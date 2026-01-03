/**
 * @file index.ts
 * @description Centralized type exports - organized into logical modules
 *
 * Import pattern:
 *   import { Position, Signal, Trade, CandleData } from '@/types';
 */

// ============================
// Trading Types (NEW - Consolidated)
// ============================
export * from './trading';

// ============================
// Strategy Types (NEW - Consolidated)
// ============================
export * from './strategy';

// ============================
// API Types
// ============================
export * from './api/websocket';

// ============================
// Chart and visualization types
// ============================
export * from './chart/chart';

// ============================
// API and external service types
// ============================
export * from './api/api';

// ============================
// UI component and state types
// ============================
export * from './ui/ui';

// Note: Legacy exports removed to avoid duplicate declarations
// For backward compatibility, import from:
//   - '@/types/trading' for trading types
//   - '@/types/api/websocket' for websocket types
//   - '@/types/coinbase' for CandleData