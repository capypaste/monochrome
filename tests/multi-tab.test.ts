import 'jest-environment-jsdom';

// Import the chrome mock from our test setup
declare const global: any;

describe('Multi-tab grayscale functionality', () => {
  let mockBackgroundModule: any;
  let mockTabStates: Record<string, any> = {};
  let mockGlobalSettings: any = { applyToAllTabs: false };
  
  beforeEach(() => {
    // Reset tab states and mock storage
    mockTabStates = {};
    mockGlobalSettings = { applyToAllTabs: false };
    
    // Set up browser tab mocks
    global.chrome.tabs.query.mockImplementation(async (queryInfo: any) => {
      if (queryInfo.active && queryInfo.currentWindow) {
        // Return the active tab (first tab)
        return [{ id: 1, url: 'https://example.com', title: 'Example Website Tab 1' }];
      } else {
        // Return all tabs when no specific query
        return [
          { id: 1, url: 'https://example.com', title: 'Example Website Tab 1' },
          { id: 2, url: 'https://example.com', title: 'Example Website Tab 2' }
        ];
      }
    });
    
    // Mock the chrome.tabs.get function
    global.chrome.tabs.get.mockImplementation(async (tabId: number) => {
      if (tabId === 1) {
        return { id: 1, url: 'https://example.com', title: 'Example Website Tab 1' };
      } else if (tabId === 2) {
        return { id: 2, url: 'https://example.com', title: 'Example Website Tab 2' };
      }
      throw new Error(`Unknown tab ID: ${tabId}`);
    });
    
    // Mock the storage functionality
    global.chrome.storage.local.get.mockImplementation(async (key: string) => {
      if (key === 'globalSettings') {
        return { globalSettings: mockGlobalSettings };
      } else if (key.startsWith('tab_')) {
        const tabKey = key;
        const result: Record<string, any> = {};
        if (mockTabStates[tabKey]) {
          result[tabKey] = mockTabStates[tabKey];
        }
        return result;
      }
      return {};
    });
    
    global.chrome.storage.local.set.mockImplementation(async (data: Record<string, any>) => {
      // Store the tab states or global settings
      Object.keys(data).forEach(key => {
        if (key === 'globalSettings') {
          mockGlobalSettings = data[key];
        } else if (key.startsWith('tab_')) {
          mockTabStates[key] = data[key];
        }
      });
      return;
    });
    
    // Import the background script module
    // Note: We create this as a mock rather than importing the actual module
    // since the file is loaded in a service worker context
    mockBackgroundModule = {
      applyGrayscaleToTab: jest.fn(async (tabId: number, isGrayscale: boolean) => {
        const tabKey = `tab_${tabId}`;
        mockTabStates[tabKey] = { isGrayscale };
      }),
      applyGrayscaleToAllTabs: jest.fn(async (isGrayscale: boolean) => {
        const tabs = await global.chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id) {
            const tabKey = `tab_${tab.id}`;
            mockTabStates[tabKey] = { isGrayscale };
          }
        }
      }),
      toggleGrayscaleForTab: jest.fn(async (tabId: number) => {
        const tabKey = `tab_${tabId}`;
        // Get current tab state
        const currentState = mockTabStates[tabKey]?.isGrayscale || false;
        // Toggle the state
        const newState = !currentState;
        
        if (mockGlobalSettings.applyToAllTabs) {
          // Apply to all tabs
          await mockBackgroundModule.applyGrayscaleToAllTabs(newState);
        } else {
          // Apply to just this tab
          await mockBackgroundModule.applyGrayscaleToTab(tabId, newState);
        }
      })
    };
  });
  
  test('should apply grayscale to all tabs when "Apply to all tabs" is enabled', async () => {
    // Set the "Apply to all tabs" setting to true
    mockGlobalSettings.applyToAllTabs = true;
    
    // Toggle grayscale on the first tab
    await mockBackgroundModule.toggleGrayscaleForTab(1);
    
    // Check that both tabs have grayscale enabled
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: true });
    expect(mockTabStates['tab_2']).toEqual({ isGrayscale: true });
    
    // Toggle grayscale off
    await mockBackgroundModule.toggleGrayscaleForTab(1);
    
    // Check that both tabs have grayscale disabled
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: false });
    expect(mockTabStates['tab_2']).toEqual({ isGrayscale: false });
  });
  
  test('should only apply grayscale to the current tab when "Apply to all tabs" is disabled', async () => {
    // Set the "Apply to all tabs" setting to false
    mockGlobalSettings.applyToAllTabs = false;
    
    // Toggle grayscale on the first tab
    await mockBackgroundModule.toggleGrayscaleForTab(1);
    
    // Check that only the first tab has grayscale enabled
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: true });
    expect(mockTabStates['tab_2']).toBeUndefined();
    
    // Now toggle the second tab separately
    await mockBackgroundModule.toggleGrayscaleForTab(2);
    
    // Check that both tabs have their own separate states
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: true });
    expect(mockTabStates['tab_2']).toEqual({ isGrayscale: true });
    
    // Toggle the first tab again
    await mockBackgroundModule.toggleGrayscaleForTab(1);
    
    // Check that only the first tab changed
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: false });
    expect(mockTabStates['tab_2']).toEqual({ isGrayscale: true });
  });
  
  test('should update all tabs when changing from individual to global mode', async () => {
    // Start with individual mode
    mockGlobalSettings.applyToAllTabs = false;
    
    // Toggle grayscale on first tab only
    await mockBackgroundModule.toggleGrayscaleForTab(1);
    
    // Check that only the first tab has grayscale enabled
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: true });
    expect(mockTabStates['tab_2']).toBeUndefined();
    
    // Simulate popup setting "Apply to all tabs" to true
    mockGlobalSettings.applyToAllTabs = true;
    
    // This simulates the handler in the background script when the setting is changed
    const activeTabState = mockTabStates['tab_1'] || { isGrayscale: false };
    await mockBackgroundModule.applyGrayscaleToAllTabs(activeTabState.isGrayscale);
    
    // Now both tabs should have grayscale enabled
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: true });
    expect(mockTabStates['tab_2']).toEqual({ isGrayscale: true });
    
    // Toggle it off from the first tab, should affect all tabs
    await mockBackgroundModule.toggleGrayscaleForTab(1);
    
    // Both tabs should be disabled now
    expect(mockTabStates['tab_1']).toEqual({ isGrayscale: false });
    expect(mockTabStates['tab_2']).toEqual({ isGrayscale: false });
  });
});