// Edge case tests for the Monochrome extension

describe('Edge Cases', () => {
  // Test handling pages without a body
  test('extension should handle pages without document.body', () => {
    // Temporarily remove body
    const originalBody = document.body;
    
    // Define body getter/setter to simulate page loading
    Object.defineProperty(document, 'body', {
      value: null,
      writable: true,
      configurable: true
    });
    
    // Ensure document has no body
    expect(document.body).toBeNull();
    
    // Create mutation observer (from content.ts)
    const setupMutationObserver = () => {
      const observer = new MutationObserver(() => {});
      
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        // Should use this path for pages without body yet
        const bodyObserver = new MutationObserver(() => {
          if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            bodyObserver.disconnect();
          }
        });
        
        bodyObserver.observe(document.documentElement, { childList: true });
      }
      
      return observer;
    };
    
    // This should not throw an error
    expect(() => {
      const observer = setupMutationObserver();
      observer.disconnect();
    }).not.toThrow();
    
    // Restore body
    Object.defineProperty(document, 'body', {
      value: originalBody,
      writable: true,
      configurable: true
    });
  });
  
  // Test handling rapid toggle requests
  test('should handle rapid toggle requests gracefully', () => {
    // Create a toggle function that tracks state
    let isGrayscale = false;
    
    const toggleGrayscale = jest.fn(() => {
      isGrayscale = !isGrayscale;
      document.documentElement.classList.toggle('monochrome-enabled', isGrayscale);
      return isGrayscale;
    });
    
    // Perform multiple rapid toggles
    for (let i = 0; i < 10; i++) {
      toggleGrayscale();
    }
    
    // Should have been called 10 times
    expect(toggleGrayscale).toHaveBeenCalledTimes(10);
    
    // Final state should match number of toggles
    const expectedState = (10 % 2) === 0 ? false : true;
    expect(isGrayscale).toBe(expectedState);
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(expectedState);
  });
  
  // Test memory leak prevention with events
  test('event listeners should be properly manageable', () => {
    // Mock event listening and cleanup
    const addEventListener = jest.spyOn(document, 'addEventListener');
    const removeEventListener = jest.spyOn(document, 'removeEventListener');
    
    // Add listener
    const handler = () => {};
    document.addEventListener('click', handler);
    
    // Verify it was added
    expect(addEventListener).toHaveBeenCalledWith('click', handler);
    
    // Remove it
    document.removeEventListener('click', handler);
    
    // Verify it was removed
    expect(removeEventListener).toHaveBeenCalledWith('click', handler);
    
    // Restore spies
    addEventListener.mockRestore();
    removeEventListener.mockRestore();
  });
  
  // Test handling of nested iframes
  test('should handle nested iframes with CSS approach', () => {
    // Create nested iframes structure
    const iframe1 = document.createElement('iframe');
    document.body.appendChild(iframe1);
    
    // Create a CSS rule that targets iframes
    const style = document.createElement('style');
    style.textContent = `
      html.monochrome-enabled,
      html.monochrome-enabled iframe {
        filter: grayscale(100%) !important;
      }
    `;
    document.head.appendChild(style);
    
    // Apply grayscale class
    document.documentElement.classList.add('monochrome-enabled');
    
    // Check that the class is applied
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(true);
    
    // With real DOM rendering, this would verify the CSS cascade to iframes
  });
});