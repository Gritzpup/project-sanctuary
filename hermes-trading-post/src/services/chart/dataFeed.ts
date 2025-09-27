// LEGACY FILE - This file has been modularized into separate components
// New structure:
// - ChartDataOrchestrator.ts - Main coordinator
// - data-sources/RealtimeDataSource.ts - Real-time WebSocket data
// - data-sources/HistoricalDataSource.ts - Historical API data  
// - data-sources/CacheDataSource.ts - Cache management
// - aggregation/CandleAggregator.ts - Candle processing
// - aggregation/GranularityManager.ts - Granularity handling
// - subscription/SubscriptionManager.ts - Subscription tracking
// - cache/DataCacheManager.ts - Memory cache management

// Export the new orchestrator as the main interface
export { ChartDataOrchestrator as ChartDataFeed } from './ChartDataOrchestrator';