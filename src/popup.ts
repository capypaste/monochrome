// Get DOM elements
const applyToAllTabsCheckbox = document.getElementById('applyToAllTabs') as HTMLInputElement;
const toggleCurrentTabButton = document.getElementById('toggleCurrentTab') as HTMLButtonElement;

// Load initial state
async function initializePopup(): Promise<void> {
  // Get global settings
  const result = await chrome.storage.local.get('globalSettings');
  const globalSettings = result.globalSettings || { applyToAllTabs: false };
  
  // Set checkbox state based on stored preference
  applyToAllTabsCheckbox.checked = globalSettings.applyToAllTabs;
}

// Handle checkbox change
applyToAllTabsCheckbox.addEventListener('change', async () => {
  // Save preference
  await chrome.storage.local.set({
    globalSettings: { applyToAllTabs: applyToAllTabsCheckbox.checked }
  });
  
  // Notify background script to apply changes
  chrome.runtime.sendMessage({
    action: 'updateGlobalSetting',
    applyToAllTabs: applyToAllTabsCheckbox.checked
  });
});

// Handle toggle button click
toggleCurrentTabButton.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.runtime.sendMessage({
      action: 'toggleCurrentTab',
      tabId: tab.id
    });
  }
  window.close(); // Close popup after action
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);