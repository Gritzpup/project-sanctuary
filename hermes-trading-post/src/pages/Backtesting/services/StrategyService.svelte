<script lang="ts" context="module">
  import { ReverseRatioStrategy } from '../../../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../../../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../../../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../../../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../../../strategies/implementations/VWAPBounceStrategy';
  import { MicroScalpingStrategy } from '../../../strategies/implementations/MicroScalpingStrategy';
  import type { Strategy } from '../../../strategies/base/Strategy';

  // Built-in strategies
  export const builtInStrategies = [
    { value: 'reverse-descending-grid', label: 'Reverse Descending Grid', description: 'Grid trading with reverse position sizing', isCustom: false },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
    { value: 'micro-scalping', label: 'Micro Scalping (1H)', description: 'High-frequency 1H trading with 0.8% entries', isCustom: false },
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping with RSI, MACD, and stop losses', isCustom: false }
  ];

  // Default strategy parameters
  export const defaultStrategyParams: Record<string, any> = {
    'reverse-descending-grid': {
      initialDropPercent: 0.02,
      levelDropPercent: 0.015,
      ratioMultiplier: 1.0,
      profitTarget: 0.85,
      maxLevels: 12,
      lookbackPeriod: 3,
      positionSizeMode: 'percentage',
      basePositionPercent: 8,
      basePositionAmount: 50,
      maxPositionPercent: 96,
      vaultConfig: {
        btcVaultPercent: 40,
        usdGrowthPercent: 30,
        usdcVaultPercent: 30
      }
    },
    'grid-trading': {
      gridLevels: 10,
      gridSpacing: 1.0,
      positionSize: 10,
      takeProfit: 1.0,
      stopLoss: 5.0
    },
    'rsi-mean-reversion': {
      rsiPeriod: 14,
      oversoldThreshold: 30,
      overboughtThreshold: 70,
      positionSize: 20,
      stopLoss: 2.0
    },
    'dca': {
      interval: 3600,
      amount: 100,
      maxPositions: 10
    },
    'vwap-bounce': {
      vwapPeriod: 20,
      bounceThreshold: 0.5,
      positionSize: 15,
      stopLoss: 1.5,
      takeProfit: 2.0
    },
    'micro-scalping': {
      entryThreshold: 0.8,
      exitThreshold: 0.3,
      positionSize: 25,
      maxPositions: 4,
      stopLoss: 0.5
    },
    'proper-scalping': {
      entryThreshold: 0.5,
      exitThreshold: 0.2,
      positionSize: 30,
      maxPositions: 3,
      stopLoss: 0.3
    }
  };

  export function createStrategy(type: string, params: Record<string, any> = {}, customStrategies: any[] = []): Strategy {
    try {
      const strategyParams = { ...defaultStrategyParams[type], ...params };
      
      const customStrategy = customStrategies.find(s => s.value === type);
      if (customStrategy) {
        throw new Error('Custom strategies not yet implemented in refactored version');
      }
      
      switch (type) {
        case 'reverse-descending-grid':
          return new ReverseRatioStrategy(strategyParams);
        case 'grid-trading':
          return new GridTradingStrategy(strategyParams);
        case 'rsi-mean-reversion':
          return new RSIMeanReversionStrategy(strategyParams);
        case 'dca':
          return new DCAStrategy(strategyParams);
        case 'vwap-bounce':
          return new VWAPBounceStrategy(strategyParams);
        case 'micro-scalping':
          return new MicroScalpingStrategy(strategyParams);
        case 'proper-scalping':
          // For now, use micro-scalping as a placeholder for proper-scalping
          return new MicroScalpingStrategy(strategyParams);
        default:
          throw new Error(`Unknown strategy type: ${type}`);
      }
    } catch (error) {
      throw error;
    }
  }

  export function loadStrategySourceCode(strategyType: string, customStrategies: any[] = []): string {
    const customStrategy = customStrategies.find(s => s.value === strategyType);
    if (customStrategy) {
      return customStrategy.code;
    }
    
    // For built-in strategies, just show a placeholder
    return `// ${strategyType} strategy\n// Source code viewing for built-in strategies\n// Implementation details...`;
  }

  export function getAllStrategies(customStrategies: any[] = []) {
    return [...builtInStrategies, ...customStrategies];
  }
</script>

<script lang="ts">
  // This component only exports utility functions
  // No UI rendering
</script>