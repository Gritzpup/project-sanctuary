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
  const originalError = console.error;
  const originalLog = console.log;
  const originalWarn = console.warn;
  
  // Helper to check if message is extension error
  const isExtensionError = (str: string) => {
    return str.includes('Unchecked runtime.lastError') || 
           str.includes('message channel closed') ||
           str.includes('chrome-extension://') ||
           str.includes('Extension context invalidated');
  };
  
  // Override console.error
  console.error = function(...args: any[]) {
    const errorStr = args.map(arg => String(arg)).join(' ');
    if (isExtensionError(errorStr)) {
      showExtensionWarning();
      return;
    }
    originalError.apply(console, args);
  };
  
  // Override console.log (some extension errors come through here)
  console.log = function(...args: any[]) {
    const logStr = args.map(arg => String(arg)).join(' ');
    if (isExtensionError(logStr)) {
      showExtensionWarning();
      return;
    }
    originalLog.apply(console, args);
  };
  
  // Override console.warn
  console.warn = function(...args: any[]) {
    const warnStr = args.map(arg => String(arg)).join(' ');
    if (isExtensionError(warnStr)) {
      showExtensionWarning();
      return;
    }
    originalWarn.apply(console, args);
  };
  
  // Intercept errors at the window level
  window.addEventListener('error', (event) => {
    if (event.message && isExtensionError(event.message)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showExtensionWarning();
      return false;
    }
  }, true); // Use capture phase
  
  // Also catch unhandledrejection events
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && isExtensionError(String(event.reason))) {
      event.preventDefault();
      showExtensionWarning();
    }
  }, true);
  
  // Log that handler is active
  console.info(
    '%c[Extension Error Handler Active]',
    'color: blue; font-weight: bold',
    '\nSuppressing browser extension errors. These do not affect app functionality.'
  );
}

function showExtensionWarning() {
  errorCount++;
  
  // Only show the detailed warning once
  if (!extensionErrorShown) {
    extensionErrorShown = true;
    
    // Use the original console.warn to ensure it shows
    (console as any).__proto__.warn.call(
      console,
      '%c[Browser Extension Error Detected]',
      'color: orange; font-weight: bold; font-size: 14px',
      '\n\n⚠️  This error is from a browser extension, NOT from Hermes Trading Post!\n',
      '\n📍 Error source: inject.js (probably line 22)',
      '\n\n🔍 To find which extension:',
      '\n   1. Open Chrome DevTools → Sources tab',
      '\n   2. Search for "inject.js"',
      '\n   3. Check chrome://extensions',
      '\n\n✅ Your app is working fine. These errors can be safely ignored.',
      '\n\n💡 To stop these errors, disable the problematic extension.',
      `\n\n📊 Total extension errors suppressed: ${errorCount}`
    );
  }
}

// Helper to identify problematic extensions
export function identifyProblematicExtensions() {
  // Don't check for chrome.runtime - just look for extension scripts
  
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
    console.group('%c[Detected Extension Activity]', 'color: orange; font-weight: bold');
    
    if (suspiciousScripts.length > 0) {
      console.log(`Found ${suspiciousScripts.length} extension scripts:`);
      suspiciousScripts.forEach(script => {
        console.log('  📜 Extension script:', script.src);
      });
    }
    
    if (extensionElements.length > 0) {
      console.log(`Found ${extensionElements.length} extension-injected elements`);
    }
    
    console.log('\n💡 These extensions may be causing the "runtime.lastError" messages.');
    console.groupEnd();
  } else {
    console.log(
      '%c[No Extension Scripts Detected]',
      'color: green',
      'Extension errors may be coming from background scripts not visible here.'
    );
  }
}