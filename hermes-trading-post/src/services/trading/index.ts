/**
 * Trading Service Modules
 * Unified trading engine with backend integration
 */

// New unified paper trading engine (recommended)
export { PaperTradingEngine, paperTradingEngine } from './PaperTradingEngine';
export type { TradingState, TradingMode, TradingOptions, TradingResults } from './PaperTradingEngine';

// Legacy modular components (for migration)
export { TradingStateManager } from './TradingStateManager';
export type { PaperTradingState } from './TradingStateManager';
export { TradeExecutor } from './TradeExecutor';
export { TradingPersistence } from './TradingPersistence';