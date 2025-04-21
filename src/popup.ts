// Get DOM elements
const applyToAllTabsCheckbox = document.getElementById('applyToAllTabs') as HTMLInputElement;
const toggleCurrentTabButton = document.getElementById('toggleCurrentTab') as HTMLElement;
const statusIndicator = document.getElementById('statusIndicator') as HTMLElement;

// Load initial state
async function initializePopup(): Promise<void> {
  // Get global settings
  const settingsResult = await chrome.storage.local.get('globalSettings');
  const globalSettings = settingsResult.globalSettings || { 
    applyToAllTabs: false
  };
  
  // Set checkbox states based on stored preferences
  applyToAllTabsCheckbox.checked = globalSettings.applyToAllTabs;
  
  // Get current tab information
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    // Get current tab state
    const tabResult = await chrome.storage.local.get(`tab_${tab.id}`);
    const tabState = tabResult[`tab_${tab.id}`] || { isGrayscale: false };
    
    // Update status indicator
    updateStatusIndicator(tabState.isGrayscale);
  }
}

// Update the status indicator based on current grayscale state
function updateStatusIndicator(isGrayscale: boolean): void {
  if (isGrayscale) {
    statusIndicator.textContent = 'ON';
    statusIndicator.style.color = '#2196F3';
    toggleCurrentTabButton.style.borderLeft = '4px solid #2196F3';
  } else {
    statusIndicator.textContent = 'OFF';
    statusIndicator.style.color = '#888';
    toggleCurrentTabButton.style.borderLeft = '4px solid transparent';
  }
}

// Handle apply-to-all checkbox change
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
    // Get current state before toggle
    const tabResult = await chrome.storage.local.get(`tab_${tab.id}`);
    const currentState = tabResult[`tab_${tab.id}`] || { isGrayscale: false };
    
    // Update UI immediately to feel responsive
    updateStatusIndicator(!currentState.isGrayscale);
    
    // Send toggle message
    chrome.runtime.sendMessage({
      action: 'toggleCurrentTab',
      tabId: tab.id
    });
  }
});

// Listen for tab state updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'tabStateChanged' && message.tabId) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id === message.tabId) {
        updateStatusIndicator(message.isGrayscale);
      }
    });
  }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);