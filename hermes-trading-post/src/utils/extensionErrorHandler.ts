/**
 * Utility to detect and handle browser extension errors
 * These errors are not from our application but from installed browser extensions
 */

// Track if we've already shown the extension error warning
let extensionErrorShown = false;
let errorCount = 0;

export function setupExtensionErrorHandler() {
  // Remove the chrome.runtime check - it's preventing the handler from working

  // Store original console methods
  const originalError = (console as any).error;
  const originalLog = (console as any).log;
  const originalWarn = (console as any).warn;

  // Helper to check if message is extension error
  const isExtensionError = (str: string) => {
    return str.includes('Unchecked runtime.lastError') ||
           str.includes('message channel closed') ||
           str.includes('chrome-extension://') ||
           str.includes('Extension context invalidated');
  };

  (console as any).error = function(...args: any[]) {
    const errorStr = args.map(arg => String(arg)).join(' ');
    if (isExtensionError(errorStr)) {
      showExtensionWarning();
      return;
    }
    originalError.apply(console, args);
  };

  (console as any).log = function(...args: any[]) {
    const logStr = args.map(arg => String(arg)).join(' ');
    if (isExtensionError(logStr)) {
      showExtensionWarning();
      return;
    }
    originalLog.apply(console, args);
  };

  (console as any).warn = function(...args: any[]) {
    const warnStr = args.map(arg => String(arg)).join(' ');
    if (isExtensionError(warnStr)) {
      showExtensionWarning();
      return;
    }
    originalWarn.apply(console, args);
  };

  // Intercept errors at the window level
  window.addEventListener('error', (event): void => {
    if (event.message && isExtensionError(event.message)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showExtensionWarning();
    }
  }, true); // Use capture phase

  // Also catch unhandledrejection events
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && isExtensionError(String(event.reason))) {
      event.preventDefault();
      showExtensionWarning();
    }
  }, true);
}

function showExtensionWarning() {
  errorCount++;

  // Only show the detailed warning once
  if (!extensionErrorShown) {
    extensionErrorShown = true;
  }
}

// Helper to identify problematic extensions
export function identifyProblematicExtensions() {
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

  // Also check for extension-injected elements
  const extensionElements = document.querySelectorAll('[id*="extension"], [class*="extension"], [data-extension]');

  if (suspiciousScripts.length > 0 || extensionElements.length > 0) {
    // Extension detected
  }
}
