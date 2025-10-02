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
        
        console.log(`[ProfitDistributor] Compound transaction executed:`, {
          profit: profit.toFixed(2),
          btcAllocation: transaction.btcAllocation.toFixed(2),
          usdAllocation: transaction.usdAllocation.toFixed(2),
          usdcAllocation: transaction.usdcAllocation.toFixed(2),
          btcReceived: (transaction.btcAllocation / candle.close).toFixed(6),
          compoundCount: compoundState.compoundCount,
          totalCompounded: compoundState.totalCompounded.toFixed(2)
        });
        
        const metrics = this.compoundEngine.getMetrics(candle.close);
        console.log(`[ProfitDistributor] Vault balances after compound:`, {
          btcVault: metrics.btcVault.toFixed(6),
          btcVaultValue: metrics.btcVaultValue.toFixed(2),
          usdGrowth: metrics.usdGrowth.toFixed(2),
          usdcVault: metrics.usdcVault.toFixed(2),
          totalValue: metrics.totalValue.toFixed(2),
          allocations: {
            btc: metrics.allocations.btc.toFixed(2) + '%',
            usd: metrics.allocations.usd.toFixed(2) + '%',
            usdc: metrics.allocations.usdc.toFixed(2) + '%'
          }
        });
      } else {
        // If not compounding yet, just add profit to USD
        state.balance.usd += profit;
        console.log(`[ProfitDistributor] Profit added to USD (compound threshold not met):`, {
          profit: profit.toFixed(2),
          minCompoundAmount: this.compoundEngine.getState().totalCompounded
        });
      }
      
      console.log(`[ProfitDistributor] Profit distribution:`, {
        profit: profit.toFixed(2),
        principal: totalCost.toFixed(2),
        newUsdBalance: state.balance.usd.toFixed(2),
        newBtcVault: state.balance.btcVault.toFixed(6),
        newVaultBalance: state.balance.vault.toFixed(2),
        totalInitialBalanceGrowth: this.stateManager.getState().initialBalanceGrowth.toFixed(2)
      });
    } else {
      // Loss - return all proceeds to USD
      state.balance.usd += profitData.netProceeds;
      console.log(`[ProfitDistributor] Loss - returning proceeds to USD:`, {
        loss: profit,
        netProceeds: profitData.netProceeds,
        newUsdBalance: state.balance.usd
      });
    }
  }
}