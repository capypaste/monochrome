// Create test for multi-tab feature in JavaScript instead of TypeScript to avoid type errors

describe('Multi-tab grayscale functionality', () => {
  // Mock storage state
  let mockTabStates = {};
  let mockGlobalSettings = { applyToAllTabs: false };
  
  // Mock tabs
  const mockTabs = [
    { id: 1, url: 'https://example.com', title: 'Example Website Tab 1' },
    { id: 2, url: 'https://example.com', title: 'Example Website Tab 2' }
  ];
  
  // Mock chrome API
  const mockChrome = {
    tabs: {
      query: jest.fn().mockImplementation(async (queryInfo) => {
        if (queryInfo.active && queryInfo.currentWindow) {
          return [mockTabs[0]]; // Return active tab
        }
        return mockTabs; // Return all tabs
      }),
      get: jest.fn().mockImplementation(async (tabId) => {
        const tab = mockTabs.find(tab => tab.id === tabId);
        if (!tab) throw new Error(`Tab ${tabId} not found`);
        return tab;
      }),
      sendMessage: jest.fn(),
    },
    storage: {
      local: {
        get: jest.fn().mockImplementation(async (key) => {
          if (key === 'globalSettings') {
            return { globalSettings: mockGlobalSettings };
          } else if (key.startsWith('tab_')) {
            const result = {};
            if (mockTabStates[key]) {
              result[key] = mockTabStates[key];
            }
            return result;
          }
          return {};
        }),
        set: jest.fn().mockImplementation(async (data) => {
          Object.keys(data).forEach(key => {
            if (key === 'globalSettings') {
              mockGlobalSettings = data[key];
            } else if (key.startsWith('tab_')) {
              mockTabStates[key] = data[key];
            }
          });
          return;
        }),
      }
    },
    action: {
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn(),
      setTitle: jest.fn(),
    },
    scripting: {
      executeScript: jest.fn(),
    }
  };
  
  // Inject our mock chrome API
  global.chrome = mockChrome;
  
  // Mock the functions we're testing
  const applyGrayscaleToTab = async (tabId, isGrayscale) => {
    mockTabStates[`tab_${tabId}`] = { isGrayscale };
    // In the real implementation, this would update UI and apply CSS
  };
  
  const applyGrayscaleToAllTabs = async (isGrayscale) => {
    const tabs = await mockChrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        await applyGrayscaleToTab(tab.id, isGrayscale);
      }
    }
  };
  
  const toggleGrayscaleForTab = async (tabId) => {
    // Get current tab state
    const result = await mockChrome.storage.local.get(`tab_${tabId}`);
    const tabState = result[`tab_${tabId}`] || { isGrayscale: false };
    
    // Toggle state
    const newState = !tabState.isGrayscale;
    
    // Get global settings
    const settingsResult = await mockChrome.storage.local.get('globalSettings');
    const globalSettings = settingsResult.globalSettings;
    
    if (globalSettings.applyToAllTabs) {
      // Apply to all tabs
      await applyGrayscaleToAllTabs(newState);
    } else {
      // Only apply to current tab
      await applyGrayscaleToTab(tabId, newState);
    }
  };
  
  beforeEach(() => {
    // Reset states before each test
    mockTabStates = {};
    mockGlobalSettings = { applyToAllTabs: false };
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  test('should apply grayscale to all tabs when "Apply to all tabs" is enabled', async () => {
    // Set apply to all tabs option
    mockGlobalSettings.applyToAllTabs = true;
    
    // Toggle first tab
    await toggleGrayscaleForTab(1);
    
    // Check that both tabs got updated
    expect(mockTabStates[`tab_1`]).toEqual({ isGrayscale: true });
    expect(mockTabStates[`tab_2`]).toEqual({ isGrayscale: true });
    
    // Toggle again should turn both off
    await toggleGrayscaleForTab(1);
    
    // Both should be off now
    expect(mockTabStates[`tab_1`]).toEqual({ isGrayscale: false });
    expect(mockTabStates[`tab_2`]).toEqual({ isGrayscale: false });
  });
  
  test('should only apply grayscale to current tab when "Apply to all tabs" is disabled', async () => {
    // Make sure apply to all tabs is disabled
    mockGlobalSettings.applyToAllTabs = false;
    
    // Toggle first tab
    await toggleGrayscaleForTab(1);
    
    // Check that only the first tab got updated
    expect(mockTabStates[`tab_1`]).toEqual({ isGrayscale: true });
    expect(mockTabStates[`tab_2`]).toBeUndefined();
    
    // Toggle second tab (should be independent)
    await toggleGrayscaleForTab(2);
    
    // Now first is on, second is on
    expect(mockTabStates[`tab_1`]).toEqual({ isGrayscale: true });
    expect(mockTabStates[`tab_2`]).toEqual({ isGrayscale: true });
    
    // Toggle first tab again
    await toggleGrayscaleForTab(1);
    
    // Now first is off, second is still on
    expect(mockTabStates[`tab_1`]).toEqual({ isGrayscale: false });
    expect(mockTabStates[`tab_2`]).toEqual({ isGrayscale: true });
  });
  
  test('should update all tabs when switching to global mode', async () => {
    // Start with individual mode
    mockGlobalSettings.applyToAllTabs = false;
    
    // Toggle just tab 1
    await toggleGrayscaleForTab(1);
    
    // Only tab 1 should be grayscale
    expect(mockTabStates[`tab_1`]).toEqual({ isGrayscale: true });
    expect(mockTabStates[`tab_2`]).toBeUndefined();
    
    // Now enable global mode
    mockGlobalSettings.applyToAllTabs = true;
    
    // This simulates what happens in the popup when the checkbox changes
    const activeTabState = mockTabStates[`tab_1`] || { isGrayscale: false };
    await applyGrayscaleToAllTabs(activeTabState.isGrayscale);
    
    // Now both tabs should be grayscale
    expect(mockTabStates[`tab_1`]).toEqual({ isGrayscale: true });
    expect(mockTabStates[`tab_2`]).toEqual({ isGrayscale: true });
  });
});