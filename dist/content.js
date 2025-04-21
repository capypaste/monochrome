"use strict";
/**
 * Monochrome Extension - Content Script
 *
 * This script manages the application of grayscale filters to web pages.
 * It handles:
 * 1. Applying/removing grayscale filter via CSS classes
 * 2. Dynamic content through mutation observers
 * 3. Cross-frame grayscale application where possible
 * 4. Communication with the background script
 */
//=============================================================================
// STATE MANAGEMENT
//=============================================================================
// Track our observer instance for dynamic content
let mutationObserver = null;
//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================
/**
 * Debounce function to limit how often a function is called
 * Improves performance for frequently triggered events
 *
 * @param func - The function to debounce
 * @param waitFor - Milliseconds to wait before executing
 * @returns Debounced function
 */
function debounce(func, waitFor) {
    let timeout = null;
    return function (...args) {
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), waitFor);
    };
}
/**
 * Get the tab ID for the current content script context
 * (We can't access chrome.tabs API directly from content scripts)
 *
 * @returns Promise resolving to the tab ID or undefined if unavailable
 */
async function getCurrentTabId() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getTabId' }, (response) => {
            resolve(response === null || response === void 0 ? void 0 : response.tabId);
        });
    });
}
//=============================================================================
// GRAYSCALE MANAGEMENT
//=============================================================================
/**
 * Apply or remove grayscale filter to the entire page
 *
 * @param enabled - Whether grayscale should be enabled
 */
function toggleGrayscale(enabled) {
    console.log(`Content script applying grayscale: ${enabled}`);
    if (enabled) {
        // Apply grayscale using a class for better performance
        document.documentElement.classList.add('monochrome-enabled');
        // Monitor for dynamic content that needs grayscale applied
        setupMutationObserver();
    }
    else {
        // Remove grayscale class
        document.documentElement.classList.remove('monochrome-enabled');
        // Stop monitoring for content changes when grayscale is disabled
        disconnectMutationObserver();
    }
}
//=============================================================================
// IFRAME & DYNAMIC CONTENT HANDLING
//=============================================================================
/**
 * Apply grayscale filter to an iframe if possible
 *
 * @param iframe - The iframe element to process
 */
function applyGrayscaleToIframe(iframe) {
    try {
        // Access iframe content - this will throw an error for cross-origin frames
        const doc = iframe.contentDocument;
        if (!doc)
            return;
        // Apply grayscale filter directly to the iframe's document
        doc.documentElement.style.filter = 'grayscale(100%)';
        doc.documentElement.style.transition = 'filter 0.3s ease';
    }
    catch (e) {
        // This is normal for cross-origin iframes and not an error
        console.debug('Could not apply grayscale to cross-origin iframe');
    }
}
/**
 * Process DOM mutations to find and handle newly added iframes
 *
 * @param mutations - The list of mutations from MutationObserver
 */
function processMutations(mutations) {
    mutations.forEach((mutation) => {
        if (mutation.type !== 'childList')
            return;
        mutation.addedNodes.forEach((node) => {
            // Apply grayscale to any newly added iframes
            if (node instanceof HTMLIFrameElement) {
                applyGrayscaleToIframe(node);
            }
        });
    });
}
/**
 * Set up observer to handle dynamically added content like iframes
 * This is essential for Single Page Applications and dynamic websites
 */
function setupMutationObserver() {
    // Don't create multiple observers
    if (mutationObserver)
        return;
    // Create a debounced processor to improve performance
    const processAddedNodesDebounced = debounce(processMutations, 50);
    // Create and store the observer
    mutationObserver = new MutationObserver((mutations) => {
        processAddedNodesDebounced(mutations);
    });
    // Start observing if body is available
    if (document.body) {
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        return;
    }
    // If body isn't available yet (rare), wait for it to be created
    const bodyObserver = new MutationObserver(() => {
        if (!document.body)
            return;
        // Once body exists, observe it and disconnect this temporary observer
        mutationObserver === null || mutationObserver === void 0 ? void 0 : mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        bodyObserver.disconnect();
    });
    // Watch for body to be added to document
    bodyObserver.observe(document.documentElement, { childList: true });
}
/**
 * Clean up the mutation observer when grayscale is disabled
 */
function disconnectMutationObserver() {
    if (!mutationObserver)
        return;
    mutationObserver.disconnect();
    mutationObserver = null;
}
//=============================================================================
// STATE INITIALIZATION
//=============================================================================
/**
 * Initialize the grayscale state based on stored settings
 * Retries automatically if tab ID can't be retrieved
 */
async function initializeState() {
    var _a;
    try {
        console.log('Content script initializing...');
        // Get tab ID from background script
        const tabId = await getCurrentTabId();
        if (!tabId) {
            console.warn('Could not get tab ID, retrying in 500ms');
            setTimeout(initializeState, 500);
            return;
        }
        // Retrieve grayscale state for this tab
        console.log(`Got tab ID: ${tabId}, checking grayscale state`);
        const result = await chrome.storage.local.get(`tab_${tabId}`);
        const tabState = result[`tab_${tabId}`];
        // Apply the stored state
        const isGrayscale = (_a = tabState === null || tabState === void 0 ? void 0 : tabState.isGrayscale) !== null && _a !== void 0 ? _a : false;
        console.log(`Tab should be ${isGrayscale ? 'grayscale' : 'normal'}`);
        toggleGrayscale(isGrayscale);
    }
    catch (error) {
        console.error('Error initializing grayscale state:', error);
        // Retry after a delay if there was an error
        setTimeout(initializeState, 500);
    }
}
//=============================================================================
// MESSAGE HANDLING
//=============================================================================
/**
 * Listen for messages from the background script
 * Handles commands like toggling grayscale state
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleGrayscale') {
        console.log(`Received toggle message with grayscale: ${message.isGrayscale}`);
        // Apply grayscale immediately
        toggleGrayscale(message.isGrayscale);
        // Ensure the UI updates immediately with requestAnimationFrame
        // This prevents any visual delay in applying the filter
        requestAnimationFrame(() => {
            document.documentElement.style.filter = message.isGrayscale ? 'grayscale(100%)' : 'none';
        });
        sendResponse({ success: true });
    }
    // Keep the message channel open for async responses
    return true;
});
//=============================================================================
// INITIALIZATION
//=============================================================================
/**
 * Self-executing initialization function
 * Runs as soon as the content script is injected
 */
(function () {
    console.log('Content script starting initialization');
    // Add stylesheet immediately to prevent flash of unstyled content
    // This defines the monochrome-enabled class used for grayscale
    const style = document.createElement('style');
    style.id = 'monochrome-temp-styles';
    style.textContent = `
    html.monochrome-enabled {
      filter: grayscale(100%) !important;
      -webkit-filter: grayscale(100%) !important;
      transition: filter 0.3s ease !important;
    }
  `;
    (document.head || document.documentElement).appendChild(style);
    // Initialize state immediately
    initializeState();
    // Also initialize on DOMContentLoaded as a fallback
    // This ensures grayscale is applied even if the script loads late
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded event fired, ensuring grayscale is applied');
        initializeState();
    });
})();
