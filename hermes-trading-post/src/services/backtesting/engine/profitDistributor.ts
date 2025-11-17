/**
 * @file profitDistributor.ts
 * @description Handles profit distribution and compound logic
 */

import type { CandleData, StrategyState } from '../../../types/strategy/strategy';
import type { CompoundEngine } from '../../trading/CompoundEngine';
import type { BacktestStateManager } from './stateManager';
import type { ProfitDistribution } from './types';

export class ProfitDistributor {
  private compoundEngine: CompoundEngine;
  private stateManager: BacktestStateManager;

  constructor(compoundEngine: CompoundEngine, stateManager: BacktestStateManager) {
    this.compoundEngine = compoundEngine;
    this.stateManager = stateManager;
  }

  distributeProfit(profitData: ProfitDistribution, candle: CandleData, state: StrategyState): void {
    const { profit, totalCost } = profitData;

    if (profit > 0) {
      // STEP 1: Return principal (original investment) to USD trading balance
      state.balance.usd += totalCost;
      
      // STEP 2: Check if profit meets compound threshold
      if (this.compoundEngine.shouldCompound(profit, candle.time)) {
        // Execute compound distribution according to vault allocation config
        const transaction = this.compoundEngine.compound(profit, candle.close, candle.time);
        this.stateManager.addCompoundTransaction(transaction);
        
        // STEP 3: Update all vault balances from compound engine
        const compoundState = this.compoundEngine.getState();
        
        // BTC vault: Long-term Bitcoin accumulation (14.3% of profit)
        state.balance.btcVault = compoundState.btcVault;
        
        // USD growth: Reinvested into trading capital (14.3% of profit)
        state.balance.usd += compoundState.usdGrowth;
        
        // USDC vault: Stable profit storage (71.4% of profit)
        state.balance.vault = compoundState.usdcVault;
        
        // Track total USD growth for metrics
        this.stateManager.updateInitialBalanceGrowth(compoundState.usdGrowth);

        const metrics = this.compoundEngine.getMetrics(candle.close);
      } else {
        // If not compounding yet, just add profit to USD
        state.balance.usd += profit;
      }
    } else {
      // Loss - return all proceeds to USD
      state.balance.usd += profitData.netProceeds;
    }
  }
}