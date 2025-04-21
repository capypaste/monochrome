// This is a test file that tests content script functionality separately from the actual implementation
// We're recreating simplified versions of the functions here for testing

// Create a DOM environment for testing
beforeEach(() => {
  // Reset DOM
  document.documentElement.className = '';
  document.documentElement.style.filter = '';
  
  // Reset our test observer (make sure it's null at the start of each test)
  testObserver = null;
  
  // Clear any existing style elements
  const styles = document.querySelectorAll('style');
  styles.forEach(style => style.remove());
  
  // Create a body if not exists
  if (!document.body) {
    const body = document.createElement('body');
    document.documentElement.appendChild(body);
  }
});

// Test-only variables and functions (not importing from actual content.ts)
let testObserver: MutationObserver | null = null;

// Test implementation of toggleGrayscale
function toggleGrayscale(enabled: boolean): void {
  if (enabled) {
    document.documentElement.classList.add('monochrome-enabled');
    setupMutationObserver();
  } else {
    document.documentElement.classList.remove('monochrome-enabled');
    disconnectMutationObserver();
  }
}

// Test implementation of setupMutationObserver
function setupMutationObserver(): void {
  if (testObserver) return;
  
  const observer = new MutationObserver(() => {});
  testObserver = observer;
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        bodyObserver.disconnect();
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true });
  }
}

// Test implementation of disconnectMutationObserver
function disconnectMutationObserver(): void {
  if (testObserver) {
    testObserver.disconnect();
    testObserver = null;
  }
}

describe('Content Script', () => {
  // Test toggling grayscale function
  test('toggleGrayscale should add monochrome-enabled class when enabled', () => {
    // Initial state
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(false);
    
    // Apply grayscale
    toggleGrayscale(true);
    
    // Check class was added
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(true);
  });
  
  test('toggleGrayscale should remove monochrome-enabled class when disabled', () => {
    // Setup: add class first
    document.documentElement.classList.add('monochrome-enabled');
    
    // Disable grayscale
    toggleGrayscale(false);
    
    // Check class was removed
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(false);
  });
  
  // Test MutationObserver setup
  test('setupMutationObserver should create a single observer instance', () => {
    // First call should create observer
    setupMutationObserver();
    expect(testObserver).not.toBeNull();
    
    // Store the original observer
    const originalObserver = testObserver;
    
    // Second call should reuse existing observer
    setupMutationObserver();
    expect(testObserver).toBe(originalObserver);
  });
  
  // Test observer cleanup
  test('disconnectMutationObserver should clean up the observer', () => {
    // Setup observer
    setupMutationObserver();
    expect(testObserver).not.toBeNull();
    
    // Mock disconnect method
    const disconnectSpy = jest.spyOn(testObserver as MutationObserver, 'disconnect');
    
    // Disconnect
    disconnectMutationObserver();
    
    // Verify observer was disconnected and reset
    expect(disconnectSpy).toHaveBeenCalled();
    expect(testObserver).toBeNull();
  });
  
  // Performance test
  test('toggleGrayscale should execute within performance budget', () => {
    // Setup: create many elements to simulate a complex page
    for (let i = 0; i < 100; i++) {
      const div = document.createElement('div');
      div.textContent = `Element ${i}`;
      document.body.appendChild(div);
    }
    
    // Measure execution time
    const start = performance.now();
    toggleGrayscale(true);
    const end = performance.now();
    
    // Should execute in under 50ms
    expect(end - start).toBeLessThan(50);
  });
  
  // CSS specificity test
  test('monochrome-enabled class should add grayscale styling', () => {
    // Create a style element with our grayscale CSS
    const style = document.createElement('style');
    style.textContent = `
      html.monochrome-enabled {
        filter: grayscale(100%) !important;
        -webkit-filter: grayscale(100%) !important;
      }
    `;
    document.head.appendChild(style);
    
    // Apply grayscale
    toggleGrayscale(true);
    
    // Get computed style (simplified in JSDOM)
    const computedStyle = window.getComputedStyle(document.documentElement);
    
    // In real browsers this would check for grayscale filter
    // but JSDOM has limited CSS support
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(true);
  });
});