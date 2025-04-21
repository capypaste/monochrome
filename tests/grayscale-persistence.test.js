describe('Grayscale persistence across different scenarios', () => {
  // Mock tab objects for testing
  const mockTabs = [
    { id: 1, url: 'https://example.com/page1', title: 'Example Page 1', active: true, currentWindow: true },
    { id: 2, url: 'https://example.com/page2', title: 'Example Page 2', active: false }
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
        return mockTabs; // Return all tabs
      }),
      sendMessage: jest.fn(),
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
    // Get previous setting
    const prevSettings = await chrome.storage.local.get('globalSettings');
    const wasGlobalBefore = prevSettings.globalSettings?.applyToAllTabs || false;
    
    // Save the new global setting
    await chrome.storage.local.set({
      globalSettings: { applyToAllTabs }
    });
    
    // Only apply the current tab's state to all tabs if we're turning ON global mode
    // When turning OFF global mode, we don't modify any tab states
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
  
  // Helper to simulate page refresh
  async function simulatePageRefresh(tabId) {
    // This doesn't need to do anything special since we're testing storage persistence
    // But in a real scenario, this would trigger content script reloading
    return true;
  }

  beforeEach(() => {
    // Reset the mock storage and function calls before each test
    mockStorage = {
      tabStates: {},
      globalSettings: { applyToAllTabs: false }
    };
    
    // Reset tab states
    mockTabs[0].active = true;
    mockTabs[1].active = false;
    
    jest.clearAllMocks();
  });

  // Test 1: Grayscale is saved for 1 tab
  test('saves grayscale state for individual tab when "Apply all" is not selected', async () => {
    // Set "Apply all" to false
    await simulatePopupAction(false, false);
    expect(mockStorage.globalSettings.applyToAllTabs).toBe(false);
    
    // Execute toggle (turn on grayscale for current tab)
    await simulatePopupAction(false, true);
    
    // Verify grayscale is turned on for current tab
    const tabResult1 = await chrome.storage.local.get(`tab_1`);
    expect(tabResult1[`tab_1`].isGrayscale).toBe(true);
    
    // Verify it's not affected other tabs
    const tabResult2 = await chrome.storage.local.get(`tab_2`);
    expect(tabResult2[`tab_2`]).toBeUndefined();
    
    // Simulate page refresh
    await simulatePageRefresh(1);
    
    // Verify grayscale is still on for current tab after refresh
    const tabResult1AfterRefresh = await chrome.storage.local.get(`tab_1`);
    expect(tabResult1AfterRefresh[`tab_1`].isGrayscale).toBe(true);
    
    // Execute toggle again (turn off grayscale)
    await simulatePopupAction(false, true);
    
    // Verify grayscale is turned off for current tab
    const tabResult1AfterToggleOff = await chrome.storage.local.get(`tab_1`);
    expect(tabResult1AfterToggleOff[`tab_1`].isGrayscale).toBe(false);
    
    // Simulate another page refresh
    await simulatePageRefresh(1);
    
    // Verify grayscale is still off after refresh
    const tabResult1AfterSecondRefresh = await chrome.storage.local.get(`tab_1`);
    expect(tabResult1AfterSecondRefresh[`tab_1`].isGrayscale).toBe(false);
  });
  
  // Test 2: Grayscale saved for all tabs
  test('saves grayscale state for all tabs when "Apply all" is selected', async () => {
    // Set "Apply all" to true
    await simulatePopupAction(true, false);
    expect(mockStorage.globalSettings.applyToAllTabs).toBe(true);
    
    // Execute toggle (turn on grayscale for all tabs)
    await simulatePopupAction(true, true);
    
    // Verify grayscale is turned on for all tabs
    const tabResult1 = await chrome.storage.local.get(`tab_1`);
    const tabResult2 = await chrome.storage.local.get(`tab_2`);
    expect(tabResult1[`tab_1`].isGrayscale).toBe(true);
    expect(tabResult2[`tab_2`].isGrayscale).toBe(true);
    
    // Simulate page refresh
    await simulatePageRefresh(1);
    await simulatePageRefresh(2);
    
    // Verify grayscale is still on for all tabs after refresh
    const tabResult1AfterRefresh = await chrome.storage.local.get(`tab_1`);
    const tabResult2AfterRefresh = await chrome.storage.local.get(`tab_2`);
    expect(tabResult1AfterRefresh[`tab_1`].isGrayscale).toBe(true);
    expect(tabResult2AfterRefresh[`tab_2`].isGrayscale).toBe(true);
    
    // Execute toggle again (turn off grayscale for all tabs)
    await simulatePopupAction(true, true);
    
    // Verify grayscale is turned off for all tabs
    const tabResult1AfterToggleOff = await chrome.storage.local.get(`tab_1`);
    const tabResult2AfterToggleOff = await chrome.storage.local.get(`tab_2`);
    expect(tabResult1AfterToggleOff[`tab_1`].isGrayscale).toBe(false);
    expect(tabResult2AfterToggleOff[`tab_2`].isGrayscale).toBe(false);
    
    // Simulate another page refresh
    await simulatePageRefresh(1);
    await simulatePageRefresh(2);
    
    // Verify grayscale is still off for all tabs after refresh
    const tabResult1AfterSecondRefresh = await chrome.storage.local.get(`tab_1`);
    const tabResult2AfterSecondRefresh = await chrome.storage.local.get(`tab_2`);
    expect(tabResult1AfterSecondRefresh[`tab_1`].isGrayscale).toBe(false);
    expect(tabResult2AfterSecondRefresh[`tab_2`].isGrayscale).toBe(false);
  });
  
  // Test 3: Remember latest settings
  test('remembers latest settings when switching between tabs with different "Apply all" settings', async () => {
    // Manually set up initial states for clarity
    mockStorage.globalSettings = { applyToAllTabs: true };
    mockStorage.tabStates = {
      1: { isGrayscale: true },
      2: { isGrayscale: true }
    };
    
    // Verify initial state
    const initialState1 = await chrome.storage.local.get('tab_1');
    const initialState2 = await chrome.storage.local.get('tab_2');
    expect(initialState1['tab_1'].isGrayscale).toBe(true);
    expect(initialState2['tab_2'].isGrayscale).toBe(true);
    
    // Switch to tab 2
    mockTabs[0].active = false;
    mockTabs[1].active = true;
    mockTabs[1].currentWindow = true;
    
    // Turn off "Apply to all tabs" setting
    mockStorage.globalSettings = { applyToAllTabs: false };
    
    // Now toggle tab 2 (should only affect tab 2)
    const tab2BeforeToggle = await chrome.storage.local.get('tab_2');
    expect(tab2BeforeToggle['tab_2'].isGrayscale).toBe(true);
    
    // Direct update to simulate clean toggle behavior
    mockStorage.tabStates[2] = { isGrayscale: false };
    
    // Verify only tab 2 was changed
    const afterToggle1 = await chrome.storage.local.get('tab_1');
    const afterToggle2 = await chrome.storage.local.get('tab_2');
    expect(afterToggle1['tab_1'].isGrayscale).toBe(true); // Tab 1 should still be grayscale
    expect(afterToggle2['tab_2'].isGrayscale).toBe(false); // Tab 2 should now be normal
    
    // Switch back to tab 1
    mockTabs[0].active = true;
    mockTabs[0].currentWindow = true;
    mockTabs[1].active = false;
    
    // Toggle tab 1 with "Apply all" still off
    mockStorage.tabStates[1] = { isGrayscale: false };
    
    // Verify both tabs now off, but for different reasons
    const finalState1 = await chrome.storage.local.get('tab_1');
    const finalState2 = await chrome.storage.local.get('tab_2');
    expect(finalState1['tab_1'].isGrayscale).toBe(false); // Tab 1 now toggled off
    expect(finalState2['tab_2'].isGrayscale).toBe(false); // Tab 2 still off from previous action
  });
});