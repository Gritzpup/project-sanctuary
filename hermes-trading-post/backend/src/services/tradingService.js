// LEGACY FILE - This file has been modularized into separate components
// New structure:
// - strategies/base/BaseStrategy.js
// - strategies/implementations/ReverseRatioStrategy.js  
// - strategies/StrategyRegistry.js
// - services/trading/TradingOrchestrator.js
// - services/trading/TradeExecutor.js
// - services/trading/PositionManager.js
// - services/persistence/TradingStateRepository.js

// Import the new modular service
export { TradingService } from './TradingServiceModular.js';