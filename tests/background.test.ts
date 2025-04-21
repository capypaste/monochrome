import '../src/background';

// Since the background script defines functions in its own scope,
// we'll need to mock and test the interactions rather than calling the functions directly

describe('Background Script', () => {
  // Test message handling for getTabId
  test('should respond with tabId when receiving getTabId message', () => {
    const sendResponse = jest.fn();
    const message = { action: 'getTabId' };
    const sender = { tab: { id: mockTabId } };
    
    // Simulate message event - using type assertion to handle TypeScript errors
    const addListener = chrome.runtime.onMessage.addListener as any;
    const listeners = addListener.mock.calls;
    const messageHandler = listeners[listeners.length - 1][0];
    
    // Call the message handler directly
    messageHandler(message, sender, sendResponse);
    
    // Verify the response
    expect(sendResponse).toHaveBeenCalledWith({ tabId: mockTabId });
  });
  
  // Test message handling for toggleCurrentTab
  test('should handle toggleCurrentTab message', () => {
    const sendResponse = jest.fn();
    const message = { 
      action: 'toggleCurrentTab',
      tabId: mockTabId 
    };
    
    // Setup mocks for toggle process - using type assertion
    const getMock = chrome.storage.local.get as any;
    getMock.mockImplementation((key, callback) => {
      // Simulate current grayscale state
      callback({ [`tab_${mockTabId}`]: { isGrayscale: false } });
    });
    
    // Simulate message event - using type assertion
    const addListener = chrome.runtime.onMessage.addListener as any;
    const listeners = addListener.mock.calls;
    const messageHandler = listeners[listeners.length - 1][0];
    
    // Call the message handler directly
    messageHandler(message, {}, sendResponse);
    
    // We need to wait for async operations
    jest.useFakeTimers();
    setTimeout(() => {
      // Verify storage was updated
      expect(chrome.storage.local.set).toHaveBeenCalled();
      
      // Badge should be updated
      expect(chrome.action.setBadgeText).toHaveBeenCalled();
      
      // Response should be sent
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    }, 100);
    jest.advanceTimersByTime(100);
    jest.useRealTimers();
  });
  
  // Test tab state management
  test('should clean up tab state when tab is closed', () => {
    // Simulate tab removed event - using type assertion
    const addListener = chrome.tabs.onRemoved.addListener as any;
    const listeners = addListener.mock.calls;
    const tabRemovedHandler = listeners[listeners.length - 1][0];
    
    // Call the handler with a mock tab ID
    tabRemovedHandler(mockTabId);
    
    // Verify storage cleanup
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(`tab_${mockTabId}`);
  });
  
  // Test icon update on tab activation
  test('should update icon when tab becomes active', () => {
    // Setup mock storage response - using type assertion
    const getMock = chrome.storage.local.get as any;
    getMock.mockImplementation((key, callback) => {
      callback({ [`tab_${mockTabId}`]: { isGrayscale: true } });
    });
    
    // Simulate tab activated event - using type assertion
    const addListener = chrome.tabs.onActivated.addListener as any;
    const listeners = addListener.mock.calls;
    const tabActivatedHandler = listeners[listeners.length - 1][0];
    
    // Call the handler with a mock tab info
    tabActivatedHandler({ tabId: mockTabId });
    
    // Verify icon was updated
    jest.useFakeTimers();
    setTimeout(() => {
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
        tabId: mockTabId,
        text: 'ON'
      });
      
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalled();
      expect(chrome.action.setTitle).toHaveBeenCalled();
    }, 100);
    jest.advanceTimersByTime(100);
    jest.useRealTimers();
  });
});