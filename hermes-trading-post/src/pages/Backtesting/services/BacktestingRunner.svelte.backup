<script lang="ts" context="module">
  import { BacktestingEngine } from '../../../services/backtesting/engine';
  import type { Strategy } from '../../../strategies/base/Strategy';
  import type { BacktestConfig, BacktestResult } from '../../../strategies/base/StrategyTypes';
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
  ): Promise<BacktestResult> {
    if (!strategy) {
      throw new Error('Strategy not initialized');
    }

    const backtestConfig: BacktestConfig = {
      startBalance: config.startBalance,
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
    
    console.log('Backtest completed:', results);
    return results;
  }
</script>

<script lang="ts">
  // This component only exports utility functions
  // No UI rendering
</script>