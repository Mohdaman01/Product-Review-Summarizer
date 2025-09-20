// Simplified background script for Chrome Extension MV3
// This version focuses on core functionality without complex Firebase integration

console.log('Background script loaded');

class BackgroundService {
    constructor() {
        this.init();
    }

    init() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('Extension installed:', details.reason);
            this.handleInstallation(details);
        });

        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Message received:', request);
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Handle tab updates to detect product pages
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.checkProductPage(tab);
            }
        });
    }

    async handleInstallation(details) {
        try {
            if (details.reason === 'install') {
                console.log('First time installation');
                // Set default settings in local storage as fallback
                await chrome.storage.local.set({
                    installDate: new Date().toISOString(),
                    version: chrome.runtime.getManifest().version
                });
            } else if (details.reason === 'update') {
                console.log('Extension updated');
            }
        } catch (error) {
            console.error('Installation handling error:', error);
        }
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            console.log('Processing message:', request.action);
            
            switch (request.action) {
                case 'processReviews':
                    const result = await this.processReviews(request.reviews);
                    sendResponse({ success: true, result });
                    break;

                case 'trackEvent':
                    console.log('Event tracked:', request.event, request.data);
                    sendResponse({ success: true });
                    break;

                case 'getTabInfo':
                    const tab = await this.getCurrentTab();
                    sendResponse({ tab });
                    break;

                default:
                    console.log('Unknown action:', request.action);
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    async processReviews(reviews) {
        try {
            console.log(`Processing ${reviews.length} reviews`);
            
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Basic review processing (same as popup version)
            const summary = {
                totalReviews: reviews.length,
                avgRating: this.calculateAverageRating(reviews),
                keyInsights: this.extractKeyInsights(reviews),
                pros: this.extractPros(reviews),
                cons: this.extractCons(reviews),
                sentiment: this.calculateSentiment(reviews)
            };

            console.log('Review processing complete');
            return summary;
        } catch (error) {
            console.error('Review processing error:', error);
            throw error;
        }
    }

    calculateAverageRating(reviews) {
        const ratings = reviews
            .map(r => parseFloat(r.rating.match(/[\d.]+/)?.[0] || 0))
            .filter(r => r > 0);
        
        return ratings.length > 0 
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
            : 'N/A';
    }

    extractKeyInsights(reviews) {
        const allText = reviews.map(r => r.body + ' ' + (r.title || '')).join(' ').toLowerCase();
        const keywords = ['quality', 'price', 'shipping', 'size', 'color', 'material', 'battery', 'easy', 'difficult'];
        
        return keywords
            .map(keyword => ({
                keyword,
                count: (allText.match(new RegExp(keyword, 'g')) || []).length
            }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }

    extractPros(reviews) {
        const positiveWords = ['great', 'excellent', 'good', 'love', 'perfect', 'amazing', 'best', 'recommend'];
        const pros = [];
        
        reviews.forEach(review => {
            const sentences = review.body.split(/[.!?]+/);
            sentences.forEach(sentence => {
                const lowerSentence = sentence.toLowerCase();
                if (positiveWords.some(word => lowerSentence.includes(word)) && 
                    sentence.trim().length > 15 && sentence.trim().length < 100 && pros.length < 5) {
                    pros.push(sentence.trim());
                }
            });
        });

        return [...new Set(pros)].slice(0, 4);
    }

    extractCons(reviews) {
        const negativeWords = ['bad', 'terrible', 'poor', 'cheap', 'broken', 'defective', 'slow', 'expensive', 'disappointed'];
        const cons = [];
        
        reviews.forEach(review => {
            const sentences = review.body.split(/[.!?]+/);
            sentences.forEach(sentence => {
                const lowerSentence = sentence.toLowerCase();
                if (negativeWords.some(word => lowerSentence.includes(word)) && 
                    sentence.trim().length > 15 && sentence.trim().length < 100 && cons.length < 5) {
                    cons.push(sentence.trim());
                }
            });
        });

        return [...new Set(cons)].slice(0, 4);
    }

    calculateSentiment(reviews) {
        const positiveWords = ['great', 'excellent', 'good', 'love', 'perfect', 'amazing', 'best', 'recommend'];
        const negativeWords = ['bad', 'terrible', 'poor', 'hate', 'worst', 'awful', 'disappointed'];
        
        let positiveScore = 0;
        let negativeScore = 0;
        
        reviews.forEach(review => {
            const text = (review.body + ' ' + (review.title || '')).toLowerCase();
            positiveWords.forEach(word => {
                positiveScore += (text.match(new RegExp(word, 'g')) || []).length;
            });
            negativeWords.forEach(word => {
                negativeScore += (text.match(new RegExp(word, 'g')) || []).length;
            });
        });
        
        const total = positiveScore + negativeScore;
        const percentage = total > 0 ? (positiveScore / total) * 100 : 50;
        
        return {
            percentage: Math.round(percentage),
            label: percentage > 70 ? 'Very Positive' : 
                   percentage > 50 ? 'Positive' : 
                   percentage > 30 ? 'Mixed' : 'Negative'
        };
    }

    async checkProductPage(tab) {
        try {
            if (!tab.url) return;

            const productPagePatterns = [
                /amazon\.(com|co\.uk|de|fr|it|es|ca)\/.*\/dp\//,
                /amazon\.(com|co\.uk|de|fr|it|es|ca)\/dp\//,
                /ebay\.(com|co\.uk|de|fr|it|es|ca)\/itm\//,
                /etsy\.com\/listing\//
            ];

            const isProductPage = productPagePatterns.some(pattern => pattern.test(tab.url));

            if (isProductPage) {
                // Update badge to indicate extension is active
                await chrome.action.setBadgeText({
                    text: '•',
                    tabId: tab.id
                });
                
                await chrome.action.setBadgeBackgroundColor({
                    color: '#4CAF50',
                    tabId: tab.id
                });
            } else {
                // Clear badge for non-product pages
                await chrome.action.setBadgeText({
                    text: '',
                    tabId: tab.id
                });
            }
        } catch (error) {
            console.error('Product page check error:', error);
        }
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab;
        } catch (error) {
            console.error('Get current tab error:', error);
            return null;
        }
    }
}

// Initialize the background service
console.log('Initializing background service...');
try {
    new BackgroundService();
    console.log('Background service initialized successfully');
} catch (error) {
    console.error('Background service initialization failed:', error);
}