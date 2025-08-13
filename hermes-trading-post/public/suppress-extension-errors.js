// This script runs before anything else to suppress extension errors
// It must be vanilla JS (no TypeScript) to run immediately

(function() {
  'use strict';
  
  // Flag to track if we've shown the warning
  let warningShown = false;
  let suppressedCount = 0;
  
  // Store original console methods before anything can override them
  const originalConsole = {
    error: console.error,
    log: console.log,
    warn: console.warn
  };
  
  // Helper to detect extension errors
  function isExtensionError(args) {
    const str = Array.from(args).join(' ');
    return str.includes('Unchecked runtime.lastError') || 
           str.includes('message channel closed') ||
           str.includes('Extension context invalidated') ||
           (str.includes('(index):1') && str.includes('runtime'));
  }
  
  // Override all console methods
  ['error', 'log', 'warn'].forEach(method => {
    console[method] = function() {
      if (isExtensionError(arguments)) {
        suppressedCount++;
        if (!warningShown) {
          warningShown = true;
          originalConsole.warn(
            '%c🛡️ Extension Error Blocker Active',
            'color: #ff9800; font-weight: bold; font-size: 16px',
            '\n\nBrowser extension errors are being suppressed.',
            '\nThese errors (from inject.js:22) do NOT affect your app!',
            '\n\nTo find the extension: chrome://extensions',
            '\n\nSuppressed errors:', suppressedCount
          );
        }
        return;
      }
      originalConsole[method].apply(console, arguments);
    };
  });
  
  // Intercept window error events
  const errorHandler = function(event) {
    if (event && event.message && (
      event.message.includes('Unchecked runtime.lastError') ||
      event.message.includes('message channel closed')
    )) {
      event.stopImmediatePropagation();
      event.preventDefault();
      suppressedCount++;
      return false;
    }
  };
  
  // Add error handler with maximum priority
  window.addEventListener('error', errorHandler, true);
  
  // Also handle unhandledrejection
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.toString().includes('runtime.lastError')) {
      event.preventDefault();
      suppressedCount++;
    }
  }, true);
  
})();