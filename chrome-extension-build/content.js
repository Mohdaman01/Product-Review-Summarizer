// Content script for Product Review Summarizer
// This script runs on the product pages and helps extract review data

class ReviewExtractor {
    constructor() {
        this.init();
    }

    init() {
        // Listen for messages from popup or background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'extractReviews') {
                const reviews = this.extractReviews();
                sendResponse({ reviews: reviews });
            } else if (request.action === 'checkReviews') {
                const hasReviews = this.checkForReviews();
                sendResponse({ hasReviews: hasReviews });
            } else if (request.action === 'openPopup') {
                // This action is handled by the background script, but we can add a visual cue here if needed.
            }
            // Return true to indicate you wish to send a response asynchronously
            return true;
        });

        // Add visual indicator when reviews are found
        this.addReviewIndicator();
    }

    extractReviews() {
        const hostname = window.location.hostname;
        let reviews = [];

        try {
            if (hostname.includes('amazon')) {
                reviews = this.extractAmazonReviews();
            } else if (hostname.includes('ebay')) {
                reviews = this.extractEbayReviews();
            } else if (hostname.includes('etsy')) {
                reviews = this.extractEtsyReviews();
            } else {
                // Generic review extraction
                reviews = this.extractGenericReviews();
            }
        } catch (error) {
            console.error('Error extracting reviews:', error);
        }

        return reviews.filter(review => 
            review.body && 
            review.body.trim().length > 10 &&
            review.body.trim().length < 1000
        ).slice(0, 50); // Limit to 50 reviews
    }

    extractAmazonReviews() {
        const reviews = [];
        
        // Try different Amazon review selectors
        const reviewSelectors = [
            '[data-hook="review"]',
            '.review',
            '[data-testid="reviews-section"] [data-testid="review"]'
        ];

        let reviewElements = [];
        for (const selector of reviewSelectors) {
            reviewElements = document.querySelectorAll(selector);
            if (reviewElements.length > 0) break;
        }

        reviewElements.forEach((element, index) => {
            if (index >= 50) return; // Limit processing

            try {
                // Extract rating
                const ratingElement = element.querySelector('.a-icon-alt, [class*="rating"], .cr-original-review-rating');
                let rating = '';
                if (ratingElement) {
                    const ratingText = ratingElement.textContent || ratingElement.alt || '';
                    const ratingMatch = ratingText.match(/[\d.]+/);
                    rating = ratingMatch ? ratingMatch[0] : '';
                }

                // Extract title
                const titleElement = element.querySelector('[data-hook="review-title"], .review-title, .cr-original-review-title');
                const title = titleElement ? titleElement.textContent.trim() : '';

                // Extract review body
                const bodyElement = element.querySelector('[data-hook="review-body"], .review-body, .cr-original-review-body');
                const body = bodyElement ? bodyElement.textContent.trim() : '';

                // Extract helpful votes
                const helpfulElement = element.querySelector('[data-hook="helpful-vote-statement"], .helpful-vote');
                const helpful = helpfulElement ? helpfulElement.textContent.trim() : '';

                // Extract date
                const dateElement = element.querySelector('[data-hook="review-date"], .review-date');
                const date = dateElement ? dateElement.textContent.trim() : '';

                if (body && body.length > 10) {
                    reviews.push({
                        rating: rating,
                        title: title,
                        body: body,
                        helpful: helpful,
                        date: date,
                        source: 'amazon'
                    });
                }
            } catch (error) {
                console.warn('Error extracting individual Amazon review:', error);
            }
        });

        return reviews;
    }

    extractEbayReviews() {
        const reviews = [];
        const reviewElements = document.querySelectorAll('.reviews .review-item, .ebay-review, [class*="review-"]');

        reviewElements.forEach((element, index) => {
            if (index >= 50) return;

            try {
                const ratingElement = element.querySelector('.star-rating, [class*="rating"], .stars');
                const rating = ratingElement ? ratingElement.title || ratingElement.getAttribute('aria-label') || '' : '';

                const bodyElement = element.querySelector('.review-text, .review-body, [class*="comment"]');
                const body = bodyElement ? bodyElement.textContent.trim() : '';

                const dateElement = element.querySelector('.review-date, [class*="date"]');
                const date = dateElement ? dateElement.textContent.trim() : '';

                if (body && body.length > 10) {
                    reviews.push({
                        rating: rating,
                        body: body,
                        date: date,
                        source: 'ebay'
                    });
                }
            } catch (error) {
                console.warn('Error extracting eBay review:', error);
            }
        });

        return reviews;
    }

    extractEtsyReviews() {
        const reviews = [];
        const reviewElements = document.querySelectorAll('.shop2-review-review, .listing-review, [class*="review"]');

        reviewElements.forEach((element, index) => {
            if (index >= 50) return;

            try {
                const ratingElement = element.querySelector('.rating, .stars, [class*="star"]');
                const rating = ratingElement ? ratingElement.title || ratingElement.getAttribute('aria-label') || '' : '';

                const bodyElement = element.querySelector('.review-text, .review-body');
                const body = bodyElement ? bodyElement.textContent.trim() : '';

                if (body && body.length > 10) {
                    reviews.push({
                        rating: rating,
                        body: body,
                        source: 'etsy'
                    });
                }
            } catch (error) {
                console.warn('Error extracting Etsy review:', error);
            }
        });

        return reviews;
    }

    extractGenericReviews() {
        const reviews = [];
        
        // Generic selectors for common review structures
        const reviewSelectors = [
            '[class*="review"]',
            '[class*="comment"]',
            '[class*="feedback"]',
            '[data-testid*="review"]',
            '.testimonial'
        ];

        for (const selector of reviewSelectors) {
            const elements = document.querySelectorAll(selector);
            
            elements.forEach((element, index) => {
                if (reviews.length >= 50) return;

                try {
                    const text = element.textContent.trim();
                    
                    // Skip if too short or too long
                    if (text.length < 20 || text.length > 1000) return;
                    
                    // Look for rating indicators
                    const ratingElement = element.querySelector('[class*="star"], [class*="rating"], [class*="score"]');
                    const rating = ratingElement ? ratingElement.textContent || ratingElement.title || '' : '';

                    reviews.push({
                        rating: rating,
                        body: text,
                        source: 'generic'
                    });
                } catch (error) {
                    console.warn('Error extracting generic review:', error);
                }
            });

            if (reviews.length > 0) break; // Use first successful selector
        }

        return reviews;
    }

    checkForReviews() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('amazon')) {
            return document.querySelectorAll('[data-hook="review"], .review').length > 0;
        } else if (hostname.includes('ebay')) {
            return document.querySelectorAll('.reviews .review-item, .ebay-review').length > 0;
        } else if (hostname.includes('etsy')) {
            return document.querySelectorAll('.shop2-review-review, .listing-review').length > 0;
        } else {
            // Generic check
            return document.querySelectorAll('[class*="review"], [class*="comment"]').length > 0;
        }
    }

    addReviewIndicator() {
        // Add a subtle indicator when reviews are detected
        if (this.checkForReviews()) {
            const indicator = document.createElement('div');
            indicator.id = 'review-summarizer-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: #4CAF50;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                color: white;
                z-index: 10000;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                opacity: 0.8;
                transition: opacity 0.3s;
            `;
            indicator.innerHTML = '📝';
            indicator.title = 'Click to summarize reviews';
                        
            indicator.addEventListener('click', () => {
                // Open extension popup programmatically
                chrome.runtime.sendMessage({action: 'openPopup'});
            });

            document.body.appendChild(indicator);

            // Fade the indicator after 5 seconds
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.style.opacity = '0.3';
                }
            }, 5000);
        }
    }
}

// Initialize the review extractor
new ReviewExtractor();