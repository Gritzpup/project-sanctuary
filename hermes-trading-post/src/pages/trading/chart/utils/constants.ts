// Time period mappings
export const PERIOD_TO_SECONDS: Record<string, number> = {
  '1H': 3600,      // 1 hour
  '6H': 21600,     // 6 hours
  '1D': 86400,     // 1 day
  '1W': 604800,    // 1 week
  '1M': 2592000,   // 30 days
  '3M': 7776000,   // 90 days
  '1Y': 31536000   // 365 days
};

export const PERIOD_TO_DAYS: Record<string, number> = {
  '1H': 0.042,     // ~1 hour
  '6H': 0.25,      // 6 hours
  '1D': 1,         // 1 day
  '1W': 7,         // 7 days
  '1M': 30,        // 30 days
  '3M': 90,        // 90 days
  '1Y': 365        // 365 days
};

// Granularity mappings
export const GRANULARITY_TO_SECONDS: Record<string, number> = {
  '1m': 60,        // 1 minute
  '5m': 300,       // 5 minutes
  '15m': 900,      // 15 minutes
  '30m': 1800,     // 30 minutes
  '1h': 3600,      // 1 hour
  '2h': 7200,      // 2 hours
  '4h': 14400,     // 4 hours
  '6h': 21600,     // 6 hours
  '12h': 43200,    // 12 hours
  '1d': 86400      // 1 day
};

// Display names
export const PERIOD_DISPLAY_NAMES: Record<string, string> = {
  '1H': '1 Hour',
  '6H': '6 Hours',
  '1D': '1 Day',
  '1W': '1 Week',
  '1M': '1 Month',
  '3M': '3 Months',
  '1Y': '1 Year'
};

export const GRANULARITY_DISPLAY_NAMES: Record<string, string> = {
  '1m': '1 Minute',
  '5m': '5 Minutes',
  '15m': '15 Minutes',
  '30m': '30 Minutes',
  '1h': '1 Hour',
  '2h': '2 Hours',
  '4h': '4 Hours',
  '6h': '6 Hours',
  '12h': '12 Hours',
  '1d': '1 Day'
};

// Traditional trading intervals for each timeframe (realistic data points)
export const RECOMMENDED_GRANULARITIES: Record<string, string[]> = {
  '1H': ['1m', '5m'],                    // 60-12 candles
  '6H': ['5m', '15m', '30m'],           // 72-12 candles  
  '1D': ['15m', '30m', '1h'],           // 96-24 candles
  '1W': ['1h', '4h'],                   // 168-42 candles
  '1M': ['4h', '1d'],                   // 180-30 candles
  '3M': ['1d'],                         // 90 candles
  '1Y': ['1d']                          // 365 candles
};

// All possible intervals for each timeframe (including non-recommended)
export const VALID_GRANULARITIES: Record<string, string[]> = {
  '1H': ['1m', '5m', '15m'],
  '6H': ['1m', '5m', '15m', '30m', '1h'],
  '1D': ['5m', '15m', '30m', '1h', '4h'],
  '1W': ['30m', '1h', '4h', '1d'],
  '1M': ['1h', '4h', '1d'],
  '3M': ['4h', '1d'],
  '1Y': ['1d']
};

// WebSocket configuration
export const WS_CONFIG = {
  URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8080',
  RECONNECT_DELAY: 5000,
  HEARTBEAT_INTERVAL: 30000,
  MESSAGE_THROTTLE: 100
};

// Cache configuration
export const CACHE_CONFIG = {
  MAX_ENTRIES: 100,
  EXPIRY_MINUTES: 5,
  CLEANUP_INTERVAL: 60000 // 1 minute
};

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  FPS: {
    EXCELLENT: 55,
    GOOD: 45,
    FAIR: 30,
    POOR: 20
  },
  RENDER_TIME: {
    EXCELLENT: 16,  // 60 FPS
    GOOD: 33,       // 30 FPS
    FAIR: 50,       // 20 FPS
    POOR: 100       // 10 FPS
  },
  DATA_LOAD_TIME: {
    EXCELLENT: 500,
    GOOD: 1000,
    FAIR: 2000,
    POOR: 5000
  }
};

// Chart colors
export const CHART_COLORS = {
  DARK: {
    background: '#1a1a1a',
    text: '#d1d4dc',
    grid: '#2a2a2a',
    border: '#2a2a2a',
    upColor: '#26a69a',
    downColor: '#ef5350'
  },
  LIGHT: {
    background: '#ffffff',
    text: '#191919',
    grid: '#e1e1e1',
    border: '#e1e1e1',
    upColor: '#26a69a',
    downColor: '#ef5350'
  }
};

// Default configuration
export const DEFAULT_CONFIG = {
  PAIR: 'BTC-USD',
  TIMEFRAME: '1H',
  GRANULARITY: '1m',
  THEME: 'dark' as const,
  SHOW_VOLUME: true,
  SHOW_GRID: true,
  SHOW_CROSSHAIR: true
};