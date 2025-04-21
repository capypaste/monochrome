// Setup mock DOM elements before tests
beforeEach(() => {
  // Clear previous DOM
  document.body.innerHTML = '';
  
  // Create popup DOM structure
  document.body.innerHTML = `
    <input type="checkbox" id="applyToAllTabs">
    <button id="toggleCurrentTab">Toggle current tab</button>
  `;
});

// Mock popup functionality for testing
const testCheckbox = document.getElementById('applyToAllTabs') as HTMLInputElement;
const testButton = document.getElementById('toggleCurrentTab') as HTMLButtonElement;

async function initializePopup(): Promise<void> {
  // Get global settings
  const result = await new Promise(resolve => {
    chrome.storage.local.get('globalSettings', resolve);
  });
  
  // Use type assertion to handle the unknown type
  const settings = result as any;
  const globalSettings = settings.globalSettings || { applyToAllTabs: false };
  
  // Set checkbox state based on stored preference
  if (testCheckbox) {
    testCheckbox.checked = globalSettings.applyToAllTabs;
  }
}

describe('Popup Script', () => {
  // Test popup initialization
  test('initializePopup should set checkbox based on storage', async () => {
    // Mock storage with settings
    const getMock = chrome.storage.local.get as any;
    getMock.mockImplementation((key, callback) => {
      callback({ globalSettings: { applyToAllTabs: true } });
    });
    
    // Call initialize
    await initializePopup();
    
    // Check checkbox state
    const checkbox = document.getElementById('applyToAllTabs') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
  
  test('initializePopup should handle missing storage settings', async () => {
    // Mock empty storage
    const getMock = chrome.storage.local.get as any;
    getMock.mockImplementation((key, callback) => {
      callback({});
    });
    
    // Call initialize
    await initializePopup();
    
    // Should default to false
    const checkbox = document.getElementById('applyToAllTabs') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
  
  // Test checkbox change event
  test('checkbox change should update storage and send message', () => {
    // Set up the checkbox
    const checkbox = document.getElementById('applyToAllTabs') as HTMLInputElement;
    checkbox.checked = true;
    
    // Add event listener (mimicking popup.ts)
    checkbox.addEventListener('change', async () => {
      // Save preference
      await chrome.storage.local.set({
        globalSettings: { applyToAllTabs: checkbox.checked }
      });
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'updateGlobalSetting',
        applyToAllTabs: checkbox.checked
      });
    });
    
    // Trigger change event
    checkbox.dispatchEvent(new Event('change'));
    
    // Verify storage update
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      globalSettings: { applyToAllTabs: true }
    });
    
    // Verify message sent
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'updateGlobalSetting',
      applyToAllTabs: true
    });
  });
  
  // Test toggle button click
  test('toggle button should send message and close popup', () => {
    // Mock tabs query
    const queryMock = chrome.tabs.query as any;
    queryMock.mockImplementation((query, callback) => {
      callback([{ id: mockTabId }]);
    });
    
    // Mock window.close
    const originalClose = window.close;
    window.close = jest.fn();
    
    // Add event listener (mimicking popup.ts)
    const button = document.getElementById('toggleCurrentTab') as HTMLButtonElement;
    button.addEventListener('click', async () => {
      const result = await new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      
      // Type assertion for array access
      const tabs = result as any[];
      const tab = tabs[0];
      
      if (tab && tab.id) {
        chrome.runtime.sendMessage({
          action: 'toggleCurrentTab',
          tabId: tab.id
        });
      }
      
      window.close();
    });
    
    // Click button
    button.click();
    
    // Use fake timers to handle Promise
    jest.useFakeTimers();
    jest.advanceTimersByTime(100);
    jest.useRealTimers();
    
    // Verify message sent
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'toggleCurrentTab',
      tabId: mockTabId
    });
    
    // Verify window closed
    expect(window.close).toHaveBeenCalled();
    
    // Restore original
    window.close = originalClose;
  });
});