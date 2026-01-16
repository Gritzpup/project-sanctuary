/**
 * @file vaultService.ts
 * @description Manages vault allocations and profit distribution
 */

import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface Deposit {
  timestamp: number;
  amount: number;
  source: string; // 'profit' | 'manual' | 'initial'
}

export interface BotVault {
  botId: string;
  name: string;
  botName?: string; // Alias for name
  strategy: string;
  asset: string;
  status: 'active' | 'paused' | 'stopped' | 'running';
  value: number;
  totalValue?: number; // Alias for value
  initialDeposit: number;
  growthPercent: number;
  profitPercent?: number; // Alias for growthPercent
  totalTrades: number;
  winRate: number;
  startedAt: number;
  deposits: Deposit[];
  btcBalance?: number;
  usdBalance?: number;
}

export interface AssetVaults {
  vaults: BotVault[];
  totalValue: number;
  totalGrowth: number;
}

export interface VaultBalance {
  balance: number;
  value: number;
  growthPercent: number;
}

export interface VaultData {
  assets: Record<string, AssetVaults>;
  totalBots: number;
  totalGrowthPercent: number;
  // Individual vault summaries for quick access
  btcVault: VaultBalance;
  usdVault: VaultBalance;
  usdcVault: VaultBalance;
}

class VaultService {
  private store: Writable<VaultData>;
  private data: VaultData;

  constructor() {
    // Initialize with sample data
    const initialData: VaultData = {
      assets: {
        BTC: {
          vaults: [
            {
              botId: 'bot-1',
              name: 'BTC Bot 1 - Reverse Descending Grid',
              strategy: 'reverse-descending-grid',
              asset: 'BTC',
              status: 'active',
              value: 12847.32,
              initialDeposit: 10000,
              growthPercent: 28.47,
              totalTrades: 156,
              winRate: 73.2,
              startedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
              deposits: [
                { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, amount: 10000, source: 'initial' },
                { timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, amount: 847.32, source: 'profit' },
                { timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, amount: 1000, source: 'profit' },
                { timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, amount: 1000, source: 'profit' }
              ]
            },
            {
              botId: 'bot-2',
              name: 'BTC Bot 2 - Grid Trading',
              strategy: 'grid-trading',
              asset: 'BTC',
              status: 'active',
              value: 9234.56,
              initialDeposit: 8000,
              growthPercent: 15.43,
              totalTrades: 89,
              winRate: 65.4,
              startedAt: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
              deposits: [
                { timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, amount: 8000, source: 'initial' },
                { timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, amount: 634.56, source: 'profit' },
                { timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, amount: 600, source: 'profit' }
              ]
            },
            {
              botId: 'bot-3',
              name: 'BTC Bot 3 - RSI Strategy',
              strategy: 'rsi-mean-reversion',
              asset: 'BTC',
              status: 'paused',
              value: 5123.78,
              initialDeposit: 5000,
              growthPercent: 2.48,
              totalTrades: 34,
              winRate: 58.8,
              startedAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
              deposits: [
                { timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, amount: 5000, source: 'initial' },
                { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, amount: 123.78, source: 'profit' }
              ]
            }
          ],
          totalValue: 27205.66,
          totalGrowth: 19.46
        },
        ETH: {
          vaults: [
            {
              botId: 'bot-4',
              name: 'ETH Bot 1 - DCA Strategy',
              strategy: 'dca',
              asset: 'ETH',
              status: 'active',
              value: 4567.89,
              initialDeposit: 4000,
              growthPercent: 14.20,
              totalTrades: 45,
              winRate: 71.1,
              startedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
              deposits: [
                { timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, amount: 4000, source: 'initial' },
                { timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, amount: 567.89, source: 'profit' }
              ]
            }
          ],
          totalValue: 4567.89,
          totalGrowth: 14.20
        },
        GOLD: {
          vaults: [],
          totalValue: 0,
          totalGrowth: 0
        }
      },
      totalBots: 4,
      totalGrowthPercent: 17.88,
      // Individual vault summaries
      btcVault: { balance: 0.5, value: 47500, growthPercent: 15.2 },
      usdVault: { balance: 5000, value: 5000, growthPercent: 8.5 },
      usdcVault: { balance: 10000, value: 10000, growthPercent: 5.2 }
    };

    this.data = initialData;
    this.store = writable(initialData);
  }

  subscribe(callback: (data: VaultData) => void): () => void {
    return this.store.subscribe(callback);
  }

  getVaultData(): VaultData {
    return this.data;
  }

  addBot(asset: string, bot: Omit<BotVault, 'botId'>) {
    const botId = `bot-${Date.now()}`;
    const newBot: BotVault = { ...bot, botId };

    if (!this.data.assets[asset]) {
      this.data.assets[asset] = {
        vaults: [],
        totalValue: 0,
        totalGrowth: 0
      };
    }

    this.data.assets[asset].vaults.push(newBot);
    this.recalculateTotals();
    this.store.set(this.data);
  }

  updateBotValue(botId: string, newValue: number, isProfit?: boolean) {
    for (const asset of Object.values(this.data.assets)) {
      const bot = asset.vaults.find(v => v.botId === botId);
      if (bot) {
        const previousValue = bot.value;
        bot.value = newValue;
        bot.growthPercent = ((newValue - bot.initialDeposit) / bot.initialDeposit) * 100;
        
        // Add deposit record if it's a profit deposit
        if (isProfit && newValue > previousValue) {
          bot.deposits.push({
            timestamp: Date.now(),
            amount: newValue - previousValue,
            source: 'profit'
          });
        }
        
        this.recalculateTotals();
        this.store.set(this.data);
        break;
      }
    }
  }

  updateBotStatus(botId: string, status: 'active' | 'paused' | 'stopped') {
    for (const asset of Object.values(this.data.assets)) {
      const bot = asset.vaults.find(v => v.botId === botId);
      if (bot) {
        bot.status = status;
        this.store.set(this.data);
        break;
      }
    }
  }

  async deposit(amount: number, botId: string): Promise<void> {
    for (const asset of Object.values(this.data.assets)) {
      const bot = asset.vaults.find(v => v.botId === botId);
      if (bot) {
        bot.value += amount;
        bot.deposits.push({
          timestamp: Date.now(),
          amount,
          source: 'deposit'
        });
        this.recalculateTotals();
        this.store.set(this.data);
        break;
      }
    }
  }

  updateBotStats(botId: string, stats: { totalTrades?: number; winRate?: number }) {
    for (const asset of Object.values(this.data.assets)) {
      const bot = asset.vaults.find(v => v.botId === botId);
      if (bot) {
        if (stats.totalTrades !== undefined) bot.totalTrades = stats.totalTrades;
        if (stats.winRate !== undefined) bot.winRate = stats.winRate;
        this.store.set(this.data);
        break;
      }
    }
  }

  withdrawFromBot(botId: string, amount: number): boolean {
    for (const asset of Object.values(this.data.assets)) {
      const bot = asset.vaults.find(v => v.botId === botId);
      if (bot && bot.value >= amount) {
        bot.value -= amount;
        bot.growthPercent = ((bot.value - bot.initialDeposit) / bot.initialDeposit) * 100;
        this.recalculateTotals();
        this.store.set(this.data);
        return true;
      }
    }
    return false;
  }

  private recalculateTotals() {
    let totalValue = 0;
    let totalInitial = 0;
    let activeBots = 0;

    // Aggregate metrics across all assets (BTC, ETH, GOLD, etc.)
    for (const asset of Object.values(this.data.assets)) {
      // Calculate total value for this asset by summing all bot vaults
      asset.totalValue = asset.vaults.reduce((sum, vault) => sum + vault.value, 0);
      
      // Calculate total initial deposits for this asset
      const assetInitial = asset.vaults.reduce((sum, vault) => sum + vault.initialDeposit, 0);
      
      // Calculate growth percentage for the asset
      // Formula: ((current value - initial deposit) / initial deposit) * 100
      // Example: ($12,847 - $10,000) / $10,000 * 100 = 28.47% growth
      asset.totalGrowth = assetInitial > 0 
        ? ((asset.totalValue - assetInitial) / assetInitial) * 100 
        : 0;
      
      // Add to portfolio totals
      totalValue += asset.totalValue;
      totalInitial += assetInitial;
      activeBots += asset.vaults.length;
    }

    // Update portfolio-wide metrics
    this.data.totalBots = activeBots;
    
    // Calculate overall portfolio growth percentage
    // This shows the performance across all bots and assets
    this.data.totalGrowthPercent = totalInitial > 0 
      ? ((totalValue - totalInitial) / totalInitial) * 100 
      : 0;
  }
}

// Export singleton instance
export const vaultService = new VaultService();