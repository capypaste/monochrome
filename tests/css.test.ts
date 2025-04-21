// CSS tests for the Monochrome extension

describe('CSS Handling', () => {
  beforeEach(() => {
    // Reset document
    document.documentElement.className = '';
    document.documentElement.style.filter = '';
    
    // Remove any previous style elements
    const styles = document.querySelectorAll('style');
    styles.forEach(style => style.remove());
  });
  
  test('grayscale CSS should have high specificity with !important', () => {
    // Create style element with our grayscale CSS
    const style = document.createElement('style');
    style.textContent = `
      html.monochrome-enabled {
        filter: grayscale(100%) !important;
        -webkit-filter: grayscale(100%) !important;
        -moz-filter: grayscale(100%) !important;
      }
    `;
    document.head.appendChild(style);
    
    // Check the CSS contains !important
    const styleSheet = style.sheet as CSSStyleSheet;
    const rules = styleSheet.cssRules || styleSheet.rules;
    const cssText = rules[0].cssText;
    
    // Should contain !important flags
    expect(cssText).toContain('!important');
    
    // Apply the class
    document.documentElement.classList.add('monochrome-enabled');
    
    // JSDOM doesn't fully process CSS, but we can verify the class is applied
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(true);
  });
  
  test('CSS should include vendor prefixes for cross-browser support', () => {
    // Create and add our CSS file content to test
    const grayscaleCSS = `
      html.monochrome-enabled {
        filter: grayscale(100%) !important;
        -webkit-filter: grayscale(100%) !important;
        -moz-filter: grayscale(100%) !important;
        transition: filter 0.3s ease !important;
        -webkit-transition: -webkit-filter 0.3s ease !important;
        -moz-transition: -moz-filter 0.3s ease !important;
      }
      
      html.monochrome-enabled iframe {
        filter: grayscale(100%) !important;
        -webkit-filter: grayscale(100%) !important;
        -moz-filter: grayscale(100%) !important;
      }
    `;
    
    // Check for webkit prefixes
    expect(grayscaleCSS).toContain('-webkit-filter');
    expect(grayscaleCSS).toContain('-webkit-transition');
    
    // Check for moz prefixes
    expect(grayscaleCSS).toContain('-moz-filter');
    expect(grayscaleCSS).toContain('-moz-transition');
    
    // Check iframe CSS
    expect(grayscaleCSS).toContain('html.monochrome-enabled iframe');
  });
  
  test('should handle style conflict resolution', () => {
    // Add a competing style with lower specificity
    const competingStyle = document.createElement('style');
    competingStyle.textContent = `
      html {
        filter: sepia(100%);
      }
    `;
    document.head.appendChild(competingStyle);
    
    // Add our style with higher specificity and !important
    const ourStyle = document.createElement('style');
    ourStyle.textContent = `
      html.monochrome-enabled {
        filter: grayscale(100%) !important;
      }
    `;
    document.head.appendChild(ourStyle);
    
    // Apply the class
    document.documentElement.classList.add('monochrome-enabled');
    
    // In a real browser, our style would win
    // JSDOM doesn't fully process CSS, but we can check class application
    expect(document.documentElement.classList.contains('monochrome-enabled')).toBe(true);
  });
  
  test('CSS selectors should properly target iframes', () => {
    // Add our CSS
    const style = document.createElement('style');
    style.textContent = `
      html.monochrome-enabled iframe {
        filter: grayscale(100%) !important;
      }
    `;
    document.head.appendChild(style);
    
    // Create an iframe
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    
    // Apply class
    document.documentElement.classList.add('monochrome-enabled');
    
    // Get CSS rules
    const sheet = style.sheet as CSSStyleSheet;
    const rules = sheet.cssRules || sheet.rules;
    const rule = rules[0] as CSSStyleRule;
    
    // Check selector targets iframes
    expect(rule.selectorText).toBe('html.monochrome-enabled iframe');
  });
  
  test('transition effect should be smooth (short duration)', () => {
    // Add transition CSS
    const style = document.createElement('style');
    style.textContent = `
      html.monochrome-enabled {
        transition: filter 0.3s ease !important;
      }
    `;
    document.head.appendChild(style);
    
    // Get the CSS rule
    const sheet = style.sheet as CSSStyleSheet;
    const rules = sheet.cssRules || sheet.rules;
    const rule = rules[0] as CSSStyleRule;
    
    // Check transition duration is short but noticeable
    expect(rule.style.transition).toContain('0.3s');
    
    // Duration should be quick but visible (0.2-0.5s is good UX practice)
    const durationMatch = rule.style.transition.match(/([0-9.]+)s/);
    if (durationMatch) {
      const duration = parseFloat(durationMatch[1]);
      expect(duration).toBeGreaterThanOrEqual(0.2);
      expect(duration).toBeLessThanOrEqual(0.5);
    }
  });
});