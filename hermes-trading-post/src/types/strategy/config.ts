/**
 * @file strategy/config.ts
 * @description Strategy configuration types
 */

// ============================
// Strategy Configuration Types
// ============================

/**
 * Base strategy configuration
 */
export interface StrategyConfig {
  vaultAllocation?: number;        // % of profits to vault (0-100)
  btcGrowthAllocation?: number;    // % of profits to keep in BTC (0-100)
  maxDrawdown?: number;            // Optional max drawdown %
  vaultConfig?: VaultAllocationConfig; // Enhanced vault configuration
  opportunityConfig?: OpportunityDetectionConfig; // Opportunity detection
  [key: string]: any;              // Strategy-specific parameters
}

/**
 * Vault allocation configuration (Triple Compounding System)
 */
export interface VaultAllocationConfig {
  // Triple Compounding System
  btcVaultPercent: number;        // % to BTC vault (default: 14.3% = 1/7)
  usdGrowthPercent: number;       // % to USD growth (default: 14.3% = 1/7)
  usdcVaultPercent: number;       // % to USDC vault (default: 71.4% = 5/7)

  // Compound Settings
  compoundFrequency: 'trade' | 'daily' | 'weekly' | 'monthly';
  minCompoundAmount: number;      // Minimum profit to trigger compound
  autoCompound: boolean;          // Auto-compound vault earnings

  // Vault Targets
  btcVaultTarget?: number;        // Optional target BTC amount
  usdcVaultTarget?: number;       // Optional target USDC amount
  rebalanceThreshold?: number;    // % deviation to trigger rebalance
}

/**
 * Opportunity detection configuration
 */
export interface OpportunityDetectionConfig {
  // Multi-timeframe analysis
  timeframes: Array<{
    period: string;
    weight: number;
  }>;

  // Signal thresholds
  minSignalStrength: number;      // 0-1
  confirmationRequired: number;   // Number of timeframes to confirm

  // Pre-emptive orders
  enablePreEmptive: boolean;
  maxPreEmptiveOrders: number;
  preEmptiveSpread: number;       // % below current price
}
