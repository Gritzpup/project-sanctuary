export interface Candle {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

export interface PriceUpdate {
  time: number;
  price: number;
  volume?: number;
  pair: string;
}

export interface WebSocketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  type: 'historical' | 'current' | 'update' | 'ticker';
}

export interface DataRequest {
  pair: string;
  granularity: string;
  start?: number;
  end?: number;
  limit?: number;
}

export interface DataCache {
  key: string;
  data: Candle[];
  timestamp: number;
  expiresAt: number;
}

export interface RealtimeSubscription {
  pair: string;
  granularity: string;
  handler: (update: PriceUpdate) => void;
  unsubscribe: () => void;
}

export interface AggregatedCandle extends Candle {
  updateCount: number;
  isComplete: boolean;
}