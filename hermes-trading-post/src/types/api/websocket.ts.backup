/**
 * @file api/websocket.ts
 * @description WebSocket connection and message types
 */

// ============================
// WebSocket Message Types
// ============================

/**
 * Base WebSocket message
 */
export interface WebSocketMessage {
  type: string;                   // Message type
  sequence: number;               // Sequence number
  product_id: string;             // Product/pair ID
  price?: string;                 // Current price
  open_24h?: string;              // 24h open price
  volume_24h?: string;            // 24h volume
  low_24h?: string;               // 24h low
  high_24h?: string;              // 24h high
  volume_30d?: string;            // 30d volume
  best_bid?: string;              // Best bid price
  best_ask?: string;              // Best ask price
  side?: string;                  // Trade side
  time?: string;                  // Message time
  trade_id?: number;              // Trade ID
  last_size?: string;             // Last trade size
}

/**
 * Ticker-specific WebSocket message
 */
export interface TickerMessage extends WebSocketMessage {
  type: 'ticker';
}

/**
 * Match/trade WebSocket message
 */
export interface MatchMessage extends WebSocketMessage {
  type: 'match';
  size: string;                   // Trade size
}

/**
 * WebSocket subscription message
 */
export interface SubscribeMessage {
  type: 'subscribe';
  product_ids: string[];          // Products to subscribe to
  channels: string[];             // Channels to subscribe to
}

/**
 * WebSocket connection configuration
 */
export interface WebSocketConfig {
  url: string;
  channels: string[];
  productIds: string[];
  heartbeat?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Real-time subscription
 */
export interface RealtimeSubscription {
  pair: string;
  granularity: string;
  handler: (update: any) => void;
  unsubscribe: () => void;
}
