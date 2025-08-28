<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import BotTabs from '../../../PaperTrading/BotTabs.svelte';
  import BalanceDisplay from './BalanceDisplay.svelte';
  import { paperTradingManager } from '../../../../services/paperTradingManager';
  import { tradingBackendService } from '../../../../services/tradingBackendService';

  // Props
  export let selectedStrategyType: string = 'reverse-ratio';
  export let currentPrice: number = 0;
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  export let currentStrategy: any = null;
  export let strategyParameters: any = {};

  // Reactive state
  export let balance: number = 10000;
  export let btcBalance: number = 0;
  export let vaultBalance: number = 0;
  export let btcVaultBalance: number = 0;
  export let totalReturn: number = 0;
  export let trades: any[] = [];
  export let positions: any[] = [];

  const dispatch = createEventDispatcher();

  // Bot manager state
  const managerState = paperTradingManager.getState();
  let activeBotInstance: any = null;
  let botTabs: any[] = [];
  let activeBotStateUnsubscribe: (() => void) | null = null;

  // Backend state subscription
  const backendState = tradingBackendService.getState();
  let backendSyncInterval: NodeJS.Timer | null = null;

  // Subscribe to manager state changes
  $: {
    if ($managerState) {
      activeBotInstance = paperTradingManager.getActiveBot();
      
      // Get bots for current strategy
      const strategyBots = $managerState.bots[selectedStrategyType] || [];
      botTabs = strategyBots.map(bot => {
        // Check backend state for this bot
        const backendBot = $backendState.managerState?.bots?.[bot.id];
        let status = 'empty';
        
        if (backendBot && backendBot.status) {
          // Use backend status if available
          if (backendBot.status.isRunning) {
            status = backendBot.status.isPaused ? 'paused' : 'running';
          } else if (backendBot.status.trades && backendBot.status.trades.length > 0) {
            status = 'stopped';
          }
        } else {
          // Fall back to frontend state
          if (bot.state.isRunning) {
            status = bot.state.isPaused ? 'paused' : 'running';
          } else if (bot.state.trades.length > 0) {
            status = 'stopped';
          }
        }
        
        return {
          id: bot.id,
          name: bot.name,
          status,
          usdBalance: bot.state.balance.usd,
          btcBalance: bot.state.balance.btcPositions
        };
      });
    }
  }

  // Separate reactive statement for price-dependent calculations
  $: {
    if (botTabs && currentPrice) {
      botTabs = botTabs.map(tab => ({
        ...tab,
        balance: tab.usdBalance + (tab.btcBalance * currentPrice),
        profitLoss: ((tab.usdBalance + (tab.btcBalance * currentPrice)) - 10000) / 100
      }));
    }
  }

  // Backend sync interval for active bot
  $: if (activeBotInstance && $backendState.isConnected) {
    // Clear any existing interval
    if (backendSyncInterval) clearInterval(backendSyncInterval);
    
    // Sync every 2 seconds
    backendSyncInterval = setInterval(() => {
      const backendBot = $backendState.managerState?.bots?.[activeBotInstance.id];
      if (backendBot && backendBot.status) {
        // Only update if backend has data
        if (backendBot.status.trades && backendBot.status.trades.length > 0) {
          trades = [...backendBot.status.trades];
          dispatch('tradesUpdate', trades);
        }
        if (backendBot.status.positions) {
          positions = backendBot.status.positions;
          dispatch('positionsUpdate', positions);
        }
        
        // Always update balances and running state from backend
        balance = backendBot.status.balance?.usd || balance;
        btcBalance = backendBot.status.balance?.btc || btcBalance;
        
        // Update vault balances if available
        if (backendBot.status.vaultBalance !== undefined) {
          vaultBalance = backendBot.status.vaultBalance;
        }
        if (backendBot.status.btcVaultBalance !== undefined) {
          btcVaultBalance = backendBot.status.btcVaultBalance;
        }
        
        // Update trading state
        isRunning = backendBot.status.isRunning || false;
        isPaused = backendBot.status.isPaused || false;
        
        // Recalculate total return with vault values
        totalReturn = vaultBalance + (btcVaultBalance * currentPrice);
        
        // Dispatch state updates
        dispatch('stateUpdate', {
          balance,
          btcBalance,
          vaultBalance,
          btcVaultBalance,
          isRunning,
          isPaused,
          totalReturn
        });
      }
    }, 2000);
  } else if (backendSyncInterval) {
    clearInterval(backendSyncInterval);
    backendSyncInterval = null;
  }

  // Subscribe to active bot state
  $: if (activeBotInstance) {
    // Unsubscribe from previous bot if exists
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
      activeBotStateUnsubscribe = null;
    }
    
    syncWithBackendState();
  }

  function syncWithBackendState() {
    if (!activeBotInstance || !$backendState) return;
    
    const backendBot = $backendState.managerState?.bots?.[activeBotInstance.id];
    
    if (backendBot) {
      // Update local variables from backend bot state
      const wasRunning = isRunning;
      isRunning = backendBot.status?.isRunning || false;
      isPaused = backendBot.status?.isPaused || false;
      
      // Only log significant state changes
      if (wasRunning !== isRunning) {
        console.log(`Bot running state changed (backend): ${wasRunning} -> ${isRunning}`);
      }
      
      balance = backendBot.status?.balance?.usd || 10000;
      btcBalance = backendBot.status?.balance?.btc || 0;
      vaultBalance = 0; // Backend doesn't track vault balance yet
      btcVaultBalance = 0; // Backend doesn't track BTC vault yet
      
      // Only update positions if backend has them
      if (backendBot.status?.positions) {
        positions = backendBot.status.positions;
      }
      
      // Only update trades if backend has them - NEVER clear existing trades
      if (backendBot.status?.trades && backendBot.status.trades.length > 0) {
        trades = [...backendBot.status.trades];
      }
      
      // Total return should only count realized profits in vault
      totalReturn = vaultBalance + (btcVaultBalance * currentPrice);

      // Update strategy parameters if available
      if (backendBot.status?.strategy) {
        strategyParameters = { ...backendBot.status.strategy };
      } else {
        strategyParameters = {};
      }

      // Dispatch state updates
      dispatch('stateUpdate', {
        balance,
        btcBalance,
        vaultBalance,
        btcVaultBalance,
        isRunning,
        isPaused,
        totalReturn,
        positions,
        trades,
        strategyParameters
      });
    }
  }

  function handleBotTabSelect(event: CustomEvent) {
    const { botId } = event.detail;
    
    // Unsubscribe from current bot first
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
      activeBotStateUnsubscribe = null;
    }
    
    // Store current data temporarily
    const previousTrades = trades;
    const previousPositions = positions;
    const previousBalance = balance;
    const previousBtcBalance = btcBalance;
    
    // Select new bot
    paperTradingManager.selectBot(selectedStrategyType, botId);
    
    // Force immediate update
    activeBotInstance = paperTradingManager.getActiveBot();
    
    // Force immediate sync with backend
    if ($backendState.isConnected) {
      // Request fresh manager state
      tradingBackendService.send({ type: 'getManagerState' });
      
      // Wait a bit then sync
      setTimeout(() => {
        const backendBot = $backendState.managerState?.bots?.[botId];
        if (backendBot && backendBot.status && backendBot.status.trades) {
          // Use backend data
          syncWithBackendState();
        } else {
          // No backend data yet, restore previous data to prevent flashing
          trades = previousTrades;
          positions = previousPositions;
          balance = previousBalance;
          btcBalance = previousBtcBalance;
          
          // Try sync again
          syncWithBackendState();
        }
      }, 100);
    } else {
      syncWithBackendState();
    }

    // Dispatch bot selection event
    dispatch('botSelect', { botId, activeBotInstance });
  }

  async function startTrading() {
    console.log('BotManager startTrading called:', {
      activeBotInstance,
      isRunning,
      selectedStrategyType,
      currentPrice
    });
    
    if (!activeBotInstance) {
      console.error('Cannot start trading: No active bot selected');
      // Try to select the first bot for the current strategy
      const state = get(managerState);
      const strategyBots = state.bots[selectedStrategyType];
      if (strategyBots && strategyBots.length > 0) {
        console.log('Auto-selecting first bot:', strategyBots[0].id);
        paperTradingManager.selectBot(selectedStrategyType, strategyBots[0].id);
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 100));
        activeBotInstance = paperTradingManager.getActiveBot();
      }
      
      if (!activeBotInstance) {
        console.error('Still no active bot after auto-selection');
        return;
      }
    }

    if (isRunning) {
      console.warn('Trading already running for bot:', activeBotInstance.id);
      return;
    }

    if (!currentStrategy) {
      console.error('Cannot start trading: No strategy selected');
      return;
    }

    // Create strategy payload for backend
    const strategyPayload = {
      strategyType: selectedStrategyType,
      strategyConfig: (currentStrategy as any).config || strategyParameters,
      strategy: {
        getName: () => currentStrategy.getName(),
        config: (currentStrategy as any).config || {},
        parameters: strategyParameters
      }
    };
    
    // Use backend service to start trading for this bot
    try {
      // First select the bot in the backend
      tradingBackendService.selectBot(activeBotInstance.id);
      
      // Then start trading with the strategy
      await tradingBackendService.startTrading(strategyPayload, false);
      console.log('Backend trading started successfully for bot:', activeBotInstance.id);
      
      // Let the backend state update propagate
      isRunning = true;
      isPaused = false;

      dispatch('tradingStart', { botId: activeBotInstance.id });
      
    } catch (error) {
      console.error('Failed to start backend trading:', error);
      // Handle error appropriately
    }
  }

  async function pauseTrading() {
    if (!activeBotInstance || !isRunning) return;
    
    try {
      // Send pause command with bot ID
      await tradingBackendService.send({ 
        type: 'pause',
        botId: activeBotInstance.id 
      });
      console.log('Backend trading paused for bot:', activeBotInstance.id);
      isPaused = true;
      
      dispatch('tradingPause', { botId: activeBotInstance.id });
    } catch (error) {
      console.error('Failed to pause backend trading:', error);
    }
  }

  async function resumeTrading() {
    if (!activeBotInstance || !isRunning) return;
    
    try {
      // Send resume command with bot ID
      await tradingBackendService.send({ 
        type: 'resume',
        botId: activeBotInstance.id 
      });
      console.log('Backend trading resumed for bot:', activeBotInstance.id);
      isPaused = false;
      
      dispatch('tradingResume', { botId: activeBotInstance.id });
    } catch (error) {
      console.error('Failed to resume backend trading:', error);
    }
  }

  async function stopTrading() {
    if (!activeBotInstance) return;
    
    console.log('Stopping trading for bot:', activeBotInstance.id);
    
    try {
      // Send stop command with bot ID to ensure correct bot is stopped
      await tradingBackendService.send({ 
        type: 'stop',
        botId: activeBotInstance.id 
      });
      
      console.log('Backend trading stopped for bot:', activeBotInstance.id);
      isRunning = false;
      isPaused = false;
      
      dispatch('tradingStop', { botId: activeBotInstance.id });
    } catch (error) {
      console.error('Failed to stop backend trading:', error);
      // Force local state update as fallback
      isRunning = false;
      isPaused = false;
    }
  }

  async function resetTrading() {
    console.log('Reset clicked for bot:', activeBotInstance?.id);
    
    if (!activeBotInstance) return;
    
    // Stop if running
    if (isRunning) {
      await stopTrading();
    }
    
    // Use the new backend reset handler
    tradingBackendService.resetTrading(activeBotInstance.id);
    
    // Clear local state immediately for responsive UI
    isRunning = false;
    isPaused = false;
    balance = 10000;
    btcBalance = 0;
    vaultBalance = 0;
    btcVaultBalance = 0;
    positions = [];
    trades = [];
    totalReturn = 0;
    
    // Reset the frontend bot service as well
    const botService = activeBotInstance.service;
    botService.resetStrategy();
    
    // Update bot state in manager
    paperTradingManager.updateBotState(activeBotInstance.id, {
      balance: {
        usd: 10000,
        btcVault: 0,
        btcPositions: 0,
        vault: 0
      },
      trades: [],
      positions: [],
      isRunning: false,
      isPaused: false
    });

    dispatch('tradingReset', { botId: activeBotInstance.id });
  }

  function handleBalanceUpdate(event: CustomEvent) {
    const { balance: newBalance } = event.detail;
    balance = newBalance;
    
    if (activeBotInstance) {
      // Update the bot's balance
      const botService = activeBotInstance.service;
      const currentState = get(botService.getState());
      
      botService.setInitialBalance(newBalance);
      
      // Update bot state in manager
      paperTradingManager.updateBotState(activeBotInstance.id, {
        balance: {
          ...currentState.balance,
          usd: newBalance
        }
      });
    }

    dispatch('balanceUpdate', { balance: newBalance });
  }

  onMount(() => {
    // Initialize bot manager with current strategy
    paperTradingManager.initializeBotsForStrategy(selectedStrategyType);
    
    // Wait a bit for WebSocket to connect and then restore saved bot selection
    setTimeout(() => {
      const savedState = get(managerState);
      if (savedState.activeTabId) {
        console.log('Restoring saved bot selection from frontend:', savedState.activeTabId);
        paperTradingManager.selectBot(savedState.selectedStrategy, savedState.activeTabId);
      }
    }, 500);
  });

  onDestroy(() => {
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
    }
    if (backendSyncInterval) {
      clearInterval(backendSyncInterval);
    }
    
    // Save bot manager configuration
    paperTradingManager.saveConfiguration();
  });
</script>

<div class="bot-manager">
  <!-- Bot Tabs -->
  {#if botTabs.length > 0}
    <div class="bot-tabs-container">
      <BotTabs 
        bots={botTabs} 
        activeTabId={$managerState.activeTabId}
        on:selectTab={handleBotTabSelect}
      />
    </div>
  {/if}

  <!-- Balance Display -->
  <BalanceDisplay
    {balance}
    {btcBalance}
    {vaultBalance}
    {btcVaultBalance}
    {totalReturn}
    {currentPrice}
    {isRunning}
    tradesCount={trades.length}
    on:balanceUpdate={handleBalanceUpdate}
  />

  <!-- Trading Controls -->
  <div class="control-buttons">
    {#if !isRunning}
      <button class="start-btn" on:click={startTrading}>
        Start Automated Trading
      </button>
    {:else}
      {#if !isPaused}
        <button class="pause-btn" on:click={pauseTrading}>
          Pause Trading
        </button>
      {:else}
        <button class="resume-btn" on:click={resumeTrading}>
          Resume Trading
        </button>
      {/if}
      <button class="stop-btn" on:click={stopTrading}>
        Stop Trading
      </button>
    {/if}
    
    {#if trades.length > 0 || btcBalance > 0 || vaultBalance > 0}
      <button class="reset-btn" title="Reset Trading" on:click={resetTrading}>
        Reset
      </button>
    {/if}
  </div>

  <!-- Status Indicator -->
  {#if isRunning}
    <div class="status-indicator">
      <span class="status-dot"></span>
      <span>{isPaused ? 'Strategy Paused' : 'Strategy Running'}</span>
    </div>
  {/if}
</div>

<style>
  .bot-manager {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .bot-tabs-container {
    margin: 8px 0;
  }

  .control-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  .start-btn {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    flex: 1;
    min-width: 180px;
    transition: all 0.2s ease;
  }

  .start-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  }

  .pause-btn {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pause-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  }

  .resume-btn {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .resume-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
  }

  .stop-btn {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .stop-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  }

  .reset-btn {
    background: rgba(107, 114, 128, 0.1);
    border: 1px solid rgba(107, 114, 128, 0.3);
    color: #9ca3af;
    padding: 8px 12px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .reset-btn:hover {
    background: rgba(107, 114, 128, 0.2);
    color: #d1d5db;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 6px;
    color: #22c55e;
    font-size: 14px;
    font-weight: 500;
    margin-top: 8px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    background: #22c55e;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
</style>