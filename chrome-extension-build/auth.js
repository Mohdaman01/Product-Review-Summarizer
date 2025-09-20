// Authentication popup logic
class AuthManager {
    constructor() {
        this.firebaseService = window.firebaseService;
        this.currentTab = 'login';
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthState();
    }

    bindEvents() {
        // Tab switching
        document.getElementById('loginTab').addEventListener('click', () => this.switchTab('login'));
        document.getElementById('signupTab').addEventListener('click', () => this.switchTab('signup'));

        // Form submissions
        document.getElementById('loginBtn').addEventListener('click', (e) => this.handleLogin(e));
        document.getElementById('signupBtn').addEventListener('click', (e) => this.handleSignup(e));
        
        // Google auth
        document.getElementById('googleLoginBtn').addEventListener('click', () => this.handleGoogleAuth());
        document.getElementById('googleSignupBtn').addEventListener('click', () => this.handleGoogleAuth());

        // Profile actions
        document.getElementById('signOutBtn').addEventListener('click', () => this.handleSignOut());
        document.getElementById('upgradeBtn').addEventListener('click', () => this.handleUpgrade());
        document.getElementById('viewHistoryBtn').addEventListener('click', () => this.viewHistory());

        // Form validation on input
        ['loginEmail', 'loginPassword', 'signupName', 'signupEmail', 'signupPassword', 'signupPasswordConfirm']
            .forEach(id => {
                document.getElementById(id).addEventListener('input', () => this.clearFieldError(id));
            });

        // Listen for auth state changes from Firebase
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'authStateChanged') {
                this.updateUI(message.user, message.profile);
            }
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tab + 'Tab').classList.add('active');
        
        // Show/hide forms
        document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
        document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
    }

    async checkAuthState() {
        if (this.firebaseService.isAuthenticated()) {
            await this.firebaseService.loadUserProfile();
            this.showProfileState();
        } else {
            this.showLoginState();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!this.validateLoginForm(email, password)) return;
        
        this.showLoading(true);
        
        const result = await this.firebaseService.signInWithEmail(email, password);
        
        if (result.success) {
            this.showProfileState();
        } else {
            this.showError('loginPassword', result.error);
        }
        
        this.showLoading(false);
    }

    async handleSignup(e) {
        e.preventDefault();
        
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupPasswordConfirm').value;
        
        if (!this.validateSignupForm(name, email, password, confirmPassword)) return;
        
        this.showLoading(true);
        
        const result = await this.firebaseService.signUpWithEmail(email, password, name);
        
        if (result.success) {
            this.showProfileState();
        } else {
            this.showError('signupEmail', result.error);
        }
        
        this.showLoading(false);
    }

    async handleGoogleAuth() {
        this.showLoading(true);
        
        const result = await this.firebaseService.signInWithGoogle();
        
        if (result.success) {
            this.showProfileState();
        } else {
            this.showError('loginPassword', result.error);
        }
        
        this.showLoading(false);
    }

    async handleSignOut() {
        this.showLoading(true);
        
        await this.firebaseService.signOut();
        this.showLoginState();
        
        this.showLoading(false);
    }

    async handleUpgrade() {
        // In production, integrate with Stripe or similar
        try {
            // Simulate payment processing
            const paymentInfo = {
                transactionId: 'txn_' + Date.now(),
                amount: 4.99,
                currency: 'USD'
            };

            this.showLoading(true);
            
            const result = await this.firebaseService.upgradeToPro(paymentInfo);
            
            if (result.success) {
                this.updateUsageDisplay();
                alert('Successfully upgraded to Pro!');
            } else {
                alert('Upgrade failed: ' + result.error);
            }
        } catch (error) {
            alert('Payment processing error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async viewHistory() {
        try {
            const summaries = await this.firebaseService.getUserSummaries(20);
            
            // Create a simple history popup
            const historyWindow = window.open('', 'history', 'width=600,height=400,scrollbars=yes');
            const historyHtml = this.generateHistoryHTML(summaries);
            
            historyWindow.document.write(historyHtml);
            historyWindow.document.close();
        } catch (error) {
            alert('Error loading history: ' + error.message);
        }
    }

    generateHistoryHTML(summaries) {
        const summaryItems = summaries.map(summary => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px;">${summary.productInfo.title}</h3>
                <p style="color: #666; font-size: 14px; margin: 4px 0;">
                    Site: ${summary.productInfo.site} | 
                    Reviews: ${summary.summary.totalReviews} | 
                    Rating: ${summary.summary.avgRating}
                </p>
                <p style="color: #666; font-size: 12px;">
                    ${summary.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                </p>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Summary History</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
                    h1 { color: #374151; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <h1>Your Summary History</h1>
                ${summaryItems.length > 0 ? summaryItems : '<p>No summaries yet. Start by analyzing some reviews!</p>'}
            </body>
            </html>
        `;
    }

    validateLoginForm(email, password) {
        let isValid = true;

        if (!email) {
            this.showError('loginEmail', 'Email is required');
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showError('loginEmail', 'Please enter a valid email address');
            isValid = false;
        }

        if (!password) {
            this.showError('loginPassword', 'Password is required');
            isValid = false;
        }

        return isValid;
    }

    validateSignupForm(name, email, password, confirmPassword) {
        let isValid = true;

        if (!name) {
            this.showError('signupName', 'Full name is required');
            isValid = false;
        }

        if (!email) {
            this.showError('signupEmail', 'Email is required');
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showError('signupEmail', 'Please enter a valid email address');
            isValid = false;
        }

        if (!password) {
            this.showError('signupPassword', 'Password is required');
            isValid = false;
        } else if (password.length < 6) {
            this.showError('signupPassword', 'Password must be at least 6 characters long');
            isValid = false;
        }

        if (password !== confirmPassword) {
            this.showError('signupPasswordConfirm', 'Passwords do not match');
            isValid = false;
        }

        return isValid;
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(fieldId + 'Error');
        
        field.closest('.form-group').classList.add('error');
        errorDiv.textContent = message;
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(fieldId + 'Error');
        
        field.closest('.form-group').classList.remove('error');
        errorDiv.textContent = '';
    }

    showLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
    }

    showLoginState() {
        document.getElementById('loginState').classList.remove('hidden');
        document.getElementById('profileState').classList.add('hidden');
    }

    showProfileState() {
        document.getElementById('loginState').classList.add('hidden');
        document.getElementById('profileState').classList.remove('hidden');
        this.updateProfileDisplay();
    }

    updateUI(user, profile) {
        if (user && profile) {
            this.showProfileState();
        } else {
            this.showLoginState();
        }
    }

    updateProfileDisplay() {
        const profile = this.firebaseService.userProfile;
        const user = this.firebaseService.currentUser;
        
        if (!user || !profile) return;

        // Update user info
        document.getElementById('userName').textContent = profile.displayName || 'User';
        document.getElementById('userEmail').textContent = user.email;
        
        // Update avatar
        const avatar = document.getElementById('userAvatar');
        if (user.photoURL) {
            avatar.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;">`;
        } else {
            avatar.textContent = (profile.displayName || 'User')[0].toUpperCase();
        }

        // Update pro status
        const proStatus = document.getElementById('proStatus');
        const upgradeSection = document.getElementById('upgradeSection');
        
        if (this.firebaseService.isPro()) {
            proStatus.classList.remove('hidden');
            upgradeSection.style.display = 'none';
        } else {
            proStatus.classList.add('hidden');
            upgradeSection.style.display = 'block';
        }

        this.updateUsageDisplay();
    }

    updateUsageDisplay() {
        const profile = this.firebaseService.userProfile;
        const remaining = this.firebaseService.getRemainingUsage();
        
        if (!profile) return;

        document.getElementById('totalUsage').textContent = profile.monthlySummariesUsed || 0;
        document.getElementById('monthlyRemaining').textContent = 
            remaining.monthly === 'unlimited' ? '∞' : remaining.monthly;
        document.getElementById('dailyRemaining').textContent = 
            remaining.daily === 'unlimited' ? '∞' : remaining.daily;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    setTimeout(() => {
        new AuthManager();
    }, 500);
});