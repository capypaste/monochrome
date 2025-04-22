describe('New tab behavior with global settings', () => {
  // Mock tab objects for testing
  let mockTabs = [
    { id: 1, url: 'https://example.com/page1', title: 'Example Page 1', active: true, currentWindow: true }
  ];

  // Mock storage for tab states and global settings
  let mockStorage = {
    tabStates: {},
    globalSettings: { applyToAllTabs: false }
  };

  // Mock Chrome API
  global.chrome = {
    tabs: {
      query: jest.fn().mockImplementation(async (queryInfo) => {
        if (queryInfo.active && queryInfo.currentWindow) {
          return mockTabs.filter(tab => tab.active && tab.currentWindow);
        }
        return mockTabs;
      }),
      sendMessage: jest.fn(),
      // Mock tab creation
      create: jest.fn().mockImplementation(async (options) => {
        const newTabId = mockTabs.length + 1;
        const newTab = {
          id: newTabId,
          url: options.url || 'https://example.com/newtab',
          title: `New Tab ${newTabId}`,
          active: true,
          currentWindow: true
        };
        
        // Make the new tab active
        mockTabs.forEach(tab => { tab.active = false; });
        
        mockTabs.push(newTab);
        return newTab;
      })
    },
    storage: {
      local: {
        get: jest.fn().mockImplementation(async (key) => {
          if (key === 'globalSettings') {
            return { globalSettings: mockStorage.globalSettings };
          } else if (typeof key === 'string' && key.startsWith('tab_')) {
            const tabId = key.replace('tab_', '');
            const result = {};
            if (mockStorage.tabStates[tabId]) {
              result[key] = mockStorage.tabStates[tabId];
            }
            return result;
          }
          return {};
        }),
        set: jest.fn().mockImplementation(async (data) => {
          Object.keys(data).forEach(key => {
            if (key === 'globalSettings') {
              mockStorage.globalSettings = data[key];
            } else if (key.startsWith('tab_')) {
              const tabId = key.replace('tab_', '');
              mockStorage.tabStates[tabId] = data[key];
            }
          });
          return {};
        }),
        remove: jest.fn()
      }
    },
    runtime: {
      sendMessage: jest.fn().mockImplementation((message, callback) => {
        if (message.action === 'toggleCurrentTab' && message.tabId) {
          toggleGrayscaleForTab(message.tabId).then(() => {
            if (callback) callback({ success: true });
          });
        } else if (message.action === 'updateGlobalSetting') {
          updateGlobalSetting(message.applyToAllTabs).then(() => {
            if (callback) callback({ success: true });
          });
        }
        return true;
      }),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    },
    action: {
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn(),
      setIcon: jest.fn(),
      setTitle: jest.fn()
    },
    scripting: {
      insertCSS: jest.fn(),
      removeCSS: jest.fn()
    }
  };

  // Helper function to simulate toggling grayscale for a tab
  async function toggleGrayscaleForTab(tabId) {
    // Get current tab state
    const result = await chrome.storage.local.get(`tab_${tabId}`);
    const tabState = result[`tab_${tabId}`] || { isGrayscale: false };
    
    // Toggle the state
    tabState.isGrayscale = !tabState.isGrayscale;
    
    // Save the updated state for the current tab
    await chrome.storage.local.set({ [`tab_${tabId}`]: tabState });
    
    // If apply to all tabs is enabled, apply the state to all OTHER tabs
    const settingsResult = await chrome.storage.local.get('globalSettings');
    const globalSettings = settingsResult.globalSettings || { applyToAllTabs: false };
    
    if (globalSettings.applyToAllTabs) {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.id.toString() !== tabId.toString()) {
          await chrome.storage.local.set({ [`tab_${tab.id}`]: { isGrayscale: tabState.isGrayscale } });
        }
      }
    }
    
    return tabState.isGrayscale;
  }
  
  // Helper function to update global setting
  async function updateGlobalSetting(applyToAllTabs) {
    // Save the global setting
    await chrome.storage.local.set({
      globalSettings: { applyToAllTabs }
    });
    
    // Only apply the current tab's state to all tabs if we're turning ON global mode
    if (applyToAllTabs) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id) {
        const result = await chrome.storage.local.get(`tab_${tabs[0].id}`);
        const activeTabState = result[`tab_${tabs[0].id}`] || { isGrayscale: false };
        
        // Apply to all tabs
        const allTabs = await chrome.tabs.query({});
        for (const tab of allTabs) {
          if (tab.id) {
            await chrome.storage.local.set({ 
              [`tab_${tab.id}`]: { isGrayscale: activeTabState.isGrayscale } 
            });
          }
        }
      }
    }
  }
  
  // Helper function to simulate the content script initializing on a tab
  async function simulateContentScriptInit(tabId) {
    // In the real content script, it would check the storage to determine
    // if grayscale should be applied. Let's simulate that here:
    
    // Get global settings
    const settingsResult = await chrome.storage.local.get('globalSettings');
    const globalSettings = settingsResult.globalSettings || { applyToAllTabs: false };
    
    // Get tab-specific state
    const tabResult = await chrome.storage.local.get(`tab_${tabId}`);
    const tabState = tabResult[`tab_${tabId}`];
    
    // If the tab has no state yet, and global mode is enabled,
    // check other tabs for their state to determine what to apply
    if (!tabState && globalSettings.applyToAllTabs) {
      // Find any tab with a state
      let foundState = false;
      
      for (const tab of mockTabs) {
        if (tab.id && tab.id !== tabId) {
          const otherTabResult = await chrome.storage.local.get(`tab_${tab.id}`);
          if (otherTabResult[`tab_${tab.id}`]) {
            // Apply the same state to the new tab
            await chrome.storage.local.set({
              [`tab_${tabId}`]: otherTabResult[`tab_${tab.id}`]
            });
            foundState = true;
            break;
          }
        }
      }
      
      // If no other tab has a state, default to no grayscale
      if (!foundState) {
        await chrome.storage.local.set({
          [`tab_${tabId}`]: { isGrayscale: false }
        });
      }
    } else if (!tabState) {
      // If no state and no global mode, set default (no grayscale)
      await chrome.storage.local.set({
        [`tab_${tabId}`]: { isGrayscale: false }
      });
    }
    
    // Return the current state
    const finalResult = await chrome.storage.local.get(`tab_${tabId}`);
    return finalResult[`tab_${tabId}`];
  }

  beforeEach(() => {
    // Reset mock storage and tabs for each test
    mockStorage = {
      tabStates: {},
      globalSettings: { applyToAllTabs: false }
    };
    
    mockTabs = [
      { id: 1, url: 'https://example.com/page1', title: 'Example Page 1', active: true, currentWindow: true }
    ];
    
    jest.clearAllMocks();
  });

  test('New tabs should inherit grayscale state when global setting is ON', async () => {
    // Enable "Apply to all tabs" setting
    await updateGlobalSetting(true);
    expect(mockStorage.globalSettings.applyToAllTabs).toBe(true);
    
    // Toggle grayscale ON for the current tab (tab 1)
    await toggleGrayscaleForTab(1);
    
    // Verify tab 1 has grayscale enabled
    const tab1State = await chrome.storage.local.get('tab_1');
    expect(tab1State['tab_1'].isGrayscale).toBe(true);
    
    // Create a new tab (tab 2)
    const newTab = await chrome.tabs.create({ url: 'https://example.com/newtab' });
    expect(newTab.id).toBe(2);
    
    // Simulate content script initialization in the new tab
    // This represents what happens when a new page loads
    const newTabState = await simulateContentScriptInit(newTab.id);
    
    // Verify the new tab has inherited the grayscale state
    expect(newTabState.isGrayscale).toBe(true);
    
    // Check the storage directly to confirm
    const storageState = await chrome.storage.local.get('tab_2');
    expect(storageState['tab_2'].isGrayscale).toBe(true);
    
    // Create another tab (tab 3)
    const anotherTab = await chrome.tabs.create({ url: 'https://example.com/another' });
    expect(anotherTab.id).toBe(3);
    
    // Simulate content script initialization in this tab too
    const anotherTabState = await simulateContentScriptInit(anotherTab.id);
    
    // Verify this tab also inherited the grayscale state
    expect(anotherTabState.isGrayscale).toBe(true);
  });

  test('New tabs should get independent state when global setting is OFF', async () => {
    // Make sure "Apply to all tabs" setting is OFF
    await updateGlobalSetting(false);
    expect(mockStorage.globalSettings.applyToAllTabs).toBe(false);
    
    // Toggle grayscale ON for the current tab (tab 1)
    await toggleGrayscaleForTab(1);
    
    // Verify tab 1 has grayscale enabled
    const tab1State = await chrome.storage.local.get('tab_1');
    expect(tab1State['tab_1'].isGrayscale).toBe(true);
    
    // Create a new tab (tab 2)
    const newTab = await chrome.tabs.create({ url: 'https://example.com/newtab' });
    expect(newTab.id).toBe(2);
    
    // Simulate content script initialization in the new tab
    const newTabState = await simulateContentScriptInit(newTab.id);
    
    // Verify the new tab has its own state (not affected by tab 1)
    // By default, a new tab should have grayscale OFF when global setting is OFF
    expect(newTabState.isGrayscale).toBe(false);
  });

  test('Toggling global setting ON applies to current and new tabs', async () => {
    // Start with global setting OFF and tab 1 with grayscale ON
    await updateGlobalSetting(false);
    await toggleGrayscaleForTab(1);
    
    // Create tab 2 with independent state (should be OFF by default)
    const tab2 = await chrome.tabs.create({ url: 'https://example.com/tab2' });
    await simulateContentScriptInit(tab2.id);
    
    // Verify tab 1 is ON and tab 2 is OFF
    const initialTab1State = await chrome.storage.local.get('tab_1');
    const initialTab2State = await chrome.storage.local.get('tab_2');
    expect(initialTab1State['tab_1'].isGrayscale).toBe(true);
    expect(initialTab2State['tab_2'].isGrayscale).toBe(false);
    
    // Now turn ON global setting while tab 2 is active
    mockTabs[0].active = false;
    mockTabs[1].active = true;
    await updateGlobalSetting(true);
    
    // Verify both tabs now have tab 2's state (which is OFF)
    const afterGlobalTab1State = await chrome.storage.local.get('tab_1');
    const afterGlobalTab2State = await chrome.storage.local.get('tab_2');
    expect(afterGlobalTab1State['tab_1'].isGrayscale).toBe(false);
    expect(afterGlobalTab2State['tab_2'].isGrayscale).toBe(false);
    
    // Toggle grayscale ON while on tab 2
    await toggleGrayscaleForTab(2);
    
    // Create a new tab (tab 3)
    const tab3 = await chrome.tabs.create({ url: 'https://example.com/tab3' });
    await simulateContentScriptInit(tab3.id);
    
    // Verify tab 3 inherited the grayscale ON state
    const tab3State = await chrome.storage.local.get('tab_3');
    expect(tab3State['tab_3'].isGrayscale).toBe(true);
  });
});