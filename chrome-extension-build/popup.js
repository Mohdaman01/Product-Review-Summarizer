class ReviewSummarizer {
    constructor() {
        this.currentState = 'initial';
        this.firebaseService = window.firebaseService;
        this.init();
    }

    async init() {
        // Wait for Firebase to initialize
        await this.waitForFirebase();
        await this.checkAuthState();
        this.bindEvents();
        this.updateUsageDisplay();
    }

    async waitForFirebase() {
        let attempts = 0;
        while (!window.firebaseService && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.firebaseService) {
            console.error('Firebase service not available');
            this.showAuthPrompt();
            return;
        }
        
        this.firebaseService = window.firebaseService;
    }

    async checkAuthState() {
        if (!this.firebaseService.isAuthenticated()) {
            this.showAuthPrompt();
            return;
        }

        await this.firebaseService.loadUserProfile();
        this.updateUsageDisplay();
    }

    bindEvents() {
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeReviews());
        document.getElementById('retryBtn').addEventListener('click', () => this.analyzeReviews());
        document.getElementById('newSummaryBtn').addEventListener('click', () => this.showInitialState());
        document.getElementById('upgradeBtn').addEventListener('click', () => this.handleUpgrade());
        document.getElementById('purchaseBtn').addEventListener('click', () => this.handlePurchase());
        document.getElementById('backBtn').addEventListener('click', () => this.showSummaryState());
        document.getElementById('signInBtn')?.addEventListener('click', () => this.openAuthPopup());

        // Listen for auth state changes
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'authStateChanged') {
                this.handleAuthStateChange(message.user, message.profile);
            }
        });
    }

    showAuthPrompt() {
        const authPromptHTML = `
            <div class="auth-prompt">
                <h3>🔐 Sign In Required</h3>
                <p>Please sign in to track your usage and save summaries.</p>
                <button id="signInBtn" class="btn primary large">Sign In / Sign Up</button>
            </div>
        `;
        
        document.querySelector('.content').innerHTML = authPromptHTML;
        document.getElementById('signInBtn').addEventListener('click', () => this.openAuthPopup());
        
        // Hide usage counter for unauthenticated users
        document.querySelector('.usage-counter').style.display = 'none';
    }

    openAuthPopup() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('auth.html'),
            active: true
        });
    }

    handleAuthStateChange(user, profile) {
        if (user && profile) {
            // User signed in
            this.showInitialState();
            this.updateUsageDisplay();
        } else {
            // User signed out
            this.showAuthPrompt();
        }
    }

    updateUsageDisplay() {
        if (!this.firebaseService.isAuthenticated()) {
            document.querySelector('.usage-counter').style.display = 'none';
            return;
        }

        const profile = this.firebaseService.userProfile;
        if (!profile) return;

        const remaining = this.firebaseService.getRemainingUsage();
        const usageCounter = document.querySelector('.usage-counter');
        
        if (this.firebaseService.isPro()) {
            usageCounter.innerHTML = `<span class="pro-badge">PRO</span> Unlimited summaries`;
        } else {
            usageCounter.innerHTML = `Free summaries left: <span id="usageCount">${remaining.monthly}</span>`;
        }
        
        usageCounter.style.display = 'block';
    }

    async analyzeReviews() {
        if (!this.firebaseService.isAuthenticated()) {
            this.showAuthPrompt();
            return;
        }

        // Check if user can generate summary
        const canGenerate = await this.firebaseService.canGenerateSummary();
        if (!canGenerate) {
            this.showUpgradeState();
            return;
        }

        this.showLoadingState();

        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Extract reviews from the page by messaging the content script
            const reviews = await chrome.tabs.sendMessage(tab.id, { action: 'extractReviews' }).then(res => res.reviews);

            if (!reviews || reviews.length === 0) {
                this.showNoReviewsState();
                return;
            }

            // Process reviews (send to background script for AI processing)
            const summary = await this.processReviews(reviews);
            
            // Record usage in Firebase
            await this.firebaseService.recordSummaryUsage();
            
            // Save summary to Firebase
            const productInfo = await this.extractProductInfo(tab);
            await this.firebaseService.saveSummary(summary, productInfo);
            
            // Update usage display
            this.updateUsageDisplay();

            this.showSummaryState(summary);

        } catch (error) {
            console.error('Error analyzing reviews:', error);
            this.showErrorState('Failed to analyze reviews. Please try again.');
        }
    }

    async extractProductInfo(tab) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const title = document.querySelector('h1, [id*="title"], [class*="title"]')?.textContent?.trim() || 
                                 document.title.split('-')[0].trim();
                    
                    const image = document.querySelector('img[src*="product"], img[class*="product"], img[id*="product"]')?.src ||
                                 document.querySelector('meta[property="og:image"]')?.content;
                    
                    return {
                        title: title.substring(0, 100), // Limit length
                        url: window.location.href,
                        site: window.location.hostname,
                        image: image
                    };
                }
            });
            
            return results[0].result;
        } catch (error) {
            return {
                title: 'Unknown Product',
                url: tab.url,
                site: new URL(tab.url).hostname,
                image: null
            };
        }
    }

    extractReviews() {
        // This function is intentionally left blank.
        // The logic has been moved to content.js to act as a single source of truth.
        // The popup now sends a message to the content script to extract reviews.
    }

    async processReviews(reviews) {
        try {
            // Send reviews to background script for processing
            const response = await chrome.runtime.sendMessage({
                action: 'processReviews',
                reviews: reviews
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            return response.result;
        } catch (error) {
            console.error('Background processing failed:', error);
            // No local fallback to ensure consistent processing
            throw new Error('Failed to process reviews via background service.');
        }
    }

    handleUpgrade() {
        if (this.firebaseService.isAuthenticated()) {
            this.showUpgradeState();
        } else {
            this.openAuthPopup();
        }
    }

    async handlePurchase() {
        if (!this.firebaseService.isAuthenticated()) {
            this.openAuthPopup();
            return;
        }

        try {
            // In production, integrate with Stripe or similar payment processor
            const paymentInfo = {
                transactionId: 'demo_' + Date.now(),
                amount: 4.99,
                currency: 'USD'
            };

            const result = await this.firebaseService.upgradeToPro(paymentInfo);
            
            if (result.success) {
                this.updateUsageDisplay();
                this.showSummaryState(); // Or a success message state
                alert('Successfully upgraded to Pro!');
            } else {
                alert('Upgrade failed: ' + result.error);
            }
        } catch (error) {
            alert('Payment processing error: ' + error.message);
        }
    }

    showState(stateName) {
        // Hide all states
        document.querySelectorAll('.initial-state, .loading-state, .error-state, .no-reviews-state, .summary-state, .upgrade-state')
            .forEach(el => el.classList.add('hidden'));
        
        // Show target state
        document.getElementById(stateName + 'State').classList.remove('hidden');
        this.currentState = stateName;
    }

    showInitialState() {
        this.showState('initial');
    }

    showLoadingState() {
        this.showState('loading');
    }

    showErrorState(message) {
        document.getElementById('errorMessage').textContent = message;
        this.showState('error');
    }

    showNoReviewsState() {
        this.showState('noReviews');
    }

    showSummaryState(summary) {
        if (summary) {
            this.displaySummary(summary);
        }
        this.showState('summary');
    }

    showUpgradeState() {
        this.showState('upgrade');
    }

    displaySummary(summary) {
        // Display key insights
        const insightsContainer = document.getElementById('keyInsights');
        insightsContainer.innerHTML = summary.keyInsights.map(insight => 
            `<div class="insight-item">
                <span class="keyword">${insight.keyword}</span>
                <span class="count">${insight.count}</span>
            </div>`
        ).join('');

        // Display pros
        const prosList = document.getElementById('prosList');
        prosList.innerHTML = summary.pros.map(pro => `<li>${pro}</li>`).join('');

        // Display cons
        const consList = document.getElementById('consList');
        consList.innerHTML = summary.cons.map(con => `<li>${con}</li>`).join('');

        // Display sentiment
        const sentimentFill = document.getElementById('sentimentFill');
        const sentimentText = document.getElementById('sentimentText');
        
        sentimentFill.style.width = summary.sentiment.percentage + '%';
        sentimentFill.className = `sentiment-fill ${summary.sentiment.percentage > 50 ? 'positive' : 'negative'}`;
        sentimentText.textContent = `${summary.sentiment.label} (${summary.sentiment.percentage}%)`;
    }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
    // Load Firebase config first
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'firebase-config.js';
    script.onload = () => {
        // Wait for Firebase to initialize, then create ReviewSummarizer
        setTimeout(() => {
            new ReviewSummarizer();
        }, 1000);
    };
    document.head.appendChild(script);
});