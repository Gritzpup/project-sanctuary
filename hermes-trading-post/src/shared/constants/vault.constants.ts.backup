/**
 * Vault Allocation Constants
 *
 * Triple Compounding System allocation percentages
 * Based on 7-part allocation strategy:
 * - 1/7 to BTC vault (14.3%)
 * - 1/7 to USD growth (14.3%)
 * - 5/7 to USDC vault (71.4%)
 */

export const VAULT_ALLOCATION = {
  /** BTC vault percentage - 1/7 of profits */
  BTC_VAULT_PERCENT: 14.3,

  /** USD growth percentage - 1/7 of profits */
  USD_GROWTH_PERCENT: 14.3,

  /** USDC vault percentage - 5/7 of profits */
  USDC_VAULT_PERCENT: 71.4,

  /** Alternative allocation: 85.7% to vault (6/7) */
  VAULT_ALLOCATION_PERCENT: 85.7,

  /** Alternative allocation: 14.3% to BTC growth (1/7) */
  BTC_GROWTH_ALLOCATION_PERCENT: 14.3,
} as const;

/**
 * Trading Fee Constants
 * Coinbase Advanced Trade fees
 */
export const TRADING_FEES = {
  /** Maker fee percentage */
  MAKER_FEE_PERCENT: 0.35,

  /** Taker fee percentage */
  TAKER_FEE_PERCENT: 0.75,

  /** Fee rebate percentage for high volume */
  FEE_REBATE_PERCENT: 25,

  /** Combined round-trip fee (buy + sell) for maker */
  ROUND_TRIP_MAKER_FEE_PERCENT: 0.70,

  /** Combined round-trip fee (buy + sell) for taker */
  ROUND_TRIP_TAKER_FEE_PERCENT: 1.50,
} as const;

/**
 * Strategy Configuration Constants
 */
export const STRATEGY_DEFAULTS = {
  /** Default initial drop percentage to trigger entry */
  INITIAL_DROP_PERCENT: 0.8,

  /** Default drop percentage between grid levels */
  LEVEL_DROP_PERCENT: 0.5,

  /** Default profit target percentage */
  PROFIT_TARGET_PERCENT: 1.5,

  /** Default ratio multiplier for position sizing */
  RATIO_MULTIPLIER: 1.5,

  /** Default maximum grid levels */
  MAX_LEVELS: 5,

  /** Default lookback period in candles */
  LOOKBACK_PERIOD: 20,

  /** Default base position percentage of balance */
  BASE_POSITION_PERCENT: 20,

  /** Default maximum position percentage of balance */
  MAX_POSITION_PERCENT: 80,
} as const;

/**
 * Micro Scalping Strategy Constants
 */
export const MICRO_SCALPING = {
  /** Initial drop to trigger entry (1H timeframe) */
  INITIAL_DROP_PERCENT: 0.8,

  /** Drop between levels */
  LEVEL_DROP_PERCENT: 0.5,

  /** Profit target */
  PROFIT_TARGET_PERCENT: 1.5,

  /** Position sizing ratio multiplier */
  RATIO_MULTIPLIER: 1.5,

  /** Maximum levels */
  MAX_LEVELS: 5,

  /** Lookback period (1H candles) */
  LOOKBACK_PERIOD: 20,

  /** Base position size */
  BASE_POSITION_PERCENT: 20,

  /** Maximum total position */
  MAX_POSITION_PERCENT: 80,
} as const;

/**
 * Ultra Micro Scalping Strategy Constants
 * Hyper-aggressive 1-minute timeframe
 */
export const ULTRA_MICRO_SCALPING = {
  /** Ultra-sensitive entry trigger (1m timeframe) */
  INITIAL_DROP_PERCENT: 0.15,

  /** Tight spacing between levels */
  LEVEL_DROP_PERCENT: 0.2,

  /** Quick profit target (0.4% gross = 0.1% net after fees) */
  PROFIT_TARGET_PERCENT: 0.4,

  /** Aggressive position scaling */
  RATIO_MULTIPLIER: 1.8,

  /** Limited levels to avoid over-leverage */
  MAX_LEVELS: 2,

  /** Very short lookback (5 minutes on 1m) */
  LOOKBACK_PERIOD: 5,

  /** Aggressive initial position */
  BASE_POSITION_PERCENT: 30,

  /** Maximum total exposure */
  MAX_POSITION_PERCENT: 50,
} as const;

/**
 * Rebalancing Constants
 */
export const REBALANCING = {
  /** Minimum profit threshold to trigger rebalance */
  MIN_PROFIT_THRESHOLD_USD: 100,

  /** Rebalance frequency in milliseconds (1 hour) */
  REBALANCE_FREQUENCY_MS: 60 * 60 * 1000,

  /** Minimum time between rebalances in milliseconds (30 minutes) */
  MIN_REBALANCE_INTERVAL_MS: 30 * 60 * 1000,
} as const;
