"use strict";
// Function to toggle grayscale filter
function toggleGrayscale(enabled) {
    if (enabled) {
        // Apply grayscale filter
        document.documentElement.style.filter = 'grayscale(100%)';
        document.documentElement.style.transition = 'filter 0.3s ease';
    }
    else {
        // Remove grayscale filter
        document.documentElement.style.filter = 'none';
    }
}
// Check if the page is already in grayscale mode when loaded
async function initializeState() {
    try {
        const tabId = await getCurrentTabId();
        if (!tabId)
            return;
        const result = await chrome.storage.local.get(`tab_${tabId}`);
        const tabState = result[`tab_${tabId}`];
        if (tabState && tabState.isGrayscale) {
            toggleGrayscale(true);
        }
    }
    catch (error) {
        console.error('Error initializing grayscale state:', error);
    }
}
// Helper function to get current tab ID
async function getCurrentTabId() {
    // In content scripts, we can't directly access chrome.tabs API
    // So we need to use the tab ID stored by the background script
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getTabId' }, (response) => {
            resolve(response === null || response === void 0 ? void 0 : response.tabId);
        });
    });
}
// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleGrayscale') {
        toggleGrayscale(message.isGrayscale);
        sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async responses
});
// Initialize state when the content script loads
document.addEventListener('DOMContentLoaded', initializeState);
// For pages that might already be loaded when the extension activates
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeState();
}
