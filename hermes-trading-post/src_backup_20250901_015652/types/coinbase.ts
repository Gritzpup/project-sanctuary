export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WebSocketMessage {
  type: string;
  sequence: number;
  product_id: string;
  price?: string;
  open_24h?: string;
  volume_24h?: string;
  low_24h?: string;
  high_24h?: string;
  volume_30d?: string;
  best_bid?: string;
  best_ask?: string;
  side?: string;
  time?: string;
  trade_id?: number;
  last_size?: string;
}

export interface TickerMessage extends WebSocketMessage {
  type: 'ticker';
}

export type TickerData = TickerMessage;

export interface MatchMessage extends WebSocketMessage {
  type: 'match';
  size: string;
}

export interface SubscribeMessage {
  type: 'subscribe';
  product_ids: string[];
  channels: string[];
}