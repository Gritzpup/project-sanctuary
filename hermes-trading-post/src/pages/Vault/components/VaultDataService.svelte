<script lang="ts" context="module">
  import { vaultService, type VaultData, type BotVault } from '../../../services/state/vaultService';

  // Mock data generators
  export function generateMockVaultData(currentPrice: number): VaultData {
    return {
      btcVault: {
        balance: 0.5234,
        value: 0.5234 * currentPrice,
        growthPercent: 5.2
      },
      usdVault: {
        balance: 15000,
        value: 15000,
        growthPercent: 3.1
      },
      usdcVault: {
        balance: 10000,
        value: 10000,
        growthPercent: 2.8
      },
      totalValue: 0.5234 * currentPrice + 25000,
      dailyGrowth: 1.2,
      weeklyGrowth: 5.8,
      monthlyGrowth: 12.3,
      lastUpdated: Date.now()
    };
  }

  export function generateMockBotVaults(currentPrice: number): BotVault[] {
    return [
      {
        botId: 'reverse-descending-grid-bot-1',
        botName: 'Reverse Descending Grid Bot 1',
        strategy: 'reverse-descending-grid',
        btcBalance: 0.0234,
        usdBalance: 2500,
        totalValue: 0.0234 * currentPrice + 2500,
        profitPercent: 8.5,
        status: 'running'
      },
      {
        botId: 'grid-bot-1',
        botName: 'Grid Trading Bot 1',
        strategy: 'grid-trading',
        btcBalance: 0.0156,
        usdBalance: 1800,
        totalValue: 0.0156 * currentPrice + 1800,
        profitPercent: -2.3,
        status: 'paused'
      },
      {
        botId: 'dca-bot-1',
        botName: 'DCA Bot 1',
        strategy: 'dca',
        btcBalance: 0.0412,
        usdBalance: 500,
        totalValue: 0.0412 * currentPrice + 500,
        profitPercent: 15.7,
        status: 'running'
      }
    ];
  }

  export function generateMockTransactions(): any[] {
    const types = ['deposit', 'withdraw', 'trade', 'compound'];
    const transactions = [];
    
    for (let i = 0; i < 50; i++) {
      transactions.push({
        id: `tx-${i}`,
        type: types[Math.floor(Math.random() * types.length)],
        amount: Math.random() * 1000,
        currency: Math.random() > 0.5 ? 'BTC' : 'USD',
        timestamp: Date.now() - Math.random() * 86400000 * 30,
        status: 'completed',
        description: 'Vault transaction'
      });
    }
    
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  }

  export async function loadVaultData(currentPrice: number) {
    try {
      // Use mock data for now
      const vaultData = generateMockVaultData(currentPrice);
      const botVaults = generateMockBotVaults(currentPrice);
      const transactions = generateMockTransactions();
      
      return {
        vaultData,
        botVaults,
        transactions
      };
    } catch (error) {
      throw error;
    }
  }
</script>

<script lang="ts">
  // This component only exports utility functions
  // No UI rendering
</script>