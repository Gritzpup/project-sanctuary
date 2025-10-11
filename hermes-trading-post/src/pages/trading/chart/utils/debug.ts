// Debug utility for controlling chart logging
export const DEBUG_MODE = import.meta.env.DEV || false;

// Fine-grained debug controls - set to true to enable specific categories
// In production (ALL: false), no logs will appear
// In development, enable individual categories as needed for debugging
export const DEBUG_FLAGS = {
  REALTIME: false,        // Real-time WebSocket updates
  DATA_LOADING: false,    // Data fetching and loading
  PLUGINS: false,         // Plugin lifecycle
  VOLUME: false,          // Volume calculations
  POSITIONING: false,     // Chart positioning and scrolling
  USER_INTERACTION: false, // User clicks and interactions
  GRANULARITY: false,     // Granularity switching
  ALL: false,             // Master switch - set to true to enable all logs (was: DEBUG_MODE)
};

export const ChartDebug = {
  log: (...args: any[]) => {
    if (DEBUG_FLAGS.ALL) {
      console.log('[Chart]', ...args);
    }
  },

  error: (...args: any[]) => {
    // Always log errors
    console.error('[Chart Error]', ...args);
  },

  warn: (...args: any[]) => {
    if (DEBUG_FLAGS.ALL) {
      console.warn('[Chart Warning]', ...args);
    }
  },

  info: (...args: any[]) => {
    if (DEBUG_FLAGS.ALL) {
      console.info('[Chart Info]', ...args);
    }
  },

  // Critical logs that should always show
  critical: (...args: any[]) => {
    console.log('[Chart Critical]', ...args);
  },

  // Feature-specific loggers
  realtime: (...args: any[]) => {
    if (DEBUG_FLAGS.REALTIME || DEBUG_FLAGS.ALL) {
      console.log('[Realtime]', ...args);
    }
  },

  dataLoading: (...args: any[]) => {
    if (DEBUG_FLAGS.DATA_LOADING || DEBUG_FLAGS.ALL) {
      console.log('[DataLoading]', ...args);
    }
  },

  plugins: (...args: any[]) => {
    if (DEBUG_FLAGS.PLUGINS || DEBUG_FLAGS.ALL) {
      console.log('[Plugins]', ...args);
    }
  },

  volume: (...args: any[]) => {
    if (DEBUG_FLAGS.VOLUME || DEBUG_FLAGS.ALL) {
      console.log('[Volume]', ...args);
    }
  },

  positioning: (...args: any[]) => {
    if (DEBUG_FLAGS.POSITIONING || DEBUG_FLAGS.ALL) {
      console.log('[Positioning]', ...args);
    }
  },

  userInteraction: (...args: any[]) => {
    if (DEBUG_FLAGS.USER_INTERACTION || DEBUG_FLAGS.ALL) {
      console.log('[UserInteraction]', ...args);
    }
  },

  granularity: (...args: any[]) => {
    if (DEBUG_FLAGS.GRANULARITY || DEBUG_FLAGS.ALL) {
      console.log('[Granularity]', ...args);
    }
  }
};