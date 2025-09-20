# AI Product Review Summarizer (Chrome Extension)

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

An intelligent Chrome extension that uses AI to summarize thousands of product reviews into a concise and easy-to-understand format. Save time, make smarter shopping decisions, and get the key insights without the noise.

## 🌟 Key Features

-   **AI-Powered Summaries**: Generates a comprehensive summary including:
    -   **Pros & Cons**: Key positive and negative points extracted from reviews.
    -   **Key Insights**: Identifies common themes like 'quality', 'price', 'shipping', etc.
    -   **Sentiment Analysis**: Overall sentiment score (Positive, Mixed, Negative).
    -   **Average Rating**: Calculates the average star rating.
-   **Wide Compatibility**: Works on major e-commerce sites like Amazon, eBay, and Etsy.
-   **User Authentication**: Secure sign-in/sign-up using Firebase Authentication.
-   **Cloud Sync**: Pro users can save and access their summaries across devices.
-   **Usage Tiers**: A freemium model with a limited number of free summaries and an upgrade option for unlimited access.
-   **Modern UI**: A clean, intuitive, and responsive interface.

## 📸 Screenshots

*(Placeholders for screenshots of the extension in action)*

| Initial State                               | Summary View                                |
| ------------------------------------------- | ------------------------------------------- |
| `[Image of the initial popup view]`         | `[Image of the generated summary]`          |
| **Upgrade / Pro Plan**                      | **Error / No Reviews**                      |
| `[Image of the upgrade to pro screen]`      | `[Image of the error or no reviews state]`  |

## 🛠️ Tech Stack

-   **Frontend**: HTML5, CSS3, JavaScript (ES6+)
-   **Platform**: Chrome Extension API (Manifest V3)
-   **Backend & Services**:
    -   **Firebase Authentication**: For secure user management.
    -   **Firebase Realtime Database**: To store user profiles, usage data, and saved summaries.

## 📂 Project Structure

The project is organized into logical components within the `chrome-extension-build` directory.

```
/Product Review Summarizer
└── /chrome-extension-build
    ├── manifest.json         # Core extension configuration, permissions, and scripts
    ├── popup.html            # The main popup's HTML structure
    ├── popup.js              # Logic for the popup UI, user interaction, and communication
    ├── popup.css             # Styles for the popup
    ├── background.js         # Service worker for background tasks (AI processing, API calls)
    ├── content.js            # Injected into web pages to extract review data
    ├── auth.html             # Separate page to handle the authentication flow
    ├── auth.js               # Logic for the authentication page
    ├── firebase-config.js    # Firebase project configuration keys (NEEDS to be configured)
    ├── firebase-service.js   # Handles all interactions with Firebase services
    └── /icons                # Extension icons for different resolutions
```

## 🚀 Getting Started

To set up and run this extension locally for development, follow these steps:

### 1. Prerequisites

-   A modern web browser that supports Chrome extensions (e.g., Google Chrome, Brave, Edge).
-   A Google account to set up a Firebase project.

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/product-review-summarizer.git
cd product-review-summarizer
```

### 3. Set Up Firebase

1.  Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  In your project, go to **Authentication** -> **Sign-in method** and enable **Email/Password** and **Google**.
3.  Go to **Realtime Database** (or Firestore) and create a new database. Start in **test mode** for initial development (you can secure it later with security rules).
4.  Go to your Project Settings (click the ⚙️ icon) and under "Your apps", create a new **Web app**.
5.  Copy the `firebaseConfig` object provided.

### 4. Configure the Extension

1.  Open the `chrome-extension-build/firebase-config.js` file.
2.  Paste your `firebaseConfig` object into this file, replacing the placeholder.

### 5. Load the Extension in Chrome

1.  Open your Chrome browser and navigate to `chrome://extensions`.
2.  Enable **"Developer mode"** using the toggle switch in the top-right corner.
3.  Click the **"Load unpacked"** button.
4.  Select the `chrome-extension-build` folder from this project.
5.  The "AI Review Summarizer Pro" extension should now appear in your list of extensions and in your browser's toolbar.

## 📖 How to Use

1.  Navigate to a product page on a supported site (e.g., Amazon.com).
2.  If reviews are detected, a small floating icon `📝` will appear on the page.
3.  Click the extension icon in your browser's toolbar.
4.  Sign in or create an account if prompted.
5.  Click the **"Analyze Reviews"** button.
6.  Wait for the analysis to complete and view your summary!

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features, improvements, or bug fixes, please feel free to:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourAmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/YourAmazingFeature`).
5.  Open a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.