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
  MEMORY: false,          // Memory optimization and TypedArrays (Phase 2)
  ALL: false,             // Master switch - set to true to enable all logs (was: DEBUG_MODE)
};

export const ChartDebug = {
  log: (...args: any[]) => {
    if (DEBUG_FLAGS.ALL) {
    }
  },

  error: (...args: any[]) => {
    // Always log errors
  },

  warn: (...args: any[]) => {
    if (DEBUG_FLAGS.ALL) {
    }
  },

  info: (...args: any[]) => {
    if (DEBUG_FLAGS.ALL) {
    }
  },

  // Critical logs that should always show
  critical: (...args: any[]) => {
  },

  // Feature-specific loggers
  realtime: (...args: any[]) => {
    if (DEBUG_FLAGS.REALTIME || DEBUG_FLAGS.ALL) {
    }
  },

  dataLoading: (...args: any[]) => {
    if (DEBUG_FLAGS.DATA_LOADING || DEBUG_FLAGS.ALL) {
    }
  },

  plugins: (...args: any[]) => {
    if (DEBUG_FLAGS.PLUGINS || DEBUG_FLAGS.ALL) {
    }
  },

  volume: (...args: any[]) => {
    if (DEBUG_FLAGS.VOLUME || DEBUG_FLAGS.ALL) {
    }
  },

  positioning: (...args: any[]) => {
    if (DEBUG_FLAGS.POSITIONING || DEBUG_FLAGS.ALL) {
    }
  },

  userInteraction: (...args: any[]) => {
    if (DEBUG_FLAGS.USER_INTERACTION || DEBUG_FLAGS.ALL) {
    }
  },

  granularity: (...args: any[]) => {
    if (DEBUG_FLAGS.GRANULARITY || DEBUG_FLAGS.ALL) {
    }
  },

  memory: (...args: any[]) => {
    if (DEBUG_FLAGS.MEMORY || DEBUG_FLAGS.ALL) {
    }
  }
};