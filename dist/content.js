"use strict";
// Track our observer instance for dynamic content
let mutationObserver = null;
// Simple debounce function to improve performance
function debounce(func, waitFor) {
    let timeout = null;
    return function (...args) {
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), waitFor);
    };
}
// Function to toggle grayscale filter
function toggleGrayscale(enabled) {
    console.log(`Content script applying grayscale: ${enabled}`);
    // Apply or remove filter immediately to the root document
    if (enabled) {
        // Apply grayscale using a class for better performance
        document.documentElement.classList.add('monochrome-enabled');
        // Also use direct style for legacy support
        document.documentElement.style.filter = 'grayscale(100%)';
        document.documentElement.style.transition = 'filter 0.3s ease';
        // Also apply to all iframes in the document
        applyToAllIframes(true);
        // Setup observer for SPAs and dynamically loaded content
        setupMutationObserver();
    }
    else {
        // Remove grayscale class
        document.documentElement.classList.remove('monochrome-enabled');
        // Also remove direct style
        document.documentElement.style.filter = 'none';
        // Also apply to all iframes in the document
        applyToAllIframes(false);
        // Clean up observer when not needed
        disconnectMutationObserver();
    }
}
// Helper function to apply grayscale to all existing iframes
function applyToAllIframes(enabled) {
    const iframes = document.querySelectorAll('iframe');
    console.log(`Applying grayscale to ${iframes.length} existing iframes`);
    iframes.forEach(iframe => {
        try {
            if (iframe.contentDocument) {
                iframe.contentDocument.documentElement.style.filter = enabled ? 'grayscale(100%)' : 'none';
                iframe.contentDocument.documentElement.style.transition = 'filter 0.3s ease';
            }
        }
        catch (e) {
            // Cross-origin iframe - can't modify directly
            console.debug('Could not apply grayscale to cross-origin iframe');
        }
    });
}
// Set up observer to handle dynamically added content
function setupMutationObserver() {
    if (mutationObserver)
        return; // Already observing
    // Process iframes that might have been added
    const processAddedIframes = (node) => {
        // Look for added iframes
        if (node instanceof HTMLIFrameElement) {
            try {
                // Try to access iframe content if same-origin
                if (node.contentDocument) {
                    node.contentDocument.documentElement.style.filter = 'grayscale(100%)';
                    node.contentDocument.documentElement.style.transition = 'filter 0.3s ease';
                }
            }
            catch (e) {
                // Cross-origin iframe - can't modify directly
                console.debug('Could not apply grayscale to cross-origin iframe');
            }
        }
    };
    // Debounce the processing to improve performance on complex pages
    const processAddedNodesDebounced = debounce((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(processAddedIframes);
            }
        });
    }, 50); // 50ms debounce time
    const observer = new MutationObserver((mutations) => {
        processAddedNodesDebounced(mutations);
    });
    // Store the observer reference
    mutationObserver = observer;
    // Start observing the document with the configured parameters
    // Make sure body exists before observing
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    else {
        // If body isn't available yet, wait for it
        const bodyObserver = new MutationObserver(() => {
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                bodyObserver.disconnect();
            }
        });
        bodyObserver.observe(document.documentElement, { childList: true });
    }
}
// Clean up observer when grayscale is disabled
function disconnectMutationObserver() {
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
}
// Check if the page is already in grayscale mode when loaded
async function initializeState() {
    try {
        console.log('Content script initializing...');
        // Get tab ID without any delay
        const tabId = await getCurrentTabId();
        if (!tabId) {
            console.warn('Could not get tab ID, retrying in 500ms');
            setTimeout(initializeState, 500);
            return;
        }
        console.log(`Got tab ID: ${tabId}, checking grayscale state`);
        const result = await chrome.storage.local.get(`tab_${tabId}`);
        const tabState = result[`tab_${tabId}`];
        if (tabState && tabState.isGrayscale) {
            console.log('Tab should be grayscale, applying filter immediately');
            toggleGrayscale(true);
        }
        else {
            console.log('Tab should be normal (not grayscale)');
            // Ensure it's not grayscale
            toggleGrayscale(false);
        }
    }
    catch (error) {
        console.error('Error initializing grayscale state:', error);
        // If getting the tab ID fails, try again after a short delay
        setTimeout(initializeState, 500);
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
        console.log(`Received toggle message with grayscale: ${message.isGrayscale}`);
        // Apply grayscale immediately
        toggleGrayscale(message.isGrayscale);
        // Make sure the UI reflects the change right away
        requestAnimationFrame(() => {
            document.documentElement.style.filter = message.isGrayscale ? 'grayscale(100%)' : 'none';
        });
        sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async responses
});
// Apply grayscale immediately to prevent flash of unstyled content
function injectInitialCSS() {
    // First check if we need to be in grayscale mode
    chrome.storage.local.get(null, (result) => {
        // Try to get the current tab ID using the sender info from the background script
        chrome.runtime.sendMessage({ action: 'getTabId' }, (response) => {
            if (response && response.tabId) {
                const tabState = result[`tab_${response.tabId}`];
                if (tabState && tabState.isGrayscale) {
                    // Add the class to the HTML element immediately before any content renders
                    document.documentElement.classList.add('monochrome-enabled');
                    console.log('Added monochrome-enabled class at document_start');
                    // Also use inline style as a fallback
                    document.documentElement.style.filter = 'grayscale(100%)';
                    document.documentElement.style.webkitFilter = 'grayscale(100%)';
                    document.documentElement.style.transition = 'filter 0.3s ease';
                    // For very early rendering, also create a direct stylesheet
                    const style = document.createElement('style');
                    style.textContent = `
            :root { 
              filter: grayscale(100%) !important; 
              -webkit-filter: grayscale(100%) !important;
              transition: filter 0.3s ease !important;
            }
          `;
                    style.id = 'monochrome-grayscale-styles';
                    // Insert at the earliest possible moment
                    (document.head || document.documentElement).appendChild(style);
                }
            }
        });
    });
}
// Run this immediately, don't wait for any events
injectInitialCSS();
// Initialize state as early as possible
initializeState();
// Also catch the DOMContentLoaded event as a backup
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired, ensuring grayscale is applied');
    initializeState();
});
// For pages that might already be loaded when the extension activates
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('Page already loaded, initializing immediately');
    initializeState();
}
