/**
 * @file coinbase.ts
 * @description Coinbase-specific API types
 *
 * Note: This file now re-exports from consolidated type locations.
 * For new code, import directly from:
 *   - CandleData: '@/types/trading/market'
 *   - WebSocket types: '@/types/api/websocket'
 */

// Re-export CandleData from trading/market
export type { CandleData } from './trading/market';

// Re-export WebSocket types from api/websocket
export type {
  WebSocketMessage,
  TickerMessage,
  MatchMessage,
  SubscribeMessage,
  WebSocketConfig,
  RealtimeSubscription
} from './api/websocket';

// Backward compatibility alias
export type { TickerMessage as TickerData } from './api/websocket';