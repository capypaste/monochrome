// Track our observer instance for dynamic content
let mutationObserver: MutationObserver | null = null;

// Simple debounce function to improve performance
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<F>): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

// Function to toggle grayscale filter
function toggleGrayscale(enabled: boolean): void {
  if (enabled) {
    // Apply grayscale filter
    document.documentElement.style.filter = 'grayscale(100%)';
    document.documentElement.style.transition = 'filter 0.3s ease';
    
    // Setup observer for SPAs and dynamically loaded content
    setupMutationObserver();
  } else {
    // Remove grayscale filter
    document.documentElement.style.filter = 'none';
    
    // Clean up observer when not needed
    disconnectMutationObserver();
  }
}

// Set up observer to handle dynamically added content
function setupMutationObserver(): void {
  if (mutationObserver) return; // Already observing
  
  // Process iframes that might have been added
  const processAddedIframes = (node: Node): void => {
    // Look for added iframes
    if (node instanceof HTMLIFrameElement) {
      try {
        // Try to access iframe content if same-origin
        if (node.contentDocument) {
          node.contentDocument.documentElement.style.filter = 'grayscale(100%)';
          node.contentDocument.documentElement.style.transition = 'filter 0.3s ease';
        }
      } catch (e) {
        // Cross-origin iframe - can't modify directly
        console.debug('Could not apply grayscale to cross-origin iframe');
      }
    }
  };

  // Debounce the processing to improve performance on complex pages
  const processAddedNodesDebounced = debounce((mutations: MutationRecord[]) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(processAddedIframes);
      }
    });
  }, 50); // 50ms debounce time

  const observer = new MutationObserver((mutations) => {
    processAddedNodesDebounced(mutations);
  });

  // Store the observer reference
  mutationObserver = observer;

  // Start observing the document with the configured parameters
  // Make sure body exists before observing
  if (document.body) {
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  } else {
    // If body isn't available yet, wait for it
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        observer.observe(document.body, { 
          childList: true, 
          subtree: true 
        });
        bodyObserver.disconnect();
      }
    });
    
    bodyObserver.observe(document.documentElement, { childList: true });
  }
}

// Clean up observer when grayscale is disabled
function disconnectMutationObserver(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
}

// Check if the page is already in grayscale mode when loaded
async function initializeState(): Promise<void> {
  try {
    // Add a small delay to ensure the background script is ready
    // This helps when the extension is newly installed on an already open page
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const tabId = await getCurrentTabId();
    if (!tabId) return;

    const result = await chrome.storage.local.get(`tab_${tabId}`);
    const tabState = result[`tab_${tabId}`];
    
    if (tabState && tabState.isGrayscale) {
      toggleGrayscale(true);
    }
  } catch (error) {
    console.error('Error initializing grayscale state:', error);
    // If getting the tab ID fails, try again after a short delay
    setTimeout(initializeState, 1000);
  }
}

// Helper function to get current tab ID
async function getCurrentTabId(): Promise<number | undefined> {
  // In content scripts, we can't directly access chrome.tabs API
  // So we need to use the tab ID stored by the background script
  return new Promise<number | undefined>((resolve) => {
    chrome.runtime.sendMessage({ action: 'getTabId' }, (response) => {
      resolve(response?.tabId);
    });
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleGrayscale') {
    toggleGrayscale(message.isGrayscale);
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async responses
});

// Initialize state when the content script loads
document.addEventListener('DOMContentLoaded', initializeState);

// For pages that might already be loaded when the extension activates
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeState();
}
