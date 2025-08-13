/**
 * Utility to detect and handle browser extension errors
 * These errors are not from our application but from installed browser extensions
 */

export function setupExtensionErrorHandler() {
  // Detect if we're in a browser that supports extensions
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return;
  }

  // Override console.error to filter out extension errors
  const originalError = console.error;
  console.error = function(...args: any[]) {
    // Filter out the specific extension error
    const errorStr = args.join(' ');
    if (errorStr.includes('Unchecked runtime.lastError') && 
        errorStr.includes('message channel closed')) {
      // Log it as a warning instead with helpful context
      console.warn(
        '%c[Browser Extension Error Detected]',
        'color: orange; font-weight: bold',
        '\nThis error is from a browser extension, not Hermes Trading Post.',
        '\nTo identify which extension:',
        '\n1. Open Chrome DevTools',
        '\n2. Go to Sources tab',
        '\n3. Look for inject.js or similar extension files',
        '\n4. The extension causing this can be temporarily disabled in chrome://extensions',
        '\n\nOriginal error:', errorStr
      );
      return;
    }
    
    // Call original console.error for other errors
    originalError.apply(console, args);
  };

  // Also add a global error handler to catch uncaught extension errors
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('Unchecked runtime.lastError')) {
      event.preventDefault(); // Prevent the error from showing in console
      console.warn(
        '%c[Browser Extension Error Intercepted]',
        'color: orange; font-weight: bold',
        '\nA browser extension is causing errors. This does not affect Hermes Trading Post functionality.'
      );
    }
  });

  // Log extension detection info
  console.info(
    '%c[Extension Error Handler Active]',
    'color: blue; font-weight: bold',
    '\nFiltering out browser extension errors to keep console clean.',
    '\nTo see all errors, disable this handler in main.ts'
  );
}

// Helper to identify problematic extensions
export function identifyProblematicExtensions() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('Extension detection not available in this browser');
    return;
  }

  // Check for common problematic patterns
  const suspiciousScripts = Array.from(document.scripts)
    .filter(script => {
      const src = script.src;
      return src && (
        src.includes('inject.js') ||
        src.includes('content.js') ||
        src.includes('extension://') ||
        src.includes('chrome-extension://')
      );
    });

  if (suspiciousScripts.length > 0) {
    console.group('%c[Detected Extension Scripts]', 'color: orange; font-weight: bold');
    suspiciousScripts.forEach(script => {
      console.log('Extension script:', script.src);
    });
    console.groupEnd();
  }
}