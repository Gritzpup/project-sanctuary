  // Signal thresholds
  minSignalStrength: number;      // 0-1
  confirmationRequired: number;   // Number of timeframes to confirm
  
  // Pre-emptive orders
  enablePreEmptive: boolean;
  maxPreEmptiveOrders: number;
  preEmptiveSpread: number;       // % below current price
}

/**
 * Strategy state during execution
 */
export interface StrategyState {
  positions: Position[];          // Active positions
  balance: {
    usd: number;                  // USD balance
    btcVault: number;             // BTC accumulated from profit allocations
    btcPositions: number;         // BTC currently held in active positions
    vault: number;                // USDC vault balance
  };
  lastSignal?: Signal;            // Most recent signal
  metadata?: {                    // Strategy-specific state
    [key: string]: any;
  };
}

/**
 * Backtest result with comprehensive metrics
 */
export interface BacktestResult {
  trades: Trade[];                // All executed trades
  metrics: {
    // Basic metrics
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
    averageHoldTime: number;      // in hours
    vaultBalance: number;
    btcGrowth: number;
    
    // Advanced metrics
    avgPositionSize: number;
    tradesPerDay: number;
    tradesPerWeek: number;
    tradesPerMonth: number;
    totalFees: number;
    feesAsPercentOfProfit: number;
    vaultCAGR: number;            // Compound Annual Growth Rate
    btcGrowthPercent: number;
    maxConsecutiveLosses: number;
    riskRewardRatio: number;
    
    // Balance growth metrics
    initialBalanceGrowth: number;
    initialBalanceGrowthPercent: number;
    finalTradingBalance: number;
    totalFeeRebates: number;
    netFeesAfterRebates: number;
    
    // Compound system metrics
    totalCompounded: number;
    compoundCount: number;
    avgCompoundSize: number;
    compoundAllocations: {
      btc: number;
      usd: number;
      usdc: number;
    };
    btcVaultValue: number;
    compoundGrowthRate: number;
    
    // Opportunity detection metrics
    opportunitiesDetected: number;
    preEmptiveOpportunities: number;
    multiTimeframeSignals: number;
    opportunitySuccessRate: number;
  };
  equity: Array<{                 // Equity curve data points
    timestamp: number;
    value: number;
    btcBalance: number;
    usdBalance: number;
    vaultBalance: number;
  }>;
  chartData: {                    // Time series data for charts
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

// ============================
// User/Account Types
// ============================

/**
 * Paper trading state
 */
export interface PaperTradingState {
  isRunning: boolean;             // Whether paper trading is active
  strategy: any;                  // Active strategy instance
  balance: {
    usd: number;
    btcVault: number;
    btcPositions: number;
    vault: number;
  };
  trades: Trade[];                // Executed trades
  currentSignal: Signal | null;   // Current signal
  performance: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    winRate: number;
    totalTrades: number;
  };
  lastUpdate: number;             // Last update timestamp
}

/**
 * Persistent trading state for saving/loading
 */
export interface PersistentTradingState {
  isRunning: boolean;
  strategyType: string;
  strategyConfig: any;
  balance: {
    usd: number;
    btcVault: number;
    btcPositions: number;
    vault: number;
  };
  positions: any[];
  trades: any[];
  startTime: number;
  lastUpdateTime: number;
}

/**
 * Vault deposit record
 */
export interface Deposit {
  timestamp: number;              // Deposit time
  amount: number;                 // Deposit amount
  source: string;                 // 'profit' | 'manual' | 'initial'
}

/**
 * Bot vault for tracking individual bot performance
 */
export interface BotVault {
  botId: string;                  // Unique bot identifier
  name: string;                   // Bot display name
  strategy: string;               // Strategy name
  asset: string;                  // Trading asset (e.g., "BTC")
  status: 'active' | 'paused' | 'stopped';
  value: number;                  // Current vault value
  initialDeposit: number;         // Initial deposit amount
  growthPercent: number;          // Growth percentage
  totalTrades: number;            // Total trades executed
  winRate: number;                // Win rate percentage
  startedAt: number;              // Start timestamp
  deposits: Deposit[];            // Deposit history
}

/**
 * Asset-specific vault collection
 */
export interface AssetVaults {
  vaults: BotVault[];             // Bot vaults for this asset
  totalValue: number;             // Total value across all vaults
  totalGrowth: number;            // Total growth amount
}

/**
 * Overall vault data
 */
