/**
 * @file index.ts
 * @description Centralized type exports - organized into logical modules
 */

// Trading and market data types
export * from './trading/trading';

// Strategy and backtesting types
export * from './strategy/strategy';

// Chart and visualization types
export * from './chart/chart';

// API and external service types
export * from './api/api';

// UI component and state types
export * from './ui/ui';

// Legacy coinbase types (to be migrated)
export * from './coinbase';