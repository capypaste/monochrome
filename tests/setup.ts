// Define the mock tab ID for testing
const mockTabId = 12345;

// Set global mock tab ID
global.mockTabId = mockTabId;

// Create comprehensive Chrome API mocks
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    onActivated: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    executeScript: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setIcon: jest.fn(),
    setTitle: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    }
  },
  scripting: {
    insertCSS: jest.fn(),
    removeCSS: jest.fn(),
    executeScript: jest.fn()
  }
};

// Mock MutationObserver if needed
if (typeof global.MutationObserver !== 'function') {
  class MockMutationObserver {
    callback: Function;
    element: Element | null = null;
    options: MutationObserverInit | null = null;
    
    constructor(callback: Function) {
      this.callback = callback;
    }
    
    observe(element: Element, options: MutationObserverInit): void {
      this.element = element;
      this.options = options;
    }
    
    disconnect(): void {
      this.element = null;
      this.options = null;
    }
    
    // Required method for MutationObserver
    takeRecords(): MutationRecord[] {
      return [];
    }
  }
  
  global.MutationObserver = MockMutationObserver as any;
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset DOM
  if (document.documentElement) {
    document.documentElement.className = '';
    if (document.documentElement.style) {
      document.documentElement.style.filter = '';
    }
  }
});

export {};