/**
 * @file chartServices.ts
 * @description Coordinated chart services export
 * Phase 5D: Unified interface for all chart operations
 */

export { ChartDataService, chartDataService } from './chartDataService';
export { ChartCacheService, chartCacheService } from './chartCacheService';
export { ChartRealtimeService, chartRealtimeService } from './chartRealtimeService';

/**
 * Unified Chart Operations Interface
 *
 * Provides coordinated access to:
 * 1. ChartDataService - Main data loading with fallback chain
 * 2. ChartCacheService - Redis cache operations
 * 3. ChartRealtimeService - WebSocket real-time updates
 *
 * Usage:
 * ```typescript
 * import { chartDataService, chartCacheService, chartRealtimeService } from '@/shared/services/chartServices';
 *
 * // Load data with automatic caching
 * const data = await chartDataService.loadChartData('BTC-USD', '1h', startTime, endTime);
 *
 * // Cache operations
 * await chartCacheService.storeCandlesInCache('BTC-USD', '1h', data);
 *
 * // Real-time updates
 * chartRealtimeService.subscribe('BTC-USD', '1h');
 * ```
 */
