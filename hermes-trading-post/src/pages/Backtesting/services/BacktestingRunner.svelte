<script lang="ts" context="module">
  // @ts-nocheck - BacktestResult type compatibility between strategy/strategy.ts and StrategyTypes.ts
  import { BacktestingEngine } from '../../../services/backtesting/engine';
  import type { Strategy } from '../../../strategies/base/Strategy';
  import type { BacktestResult } from '../../../strategies/base/StrategyTypes';
  import type { BacktestConfig } from '../../../services/backtesting/engine/types';
  import type { CandleData } from '../../../types/coinbase';

  export async function runBacktest(
    strategy: Strategy,
    historicalCandles: CandleData[],
    config: {
      startBalance: number;
      makerFeePercent: number;
      takerFeePercent: number;
      feeRebatePercent: number;
    }
  ): Promise<any> {
    if (!strategy) {
      throw new Error('Strategy not initialized');
    }

    const backtestConfig: BacktestConfig = {
      initialBalance: config.startBalance,
      startTime: 0,
      endTime: Date.now(),
      feePercent: config.makerFeePercent, // Legacy
      makerFeePercent: config.makerFeePercent,
      takerFeePercent: config.takerFeePercent,
      feeRebatePercent: config.feeRebatePercent,
      slippage: 0.1
    };
    
    const backtestingEngine = new BacktestingEngine(strategy, backtestConfig);
    
    const candlesWithSecondsTime = historicalCandles.map(candle => ({
      ...candle,
      time: candle.time > 1000000000000 ? Math.floor(candle.time / 1000) : candle.time
    }));
    
    const results = await backtestingEngine.runBacktest(candlesWithSecondsTime);
    
    if (!results) {
      throw new Error('Backtest returned no results');
    }
    
    return results;
  }
</script>

<script lang="ts">
  // This component only exports utility functions
  // No UI rendering
</script>