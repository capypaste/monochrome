describe('Grayscale settings propagation to new tabs', () => {
  // Mock storage for tab states and global settings
  let mockStorage = {
    tabStates: {},
    globalSettings: { applyToAllTabs: false }
  };

  // Mock tabs collection that we can add to
  let mockTabs = [
    { id: 1, url: 'https://example.com/page1', title: 'Example Page 1', active: true, currentWindow: true }
  ];

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
      create: jest.fn().mockImplementation(async (createProperties) => {
        const newTabId = Math.max(...mockTabs.map(tab => tab.id)) + 1;
        const newTab = {
          id: newTabId,
          url: createProperties.url || 'https://example.com/new-tab',
          title: `New Tab ${newTabId}`,
          active: true,
          currentWindow: true
        };
        
        // Update active state of tabs
        mockTabs.forEach(tab => {
          tab.active = false;
        });
        
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
        remove: jest.fn().mockImplementation(async (key) => {
          if (key.startsWith('tab_')) {
            const tabId = key.replace('tab_', '');
            delete mockStorage.tabStates[tabId];
          }
          return {};
        })
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

  // Mock extension behavior
  async function toggleGrayscaleForTab(tabId) {
    // Get current tab state
    const result = await chrome.storage.local.get(`tab_${tabId}`);
    const tabState = result[`tab_${tabId}`] || { isGrayscale: false };
    
    // Toggle the state
    tabState.isGrayscale = !tabState.isGrayscale;
    
    // Save the updated state for the current tab
    await chrome.storage.local.set({ [`tab_${tabId}`]: tabState });
    
    // If apply to all tabs is enabled, apply the state to all other tabs
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
  
  async function updateGlobalSetting(applyToAllTabs) {
    // Get previous setting
    const prevSettings = await chrome.storage.local.get('globalSettings');
    const wasGlobalBefore = prevSettings.globalSettings?.applyToAllTabs || false;
    
    // Save the new global setting
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
  
  // Helper to simulate popup actions
  async function simulatePopupAction(applyToAll, executeToggle) {
    // Set "Apply to all tabs" option
    if (mockStorage.globalSettings.applyToAllTabs !== applyToAll) {
      await updateGlobalSetting(applyToAll);
    }
    
    // Execute toggle if requested
    if (executeToggle) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await toggleGrayscaleForTab(tab.id);
      }
    }
  }
  
  // Mock function to simulate extension applying grayscale to a new tab
  // In the real extension, this would happen via content script initialization
  async function simulateNewTabLoad(tabId) {
    // Check global settings
    const settingsResult = await chrome.storage.local.get('globalSettings');
    const globalSettings = settingsResult.globalSettings || { applyToAllTabs: false };
    
    // If global settings are enabled, apply the same state as other tabs
    if (globalSettings.applyToAllTabs) {
      // Find any existing tab to get its state
      const existingTabs = mockTabs.filter(tab => tab.id !== tabId);
      if (existingTabs.length > 0) {
        const existingTabId = existingTabs[0].id;
        const result = await chrome.storage.local.get(`tab_${existingTabId}`);
        const existingTabState = result[`tab_${existingTabId}`] || { isGrayscale: false };
        
        // Apply the same state to the new tab
        await chrome.storage.local.set({ [`tab_${tabId}`]: { isGrayscale: existingTabState.isGrayscale } });
      }
    }
    // Otherwise, a new tab would start with grayscale off by default (no need to set anything)
  }

  beforeEach(() => {
    // Reset the mock state
    mockStorage = {
      tabStates: {},
      globalSettings: { applyToAllTabs: false }
    };
    
    mockTabs = [
      { id: 1, url: 'https://example.com/page1', title: 'Example Page 1', active: true, currentWindow: true }
    ];
    
    jest.clearAllMocks();
  });

  test('new tabs should inherit grayscale state when "Apply all" is enabled', async () => {
    // Enable "Apply all tabs" setting
    await simulatePopupAction(true, false);
    expect(mockStorage.globalSettings.applyToAllTabs).toBe(true);
    
    // Turn on grayscale for current tab (which is tab 1)
    await simulatePopupAction(true, true);
    
    // Verify grayscale is on for tab 1
    const tab1State = await chrome.storage.local.get('tab_1');
    expect(tab1State['tab_1'].isGrayscale).toBe(true);
    
    // Open a new tab (tab 2)
    const newTab = await chrome.tabs.create({ url: 'https://example.com/page2' });
    expect(newTab.id).toBe(2);
    
    // Simulate the new tab loading and checking for grayscale state
    await simulateNewTabLoad(newTab.id);
    
    // Verify the new tab has grayscale enabled
    const tab2State = await chrome.storage.local.get('tab_2');
    expect(tab2State['tab_2'].isGrayscale).toBe(true);
    
    // Now open another tab (tab 3)
    const anotherTab = await chrome.tabs.create({ url: 'https://example.com/page3' });
    expect(anotherTab.id).toBe(3);
    
    // Simulate the new tab loading
    await simulateNewTabLoad(anotherTab.id);
    
    // Verify the new tab also has grayscale enabled
    const tab3State = await chrome.storage.local.get('tab_3');
    expect(tab3State['tab_3'].isGrayscale).toBe(true);
    
    // Turn off grayscale while "Apply all" is still enabled
    await simulatePopupAction(true, true);
    
    // Open yet another tab (tab 4)
    const fourthTab = await chrome.tabs.create({ url: 'https://example.com/page4' });
    
    // Simulate the new tab loading
    await simulateNewTabLoad(fourthTab.id);
    
    // Verify this tab has grayscale disabled (inheriting the current state)
    const tab4State = await chrome.storage.local.get('tab_4');
    expect(tab4State['tab_4'].isGrayscale).toBe(false);
  });

  test('new tabs should have grayscale disabled by default when "Apply all" is disabled', async () => {
    // Make sure "Apply all tabs" setting is off
    await simulatePopupAction(false, false);
    expect(mockStorage.globalSettings.applyToAllTabs).toBe(false);
    
    // Turn on grayscale for current tab (tab 1)
    await simulatePopupAction(false, true);
    
    // Verify grayscale is on for tab 1
    const tab1State = await chrome.storage.local.get('tab_1');
    expect(tab1State['tab_1'].isGrayscale).toBe(true);
    
    // Open a new tab (tab 2)
    const newTab = await chrome.tabs.create({ url: 'https://example.com/page2' });
    
    // A new tab should not have any state set when "Apply all" is disabled
    const tab2State = await chrome.storage.local.get('tab_2');
    expect(tab2State['tab_2']).toBeUndefined();
    
    // If the content script initializes, it would check and find no state, defaulting to grayscale off
    // Simulate this by confirming we can read the tab state as undefined/falsy
    const defaultValue = tab2State['tab_2']?.isGrayscale || false;
    expect(defaultValue).toBe(false);
  });
});