/**
 * @file index.ts
 * @description Paper trading service module exports
 */

export { 
  PaperTradingService, 
  paperTradingService, 
  createPaperTradingService 
} from './paperTradingService';

export { PaperTradingPersistence } from './persistence';
export { PaperTradingExecution } from './execution';
export { PaperTradingCalculator } from './calculator';

export type { 
  PaperTradingState, 
  PaperTradingConfig 
} from './state';

export { 
  DEFAULT_CONFIG, 
  createInitialState 
} from './state';