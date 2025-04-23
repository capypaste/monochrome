// State management for the extension
interface TabState {
  isGrayscale: boolean;
}

interface GlobalSettings {
  applyToAllTabs: boolean;
  globalGrayscaleState?: boolean;
}

// Helper function to update extension button based on grayscale state
async function updateIcon(tabId: number | undefined, isGrayscale: boolean): Promise<void> {
  if (tabId === undefined) return;

  try {
    await chrome.action.setBadgeText({
      tabId: tabId,
      text: isGrayscale ? 'ON' : ''
    });

    await chrome.action.setBadgeBackgroundColor({
      tabId: tabId,
      color: isGrayscale ? '#4CAF50' : '#CCCCCC'
    });

    await chrome.action.setTitle({
      tabId: tabId,
      title: isGrayscale ? 'Monochrome: Grayscale Enabled (click to disable)' : 'Monochrome: Click to enable grayscale'
    });
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Function to apply grayscale to a specific tab with retries
async function applyGrayscaleToTab(tabId: number, isGrayscale: boolean, retries: number = 3, delay: number = 200): Promise<void> {
  if (!tabId) return;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Applying grayscale to tab ${tabId}, attempt ${attempt}: isGrayscale=${isGrayscale}`);
      await chrome.storage.local.set({ [`tab_${tabId}`]: { isGrayscale } });
      await updateIcon(tabId, isGrayscale);

      try {
        await chrome.tabs.sendMessage(tabId, { 
          action: 'toggleGrayscale', 
          isGrayscale: isGrayscale 
        });
        return; // Success, exit retry loop
      } catch (err) {
        console.warn(`Could not send message to content script for tab ${tabId}:`, err);

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (enabled: boolean) => {
              document.documentElement.style.filter = enabled ? 'grayscale(100%)' : 'none';
              document.documentElement.style.transition = 'filter 0.3s ease';
            },
            args: [isGrayscale]
          });
          return; // Success, exit retry loop
        } catch (scriptErr) {
          console.warn(`Could not execute script for tab ${tabId}:`, scriptErr);
        }
      }
    } catch (error) {
      console.error(`Error applying grayscale to tab ${tabId}, attempt ${attempt}:`, error);
    }

    if (attempt < retries) {
      console.log(`Retrying grayscale application for tab ${tabId} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.warn(`Failed to apply grayscale to tab ${tabId} after ${retries} attempts`);
}

// Function to apply grayscale to all tabs
async function applyGrayscaleToAllTabs(isGrayscale: boolean): Promise<void> {
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
  } catch (error) {
    console.error('Error applying grayscale to all tabs:', error);
  }
}

// Initialize extension state when installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Monochrome extension installed.');

  const result = await chrome.storage.local.get('globalSettings');
  if (!result.globalSettings) {
    await chrome.storage.local.set({
      globalSettings: {
        applyToAllTabs: false,
        globalGrayscaleState: false
      }
    });
  }
});

// Function to toggle grayscale for the current tab
async function toggleGrayscaleForTab(tabId: number): Promise<void> {
  if (!tabId) return;
  try {
    const settingsResult = await chrome.storage.local.get('globalSettings');
    const globalSettings: GlobalSettings = settingsResult.globalSettings || { 
      applyToAllTabs: false,
      globalGrayscaleState: false
    };

    let newState: boolean;
    if (globalSettings.applyToAllTabs) {
      newState = !globalSettings.globalGrayscaleState;
      await chrome.storage.local.set({
        globalSettings: { 
          applyToAllTabs: true, 
          globalGrayscaleState: newState 
        }
      });
      console.log('Apply to all tabs is enabled, toggling global state to:', newState);
      await applyGrayscaleToAllTabs(newState);
    } else {
      const result = await chrome.storage.local.get(`tab_${tabId}`);
      const tabState: TabState = result[`tab_${tabId}`] || { isGrayscale: false };
      newState = !tabState.isGrayscale;
      console.log(`Toggling tab ${tabId} to grayscale state: ${newState}`);
      await applyGrayscaleToTab(tabId, newState);
    }
  } catch (error) {
    console.error('Error toggling grayscale:', error);
  }
}

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await toggleGrayscaleForTab(tab.id);
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTabId' && sender.tab) {
    sendResponse({ tabId: sender.tab.id });
    return true;
  }

  if (message.action === 'updateGlobalSetting') {
    (async () => {
      try {
        console.log('Updating global setting:', message.applyToAllTabs);
        const settingsResult = await chrome.storage.local.get('globalSettings');
        let globalSettings: GlobalSettings = settingsResult.globalSettings || { 
          applyToAllTabs: false,
          globalGrayscaleState: false
        };

        if (message.applyToAllTabs) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          let activeTabState = { isGrayscale: false };
          if (tabs.length > 0 && tabs[0].id) {
            const result = await chrome.storage.local.get(`tab_${tabs[0].id}`);
            activeTabState = result[`tab_${tabs[0].id}`] || { isGrayscale: false };
          }
          globalSettings = {
            applyToAllTabs: true,
            globalGrayscaleState: activeTabState.isGrayscale
          };
          await chrome.storage.local.set({ globalSettings });
          console.log('Applying global grayscale state to all tabs:', activeTabState.isGrayscale);
          await applyGrayscaleToAllTabs(activeTabState.isGrayscale);
        } else {
          globalSettings = { applyToAllTabs: false };
          await chrome.storage.local.set({ globalSettings });
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error updating global setting:', error);
        sendResponse({ success: false, error });
      }
    })();
    return true;
  }

  if (message.action === 'toggleCurrentTab' && message.tabId) {
    (async () => {
      await toggleGrayscaleForTab(message.tabId);
      sendResponse({ success: true });
    })();
    return true;
  }

  return true;
});

// Update icon when switching tabs to reflect the current state
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const settingsResult = await chrome.storage.local.get('globalSettings');
    const globalSettings: GlobalSettings = settingsResult.globalSettings || { 
      applyToAllTabs: false,
      globalGrayscaleState: false
    };

    if (globalSettings.applyToAllTabs && activeInfo.tabId) {
      await applyGrayscaleToTab(activeInfo.tabId, globalSettings.globalGrayscaleState || false);
    } else {
      const result = await chrome.storage.local.get(`tab_${activeInfo.tabId}`);
      const tabState = result[`tab_${activeInfo.tabId}`];
      await updateIcon(activeInfo.tabId, tabState?.isGrayscale || false);
    }
  } catch (error) {
    console.error('Error updating icon on tab switch:', error);
  }
});

// Update icon and state when navigating to a new page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.id) {
    try {
      const settingsResult = await chrome.storage.local.get('globalSettings');
      const globalSettings: GlobalSettings = settingsResult.globalSettings || { 
        applyToAllTabs: false,
        globalGrayscaleState: false
      };

      if (globalSettings.applyToAllTabs) {
        console.log(`Tab ${tabId} updated, applying global grayscale state: ${globalSettings.globalGrayscaleState}`);
        await applyGrayscaleToTab(tabId, globalSettings.globalGrayscaleState || false);
      } else {
        const result = await chrome.storage.local.get(`tab_${tabId}`);
        const tabState = result[`tab_${tabId}`];
        await updateIcon(tabId, tabState?.isGrayscale || false);
      }
    } catch (error) {
      console.error('Error updating tab on page load:', error);
    }
  }
});

// Apply global grayscale state to new tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    const settingsResult = await chrome.storage.local.get('globalSettings');
    const globalSettings: GlobalSettings = settingsResult.globalSettings || { 
      applyToAllTabs: false,
      globalGrayscaleState: false
    };

    if (globalSettings.applyToAllTabs) {
      console.log(`New tab ${tab.id} created, applying global grayscale state: ${globalSettings.globalGrayscaleState}`);
      // Apply with retries to ensure tab is ready
      await applyGrayscaleToTab(tab.id, globalSettings.globalGrayscaleState || false, 3, 200);
    }
  } catch (error) {
    console.error('Error handling new tab creation:', error);
  }
});

// Clean up tab state when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tab_${tabId}`);
});