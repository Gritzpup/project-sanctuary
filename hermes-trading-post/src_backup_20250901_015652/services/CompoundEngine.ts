/**
 * @file CompoundEngine.ts
 * @description Calculates compound growth and profit reinvestment
 */

import type { VaultAllocationConfig } from '../strategies/base/StrategyTypes';

export interface CompoundState {
  btcVault: number;
  usdGrowth: number;
  usdcVault: number;
  totalCompounded: number;
  lastCompoundTime: number;
  compoundCount: number;
}

export interface CompoundTransaction {
  timestamp: number;
  profitAmount: number;
  btcAllocation: number;
  usdAllocation: number;
  usdcAllocation: number;
  btcPrice: number;
  reason: string;
}

export class CompoundEngine {
  private config: VaultAllocationConfig;
  private state: CompoundState;
  private transactions: CompoundTransaction[] = [];
  
  constructor(config: VaultAllocationConfig, initialState?: CompoundState) {
    this.config = config;
    this.state = initialState || {
      btcVault: 0,
      usdGrowth: 0,
      usdcVault: 0,
      totalCompounded: 0,
      lastCompoundTime: Date.now(),
      compoundCount: 0
    };
  }
  
  shouldCompound(profit: number, currentTime: number): boolean {
    if (!this.config.autoCompound) return false;
    if (profit < this.config.minCompoundAmount) return false;
    
    switch (this.config.compoundFrequency) {
      case 'trade':
        return true;
      case 'daily':
        return currentTime - this.state.lastCompoundTime >= 24 * 60 * 60 * 1000;
      case 'weekly':
        return currentTime - this.state.lastCompoundTime >= 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return currentTime - this.state.lastCompoundTime >= 30 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }
  
  compound(profit: number, btcPrice: number, timestamp: number): CompoundTransaction {
    // Calculate profit allocations based on vault configuration
    // This implements the 1/7 : 1/7 : 5/7 distribution model
    // btcVaultPercent: 14.3% (1/7) - Accumulate Bitcoin for long-term growth
    // usdGrowthPercent: 14.3% (1/7) - Reinvest in trading capital
    // usdcVaultPercent: 71.4% (5/7) - Store in stable vault
    const btcAllocation = profit * (this.config.btcVaultPercent / 100);
    const usdAllocation = profit * (this.config.usdGrowthPercent / 100);
    const usdcAllocation = profit * (this.config.usdcVaultPercent / 100);
    
    // Update vault states with new allocations
    // BTC Vault: Convert USD profit to BTC at current price
    // This accumulates Bitcoin regardless of price, implementing dollar-cost averaging
    this.state.btcVault += btcAllocation / btcPrice;
    
    // USD Growth: Added back to trading capital to compound position sizes
    // This enables exponential growth - bigger trades = bigger profits
    this.state.usdGrowth += usdAllocation;
    
    // USDC Vault: Stable value storage, protected from volatility
    // This is the "take profit" portion that secures gains
    this.state.usdcVault += usdcAllocation;
    
    // Track totals for performance metrics
    this.state.totalCompounded += profit;
    this.state.lastCompoundTime = timestamp;
    this.state.compoundCount++;
    
    // Record transaction for audit trail
    const transaction: CompoundTransaction = {
      timestamp,
      profitAmount: profit,
      btcAllocation,
      usdAllocation,
      usdcAllocation,
      btcPrice,
      reason: `Compound #${this.state.compoundCount} - ${this.config.compoundFrequency}`
    };
    
    this.transactions.push(transaction);
    
    // Check if vaults need rebalancing to maintain target allocations
    this.checkRebalance(btcPrice);
    
    return transaction;
  }
  
  private checkRebalance(btcPrice: number): void {
    if (!this.config.rebalanceThreshold) return;
    
    const totalValue = this.getTotalValue(btcPrice);
    const btcValue = this.state.btcVault * btcPrice;
    const btcPercent = (btcValue / totalValue) * 100;
    
    const targetBtcPercent = this.config.btcVaultPercent;
    const deviation = Math.abs(btcPercent - targetBtcPercent);
    
    if (deviation > this.config.rebalanceThreshold) {
      // TODO: Implement rebalancing logic
      console.log(`Rebalance needed: BTC at ${btcPercent.toFixed(2)}%, target ${targetBtcPercent}%`);
    }
  }
  
  getTotalValue(btcPrice: number): number {
    return (this.state.btcVault * btcPrice) + this.state.usdGrowth + this.state.usdcVault;
  }
  
  getState(): CompoundState {
    return { ...this.state };
  }
  
  getTransactions(): CompoundTransaction[] {
    return [...this.transactions];
  }
  
  getMetrics(btcPrice: number) {
    const totalValue = this.getTotalValue(btcPrice);
    const btcValue = this.state.btcVault * btcPrice;
    
    return {
      totalValue,
      btcVault: this.state.btcVault,
      btcVaultValue: btcValue,
      usdGrowth: this.state.usdGrowth,
      usdcVault: this.state.usdcVault,
      totalCompounded: this.state.totalCompounded,
      compoundCount: this.state.compoundCount,
      avgCompoundSize: this.state.compoundCount > 0 ? this.state.totalCompounded / this.state.compoundCount : 0,
      allocations: {
        btc: (btcValue / totalValue) * 100,
        usd: (this.state.usdGrowth / totalValue) * 100,
        usdc: (this.state.usdcVault / totalValue) * 100
      }
    };
  }
}