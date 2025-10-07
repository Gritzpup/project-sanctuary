/**
 * Centralized Event Type Definitions
 * All application events should be defined here for type safety
 */

import type { SupportedTradingPair, SupportedGranularity, TradeData } from './Trading';

// Chart marker type
export interface ChartMarker {
  time: number;
  position: 'belowBar' | 'aboveBar' | 'inBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  text?: string;
  size?: 'small' | 'normal' | 'large';
}

// Chart data point
export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Chart Events
export interface ChartEvents {
  'chart:pairChange': { pair: SupportedTradingPair };
  'chart:granularityChange': { granularity: SupportedGranularity };
  'chart:periodChange': { period: string };
  'chart:speedChange': { speed: string };
  'chart:dateChange': { date: string };
  'chart:zoomReset': Record<string, never>;
  'chart:play': Record<string, never>;
  'chart:pause': Record<string, never>;
  'chart:stop': Record<string, never>;
  'chart:markersUpdated': { markers: ChartMarker[] };
  'chart:dataLoaded': { data: ChartDataPoint[] };
}

// Trading Events
export interface TradingEvents {
  'trading:start': {};
  'trading:pause': {};
  'trading:resume': {};
  'trading:stop': {};
  'trading:reset': {};
  'trading:strategyChange': { strategyType: string };
  'trading:balanceChange': { balance: number };
  'trading:stateUpdate': { 
    isRunning: boolean; 
    isPaused: boolean; 
    trades: any[]; 
    positions: any[];
    balance: number;
  };
  'trading:tradeExecuted': { trade: any };
  'trading:positionOpened': { position: any };
  'trading:positionClosed': { position: any };
  'trading:errorOccurred': { error: string; code?: string };
}

// Backtesting Events
export interface BacktestingEvents {
  'backtest:run': { 
    strategy: string; 
    parameters: Record<string, any>; 
    balance: number;
  };
  'backtest:complete': { 
    results: any; 
    performance: any; 
    trades: any[]; 
  };
  'backtest:progress': { progress: number; stage: string };
  'backtest:error': { error: string; stage: string };
  'backtest:configurationChange': { 
    strategyType: string; 
    parameters: Record<string, any>; 
  };
  'backtest:syncToPaperTrading': { config: any };
  'backtest:saveBackup': { name: string; description: string; config: any };
  'backtest:loadBackup': { backup: any };
  'backtest:deleteBackup': { backupKey: string };
}

// Strategy Events
export interface StrategyEvents {
  'strategy:create': { 
    name: string; 
    label: string; 
    description: string; 
    code: string; 
  };
  'strategy:update': { 
    name: string; 
    label: string; 
    description: string; 
    code: string; 
  };
  'strategy:delete': { strategyName: string };
  'strategy:parameterChange': { paramName: string; value: any };
  'strategy:validate': { code: string };
  'strategy:compiled': { name: string; success: boolean; errors?: string[] };
}

// Bot Events
export interface BotEvents {
  'bot:select': { botId: string };
  'bot:create': { name: string; strategy: string; config: any };
  'bot:delete': { botId: string };
  'bot:start': { botId: string };
  'bot:stop': { botId: string };
  'bot:statusChange': { botId: string; status: string };
  'bot:performanceUpdate': { botId: string; performance: any };
}

// UI Events
export interface UIEvents {
  'ui:tabChange': { tab: string; section?: string };
  'ui:sidebarToggle': { collapsed: boolean };
  'ui:navigate': { route: string; params?: Record<string, any> };
  'ui:notification': { 
    type: 'success' | 'error' | 'warning' | 'info'; 
    message: string; 
    duration?: number; 
  };
  'ui:modal:open': { modalId: string; data?: any };
  'ui:modal:close': { modalId: string };
  'ui:dragStart': { elementId: string; type: string };
  'ui:dragEnd': { elementId: string; type: string };
}

// Data Events
export interface DataEvents {
  'data:priceUpdate': { price: number; symbol: string; timestamp: number };
  'data:candleUpdate': { candle: any; symbol: string };
  'data:connectionStatus': { 
    status: 'connected' | 'disconnected' | 'error' | 'loading'; 
    service: string; 
  };
  'data:cacheInvalidated': { type: string; key?: string };
  'data:syncComplete': { type: string; timestamp: number };
}

// System Events
export interface SystemEvents {
  'system:error': { error: Error; context: string };
  'system:warning': { message: string; context: string };
  'system:info': { message: string; context: string };
  'system:performance': { metrics: Record<string, number> };
  'system:cleanup': { type: string; details?: any };
}

// Combined event types for type safety
export type AllEvents = 
  & ChartEvents 
  & TradingEvents 
  & BacktestingEvents 
  & StrategyEvents 
  & BotEvents 
  & UIEvents 
  & DataEvents 
  & SystemEvents;

export type EventType = keyof AllEvents;
export type EventData<T extends EventType> = AllEvents[T];

// Event bus wrapper with type safety
export interface TypedEventBus {
  on<T extends EventType>(eventType: T, handler: (data: EventData<T>) => void): () => void;
  once<T extends EventType>(eventType: T, handler: (data: EventData<T>) => void): () => void;
  emit<T extends EventType>(eventType: T, data: EventData<T>, source?: string): void;
  off<T extends EventType>(eventType: T, handler: (data: EventData<T>) => void): void;
}

// Event categories for filtering and debugging
export const EVENT_CATEGORIES = {
  CHART: 'chart',
  TRADING: 'trading',
  BACKTESTING: 'backtest',
  STRATEGY: 'strategy',
  BOT: 'bot',
  UI: 'ui',
  DATA: 'data',
  SYSTEM: 'system'
} as const;

export type EventCategory = typeof EVENT_CATEGORIES[keyof typeof EVENT_CATEGORIES];

export function getEventCategory(eventType: EventType): EventCategory {
  const prefix = eventType.split(':')[0] as EventCategory;
  return Object.values(EVENT_CATEGORIES).includes(prefix) 
    ? prefix 
    : EVENT_CATEGORIES.SYSTEM;
}