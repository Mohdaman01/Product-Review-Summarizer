// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,    
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    increment,
    serverTimestamp,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Your Firebase config (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyBK-JMNRbjTF5clagEp47CR1UjG4NLPzIs",
  authDomain: "review-summarizer-pro.firebaseapp.com",
  projectId: "review-summarizer-pro",
  storageBucket: "review-summarizer-pro.firebasestorage.app",
  messagingSenderId: "24027932284",
  appId: "1:24027932284:web:554c1d917d6ef78c114bf9",
  measurementId: "G-G80PTLDFX2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

class FirebaseService {
    constructor() {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.userProfile = null;
        
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            if (user) {
                this.loadUserProfile();
            } else {
                this.userProfile = null;
            }
            this.notifyAuthStateChange(user);
        });
    }

    // Authentication Methods
    async signInWithEmail(email, password) {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            await this.updateLastLogin();
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    async signUpWithEmail(email, password, displayName) {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            
            // Create user profile in Firestore
            await this.createUserProfile(result.user, displayName);
            
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    async signInWithGoogle() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            
            // Check if user profile exists, create if not
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (!userDoc.exists()) {
                await this.createUserProfile(result.user, result.user.displayName);
            } else {
                await this.updateLastLogin();
            }
            
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    async signOut() {
        try {
            await signOut(auth);
            this.userProfile = null;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // User Profile Management
    async createUserProfile(user, displayName) {
        const userProfile = {
            uid: user.uid,
            email: user.email,
            displayName: displayName || user.displayName || 'User',
            photoURL: user.photoURL || null,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            
            // Subscription details
            subscriptionTier: 'free',
            subscriptionStatus: 'active',
            subscriptionStartDate: serverTimestamp(),
            subscriptionEndDate: null,
            
            // Usage tracking
            totalSummariesGenerated: 0,
            monthlySummariesUsed: 0,
            lastMonthlyReset: serverTimestamp(),
            
            // Limits
            monthlyLimit: 5,
            dailyLimit: 2,
            todaySummariesUsed: 0,
            lastDailyReset: serverTimestamp(),
            
            // Settings
            preferences: {
                autoAnalyze: false,
                showNotifications: true,
                theme: 'light',
                defaultSummaryLength: 'medium'
            }
        };

        await setDoc(doc(db, 'users', user.uid), userProfile);
        this.userProfile = userProfile;
        return userProfile;
    }

    async loadUserProfile() {
        if (!this.currentUser) return null;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                this.userProfile = { id: userDoc.id, ...userDoc.data() };
                await this.checkAndResetLimits();
                return this.userProfile;
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
        return null;
    }

    async updateUserProfile(updates) {
        if (!this.currentUser) throw new Error('User not authenticated');
        
        try {
            await updateDoc(doc(db, 'users', this.currentUser.uid), {
                ...updates,
                updatedAt: serverTimestamp()
            });
            
            // Update local profile
            this.userProfile = { ...this.userProfile, ...updates };
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Usage Tracking
    async canGenerateSummary() {
        if (!this.userProfile) return false;
        
        // Pro users have unlimited access
        if (this.userProfile.subscriptionTier === 'pro') {
            return true;
        }
        
        // Check daily and monthly limits for free users
        const monthlyUsed = this.userProfile.monthlySummariesUsed || 0;
        const todayUsed = this.userProfile.todaySummariesUsed || 0;
        
        return monthlyUsed < this.userProfile.monthlyLimit && 
               todayUsed < this.userProfile.dailyLimit;
    }

    async recordSummaryUsage() {
        if (!this.currentUser) throw new Error('User not authenticated');
        
        try {
            await updateDoc(doc(db, 'users', this.currentUser.uid), {
                totalSummariesGenerated: increment(1),
                monthlySummariesUsed: increment(1),
                todaySummariesUsed: increment(1),
                lastSummaryAt: serverTimestamp()
            });

            // Update local profile
            this.userProfile.totalSummariesGenerated++;
            this.userProfile.monthlySummariesUsed++;
            this.userProfile.todaySummariesUsed++;
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkAndResetLimits() {
        if (!this.userProfile) return;
        
        const now = new Date();
        const lastMonthlyReset = this.userProfile.lastMonthlyReset?.toDate() || new Date(0);
        const lastDailyReset = this.userProfile.lastDailyReset?.toDate() || new Date(0);
        
        const updates = {};
        
        // Reset monthly counter if it's a new month
        if (now.getMonth() !== lastMonthlyReset.getMonth() || 
            now.getFullYear() !== lastMonthlyReset.getFullYear()) {
            updates.monthlySummariesUsed = 0;
            updates.lastMonthlyReset = serverTimestamp();
        }
        
        // Reset daily counter if it's a new day
        if (now.toDateString() !== lastDailyReset.toDateString()) {
            updates.todaySummariesUsed = 0;
            updates.lastDailyReset = serverTimestamp();
        }
        
        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'users', this.currentUser.uid), updates);
            Object.assign(this.userProfile, updates);
        }
    }

    // Summary History
    async saveSummary(summaryData, productInfo) {
        if (!this.currentUser) throw new Error('User not authenticated');
        
        try {
            const summaryDoc = {
                userId: this.currentUser.uid,
                productInfo: {
                    title: productInfo.title || 'Unknown Product',
                    url: productInfo.url,
                    site: productInfo.site,
                    image: productInfo.image || null
                },
                summary: summaryData,
                createdAt: serverTimestamp(),
                metadata: {
                    reviewCount: summaryData.totalReviews || 0,
                    avgRating: summaryData.avgRating,
                    sentimentScore: summaryData.sentiment?.percentage || 0
                }
            };

            const docRef = await addDoc(collection(db, 'summaries'), summaryDoc);
            return { success: true, id: docRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getUserSummaries(limitCount = 10) {
        if (!this.currentUser) return [];
        
        try {
            const q = query(
                collection(db, 'summaries'),
                where('userId', '==', this.currentUser.uid),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
            
            const querySnapshot = await getDocs(q);
            const summaries = [];
            
            querySnapshot.forEach((doc) => {
                summaries.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return summaries;
        } catch (error) {
            console.error('Error getting user summaries:', error);
            return [];
        }
    }

    // Subscription Management
    async upgradeToPro(paymentInfo) {
        if (!this.currentUser) throw new Error('User not authenticated');
        
        try {
            // In production, validate payment with your payment processor
            
            const subscriptionEnd = new Date();
            subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // 1 month from now
            
            await updateDoc(doc(db, 'users', this.currentUser.uid), {
                subscriptionTier: 'pro',
                subscriptionStatus: 'active',
                subscriptionEndDate: subscriptionEnd,
                paymentInfo: {
                    transactionId: paymentInfo.transactionId,
                    amount: paymentInfo.amount,
                    currency: paymentInfo.currency,
                    paymentDate: serverTimestamp()
                }
            });
            
            this.userProfile.subscriptionTier = 'pro';
            this.userProfile.subscriptionStatus = 'active';
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Utility Methods
    async updateLastLogin() {
        if (!this.currentUser) return;
        
        await updateDoc(doc(db, 'users', this.currentUser.uid), {
            lastLoginAt: serverTimestamp()
        });
    }

    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'No user found with this email address.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'An account already exists with this email address.',
            'auth/weak-password': 'Password should be at least 6 characters long.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.'
        };
        
        return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
    }

    notifyAuthStateChange(user) {
        // Send message to popup/content scripts about auth state change
        if (chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'authStateChanged',
                user: user ? {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName
                } : null,
                profile: this.userProfile
            }).catch(() => {
                // Ignore errors if no listener
            });
        }
    }

    // Getters
    isAuthenticated() {
        return !!this.currentUser;
    }

    isPro() {
        return this.userProfile?.subscriptionTier === 'pro' && 
               this.userProfile?.subscriptionStatus === 'active';
    }

    getRemainingUsage() {
        if (this.isPro()) {
            return { monthly: 'unlimited', daily: 'unlimited' };
        }
        
        return {
            monthly: Math.max(0, (this.userProfile?.monthlyLimit || 5) - (this.userProfile?.monthlySummariesUsed || 0)),
            daily: Math.max(0, (this.userProfile?.dailyLimit || 2) - (this.userProfile?.todaySummariesUsed || 0))
        };
    }
}

// Create global instance
window.firebaseService = new FirebaseService();

export default window.firebaseService;