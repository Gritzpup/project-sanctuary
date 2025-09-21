<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { paperTradingManager } from '../../services/state/paperTradingManager';
  import { paperTestService } from '../../services/state/paperTestService';
  import type { Strategy } from '../../strategies/base/Strategy';
  
  export let selectedStrategyType: string;
  export let currentStrategy: Strategy | null = null;
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  export let botTabs: any[] = [];
  export let activeBotInstance: any = null;
  
  const dispatch = createEventDispatcher();
  
  // Bot manager state
  const managerStateStore = paperTradingManager.getState();
  let managerState: any = {};
  let activeBotStateUnsubscribe: (() => void) | null = null;
  
  // Subscribe to manager state
  $: managerState = $managerStateStore;
  
  // Update bot tabs when manager state changes
  $: updateBotTabs();
  
  function updateBotTabs() {
    const bots = managerState.botInstances || [];
    
    botTabs = bots.map((bot: any) => ({
      id: bot.id,
      label: `${bot.strategy} (${bot.symbol})`,
      active: bot.id === activeBotInstance,
      state: bot.state,
      profit: bot.metrics?.totalProfit || 0
    }));
    
    // If we have an active bot but it's not in the current list, clear it
    if (activeBotInstance && !bots.find((bot: any) => bot.id === activeBotInstance)) {
      activeBotInstance = null;
    }
    
    // If no active bot and we have bots, select the first one
    if (!activeBotInstance && bots.length > 0) {
      handleBotTabSelect({ detail: { botId: bots[0].id } });
    }
  }
  
  export function handleBotTabSelect(event: CustomEvent) {
    const { botId } = event.detail;
    
    // Unsubscribe from previous bot
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
      activeBotStateUnsubscribe = null;
    }
    
    // Update active bot
    activeBotInstance = botId;
    
    // Find the bot instance
    const bot = (managerState.botInstances || []).find((b: any) => b.id === botId);
    if (bot) {
      subscribeToActiveBot(bot);
    }
    
    // Update tabs
    updateBotTabs();
    
    dispatch('botSelect', { botId });
  }
  
  function subscribeToActiveBot(bot: any) {
    if (!bot) return;
    
    // Get the bot's state and subscribe to changes
    const botState = paperTestService.getBotState(bot.id);
    if (botState) {
      activeBotStateUnsubscribe = botState.subscribe((state: any) => {
        if (state) {
          // Update our local state from the bot
          dispatch('botStateUpdate', {
            balance: state.balance || 10000,
            btcBalance: state.btcBalance || 0,
            trades: state.trades || [],
            positions: state.positions || [],
            metrics: state.metrics || {}
          });
        }
      });
    }
  }
  
  export function clearBotData() {
    if (activeBotInstance) {
      paperTestService.clearBotData(activeBotInstance);
      
      // Update state after clearing
      dispatch('botDataCleared', {
        balance: 10000,
        btcBalance: 0,
        trades: [],
        positions: [],
        totalReturn: 0,
        winRate: 0,
        totalFees: 0,
        totalRebates: 0
      });
    }
  }
  
  onMount(() => {
    // Initial update
    updateBotTabs();
  });
  
  onDestroy(() => {
    if (activeBotStateUnsubscribe) {
      activeBotStateUnsubscribe();
    }
  });
</script>