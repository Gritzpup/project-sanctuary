// Common types for all trading strategies

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Position {
  entryPrice: number;
  entryTime: number;
  size: number;
  type: 'long' | 'short';
  stopLoss?: number;
  takeProfit?: number;
  metadata?: {
    level?: number;  // For reverse ratio strategy
    reason?: string;
    [key: string]: any;
  };
}

export interface Signal {
  type: 'buy' | 'sell' | 'hold';
  strength: number; // 0-1
  price: number;
  size?: number;
  reason: string;
  metadata?: {
    level?: number;
    targetPrice?: number;
    [key: string]: any;
  };
}

export interface Trade {
  id: string;
  timestamp: number;
  type: 'buy' | 'sell';
  price: number;
  size: number;
  value: number;
  fee?: number;
  position?: Position;
  profit?: number;
  profitPercent?: number;
  reason: string;
}

export interface StrategyConfig {
  // Common configuration
  vaultAllocation: number;      // % of profits to vault (0-100)
  btcGrowthAllocation: number;  // % of profits to keep in BTC (0-100)
  maxDrawdown?: number;         // Optional max drawdown %
  
  // Strategy-specific parameters
  [key: string]: any;
}

export interface BacktestResult {
  trades: Trade[];
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
    averageHoldTime: number;
    vaultBalance: number;
    btcGrowth: number;
  };
  equity: Array<{
    timestamp: number;
    value: number;
    btcBalance: number;
    usdBalance: number;
    vaultBalance: number;
  }>;
}

export interface StrategyState {
  positions: Position[];
  balance: {
    usd: number;
    btc: number;
    vault: number;
  };
  lastSignal?: Signal;
  metadata?: {
    [key: string]: any;
  };
}