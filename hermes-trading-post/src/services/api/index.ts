// Unified API Services Export
import { UnifiedAPIClient } from './UnifiedAPIClient';
import { CoinbaseAPIService } from './CoinbaseAPIService';
import { BackendAPIService } from './BackendAPIService';

export { UnifiedAPIClient } from './UnifiedAPIClient';
export { CoinbaseAPIService } from './CoinbaseAPIService';
export { BackendAPIService } from './BackendAPIService';

// Re-export types
export type { APIError, RetryConfig, RateLimitConfig } from './UnifiedAPIClient';
export type {
  CoinbaseTicker,
  CoinbaseCandle,
  CoinbaseProduct
} from './CoinbaseAPIService';
export type {
  BotStatus,
  BotConfig,
  ManagerState
} from './BackendAPIService';

// Create singleton instances for easy access
export const coinbaseAPI = CoinbaseAPIService.getInstance();
export const backendAPI = BackendAPIService.getInstance();
export const unifiedAPI = UnifiedAPIClient.getInstance();