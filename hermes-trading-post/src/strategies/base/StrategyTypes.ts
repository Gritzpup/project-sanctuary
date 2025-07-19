// Common types for all trading strategies

// Re-export CandleData from the existing definition
export type { CandleData } from '../../types/coinbase';

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
  grossFee?: number;    // Total fee before rebates
  feeRebate?: number;   // Fee rebate amount
  position?: Position;
  profit?: number;
  profitPercent?: number;
  reason: string;
}

export interface VaultAllocationConfig {
  // Triple Compounding System
  btcVaultPercent: number;      // % to BTC vault (default: 14.3% = 1/7)
  usdGrowthPercent: number;     // % to USD growth (default: 14.3% = 1/7)
  usdcVaultPercent: number;     // % to USDC vault (default: 71.4% = 5/7)
  
  // Compound Settings
  compoundFrequency: 'trade' | 'daily' | 'weekly' | 'monthly';
  minCompoundAmount: number;    // Minimum profit to trigger compound
  autoCompound: boolean;        // Auto-compound vault earnings
  
  // Vault Targets
  btcVaultTarget?: number;      // Optional target BTC amount
  usdcVaultTarget?: number;     // Optional target USDC amount
  rebalanceThreshold?: number;  // % deviation to trigger rebalance
}

export interface OpportunityDetectionConfig {
  // Multi-timeframe analysis
  timeframes: Array<{
    period: string;
    weight: number;
  }>;
  
  // Signal thresholds
  minSignalStrength: number;    // 0-1
  confirmationRequired: number; // Number of timeframes to confirm
  
  // Pre-emptive orders
  enablePreEmptive: boolean;
  maxPreEmptiveOrders: number;
  preEmptiveSpread: number;     // % below current price
}

export interface StrategyConfig {
  // Common configuration
  vaultAllocation: number;      // % of profits to vault (0-100)
  btcGrowthAllocation: number;  // % of profits to keep in BTC (0-100)
  maxDrawdown?: number;         // Optional max drawdown %
  
  // Enhanced vault configuration
  vaultConfig?: VaultAllocationConfig;
  
  // Opportunity detection
  opportunityConfig?: OpportunityDetectionConfig;
  
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
    averageHoldTime: number; // in hours
    vaultBalance: number;
    btcGrowth: number;
    // New metrics
    avgPositionSize: number;
    tradesPerDay: number;
    tradesPerWeek: number;
    tradesPerMonth: number;
    totalFees: number;
    feesAsPercentOfProfit: number;
    vaultCAGR: number; // Compound Annual Growth Rate
    btcGrowthPercent: number;
    maxConsecutiveLosses: number;
    riskRewardRatio: number;
    // Balance growth metrics
    initialBalanceGrowth: number;        // USD growth from profit reinvestment
    initialBalanceGrowthPercent: number; // Percentage growth of initial balance
    finalTradingBalance: number;         // Final USD available for trading
    totalFeeRebates: number;             // Total fee rebates received
    netFeesAfterRebates: number;         // Net fees paid after rebates
    // Compound system metrics
    totalCompounded: number;             // Total amount compounded
    compoundCount: number;               // Number of compound transactions
    avgCompoundSize: number;             // Average compound size
    compoundAllocations: {               // Current allocation percentages
      btc: number;
      usd: number;
      usdc: number;
    };
    btcVaultValue: number;               // Current BTC vault value in USD
    compoundGrowthRate: number;          // Compound growth as % of initial balance
    // Opportunity detection metrics
    opportunitiesDetected: number;       // Total opportunities detected
    preEmptiveOpportunities: number;     // Pre-emptive orders placed
    multiTimeframeSignals: number;       // Multi-timeframe confirmations
    opportunitySuccessRate: number;      // Success rate of opportunities
  };
  equity: Array<{
    timestamp: number;
    value: number;
    btcBalance: number;
    usdBalance: number;
    vaultBalance: number;
  }>;
  // Time series data for charts
  chartData: {
    vaultGrowth: Array<{time: number; value: number}>;
    btcGrowth: Array<{time: number; value: number}>;
    equityCurve: Array<{time: number; value: number}>;
    drawdown: Array<{time: number; value: number}>;
    tradeDistribution: {
      daily: Map<string, number>;
      weekly: Map<string, number>;
      monthly: Map<string, number>;
    };
    compoundTimeline: Array<{
      time: number;
      amount: number;
      btcAllocation: number;
      usdAllocation: number;
      usdcAllocation: number;
    }>;
  };
}

export interface StrategyState {
  positions: Position[];
  balance: {
    usd: number;
    btcVault: number;    // BTC accumulated from profit allocations
    btcPositions: number; // BTC currently held in active positions
    vault: number;       // USDC vault balance
  };
  lastSignal?: Signal;
  metadata?: {
    [key: string]: any;
  };
}

