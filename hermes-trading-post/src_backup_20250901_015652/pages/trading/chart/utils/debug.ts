// Debug utility for controlling chart logging
export const DEBUG_MODE = import.meta.env.DEV || false;

export const ChartDebug = {
  log: (...args: any[]) => {
    if (DEBUG_MODE) {
      console.log('[Chart]', ...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error('[Chart Error]', ...args);
  },
  
  warn: (...args: any[]) => {
    if (DEBUG_MODE) {
      console.warn('[Chart Warning]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (DEBUG_MODE) {
      console.info('[Chart Info]', ...args);
    }
  },
  
  // Critical logs that should always show
  critical: (...args: any[]) => {
    console.log('[Chart Critical]', ...args);
  }
};