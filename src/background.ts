// State management for the extension
interface TabState {
  isGrayscale: boolean;
}

// Initialize tab state when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Monochrome extension installed.');
});

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    // Get current tab state from storage
    const result = await chrome.storage.local.get(`tab_${tab.id}`);
    const tabState: TabState = result[`tab_${tab.id}`] || { isGrayscale: false };

    // Toggle grayscale state
    const newState: TabState = {
      isGrayscale: !tabState.isGrayscale
    };

    // Save new state
    await chrome.storage.local.set({ [`tab_${tab.id}`]: newState });

    // Send message to content script to apply the filter
    await chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleGrayscale', 
      isGrayscale: newState.isGrayscale 
    });

    // Update icon to indicate current state (optional enhancement)
    // This would require additional icons for active/inactive states
  } catch (error) {
    console.error('Error toggling grayscale:', error);
  }
});

// Clean up tab state when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tab_${tabId}`);
});
