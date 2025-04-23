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
            resolve(response?.tabId);
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
        document.documentElement.classList.add('monochrome-enabled');
        setupMutationObserver();
    }
    else {
        document.documentElement.classList.remove('monochrome-enabled');
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
        const doc = iframe.contentDocument;
        if (!doc)
            return;
        doc.documentElement.style.filter = 'grayscale(100%)';
        doc.documentElement.style.transition = 'filter 0.3s ease';
    }
    catch (e) {
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
            if (node instanceof HTMLIFrameElement) {
                applyGrayscaleToIframe(node);
            }
        });
    });
}
/**
 * Set up observer to handle dynamically added content like iframes
 */
function setupMutationObserver() {
    if (mutationObserver)
        return;
    const processAddedNodesDebounced = debounce(processMutations, 50);
    mutationObserver = new MutationObserver((mutations) => {
        processAddedNodesDebounced(mutations);
    });
    if (document.body) {
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        return;
    }
    const bodyObserver = new MutationObserver(() => {
        if (!document.body)
            return;
        mutationObserver?.observe(document.body, {
            childList: true,
            subtree: true
        });
        bodyObserver.disconnect();
    });
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
 * Prioritizes globalGrayscaleState if applyToAllTabs is true
 */
async function initializeState() {
    try {
        console.log('Content script initializing...');
        const tabId = await getCurrentTabId();
        if (!tabId) {
            console.warn('Could not get tab ID, retrying in 500ms');
            setTimeout(initializeState, 500);
            return;
        }
        // Check global settings first
        const settingsResult = await chrome.storage.local.get('globalSettings');
        const globalSettings = settingsResult.globalSettings || {
            applyToAllTabs: false,
            globalGrayscaleState: false
        };
        let isGrayscale;
        if (globalSettings.applyToAllTabs) {
            // Use globalGrayscaleState for consistency
            isGrayscale = globalSettings.globalGrayscaleState ?? false;
            console.log(`Tab ${tabId} using global grayscale state: ${isGrayscale}`);
        }
        else {
            // Fall back to tab-specific state
            const result = await chrome.storage.local.get(`tab_${tabId}`);
            const tabState = result[`tab_${tabId}`];
            isGrayscale = tabState?.isGrayscale ?? false;
            console.log(`Tab ${tabId} using tab-specific state: ${isGrayscale}`);
        }
        toggleGrayscale(isGrayscale);
    }
    catch (error) {
        console.error('Error initializing grayscale state:', error);
        setTimeout(initializeState, 500);
    }
}
//=============================================================================
// MESSAGE HANDLING
//=============================================================================
/**
 * Listen for messages from the background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleGrayscale') {
        console.log(`Received toggle message with grayscale: ${message.isGrayscale}`);
        toggleGrayscale(message.isGrayscale);
        requestAnimationFrame(() => {
            document.documentElement.style.filter = message.isGrayscale ? 'grayscale(100%)' : 'none';
        });
        sendResponse({ success: true });
    }
    return true;
});
//=============================================================================
// INITIALIZATION
//=============================================================================
/**
 * Self-executing initialization function
 */
(function () {
    console.log('Content script starting initialization');
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
    initializeState();
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded event fired, ensuring grayscale is applied');
        initializeState();
    });
})();
