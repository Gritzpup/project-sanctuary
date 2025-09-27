import { ReverseRatioStrategy } from './implementations/ReverseRatioStrategy.js';

export class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  registerDefaultStrategies() {
    // Register built-in strategies
    this.register('reverse-ratio', ReverseRatioStrategy);
    this.register('ultra-micro-scalping', ReverseRatioStrategy); // Use same for now
    this.register('micro-scalping', ReverseRatioStrategy); // Use same strategy class
    // Add other strategies as they're implemented
  }

  register(name, strategyClass) {
    this.strategies.set(name, strategyClass);
  }

  createStrategy(strategyType, config = {}) {
    const StrategyClass = this.strategies.get(strategyType);
    
    if (!StrategyClass) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }
    
    return new StrategyClass(config);
  }

  getAvailableStrategies() {
    return Array.from(this.strategies.keys());
  }

  hasStrategy(strategyType) {
    return this.strategies.has(strategyType);
  }

  extractStrategyType(strategyName) {
    const nameToType = {
      'Reverse Ratio Buying': 'reverse-ratio',
      'Ultra Micro-Scalping': 'ultra-micro-scalping'
    };
    
    return nameToType[strategyName] || strategyName.toLowerCase().replace(/\s+/g, '-');
  }
}

// Singleton instance
export const strategyRegistry = new StrategyRegistry();