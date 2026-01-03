/**
 * @file index.ts
 * @description Centralized constants export for the entire application
 */

// Chart-related constants
export {
  PERIOD_TO_SECONDS,
  PERIOD_TO_DAYS,
  GRANULARITY_TO_SECONDS,
  PERIOD_DISPLAY_NAMES,
  GRANULARITY_DISPLAY_NAMES,
  RECOMMENDED_GRANULARITIES,
  VALID_GRANULARITIES,
  WS_CONFIG,
  CACHE_CONFIG,
  PERFORMANCE_THRESHOLDS,
  CHART_COLORS,
  DEFAULT_CONFIG
} from './chart.constants';

// Vault-related constants
export { VAULT_ALLOCATION, TRADING_FEES, STRATEGY_DEFAULTS, MICRO_SCALPING, ULTRA_MICRO_SCALPING, REBALANCING } from './vault.constants';
