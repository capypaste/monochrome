"use strict";
// Helper function to update extension button based on grayscale state
async function updateIcon(tabId, isGrayscale) {
    if (tabId === undefined)
        return;
    // Use badge text instead of icon swapping
    // This avoids the "Failed to fetch" error with icon loading
    try {
        // Set badge text (ON for Grayscale enabled, empty for disabled)
        await chrome.action.setBadgeText({
            tabId: tabId,
            text: isGrayscale ? 'ON' : ''
        });
        // Set badge color
        await chrome.action.setBadgeBackgroundColor({
            tabId: tabId,
            color: isGrayscale ? '#4CAF50' : '#CCCCCC'
        });
        // Update title for accessibility
        await chrome.action.setTitle({
            tabId: tabId,
            title: isGrayscale ? 'Monochrome: Grayscale Enabled (click to disable)' : 'Monochrome: Click to enable grayscale'
        });
    }
    catch (error) {
        console.error('Error updating badge:', error);
    }
}
// Function to apply grayscale to a specific tab
async function applyGrayscaleToTab(tabId, isGrayscale) {
    if (!tabId)
        return;
    try {
        // Save tab state
        await chrome.storage.local.set({ [`tab_${tabId}`]: { isGrayscale } });
        // Update icon
        await updateIcon(tabId, isGrayscale);
        // Send message to content script to apply the filter
        try {
            await chrome.tabs.sendMessage(tabId, {
                action: 'toggleGrayscale',
                isGrayscale: isGrayscale
            });
        }
        catch (err) {
            // This may happen if the content script isn't loaded yet
            console.warn("Could not send message to content script:", err);
            // We can inject the content script programmatically if needed
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (enabled) => {
                        document.documentElement.style.filter = enabled ? 'grayscale(100%)' : 'none';
                        document.documentElement.style.transition = 'filter 0.3s ease';
                    },
                    args: [isGrayscale]
                });
            }
            catch (scriptErr) {
                // Some tabs don't allow script injection (e.g., chrome:// pages)
                console.warn("Could not execute script:", scriptErr);
            }
        }
    }
    catch (error) {
        console.error('Error applying grayscale to tab:', error);
    }
}
// Function to apply grayscale to all tabs
async function applyGrayscaleToAllTabs(isGrayscale) {
    try {
        console.log(`Applying grayscale state ${isGrayscale} to all tabs`);
        const tabs = await chrome.tabs.query({});
        console.log(`Found ${tabs.length} tabs to update`);
        for (const tab of tabs) {
            if (tab.id) {
                console.log(`Applying grayscale ${isGrayscale} to tab ${tab.id}: ${tab.title}`);
                await applyGrayscaleToTab(tab.id, isGrayscale);
            }
        }
        console.log('Successfully applied grayscale to all tabs');
    }
    catch (error) {
        console.error('Error applying grayscale to all tabs:', error);
    }
}
// Initialize extension state when installed
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Monochrome extension installed.');
    // Initialize global settings
    const result = await chrome.storage.local.get('globalSettings');
    if (!result.globalSettings) {
        await chrome.storage.local.set({
            globalSettings: {
                applyToAllTabs: false
            }
        });
    }
});
// Function to toggle grayscale for the current tab
async function toggleGrayscaleForTab(tabId) {
    if (!tabId)
        return;
    try {
        // Get current tab state from storage
        const result = await chrome.storage.local.get(`tab_${tabId}`);
        const tabState = result[`tab_${tabId}`] || { isGrayscale: false };
        // Toggle grayscale state
        const newState = !tabState.isGrayscale;
        console.log(`Toggling tab ${tabId} to grayscale state: ${newState}`);
        // Get global settings
        const settingsResult = await chrome.storage.local.get('globalSettings');
        const globalSettings = settingsResult.globalSettings || {
            applyToAllTabs: false
        };
        console.log('Global settings:', globalSettings);
        if (globalSettings.applyToAllTabs) {
            console.log('Apply to all tabs is enabled, applying to all tabs');
            // Apply to all tabs if the global setting is enabled
            await applyGrayscaleToAllTabs(newState);
        }
        else {
            console.log('Apply to all tabs is disabled, applying only to current tab');
            // Apply only to current tab
            await applyGrayscaleToTab(tabId, newState);
        }
    }
    catch (error) {
        console.error('Error toggling grayscale:', error);
    }
}
// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id)
        return;
    // Open popup if we have one configured
    // This is commented out because we want the icon click to still toggle grayscale directly
    // chrome.action.openPopup();
    await toggleGrayscaleForTab(tab.id);
});
// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle getTabId request from content scripts
    if (message.action === 'getTabId' && sender.tab) {
        sendResponse({ tabId: sender.tab.id });
        return true;
    }
    // Handle global setting update from popup
    if (message.action === 'updateGlobalSetting') {
        (async () => {
            try {
                console.log('Updating global setting:', message.applyToAllTabs);
                // Save the global setting
                await chrome.storage.local.set({
                    globalSettings: { applyToAllTabs: message.applyToAllTabs }
                });
                // Check if we should apply the current state to all tabs
                if (message.applyToAllTabs) {
                    // Get the active tab's state to apply to all tabs
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tabs.length > 0 && tabs[0].id) {
                        const result = await chrome.storage.local.get(`tab_${tabs[0].id}`);
                        const activeTabState = result[`tab_${tabs[0].id}`] || { isGrayscale: false };
                        console.log('Applying active tab state to all tabs:', activeTabState.isGrayscale);
                        // Apply the active tab's state to all tabs
                        await applyGrayscaleToAllTabs(activeTabState.isGrayscale);
                    }
                }
                sendResponse({ success: true });
            }
            catch (error) {
                console.error('Error updating global setting:', error);
                sendResponse({ success: false, error });
            }
        })();
        return true;
    }
    // Handle toggle request from popup
    if (message.action === 'toggleCurrentTab' && message.tabId) {
        (async () => {
            await toggleGrayscaleForTab(message.tabId);
            sendResponse({ success: true });
        })();
        return true;
    }
    return true; // Keep the message channel open for async responses
});
// Update icon when switching tabs to reflect the current state
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const result = await chrome.storage.local.get(`tab_${activeInfo.tabId}`);
        const tabState = result[`tab_${activeInfo.tabId}`];
        await updateIcon(activeInfo.tabId, (tabState === null || tabState === void 0 ? void 0 : tabState.isGrayscale) || false);
    }
    catch (error) {
        console.error('Error updating icon on tab switch:', error);
    }
});
// Update icon when navigating to a new page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        try {
            const result = await chrome.storage.local.get(`tab_${tabId}`);
            const tabState = result[`tab_${tabId}`];
            await updateIcon(tabId, (tabState === null || tabState === void 0 ? void 0 : tabState.isGrayscale) || false);
        }
        catch (error) {
            console.error('Error updating icon on page load:', error);
        }
    }
});
// Clean up tab state when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(`tab_${tabId}`);
});
