/**
 * Core trading types to eliminate 'any' usage
 */

// Trading pairs
export type SupportedTradingPair = 
  | 'BTC-USD' | 'ETH-USD' | 'LTC-USD' | 'BCH-USD' | 'PAXG-USD'
  | 'ADA-USD' | 'DOT-USD' | 'LINK-USD' | 'XLM-USD' | 'UNI-USD';

// Time granularities  
export type SupportedGranularity = 
  | '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d';

// Strategy types
export type SupportedStrategy = 
  | 'reverse-descending-grid' | 'grid-trading' | 'rsi-mean-reversion' 
  | 'dca' | 'vwap-bounce' | 'micro-scalping' | 'proper-scalping' 
  | 'ultra-micro-scalping';

// Trade sides
export type TradeSide = 'buy' | 'sell';

// Order types
export type OrderType = 'market' | 'limit' | 'stop' | 'stop-limit';

// Order status
export type OrderStatus = 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';

// Trade data structure
export interface TradeData {
  id: string;
  symbol: SupportedTradingPair;
  side: TradeSide;
  quantity: number;
  price: number;
  timestamp: string;
  fees?: number;
  orderId?: string;
  type?: OrderType;
  status?: OrderStatus;
}

// Position data structure
export interface PositionData {
  id: string;
  symbol: SupportedTradingPair;
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  unrealizedPL?: number;
  timestamp: string;
}

// Balance structure
export interface Balance {
  usd: number;
  btc: number;
  vault?: {
    usd: number;
    btc: number;
  };
}

// Strategy configuration
export interface StrategyConfig {
  strategyType: SupportedStrategy;
  initialDropPercent?: number;
  levelDropPercent?: number;
  profitTargetPercent?: number;
  maxLevels?: number;
  basePositionPercent?: number;
  [key: string]: unknown; // Allow additional strategy-specific config
}

// Market data
export interface MarketData {
  symbol: SupportedTradingPair;
  price: number;
  volume: number;
  timestamp: string;
  priceChange24h?: number;
  priceChangePercent24h?: number;
}

// Bot/instance data
export interface BotInstance {
  id: string;
  name: string;
  isRunning: boolean;
  strategy?: StrategyConfig;
  balance?: Balance;
  trades?: TradeData[];
  positions?: PositionData[];
  performance?: {
    totalReturn: number;
    tradesCount: number;
    winRate?: number;
    profitLoss?: number;
  };
  timestamp?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp?: string;
}

export interface PriceUpdateMessage extends WebSocketMessage {
  type: 'price_update';
  data: {
    symbol: SupportedTradingPair;
    price: number;
    timestamp: string;
  };
}

export interface TradeUpdateMessage extends WebSocketMessage {
  type: 'trade_update';
  data: TradeData;
}

export interface BalanceUpdateMessage extends WebSocketMessage {
  type: 'balance_update';
  data: Balance;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error types
export interface TradingError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  context?: {
    symbol?: SupportedTradingPair;
    strategy?: SupportedStrategy;
    action?: string;
  };
}