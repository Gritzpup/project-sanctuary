<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { tradingBackendService } from '../../services/state/tradingBackendService';
  import { paperTestService } from '../../services/state/paperTestService';
  import { ChartDataFeed } from '../../services/chart/dataFeed';
  import type { Strategy } from '../../strategies/base/Strategy';
  
  export let activeBotInstance: any = null;
  export let currentStrategy: Strategy | null = null;
  export let selectedStrategyType: string;
  
  const dispatch = createEventDispatcher();
  
  let backendStateUnsubscribe: (() => void) | null = null;
  let backendSyncInterval: NodeJS.Timer | null = null;
  let chartDataFeed: ChartDataFeed | null = null;
  let dataFeedInterval: NodeJS.Timer | null = null;
  
  export function syncWithBackendState() {
    const backendState = tradingBackendService.getState();
    const state = backendState.state || {};
    
    // Check if chart should be cleared (on reset)
    if (backendState.shouldClearChart) {
      dispatch('clearChart');
      // Clear the flag after dispatching
      tradingBackendService.getState().update(s => ({ ...s, shouldClearChart: false }));
    }
    
    if (state.isTestMode && state.activeBot) {
      const bot = state.activeBot;
      
      // Dispatch state update
      dispatch('stateSync', {
        isRunning: bot.state === 'running',
        isPaused: bot.state === 'paused',
        balance: bot.balance || 10000,
        btcBalance: bot.btcBalance || 0,
        vaultBalance: bot.vaultBalance || 0,
        btcVaultBalance: bot.btcVaultBalance || 0,
        trades: bot.trades || [],
        positions: bot.positions || [],
        metrics: bot.metrics || {}
      });
    }
  }
  
  export async function startTrading(strategy: Strategy) {
    try {
      
      // Initialize chart data feed if not already done
      if (!chartDataFeed) {
        chartDataFeed = ChartDataFeed.getInstance();
        chartDataFeed.setActiveInstance('paper-test');
      }
      
      // Start paper test with the selected strategy
      const bot = await paperTestService.startPaperTest(
        selectedStrategyType,
        'BTC-USD',
        10000,
        strategy
      );
      
      if (bot) {
        activeBotInstance = bot.id;
        
        // Update strategy with chart data feed
        if (dataFeedInterval) {
          clearInterval(dataFeedInterval);
        }
        
        dataFeedInterval = setInterval(() => {
          if (chartDataFeed && strategy) {
            const candles = chartDataFeed.getCurrentCandles();
            if (candles && candles.length > 0) {
              strategy.updateCandleData?.(candles);
            }
          }
        }, 1000);
        
        dispatch('tradingStarted', { botId: bot.id });
      }
    } catch (error) {
      dispatch('error', { message: 'Failed to start trading' });
    }
  }
  
  export function stopTrading() {
    if (activeBotInstance) {
      paperTestService.stopPaperTest(activeBotInstance);
      
      if (dataFeedInterval) {
        clearInterval(dataFeedInterval);
        dataFeedInterval = null;
      }
      
      dispatch('tradingStopped');
    }
  }
  
  export function pauseTrading() {
    if (activeBotInstance) {
      paperTestService.pausePaperTest(activeBotInstance);
      dispatch('tradingPaused');
    }
  }
  
  export function resumeTrading() {
    if (activeBotInstance) {
      paperTestService.resumePaperTest(activeBotInstance);
      dispatch('tradingResumed');
    }
  }
  
  onMount(() => {
    // Initial sync
    syncWithBackendState();
    
    // Set up periodic sync
    backendSyncInterval = setInterval(() => {
      syncWithBackendState();
    }, 2000);
    
    // Subscribe to backend state changes
    const backendStore = tradingBackendService.getState();
    backendStateUnsubscribe = backendStore.subscribe(() => {
      syncWithBackendState();
    });
  });
  
  onDestroy(() => {
    if (backendStateUnsubscribe) {
      backendStateUnsubscribe();
    }
    if (backendSyncInterval) {
      clearInterval(backendSyncInterval);
    }
    if (dataFeedInterval) {
      clearInterval(dataFeedInterval);
    }
  });
</script>