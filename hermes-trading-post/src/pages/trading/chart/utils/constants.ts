// Time period mappings
export const PERIOD_TO_SECONDS: Record<string, number> = {
  '1H': 3600,       // 1 hour
  '4H': 14400,      // 4 hours
  '6H': 21600,      // 6 hours
  '1D': 86400,      // 1 day
  '5D': 432000,     // 5 days
  '1W': 604800,     // 1 week
  '1M': 2592000,    // 30 days
  '3M': 7776000,    // 90 days
  '6M': 15552000,   // 180 days
  '1Y': 31536000,   // 365 days
  '5Y': 157680000   // 5 years (1825 days)
};

export const PERIOD_TO_DAYS: Record<string, number> = {
  '1H': 0.042,     // ~1 hour
  '4H': 0.167,     // 4 hours
  '6H': 0.25,      // 6 hours
  '1D': 1,         // 1 day
  '5D': 5,         // 5 days
  '1W': 7,         // 7 days
  '1M': 30,        // 30 days
  '3M': 90,        // 90 days
  '6M': 180,       // 180 days
  '1Y': 365,       // 365 days
  '5Y': 1825       // 5 years
};

// ✅ VALIDATED Coinbase Advanced Trade API Granularities (2025-10-21)
// 🚀 Upgraded from Exchange API to Advanced Trade API - now supports 30m, 2h, 4h
export const GRANULARITY_TO_SECONDS: Record<string, number> = {
  '1m': 60,        // 1 minute
  '5m': 300,       // 5 minutes
  '15m': 900,      // 15 minutes
  '30m': 1800,     // 30 minutes ✅ Re-enabled
  '1h': 3600,      // 1 hour
  '2h': 7200,      // 2 hours ✅ Now supported
  '4h': 14400,     // 4 hours ✅ Re-enabled
  '6h': 21600,     // 6 hours
  '1d': 86400      // 1 day
};

// Advanced Trade API note:
// The Advanced Trade API provides additional granularities that were not available
// in the old Exchange API. This allows better flexibility for different trading timeframes.

// Display names
export const PERIOD_DISPLAY_NAMES: Record<string, string> = {
  '1H': '1 Hour',
  '4H': '4 Hours',
  '6H': '6 Hours',
  '1D': '1 Day',
  '5D': '5 Days',
  '1W': '1 Week',
  '1M': '1 Month',
  '3M': '3 Months',
  '6M': '6 Months',
  '1Y': '1 Year',
  '5Y': '5 Years'
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
  '1d': '1 Day'
};

// ✅ Validated trading intervals for each timeframe (Advanced Trade API - 2025-10-21)
// 🚀 Updated to include 30m, 2h, 4h for more flexible trading
export const RECOMMENDED_GRANULARITIES: Record<string, string[]> = {
  '1H': ['1m', '5m', '15m', '30m'],     // 60-12-4-2 candles
  '4H': ['5m', '15m', '30m', '1h'],     // 48-16-8-4 candles
  '6H': ['5m', '15m', '30m', '1h'],     // 72-24-12-6 candles
  '1D': ['15m', '30m', '1h', '2h', '4h', '6h'],  // 96-48-24-12-6-4 candles
  '5D': ['1h', '2h', '4h', '6h'],       // 120-60-30-20 candles
  '1W': ['1h', '2h', '4h', '6h'],       // 168-84-42-28 candles
  '1M': ['4h', '6h', '1d'],             // 180-120-30 candles
  '3M': ['1d'],                         // 90 candles
  '6M': ['1d'],                         // 180 candles
  '1Y': ['1d'],                         // 365 candles
  '5Y': ['1d']                          // 1825 candles
};

// ✅ All supported intervals for each timeframe (Advanced Trade API validated)
export const VALID_GRANULARITIES: Record<string, string[]> = {
  '1H': ['1m', '5m', '15m', '30m'],
  '4H': ['5m', '15m', '30m', '1h', '2h'],
  '6H': ['5m', '15m', '30m', '1h', '2h'],
  '1D': ['15m', '30m', '1h', '2h', '4h', '6h'],
  '5D': ['1h', '2h', '4h', '6h', '1d'],
  '1W': ['1h', '2h', '4h', '6h', '1d'],
  '1M': ['2h', '4h', '6h', '1d'],
  '3M': ['1d'],
  '6M': ['1d'],
  '1Y': ['1d'],
  '5Y': ['1d']
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
    textColor: '#d1d4dc',
    grid: 'rgba(255, 255, 255, 0.1)',
    gridLines: 'rgba(255, 255, 255, 0.1)',
    border: '#2a2a2a',
    borderColor: '#2a2a2a',
    crosshair: 'rgba(255, 255, 255, 0.5)',
    upColor: '#26a69a',
    downColor: '#ef5350',
    candleUp: '#26a69a',
    candleDown: '#ef5350',
    volume: 'rgba(38, 166, 154, 0.3)',
    volumeUp: 'rgba(38, 166, 154, 0.6)',
    volumeDown: 'rgba(239, 83, 80, 0.6)'
  },
  LIGHT: {
    background: '#ffffff',
    textColor: '#191919',
    grid: 'rgba(225, 225, 225, 0.4)',
    gridLines: 'rgba(225, 225, 225, 0.4)',
    border: '#e1e1e1',
    borderColor: '#e1e1e1',
    crosshair: 'rgba(0, 0, 0, 0.3)',
    upColor: '#26a69a',
    downColor: '#ef5350',
    candleUp: '#26a69a',
    candleDown: '#ef5350',
    volume: 'rgba(38, 166, 154, 0.3)',
    volumeUp: 'rgba(38, 166, 154, 0.6)',
    volumeDown: 'rgba(239, 83, 80, 0.6)'
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