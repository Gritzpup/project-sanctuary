/**
 * @file balance.ts
 * @description Balance and account types
 */

// ============================
// Balance Types
// ============================

/**
 * Account balance (simple version)
 */
export interface Balance {
  usd: number;
  btc: number;
  vault?: {
    usd: number;
    btc: number;
  };
}

/**
 * Detailed balance with multiple components
 */
export interface DetailedBalance {
  usd: number;                    // USD balance
  btcVault: number;               // BTC accumulated from profit allocations
  btcPositions: number;           // BTC currently held in active positions
  vault: number;                  // USDC vault balance
}

/**
 * Bot-specific vault
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
 * Vault deposit record
 */
export interface Deposit {
  timestamp: number;              // Deposit time
  amount: number;                 // Deposit amount
  source: string;                 // 'profit' | 'manual' | 'initial'
}

/**
 * Asset-specific vault collection
 */
export interface AssetVaults {
  vaults: BotVault[];             // Bot vaults for this asset
  totalValue: number;             // Total value across all vaults
  totalGrowth: number;            // Total growth amount
}
