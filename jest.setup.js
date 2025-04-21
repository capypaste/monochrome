// Mock Chrome API for testing

// Global mock tab ID for testing
global.mockTabId = 12345;

// Chrome API mocks
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
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
    sendMessage: jest.fn()
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
    setTitle: jest.fn()
  },
  scripting: {
    insertCSS: jest.fn(),
    removeCSS: jest.fn()
  }
};

// Mock MutationObserver if not available
if (typeof global.MutationObserver !== 'function') {
  global.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    
    observe(element, options) {
      this.element = element;
      this.options = options;
    }
    
    disconnect() {
      this.element = null;
      this.options = null;
    }
  };
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