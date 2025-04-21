// Type definitions for tests

// Extend Window interface to allow for extensions in security tests
interface Window {
  toggleGrayscaleExposed?: Function;
  setupMutationObserverExposed?: Function;
  initializeStateExposed?: Function;
  toggleGrayscale?: Function;
  setupMutationObserver?: Function;
  initializeState?: Function;
}

// Custom type for mocked functions
type MockFn = {
  (...args: any[]): any;
  mock: {
    calls: any[][];
    instances: any[];
    invocationCallOrder: number[];
    results: any[];
  };
  mockClear(): MockFn;
  mockReset(): MockFn;
  mockImplementation(fn: (...args: any[]) => any): MockFn;
  mockImplementationOnce(fn: (...args: any[]) => any): MockFn;
  mockReturnThis(): MockFn;
  mockReturnValue(value: any): MockFn;
  mockReturnValueOnce(value: any): MockFn;
  mockResolvedValue(value: any): MockFn;
  mockResolvedValueOnce(value: any): MockFn;
  mockRejectedValue(value: any): MockFn;
  mockRejectedValueOnce(value: any): MockFn;
};

// Extend jest types for test environment
interface ChromeAPI {
  runtime: {
    onMessage: {
      addListener: MockFn;
      removeListener: MockFn;
    };
    sendMessage: MockFn;
  };
  tabs: {
    query: MockFn;
    onActivated: {
      addListener: MockFn;
    };
    onRemoved: {
      addListener: MockFn;
    };
    sendMessage: MockFn;
  };
  storage: {
    local: {
      get: MockFn;
      set: MockFn;
      remove: MockFn;
    };
  };
  action: {
    setBadgeText: MockFn;
    setBadgeBackgroundColor: MockFn;
    setIcon: MockFn;
    setTitle: MockFn;
  };
  scripting: {
    insertCSS: MockFn;
    removeCSS: MockFn;
  };
}

// Declare the mock Tab ID in global scope
declare global {
  var mockTabId: number;  // Using var instead of const for global declaration
  
  namespace NodeJS {
    interface Global {
      mockTabId: number;
      chrome: ChromeAPI;
      MutationObserver: any;
    }
  }
}

// Make this a module
export {};