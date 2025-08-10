<script lang="ts">
  import Chart from './Chart.svelte';
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { paperTradingService } from '../services/paperTradingService';
  import type { ChartDataFeed } from '../services/chartDataFeed';
  import { ReverseRatioStrategy } from '../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../strategies/implementations/VWAPBounceStrategy';
  import { MicroScalpingStrategy } from '../strategies/implementations/MicroScalpingStrategy';
  import { ProperScalpingStrategy } from '../strategies/implementations/ProperScalpingStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  import { strategyStore } from '../stores/strategyStore';
  import { chartPreferencesStore } from '../stores/chartPreferencesStore';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  
  function toggleSidebar() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  // Load saved chart preferences
  const savedPrefs = chartPreferencesStore.getPreferences('paper-trading');
  let selectedGranularity = savedPrefs.granularity;
  let selectedPeriod = savedPrefs.period;
  let autoGranularityActive = false;
  
  // Save preferences when they change
  $: if (selectedGranularity && selectedPeriod) {
    chartPreferencesStore.setPreferences('paper-trading', selectedGranularity, selectedPeriod);
  }
  
  // Paper trading state
  let isRunning = false;
  let selectedStrategyType = 'reverse-ratio';
  let currentStrategy: Strategy | null = null;
  let statusInterval: NodeJS.Timer | null = null;
  
  // Tab state for strategy panel
  let activeTab: 'config' | 'code' = 'config';
  let strategySourceCode = '';
  
  // Current balances and metrics
  let balance = 10000;
  let btcBalance = 0;
  let vaultBalance = 0;
  let trades: any[] = [];
  let positions: any[] = [];
  let totalReturn = 0;
  let winRate = 0;
  
  // Chart data feed for strategy
  let chartDataFeed: ChartDataFeed | null = null;
  let dataFeedInterval: NodeJS.Timer | null = null;
  
  // UI state
  let isEditingBalance = false;
  let editingBalance = '10000';
  
  // Built-in strategies (same as in Backtesting)
  const builtInStrategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio', description: 'Grid trading with reverse position sizing', isCustom: false },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
    { value: 'micro-scalping', label: 'Micro Scalping (1H)', description: 'High-frequency 1H trading with 0.8% entries', isCustom: false },
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping with RSI, MACD, and stop losses', isCustom: false }
  ];
  
  let customStrategies: any[] = [];
  let strategyParameters: Record<string, any> = {};
  
  // Subscribe to strategy store
  let unsubscribe: () => void;
  
  // Reactive combined strategies list
  $: strategies = [...builtInStrategies, ...customStrategies];
  
  function createStrategy(type: string): Strategy {
    // Check if it's a custom strategy
    const customStrategy = customStrategies.find(s => s.value === type);
    
    if (customStrategy) {
      // For custom strategies, we need to evaluate the code
      // This is a simplified version - in production you'd want more safety
      try {
        const StrategyClass = eval(`(${customStrategy.code})`);
        return new StrategyClass(strategyParameters);
      } catch (error) {
        console.error('Failed to create custom strategy:', error);
        throw error;
      }
    }
    
    // Use parameters from store, fallback to empty object
    const params = strategyParameters || {};
    
    switch (type) {
      case 'reverse-ratio':
        return new ReverseRatioStrategy(params);
      case 'grid-trading':
        return new GridTradingStrategy(params);
      case 'rsi-mean-reversion':
        return new RSIMeanReversionStrategy(params);
      case 'dca':
        return new DCAStrategy(params);
      case 'vwap-bounce':
        return new VWAPBounceStrategy(params);
      case 'micro-scalping':
        return new MicroScalpingStrategy(params);
      case 'proper-scalping':
        return new ProperScalpingStrategy(params);
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }
  
  async function loadStrategySourceCode() {
    // Check if it's a custom strategy first
    const customStrategy = customStrategies.find(s => s.value === selectedStrategyType);
    
    if (customStrategy) {
      // For custom strategies, show the actual code
      strategySourceCode = customStrategy.code || 'Custom strategy code not available';
      return;
    }
    
    // Fetch the source code for built-in strategies
    try {
      const strategyPath = `/src/strategies/implementations/${getStrategyFileName(selectedStrategyType)}.ts`;
      const response = await fetch(strategyPath);
      if (response.ok) {
        strategySourceCode = await response.text();
      } else {
        // If fetch fails, show a placeholder
        strategySourceCode = getStrategySourcePlaceholder(selectedStrategyType);
      }
    } catch (error) {
      // Fallback to placeholder
      strategySourceCode = getStrategySourcePlaceholder(selectedStrategyType);
    }
  }
  
  function getStrategyFileName(type: string): string {
    const fileNames: Record<string, string> = {
      'reverse-ratio': 'ReverseRatioStrategy',
      'grid-trading': 'GridTradingStrategy',
      'rsi-mean-reversion': 'RSIMeanReversionStrategy',
      'dca': 'DCAStrategy',
      'vwap-bounce': 'VWAPBounceStrategy',
      'micro-scalping': 'MicroScalpingStrategy'
    };
    return fileNames[type] || 'Strategy';
  }
  
  function getStrategySourcePlaceholder(type: string): string {
    // Return a sample of the actual strategy code structure
    if (type === 'reverse-ratio') {
      return `import { Strategy } from '../base/Strategy';
import { CandleData, Position, Signal, StrategyConfig } from '../base/StrategyTypes';

export class ReverseRatioStrategy extends Strategy {
  constructor(config: Partial<ReverseRatioConfig> = {}) {
    super();
    this.name = 'Reverse Ratio Buying';
    this.description = 'Buys on dips with increasing position sizes, sells all at 7% profit';
    
    // Default configuration
    this.config = {
      initialDropPercent: 5,
      levelDropPercent: 5,
      profitTargetPercent: 7,
      maxLevels: 5,
      ratioMultipliers: [1, 1.5, 2, 2.5, 3],
      vaultAllocation: 99,
      btcGrowthAllocation: 1,
      ...config
    };
  }

  analyze(candles: CandleData[], currentPrice: number): Signal {
    const recentHigh = this.findRecentHigh(candles);
    const dropFromHigh = ((recentHigh - currentPrice) / recentHigh) * 100;
    
    // Check for exit conditions first
    if (this.shouldTakeProfit(currentPrice)) {
      return { action: 'sell', confidence: 0.9, reason: 'Target profit reached' };
    }
    
    // Check for entry conditions
    if (this.shouldBuy(dropFromHigh, currentPrice)) {
      return { action: 'buy', confidence: 0.8, reason: \`Drop level reached: \${dropFromHigh.toFixed(2)}%\` };
    }
    
    return { action: 'hold', confidence: 0.5 };
  }
  
  // ... additional implementation details
}`;
    }
    
    // Default placeholder for other strategies
    return `// Source code for ${type} strategy
// Implementation details would be shown here
export class ${getStrategyFileName(type)} extends Strategy {
  // Strategy implementation...
}`;
  }
  
  onMount(async () => {
    console.log('PaperTrading: Component mounted');
    
    // Service auto-restores in constructor, so just check current status
    const status = paperTradingService.getStatus();
    console.log('PaperTrading: Service status after auto-restore:', status);
    
    // Update UI with current state
    updateStatus();
    
    // If we have saved state, restore UI settings
    const savedState = localStorage.getItem('paperTradingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        
        // Restore strategy configuration
        selectedStrategyType = state.strategyTypeKey || state.strategyType || selectedStrategyType;
        if (state.strategyConfig) {
          strategyParameters = state.strategyConfig;
        }
        
        // Recreate the strategy instance
        try {
          currentStrategy = createStrategy(selectedStrategyType);
          await loadStrategySourceCode();
        } catch (error) {
          console.error('Failed to recreate strategy:', error);
        }
      } catch (error) {
        console.error('Failed to restore UI settings:', error);
      }
    }
    
    // If trading is running, start the necessary services
    if (status.isRunning) {
      console.log('PaperTrading: Trading is running, starting services');
      isRunning = true;
      
      // Start status updates
      statusInterval = setInterval(updateStatus, 1000);
      
      // Wait for chart to be ready then start data feed
      await new Promise(resolve => setTimeout(resolve, 500));
      if (chartDataFeed) {
        startDataFeedToStrategy();
      }
    }
    
    // Add a small delay to ensure chart component is fully mounted
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('PaperTrading: Ready to initialize');
    
    // Subscribe to strategy store to sync with backtesting
    unsubscribe = strategyStore.subscribe(config => {
      console.log('Paper Trading: Received strategy update:', config);
      
      // Update local state from store
      selectedStrategyType = config.selectedType;
      strategyParameters = config.parameters || {};
      
      // Update balance if provided
      if (config.balance !== undefined) {
        balance = config.balance;
        console.log('Paper Trading: Updated balance from store:', balance);
      }
      
      // Update fees if provided (Note: Paper trading service might need these in the future)
      if (config.fees) {
        // Store fees for potential future use in paper trading service
        // Currently paper trading doesn't simulate fees, but this ensures consistency
        console.log('Paper Trading: Received fee configuration:', config.fees);
      }
      
      // Update custom strategies if provided
      if (config.customStrategies) {
        customStrategies = config.customStrategies;
      }
      
      // Recreate strategy with new configuration
      try {
        currentStrategy = createStrategy(selectedStrategyType);
        loadStrategySourceCode();
      } catch (error) {
        console.error('Failed to create strategy from store:', error);
      }
    });
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (statusInterval) {
      clearInterval(statusInterval);
    }
    if (dataFeedInterval) {
      clearInterval(dataFeedInterval);
    }
    // Don't stop the service - just save state so trading continues in background
    if (isRunning) {
      paperTradingService.save();
    }
  });
  
  // Valid granularities for each period
  const validGranularities: Record<string, string[]> = {
    '1H': ['1m', '5m', '15m'],
    '4H': ['5m', '15m', '1h'],
    '5D': ['15m', '1h'],
    '1M': ['1h', '6h'],
    '3M': ['1h', '6h', '1D'],
    '6M': ['6h', '1D'],
    '1Y': ['6h', '1D'],
    '5Y': ['1D']
  };
  
  function isGranularityValid(granularity: string, period: string): boolean {
    return validGranularities[period]?.includes(granularity) || false;
  }
  
  function selectGranularity(granularity: string) {
    if (isGranularityValid(granularity, selectedPeriod)) {
      selectedGranularity = granularity;
    }
  }
  
  function selectPeriod(period: string) {
    selectedPeriod = period;
    
    if (!isGranularityValid(selectedGranularity, period)) {
      const validOptions = validGranularities[period];
      if (validOptions && validOptions.length > 0) {
        const middleIndex = Math.floor(validOptions.length / 2);
        selectedGranularity = validOptions[middleIndex];
      }
    }
  }
  
  function handleChartGranularityChange(newGranularity: string) {
    // Prevent granularity changes during active trading
    if (isRunning) {
      console.warn('Cannot change timeframe while trading is active');
      return;
    }
    
    if (selectedGranularity !== newGranularity) {
      selectedGranularity = newGranularity;
      autoGranularityActive = true;
      
      setTimeout(() => {
        autoGranularityActive = false;
      }, 2000);
    }
  }
  
  function handleDataFeedReady(feed: ChartDataFeed) {
    console.log('Paper Trading: Chart data feed ready');
    chartDataFeed = feed;
    
    // If trading is running, start feeding data to the strategy
    if (isRunning) {
      startDataFeedToStrategy();
    }
  }
  
  function startDataFeedToStrategy() {
    if (!chartDataFeed || !paperTradingService) return;
    
    // Clear any existing interval
    if (dataFeedInterval) {
      clearInterval(dataFeedInterval);
    }
    
    // Update strategy with current candles every second
    dataFeedInterval = setInterval(() => {
      if (chartDataFeed && isRunning) {
        const candles = chartDataFeed.getCurrentCandles();
        if (candles && candles.length > 0) {
          paperTradingService.updateCandles(candles);
          console.log('Paper Trading: Fed', candles.length, 'candles to strategy');
        }
      }
    }, 1000);
  }
  
  function stopDataFeedToStrategy() {
    if (dataFeedInterval) {
      clearInterval(dataFeedInterval);
      dataFeedInterval = null;
    }
  }
  
  async function startTrading() {
    if (!paperTradingService || isRunning) return;
    
    console.log('Starting trading - checking data:', {
      chartDataFeed: !!chartDataFeed,
      recentHigh,
      currentPrice
    });
    
    // Only create new strategy if we don't have one from restored state
    if (!currentStrategy) {
      currentStrategy = createStrategy(selectedStrategyType);
      await loadStrategySourceCode();
    }
    
    // Check if strategy has required timeframe
    const requiredGranularity = currentStrategy.getRequiredGranularity?.();
    const requiredPeriod = currentStrategy.getRequiredPeriod?.();
    
    if (requiredGranularity && requiredGranularity !== selectedGranularity) {
      console.warn(`Strategy requires ${requiredGranularity} granularity, but chart is set to ${selectedGranularity}`);
      // Optionally auto-switch to required granularity
      selectedGranularity = requiredGranularity;
    }
    
    if (requiredPeriod && requiredPeriod !== selectedPeriod) {
      console.warn(`Strategy requires ${requiredPeriod} period, but chart is set to ${selectedPeriod}`);
      // Optionally auto-switch to required period
      selectedPeriod = requiredPeriod;
    }
    
    paperTradingService.start(currentStrategy, 'BTC-USD', balance);
    isRunning = true;
    
    // Capture initial trading price and recent high
    initialTradingPrice = currentPrice;
    initialRecentHigh = recentHigh > 0 ? recentHigh : currentPrice;
    
    // Capture initial trading angle (where the needle is right now)
    if (threeZoneData && threeZoneData.current) {
      initialTradingAngle = threeZoneData.current.angle;
    }
    
    // Update store to indicate paper trading is active
    strategyStore.setPaperTradingActive(true);
    
    // Start feeding chart data to strategy
    startDataFeedToStrategy();
    
    // Start periodic status updates
    statusInterval = setInterval(updateStatus, 1000);
  }
  
  function stopTrading() {
    if (!paperTradingService || !isRunning) return;
    
    // Save state before stopping
    paperTradingService.save();
    
    // Stop the service (without clearing persistence)
    paperTradingService.stopStrategy(false);
    isRunning = false;
    
    // Update store to indicate paper trading is not active
    strategyStore.setPaperTradingActive(false);
    
    // Stop feeding chart data to strategy
    stopDataFeedToStrategy();
    
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    
    updateStatus();
  }
  
  function updateStatus() {
    if (!paperTradingService) return;
    
    const status = paperTradingService.getStatus();
    balance = status.usdBalance;
    btcBalance = status.btcBalance;
    vaultBalance = status.vaultBalance;
    positions = status.positions;
    trades = status.trades;
    
    // Calculate metrics
    if (trades.length > 0) {
      const closedTrades = trades.filter(t => t.side === 'sell');
      const profitableTrades = closedTrades.filter(t => t.profit && t.profit > 0);
      winRate = closedTrades.length > 0 ? (profitableTrades.length / closedTrades.length) * 100 : 0;
      
      const initialBalance = 10000;
      const currentTotal = balance + (btcBalance * currentPrice) + vaultBalance;
      totalReturn = currentTotal - initialBalance;
    }
  }
  
  function resetTrading() {
    console.log('Reset clicked, currentPrice:', currentPrice);
    
    if (!paperTradingService) return;
    
    // Stop if running
    if (isRunning) {
      stopTrading();
    }
    
    // Reset the service
    paperTradingService.resetStrategy();
    
    // Reset local state
    balance = 10000;
    btcBalance = 0;
    vaultBalance = 0;
    trades = [];
    positions = [];
    totalReturn = 0;
    winRate = 0;
    editingBalance = '10000';
    initialTradingPrice = 0;
    initialRecentHigh = 0;
    initialTradingAngle = 90;
    recentHigh = 0;
    recentLow = 0;
    lastTradeTime = 0;
  }
  
  function startEditingBalance() {
    if (!isRunning) {
      isEditingBalance = true;
      editingBalance = balance.toString();
    }
  }
  
  function saveBalance() {
    const newBalance = parseFloat(editingBalance);
    if (!isNaN(newBalance) && newBalance > 0) {
      balance = newBalance;
      isEditingBalance = false;
    } else {
      // Reset to current balance if invalid
      editingBalance = balance.toString();
      isEditingBalance = false;
    }
  }
  
  function cancelEditBalance() {
    editingBalance = balance.toString();
    isEditingBalance = false;
  }
  
  // Find linked trades (buy-sell pairs)
  function findLinkedTrades(tradeId: string): string[] {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return [];
    
    const linked: string[] = [];
    
    if (trade.type === 'buy') {
      // Find the next sell after this buy
      const buyIndex = trades.findIndex(t => t.id === tradeId);
      const nextSell = trades.slice(buyIndex + 1).find(t => t.type === 'sell');
      if (nextSell) linked.push(nextSell.id);
    } else if (trade.type === 'sell') {
      // Find the most recent buy before this sell
      const sellIndex = trades.findIndex(t => t.id === tradeId);
      const prevBuy = trades.slice(0, sellIndex).reverse().find(t => t.type === 'buy');
      if (prevBuy) linked.push(prevBuy.id);
    }
    
    return linked;
  }
  
  function handleTradeHover(tradeId: string) {
    hoveredTradeId = tradeId;
    linkedTradeIds = findLinkedTrades(tradeId);
  }
  
  function handleTradeLeave() {
    hoveredTradeId = null;
    linkedTradeIds = [];
  }
  
  // Helper function to calculate angle for a price on the gauge
  function calculateAngleForPrice(price: number, buyPrice: number, sellPrice: number): number {
    // This function is used to position trade indicators (dots/squares) on the gauge
    // For the Reverse Ratio strategy:
    // - Buy trades (red dots) ALWAYS appear on the LEFT side (0-60 degrees)
    // - Sell trades (green squares) ALWAYS appear on the RIGHT side (120-180 degrees)
    
    const highPrice = recentHigh || currentPrice;
    const dropPercent = ((highPrice - price) / highPrice) * 100;
    
    // First, determine if this is a buy or sell by looking at the actual trade
    // We'll be called with the trade price, and we can compare it to recent high
    // In Reverse Ratio, buys only happen when price drops from recent high
    
    // If price is below recent high by more than 3%, it's definitely a buy
    if (dropPercent >= 3) {
      // BUY trade - position on LEFT side based on drop percentage
      if (dropPercent >= 25) {
        return 20; // Far left for 25% drop
      } else if (dropPercent >= 20) {
        return 28; // 20% drop
      } else if (dropPercent >= 15) {
        return 36; // 15% drop  
      } else if (dropPercent >= 10) {
        return 44; // 10% drop
      } else if (dropPercent >= 5) {
        return 52; // 5% drop
      } else {
        return 58; // 3-5% drop
      }
    }
    
    // If we have positions and price is near or above recent high, it's likely a sell
    if (positions.length > 0 && dropPercent < 3) {
      // SELL trade - position on RIGHT side based on profit
      const lowestEntry = Math.min(...positions.map(p => p.entryPrice));
      const profitFromLowest = ((price - lowestEntry) / lowestEntry) * 100;
      
      if (profitFromLowest >= 10) {
        return 170; // Far right for high profit
      } else if (profitFromLowest >= 7) {
        return 160; // At target
      } else if (profitFromLowest >= 5) {
        return 150; // Near target
      } else if (profitFromLowest >= 3) {
        return 140; // Moderate profit
      } else {
        return 130; // Small profit
      }
    }
    
    // Default: if unclear, put in center
    return 90;
  }
  
  $: totalValue = balance + (btcBalance * currentPrice) + vaultBalance;
  $: unrealizedPnl = positions.reduce((total, pos) => {
    return total + ((currentPrice - pos.entryPrice) * pos.size);
  }, 0);
  $: returnPercent = ((totalValue - 10000) / 10000) * 100;
  
  // Calculate next buy trigger for all strategies
  let recentHigh = 0;
  let recentLow = 0;
  
  // Debug recentHigh changes
  $: console.log('recentHigh changed to:', recentHigh);
  let lastTradeTime = 0;
  let initialTradingPrice = 0;
  let initialRecentHigh = 0;
  let initialTradingAngle = 90;
  
  // Hover state tracking
  let hoveredTradeId: string | null = null;
  let linkedTradeIds: string[] = [];
  
  // Get recent high/low from chart data instead of trading history
  $: {
    if (chartDataFeed && currentPrice > 0) {
      const candles = chartDataFeed.getCurrentCandles();
      if (candles && candles.length > 0) {
        // Look at last 24-48 candles for recent high/low (24-48 hours for 1H candles)
        const lookbackCandles = candles.slice(-48);
        if (lookbackCandles.length > 0) {
          recentHigh = Math.max(...lookbackCandles.map(c => c.high));
          recentLow = Math.min(...lookbackCandles.map(c => c.low));
          console.log(`Paper Trading: Recent high: $${recentHigh.toFixed(2)}, Recent low: $${recentLow.toFixed(2)}, Current: $${currentPrice.toFixed(2)}`);
          console.log('Updated recentHigh from candles:', recentHigh);
        }
      }
      
      // Fallback only if we have no candle data
      if (recentHigh === 0) {
        recentHigh = currentPrice;
        recentLow = currentPrice;
        console.log('Paper Trading: No candle data, using current price as recent high/low');
      }
    }
    
    // Update last trade time if we have trades
    if (trades.length > 0) {
      const lastBuyTrade = [...trades].reverse().find(t => t.type === 'buy');
      if (lastBuyTrade) {
        lastTradeTime = lastBuyTrade.timestamp;
      }
    }
  }
  
  $: dropFromHigh = recentHigh > 0 ? ((recentHigh - currentPrice) / recentHigh) * 100 : 0;
  $: riseFromLow = recentLow > 0 ? ((currentPrice - recentLow) / recentLow) * 100 : 0;
  
  // Calculate sell target based on positions or current price
  $: sellTarget = (() => {
    // If no positions, show where profit would be from current price
    const referencePrice = positions.length === 0 
      ? currentPrice 
      : Math.min(...positions.map(p => p.entryPrice));
    
    // Get profit target from strategy parameters or use default
    let profitTarget = 7; // Default 7%
    
    // Strategy-specific profit targets
    switch (selectedStrategyType) {
      case 'reverse-ratio':
        profitTarget = strategyParameters.profitTarget || 7;
        break;
      case 'grid-trading':
        profitTarget = strategyParameters.profitTarget || 2;
        break;
      case 'rsi-mean-reversion':
        profitTarget = strategyParameters.profitTarget || 5;
        break;
      case 'micro-scalping':
        profitTarget = 0.9; // Fixed 0.9% for micro scalping
        break;
      case 'proper-scalping':
        profitTarget = strategyParameters.profitTarget || 1.5;
        break;
      case 'vwap-bounce':
        profitTarget = strategyParameters.profitTarget || 3;
        break;
      case 'dca':
        profitTarget = strategyParameters.profitTarget || 10;
        break;
    }
    
    return {
      price: referencePrice * (1 + profitTarget / 100),
      profitTarget: profitTarget,
      lowestEntry: referencePrice
    };
  })();
  
  // Calculate next buy level based on selected strategy
  $: nextBuyLevel = (() => {
    // Use current price, no artificial fallback
    const effectivePrice = currentPrice || 1;
    
    const currentPositionCount = positions.length;
    const dropFromHigh = recentHigh > 0 ? ((recentHigh - effectivePrice) / recentHigh) * 100 : 0;
    
    // Debug logging
    console.log('nextBuyLevel calculation:', {
      currentPrice,
      effectivePrice,
      recentHigh,
      dropFromHigh,
      selectedStrategyType
    });
    
    switch (selectedStrategyType) {
      case 'reverse-ratio': {
        const levels = [5, 10, 15, 20, 25]; // Drop percentages for each level
        // Always show next buy level, even if max positions reached
        
        // Find the next level that hasn't been reached yet
        let nextLevel = null;
        
        // First, find the next level we haven't bought at yet
        for (let level of levels) {
          const hasPositionAtLevel = positions.some(p => {
            const positionDropPercent = ((recentHigh - p.entryPrice) / recentHigh) * 100;
            return Math.abs(positionDropPercent - level) < 1; // Within 1% tolerance
          });
          
          if (!hasPositionAtLevel) {
            // This is a level we haven't bought at yet
            const targetPrice = (recentHigh || effectivePrice) * (1 - level / 100);
            // Only show if it's below current price (a future buy opportunity)
            if (targetPrice < effectivePrice) {
              nextLevel = level;
              break;
            }
          }
        }
        
        // If we haven't found a level yet, it means we're above all unbought levels
        // So show the first unbought level
        if (!nextLevel && currentPositionCount < levels.length) {
          for (let level of levels) {
            const hasPositionAtLevel = positions.some(p => {
              const positionDropPercent = ((recentHigh - p.entryPrice) / recentHigh) * 100;
              return Math.abs(positionDropPercent - level) < 1;
            });
            
            if (!hasPositionAtLevel) {
              nextLevel = level;
              break;
            }
          }
        }
        
        // If no next level found, show the first available level as a reference
        if (!nextLevel) {
          nextLevel = levels[0]; // Default to first level (5%)
          // If we're above all levels, show where the first buy would be
          for (let level of levels) {
            const targetPrice = (recentHigh || effectivePrice) * (1 - level / 100);
            if (targetPrice < effectivePrice) {
              nextLevel = level;
              break;
            }
          }
        }
        
        return {
          type: 'price',
          label: 'Drop Target',
          value: `${nextLevel}%`,
          price: (recentHigh || effectivePrice) * (1 - nextLevel / 100),
          progress: (dropFromHigh / nextLevel) * 100,
          dropPercent: nextLevel,
          currentDrop: dropFromHigh,
          description: `${nextLevel}% drop from high`
        };
      }
      
      case 'grid-trading': {
        // Grid trading: Buy at regular intervals below current price
        const gridSpacing = 2; // 2% grid spacing
        const nextGridLevel = Math.floor(dropFromHigh / gridSpacing) + 1;
        const targetDrop = nextGridLevel * gridSpacing;
        
        return {
          type: 'price',
          label: 'Grid Level',
          value: `Level ${nextGridLevel}`,
          price: (recentHigh || effectivePrice) * (1 - targetDrop / 100),
          progress: ((dropFromHigh % gridSpacing) / gridSpacing) * 100,
          description: `Grid level at ${targetDrop}% drop`
        };
      }
      
      case 'rsi-mean-reversion': {
        // RSI strategy: Estimate based on price movement (simplified)
        // In reality, would need actual RSI calculation
        const oversoldTarget = 30; // RSI 30 is typical oversold
        const estimatedDropForOversold = 7; // Rough estimate
        
        return {
          type: 'indicator',
          label: 'RSI Target',
          value: 'RSI < 30',
          price: effectivePrice * (1 - estimatedDropForOversold / 100),
          progress: Math.min((dropFromHigh / estimatedDropForOversold) * 100, 95),
          description: 'Waiting for oversold RSI'
        };
      }
      
      case 'dca': {
        // DCA: Buy at regular time intervals
        const intervalHours = 24; // Daily DCA
        const intervalMs = intervalHours * 60 * 60 * 1000;
        const timeSinceLastTrade = Date.now() - (lastTradeTime * 1000);
        const progress = Math.min((timeSinceLastTrade / intervalMs) * 100, 100);
        
        return {
          type: 'time',
          label: 'Next DCA',
          value: progress >= 100 ? 'Now' : `${Math.round((intervalMs - timeSinceLastTrade) / (60 * 60 * 1000))}h`,
          price: effectivePrice, // DCA buys at market price
          progress: progress,
          dropPercent: 0,
          currentDrop: dropFromHigh,
          description: 'Daily accumulation'
        };
      }
      
      case 'vwap-bounce': {
        // VWAP strategy: Buy when price is below VWAP (simplified)
        const vwapDiscount = 2; // Buy 2% below VWAP
        const estimatedVWAP = (recentHigh || effectivePrice) * 0.98; // Simplified VWAP estimate
        const targetPrice = estimatedVWAP * (1 - vwapDiscount / 100);
        
        return {
          type: 'indicator',
          label: 'VWAP Target',
          value: 'Below VWAP',
          price: targetPrice,
          progress: Math.max(0, Math.min(100, ((estimatedVWAP - effectivePrice) / (estimatedVWAP - targetPrice)) * 100)),
          dropPercent: vwapDiscount,
          currentDrop: dropFromHigh,
          description: `${vwapDiscount}% below VWAP`
        };
      }
      
      default:
        // Default strategy: Show 5% below current price as a reasonable buy target
        const defaultDropTarget = 5;
        return {
          type: 'price',
          label: 'Buy Target',
          value: `-${defaultDropTarget}%`,
          price: effectivePrice * (1 - defaultDropTarget / 100),
          progress: Math.min((dropFromHigh / defaultDropTarget) * 100, 100),
          dropPercent: defaultDropTarget,
          currentDrop: dropFromHigh,
          description: `${defaultDropTarget}% below current`
        };
    }
  })();
  
  // Debug what nextBuyLevel is
  $: console.log('nextBuyLevel result:', nextBuyLevel);
  
  // Calculate 3-section chart data - depend on all necessary variables
  $: threeZoneData = (() => {
    if (currentPrice <= 0) return null;
    
    // Force reactivity by referencing these variables
    positions.length; // Force dependency on positions array changes
    isRunning; // Force dependency on trading state
    
    // For Reverse Ratio strategy, the gauge represents:
    // LEFT (Red) - "Buy Triggers": Where drops trigger buys (5-25% below recent high)
    // MIDDLE (Blue) - "Hold Zone": Normal trading range
    // RIGHT (Green) - "Sell Triggers": Where profit targets trigger sells
    
    // Always calculate zones based on strategy behavior
    // Ensure we have a valid recentHigh
    console.log('threeZoneData calc - recentHigh:', recentHigh, 'currentPrice:', currentPrice);
    const highPrice = (recentHigh && recentHigh > 0) ? recentHigh : currentPrice;
    const dropFromHigh = ((highPrice - currentPrice) / highPrice) * 100;
    console.log('threeZoneData calc - highPrice:', highPrice);
    
    // Calculate average entry price first (needed for multiple calculations)
    let avgEntryPrice = currentPrice; // Default if no positions
    let profitPercent = 0;
    
    if (positions.length > 0) {
      const totalValue = positions.reduce((sum, p) => {
        const entryPrice = p.entryPrice || 0;
        const size = p.size || 0;
        return sum + (entryPrice * size);
      }, 0);
      const totalSize = positions.reduce((sum, p) => sum + (p.size || 0), 0);
      avgEntryPrice = totalSize > 0 ? totalValue / totalSize : currentPrice;
      profitPercent = avgEntryPrice > 0 ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100 : 0;
    }
    
    // Calculate angle for the needle - this represents where we are in the trading cycle
    // The gauge shows our position relative to buy/sell triggers
    let angle = 90; // Default center
    
    // IMPORTANT: The angle represents our READINESS to buy or sell
    // LEFT side (0-60°) = Buy zone - we're in territory where buys can happen
    // MIDDLE (60-120°) = Hold zone - neutral territory 
    // RIGHT side (120-180°) = Sell zone - we have positions ready to sell
    
    // Make needle responsive to every price change by using currentPrice directly
    const currentDropFromHigh = ((highPrice - currentPrice) / highPrice) * 100;
    
    if (positions.length === 0) {
      // No positions - needle position based on drop from high
      // If not running or no recent high, default to center
      if (!isRunning || recentHigh === 0) {
        angle = 90; // Center when not trading
      } else if (currentDropFromHigh <= 0) {
        // At or above recent high - center (no drop yet)
        angle = 90;
      } else if (currentDropFromHigh < 5) {
        // Approaching first buy level - moving left smoothly
        // Map 0-5% drop to 120-60 degrees
        angle = 120 - (currentDropFromHigh / 5) * 60;
      } else if (currentDropFromHigh >= 25) {
        // Deep drop - far left (maximum buy opportunity)
        angle = 20;
      } else {
        // In active buy zone (5-25% drop) - left side
        // Map 5-25% drop to 60-20 degrees
        angle = 60 - ((currentDropFromHigh - 5) / 20) * 40;
      }
    } else {
      // We have positions - needle shows profit/loss status
      // profitPercent already calculated above
      
      if (profitPercent >= 7) {
        // At or above profit target - far right (sell zone)
        angle = 160;
      } else if (profitPercent > 3) {
        // Meaningful profit - moving right
        // Map 3-7% profit to 120-160 degrees
        angle = 120 + ((profitPercent - 3) / 4) * 40;
      } else if (profitPercent > 0) {
        // Small profit - center-right
        // Map 0-3% profit to 90-120 degrees
        angle = 90 + (profitPercent / 3) * 30;
      } else if (profitPercent > -5) {
        // Small loss - center-left area
        // Map -5-0% loss to 60-90 degrees
        angle = 60 + ((profitPercent + 5) / 5) * 30;
      } else {
        // Larger loss - left side (may trigger more buys)
        // Map losses below -5% to left side
        angle = Math.max(20, 60 - (Math.abs(profitPercent) - 5) / 20 * 40);
      }
    }
    
    // Get actual next buy and sell levels
    let buyZone = currentPrice * 0.95;
    let buyZoneType = 'default';
    
    if (nextBuyLevel) {
      buyZone = nextBuyLevel.price;
      buyZoneType = 'next';
    } else if (positions.length >= 5) {
      // At max positions
      if (positions.length > 0) {
        buyZone = Math.min(...positions.map(p => p.entryPrice));
        buyZoneType = 'lowest';
      }
    }
    
    const sellZone = sellTarget?.price || currentPrice * 1.07;
    const buyDistance = currentPrice - buyZone;
    const sellDistance = sellZone - currentPrice;
    
    return {
      buyZone: {
        price: buyZone,
        distance: buyDistance,
        percent: Math.abs((buyDistance / currentPrice) * 100),
        dropToNext: nextBuyLevel ? ((currentPrice - nextBuyLevel.price) / currentPrice * 100) : 5,
        type: buyZoneType
      },
      current: {
        price: currentPrice,
        angle: Math.max(0, Math.min(180, angle)),
        dropFromHigh: dropFromHigh
      },
      sellZone: {
        price: sellZone,
        distance: sellDistance,
        percent: positions.length > 0 ? 
          Math.abs((sellDistance / avgEntryPrice) * 100) : 
          Math.abs((sellDistance / currentPrice) * 100),
        hasPositions: positions.length > 0
      },
      isTrading: true,
      recentHigh: highPrice
    };
  })();
  
  // Debug logging for trading zone
  $: {
    if (threeZoneData) {
      const totalValue = positions.reduce((sum, p) => sum + (p.entryPrice || 0) * (p.size || 0), 0);
      const totalSize = positions.reduce((sum, p) => sum + (p.size || 0), 0);
      const avgEntry = totalSize > 0 ? totalValue / totalSize : 0;
      const profitPercent = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;
      
      console.log('Trading Zone Data:', {
        isTrading: threeZoneData.isTrading,
        recentHigh: threeZoneData.recentHigh,
        currentPrice: threeZoneData.current.price,
        dropFromHigh: threeZoneData.current.dropFromHigh,
        angle: threeZoneData.current.angle,
        positionCount: positions.length,
        avgEntryPrice: avgEntry,
        positions: positions.map(p => ({ entryPrice: p.entryPrice, size: p.size })),
        currentProfit: profitPercent.toFixed(2) + '%',
        buyZone: threeZoneData.buyZone,
        sellZone: threeZoneData.sellZone,
        nextBuyLevel: nextBuyLevel
      });
    }
  }
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="paper-trading"
    on:toggle={toggleSidebar} 
    on:navigate={handleNavigation} 
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="header">
      <h1>Paper Trading</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">BTC/USD</span>
          <span class="stat-value price">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Value</span>
          <span class="stat-value">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Return</span>
          <span class="stat-value" class:profit={totalReturn > 0} class:loss={totalReturn < 0}>
            ${totalReturn.toFixed(2)} ({returnPercent.toFixed(2)}%)
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Win Rate</span>
          <span class="stat-value">{winRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
    
    <div class="trading-grid">
      <!-- Chart Panel -->
      <div class="panel chart-panel">
        <div class="granularity-transition" class:active={autoGranularityActive}>
          Switching to {selectedGranularity}
        </div>
        <div class="panel-header">
          <h2>BTC/USD Chart</h2>
          <div class="chart-controls">
            <div class="granularity-buttons">
              <button class="granularity-btn" class:active={selectedGranularity === '1m'} disabled={!isGranularityValid('1m', selectedPeriod)} on:click={() => selectGranularity('1m')}>1m</button>
              <button class="granularity-btn" class:active={selectedGranularity === '5m'} disabled={!isGranularityValid('5m', selectedPeriod)} on:click={() => selectGranularity('5m')}>5m</button>
              <button class="granularity-btn" class:active={selectedGranularity === '15m'} disabled={!isGranularityValid('15m', selectedPeriod)} on:click={() => selectGranularity('15m')}>15m</button>
              <button class="granularity-btn" class:active={selectedGranularity === '1h'} disabled={!isGranularityValid('1h', selectedPeriod)} on:click={() => selectGranularity('1h')}>1h</button>
              <button class="granularity-btn" class:active={selectedGranularity === '6h'} disabled={!isGranularityValid('6h', selectedPeriod)} on:click={() => selectGranularity('6h')}>6h</button>
              <button class="granularity-btn" class:active={selectedGranularity === '1D'} disabled={!isGranularityValid('1D', selectedPeriod)} on:click={() => selectGranularity('1D')}>1D</button>
            </div>
          </div>
        </div>
        <div class="panel-content">
          <Chart 
            bind:status={connectionStatus} 
            granularity={selectedGranularity} 
            period={selectedPeriod} 
            onGranularityChange={handleChartGranularityChange}
            onDataFeedReady={handleDataFeedReady}
            trades={trades.map(t => ({
              timestamp: t.timestamp,
              type: t.type || t.side,  // Handle both 'type' and 'side' properties
              price: t.price
            }))}
          />
          {#if isRunning}
            <div class="timeframe-locked-indicator">
              🔒 Timeframe locked during trading ({selectedGranularity} / {selectedPeriod})
              {#if currentStrategy?.getRequiredGranularity?.()}
                <div class="required-timeframe">
                  Strategy requires: {currentStrategy.getRequiredGranularity()} / {currentStrategy.getRequiredPeriod() || 'any period'}
                </div>
              {/if}
            </div>
          {/if}
          <div class="period-buttons">
            <button class="period-btn" class:active={selectedPeriod === '1H'} disabled={isRunning} on:click={() => selectPeriod('1H')}>1H</button>
            <button class="period-btn" class:active={selectedPeriod === '4H'} disabled={isRunning} on:click={() => selectPeriod('4H')}>4H</button>
            <button class="period-btn" class:active={selectedPeriod === '5D'} disabled={isRunning} on:click={() => selectPeriod('5D')}>5D</button>
            <button class="period-btn" class:active={selectedPeriod === '1M'} disabled={isRunning} on:click={() => selectPeriod('1M')}>1M</button>
            <button class="period-btn" class:active={selectedPeriod === '3M'} disabled={isRunning} on:click={() => selectPeriod('3M')}>3M</button>
            <button class="period-btn" class:active={selectedPeriod === '6M'} disabled={isRunning} on:click={() => selectPeriod('6M')}>6M</button>
            <button class="period-btn" class:active={selectedPeriod === '1Y'} disabled={isRunning} on:click={() => selectPeriod('1Y')}>1Y</button>
            <button class="period-btn" class:active={selectedPeriod === '5Y'} disabled={isRunning} on:click={() => selectPeriod('5Y')}>5Y</button>
          </div>
        </div>
      </div>
      
      <!-- Trading Controls -->
      <div class="panel trading-panel">
        <div class="panel-header">
          <h2>
            Automated Trading
          </h2>
          <div class="header-actions">
            {#if trades.length > 0 || btcBalance > 0 || vaultBalance > 0}
              <button class="reset-btn" title="Reset Trading" on:click={resetTrading}>
                🔄
              </button>
            {/if}
            <div class="tabs">
              <button class="tab" class:active={activeTab === 'config'} on:click={() => activeTab = 'config'}>
                Configuration
              </button>
              <button class="tab" class:active={activeTab === 'code'} on:click={() => activeTab = 'code'}>
                Source Code
              </button>
            </div>
          </div>
        </div>
        <div class="panel-content">
          {#if activeTab === 'config'}
          <div class="strategy-section">
            <div class="sync-indicator">
              <span class="sync-icon">🔗</span>
              <span class="sync-text">Synced with Backtesting</span>
            </div>
            <label>
              Strategy
              <select bind:value={selectedStrategyType} disabled={isRunning} on:change={() => {
                try {
                  currentStrategy = createStrategy(selectedStrategyType);
                  loadStrategySourceCode();
                } catch (error) {
                  console.error('Failed to create strategy:', error);
                }
              }}>
                {#each strategies as strat}
                  <option value={strat.value}>
                    {strat.label}
                    {#if strat.isCustom}[CUSTOM]{/if}
                  </option>
                {/each}
              </select>
            </label>
          </div>
          
          <div class="balances">
            <div class="balance-item">
              <span>USD Balance:</span>
              {#if isEditingBalance}
                <div class="balance-edit">
                  $<input 
                    type="number" 
                    bind:value={editingBalance} 
                    on:keydown={(e) => {
                      if (e.key === 'Enter') saveBalance();
                      if (e.key === 'Escape') cancelEditBalance();
                    }}
                    on:blur={saveBalance}
                    autofocus
                  />
                </div>
              {:else}
                <span class="balance-value" class:editable={!isRunning} on:click={startEditingBalance}>
                  ${balance.toFixed(2)}
                  {#if !isRunning}
                    <span class="edit-icon">✏️</span>
                  {/if}
                </span>
              {/if}
            </div>
            <div class="balance-item">
              <span>BTC Balance:</span>
              <span>{btcBalance.toFixed(8)} BTC</span>
            </div>
            <div class="balance-item">
              <span>Vault Balance:</span>
              <span class="vault">${vaultBalance.toFixed(2)}</span>
            </div>
            <div class="balance-item">
              <span>Unrealized P&L:</span>
              <span class:profit={unrealizedPnl > 0} class:loss={unrealizedPnl < 0}>
                ${unrealizedPnl.toFixed(2)}
              </span>
            </div>
          </div>
          
          <div class="control-buttons">
            {#if !isRunning}
              <button class="start-btn" on:click={startTrading}>
                Start Automated Trading
              </button>
            {:else}
              <button class="stop-btn" on:click={stopTrading}>
                Stop Trading
              </button>
            {/if}
            <button class="reset-btn" on:click={resetTrading} title="Reset balance and clear all positions">
              Reset
            </button>
          </div>
          
          {#if isRunning}
            <div class="status-indicator">
              <span class="status-dot"></span>
              <span>Strategy Running</span>
            </div>
          {/if}
          {:else if activeTab === 'code'}
            <div class="code-editor-section">
              <div class="code-header">
                <h3>{getStrategyFileName(selectedStrategyType)}.ts</h3>
                <div class="code-info">
                  This is the actual implementation of the {strategies.find(s => s.value === selectedStrategyType)?.label} strategy
                </div>
              </div>
              <div class="code-editor">
                <pre><code class="typescript">{strategySourceCode}</code></pre>
              </div>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Positions Panel -->
      <div class="panel positions-panel">
        <div class="panel-header">
          <h2>Open Positions</h2>
        </div>
        <div class="panel-content">
          <div class="positions-list">
            {#if positions.length === 0}
              <p class="no-positions">No open positions</p>
            {:else}
              {#each positions as position}
                <div class="position-item">
                  <div class="position-header">
                    <span>Entry: ${position.entryPrice.toFixed(2)}</span>
                    <span>{position.size.toFixed(8)} BTC</span>
                  </div>
                  <div class="position-details">
                    <span>Current: ${currentPrice.toFixed(2)}</span>
                    <span class:profit={(currentPrice - position.entryPrice) > 0} 
                          class:loss={(currentPrice - position.entryPrice) < 0}>
                      P&L: ${((currentPrice - position.entryPrice) * position.size).toFixed(2)}
                    </span>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Trade History -->
      <div class="panel history-panel">
        <div class="panel-header">
          <h2>Trade History</h2>
        </div>
        <div class="panel-content">
          <div class="trades-list">
            {#if trades.length === 0}
              <p class="no-trades">No trades yet</p>
            {:else}
              {#each trades.slice(-20).reverse() as trade}
                <div class="trade-item" class:buy={(trade.type || trade.side) === 'buy'} class:sell={(trade.type || trade.side) === 'sell'}>
                  <div class="trade-header">
                    <span class="trade-type">{(trade.type || trade.side || '').toUpperCase()}</span>
                    <span class="trade-time">{new Date((trade.timestamp || 0) * 1000).toLocaleString()}</span>
                  </div>
                  <div class="trade-details">
                    <span>Price: ${trade.price.toFixed(2)}</span>
                    <span>Size: {trade.size.toFixed(8)} BTC</span>
                    <span>Value: ${(trade.price * trade.size).toFixed(2)}</span>
                    {#if trade.profit !== undefined}
                      <span class:profit={trade.profit > 0} class:loss={trade.profit < 0}>
                        P&L: ${trade.profit.toFixed(2)}
                      </span>
                    {/if}
                    {#if trade.profitToVault}
                      <span class="vault-allocation">Vault: ${trade.profitToVault.toFixed(2)}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Trading Zones Indicator -->
      {#if threeZoneData}
        <div class="trigger-gauge-panel">
          <div class="gauge-container">
            <div class="gauge-header">
              <h3>📊 Market Position</h3>
              <div class="zone-prices">
                <div class="zone-price buy">
                  <span class="zone-label">
                    {#if positions.length === 0}
                      Drop Level
                    {:else if threeZoneData.buyZone.type === 'next'}
                      Next Buy
                    {:else if threeZoneData.buyZone.type === 'lowest'}
                      Lowest Entry
                    {:else}
                      Buy Zone
                    {/if}
                  </span>
                  <span class="zone-value">${threeZoneData.buyZone.price.toFixed(2)}</span>
                </div>
                <div class="zone-price current">
                  <span class="zone-label">Current</span>
                  <span class="zone-value">${threeZoneData.current.price.toFixed(2)}</span>
                </div>
                <div class="zone-price sell">
                  <span class="zone-label">
                    {#if positions.length > 0}
                      Profit Target
                    {:else}
                      Est. Target
                    {/if}
                  </span>
                  <span class="zone-value">${threeZoneData.sellZone.price.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div class="three-zone-chart">
              <svg viewBox="0 0 240 140" class="zone-svg">
                <!-- Gauge background -->
                <defs>
                  <linearGradient id="buyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ef4444;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:#ef4444;stop-opacity:0.15" />
                  </linearGradient>
                  <linearGradient id="holdGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.15" />
                  </linearGradient>
                  <linearGradient id="sellGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#22c55e;stop-opacity:0.15" />
                    <stop offset="100%" style="stop-color:#22c55e;stop-opacity:0.3" />
                  </linearGradient>
                </defs>
                
                <!-- Gauge arc sections with correct paths -->
                <!-- Buy zone: 0-60 degrees -->
                <path d="M 40 120 A 80 80 0 0 1 80 50.7" 
                      fill="none" 
                      stroke="url(#buyGradient)" 
                      stroke-width="30" 
                      class="gauge-section buy-section"/>
                
                <!-- Hold zone: 60-120 degrees -->
                <path d="M 80 50.7 A 80 80 0 0 1 160 50.7" 
                      fill="none" 
                      stroke="url(#holdGradient)" 
                      stroke-width="30" 
                      class="gauge-section hold-section"/>
                
                <!-- Sell zone: 120-180 degrees -->
                <path d="M 160 50.7 A 80 80 0 0 1 200 120" 
                      fill="none" 
                      stroke="url(#sellGradient)" 
                      stroke-width="30" 
                      class="gauge-section sell-section"/>
                
                <!-- Gauge outline -->
                <path d="M 40 120 A 80 80 0 0 1 200 120" 
                      fill="none" 
                      stroke="rgba(255,255,255,0.2)" 
                      stroke-width="1" 
                      class="gauge-outline"/>
                
                <!-- Zone dividers -->
                <line x1="80" y1="50.7" x2="80" y2="35" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                <line x1="160" y1="50.7" x2="160" y2="35" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                
                <!-- Buy/Sell indicators on outer edge -->
                {#if trades.length > 0}
                  <!-- Buy trade indicators (all historical buys) -->
                  {#each trades.filter(t => t.type === 'buy') as trade, i}
                    {@const priceRange = threeZoneData.sellZone.price - threeZoneData.buyZone.price}
                    {@const pricePosition = (trade.price - threeZoneData.buyZone.price) / priceRange}
                    {@const tradeAngle = 0 + pricePosition * 180} 
                    {@const zoneColor = tradeAngle <= 60 ? '#ef4444' : tradeAngle >= 120 ? '#22c55e' : '#3b82f6'}
                    {@const isHighlighted = hoveredTradeId === trade.id || linkedTradeIds.includes(trade.id)}
                    {@const openPosition = positions.find(p => p.id === trade.position?.id)}
                    {@const currentPnL = openPosition ? ((currentPrice - openPosition.entryPrice) * openPosition.size) : null}
                    {@const currentPnLPercent = openPosition ? ((currentPrice - openPosition.entryPrice) / openPosition.entryPrice * 100) : null}
                    <g transform="rotate({tradeAngle - 90} 120 120)">
                      <circle 
                        cx="120" 
                        cy="20" 
                        r="5" 
                        fill={zoneColor} 
                        stroke="white" 
                        stroke-width="1" 
                        fill-opacity="0.9"
                        class="trade-indicator"
                      >
                        <title>Buy #{i + 1}
Price: ${trade.price.toFixed(2)}
Size: {trade.size.toFixed(6)} BTC
Value: ${trade.value.toFixed(2)}
Fee: ${(trade.fee || 0).toFixed(2)}
{#if openPosition}
Status: OPEN POSITION
Current P/L: ${currentPnL >= 0 ? '+' : ''}{currentPnL.toFixed(2)} ({currentPnLPercent >= 0 ? '+' : ''}{currentPnLPercent.toFixed(1)}%)
{:else if trade.position}
Status: CLOSED
{/if}</title>
                      </circle>
                    </g>
                  {/each}
                  
                  <!-- Sell trade indicators -->
                  {#each trades.filter(t => t.type === 'sell') as trade, i}
                    {@const priceRange = threeZoneData.sellZone.price - threeZoneData.buyZone.price}
                    {@const pricePosition = (trade.price - threeZoneData.buyZone.price) / priceRange}
                    {@const tradeAngle = 0 + pricePosition * 180}
                    {@const zoneColor = tradeAngle <= 60 ? '#ef4444' : tradeAngle >= 120 ? '#22c55e' : '#3b82f6'}
                    {@const isHighlighted = hoveredTradeId === trade.id || linkedTradeIds.includes(trade.id)}
                    <g transform="rotate({tradeAngle - 90} 120 120)">
                      <rect 
                        x="117" 
                        y="18" 
                        width="6" 
                        height="6" 
                        rx="1" 
                        fill={zoneColor} 
                        stroke="white" 
                        stroke-width="0.5" 
                        fill-opacity="0.8"
                        class="trade-indicator"
                      >
                        <title>Sell #{i + 1}
Price: ${trade.price.toFixed(2)}
Size: {trade.size.toFixed(6)} BTC
Value: ${trade.value.toFixed(2)}
{#if trade.profit !== undefined}
Profit: ${trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
Profit %: {trade.profitPercent ? (trade.profitPercent >= 0 ? '+' : '') + trade.profitPercent.toFixed(1) + '%' : 'N/A'}
{/if}
Fee: ${(trade.fee || 0).toFixed(2)}</title>
                      </rect>
                    </g>
                  {/each}
                {/if}
                
                <!-- Current/Next buy level indicator -->
                {#if true}
                  {@const buyPrice = nextBuyLevel?.price || currentPrice * 0.99}
                  {@const buyZonePrice = threeZoneData?.buyZone?.price || currentPrice * 0.95}
                  {@const sellZonePrice = threeZoneData?.sellZone?.price || currentPrice * 1.07}
                  {@const priceRange = sellZonePrice - buyZonePrice || 10000}
                  {@const pricePosition = (buyPrice - buyZonePrice) / priceRange}
                  {@const nextBuyAngle = 0 + pricePosition * 180}
                  {@const zoneColor = nextBuyAngle <= 60 ? '#ef4444' : nextBuyAngle >= 120 ? '#22c55e' : '#3b82f6'}
                  <g transform="rotate({nextBuyAngle - 90} 120 120)">
                    <circle 
                      cx="120" 
                      cy="20" 
                      r="7" 
                      fill={zoneColor} 
                      stroke="white" 
                      stroke-width="1.5" 
                      fill-opacity="0.7"
                      class="current-buy-indicator"
                    >
                      <title>Current buy trigger: ${buyPrice.toFixed(2)}
{nextBuyLevel?.label || 'Buy Target'}: {nextBuyLevel?.value || '5%'}</title>
                    </circle>
                  </g>
                {/if}
                
                <!-- Sell target indicator -->
                {#if sellTarget && sellTarget.price}
                  {@const priceRange = threeZoneData.sellZone.price - threeZoneData.buyZone.price}
                  {@const pricePosition = (sellTarget.price - threeZoneData.buyZone.price) / priceRange}
                  {@const sellAngle = 0 + pricePosition * 180}
                  <g transform="rotate({sellAngle - 90} 120 120)">
                    <rect x="116" y="20" width="8" height="10" rx="1" fill="#22c55e" stroke="#22c55e" stroke-width="1" fill-opacity="0.6">
                      <title>Sell target at ${sellTarget.price.toFixed(2)}</title>
                    </rect>
                  </g>
                {/if}
                
                
                <!-- Initial trading position indicator with open position info -->
                {#if initialTradingPrice > 0}
                  {@const totalValue = positions.reduce((sum, p) => sum + (p.entryPrice || 0) * (p.size || 0), 0)}
                  {@const totalSize = positions.reduce((sum, p) => sum + (p.size || 0), 0)}
                  {@const avgEntryPrice = totalSize > 0 ? totalValue / totalSize : 0}
                  {@const currentValue = totalSize * currentPrice}
                  {@const unrealizedPnL = currentValue - totalValue}
                  {@const pnlPercent = totalValue > 0 ? (unrealizedPnL / totalValue) * 100 : 0}
                  <g transform="rotate({initialTradingAngle - 90} 120 120)">
                    <circle cx="120" cy="20" r="8" fill="#3b82f6" stroke="white" stroke-width="3" fill-opacity="1">
                      <title>{#if positions.length > 0}Open Position
Avg Entry: ${avgEntryPrice.toFixed(2)}
Size: {totalSize.toFixed(6)} BTC
Cost: ${totalValue.toFixed(2)}
Current Value: ${currentValue.toFixed(2)}
P/L: ${unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
{:else}Started trading at ${initialTradingPrice.toFixed(2)}
No open positions{/if}</title>
                    </circle>
                  </g>
                {/if}
                
                <!-- Center point -->
                <circle cx="120" cy="120" r="3" fill="rgba(255,255,255,0.3)"/>
                
                <!-- Price indicator needle -->
                <g transform="rotate({threeZoneData.current.angle - 90} 120 120)" class="needle-group">
                  <line x1="120" y1="120" x2="120" y2="50" 
                        stroke="#a78bfa" 
                        stroke-width="4" 
                        class="gauge-needle"
                        filter="drop-shadow(0 0 10px rgba(167, 139, 250, 0.8))"/>
                  <line x1="120" y1="120" x2="120" y2="50" 
                        stroke="white" 
                        stroke-width="1" 
                        opacity="0.6"/>
                  <circle cx="120" cy="50" r="8" fill="#a78bfa" class="needle-tip" />
                  <circle cx="120" cy="50" r="3" fill="white" opacity="0.8"/>
                </g>
                
                <!-- Zone labels -->
                <text x="40" y="135" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="600">DROP</text>
                <text x="120" y="135" text-anchor="middle" fill="#3b82f6" font-size="9" font-weight="600">WAIT</text>
                <text x="200" y="135" text-anchor="middle" fill="#22c55e" font-size="9" font-weight="600">PROFIT</text>
                
                <!-- Percentage indicators -->
                <!-- Always show drop from recent high -->
                <text x="60" y="100" text-anchor="middle" fill="#ef4444" font-size="10">
                  -{threeZoneData.current.dropFromHigh.toFixed(1)}% drop
                </text>
                
                <!-- Show P/L if positions exist -->
                {#if positions.length > 0}
                  {@const totalValue = positions.reduce((sum, p) => sum + (p.entryPrice || 0) * (p.size || 0), 0)}
                  {@const totalSize = positions.reduce((sum, p) => sum + (p.size || 0), 0)}
                  {@const avgEntry = totalSize > 0 ? totalValue / totalSize : currentPrice}
                  {@const profitPercent = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0}
                  <text x="120" y="100" text-anchor="middle" fill={profitPercent >= 0 ? "#22c55e" : "#ef4444"} font-size="10">
                    {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}% P/L
                  </text>
                {/if}
                
                <!-- Always show profit to target -->
                <text x="180" y="100" text-anchor="middle" fill="#22c55e" font-size="10">
                  {threeZoneData.sellZone.percent.toFixed(1)}% to target
                </text>
                
                <!-- Recent high reference -->
                <text x="120" y="110" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="8">
                  High: ${threeZoneData.recentHigh.toFixed(0)}
                </text>
              </svg>
            </div>
            
            <div class="zone-stats">
              <div class="zone-stat">
                <div class="stat-info">
                  <span class="stat-icon">📉</span>
                  <span class="stat-label">
                    {#if threeZoneData.buyZone.type === 'next'}
                      Next Buy
                    {:else if threeZoneData.buyZone.type === 'lowest'}
                      From Lowest
                    {:else if positions.length >= 5}
                      Max Positions
                    {:else}
                      Next Buy
                    {/if}
                  </span>
                </div>
                <span class="stat-value">
                  {#if positions.length > 0}
                    {@const lowestEntry = Math.min(...positions.map(p => p.entryPrice))}
                    {@const nextBuy = lowestEntry * 0.9999} <!-- Small drop below lowest -->
                    ${nextBuy.toFixed(0)}
                  {:else if nextBuyLevel && nextBuyLevel.price && nextBuyLevel.price > 1000}
                    ${nextBuyLevel.price.toFixed(0)}
                  {:else if currentPrice > 0}
                    ${(currentPrice * 0.95).toFixed(0)}
                  {:else}
                    -
                  {/if}
                </span>
              </div>
              <div class="zone-stat">
                <div class="stat-info">
                  <span class="stat-icon">
                    {#if threeZoneData.sellZone.hasPositions}
                      💰
                    {:else}
                      📊
                    {/if}
                  </span>
                  <span class="stat-label">PROFIT ZONE</span>
                </div>
                <span class="stat-value highlight">${threeZoneData.sellZone.distance.toFixed(2)} ({threeZoneData.sellZone.percent.toFixed(1)}%)</span>
              </div>
              {#if nextBuyLevel}
                <div class="zone-stat">
                  <div class="stat-info">
                    <span class="stat-icon">
                      {#if nextBuyLevel.type === 'time'}
                        ⏰
                      {:else if nextBuyLevel.type === 'indicator'}
                        📊
                      {:else}
                        🎯
                      {/if}
                    </span>
                    <span class="stat-label">{nextBuyLevel.label}</span>
                  </div>
                  <span class="stat-value">{nextBuyLevel.value}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .dashboard-layout {
    display: flex;
    min-height: 100vh;
    background: #0a0a0a;
    color: #d1d4dc;
  }
  
  .dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: 250px;
    width: calc(100% - 250px);
    transition: all 0.3s ease;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .dashboard-content.expanded {
    margin-left: 80px;
    width: calc(100% - 80px);
  }
  
  .header {
    padding: 20px;
    background: #0f0f0f;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header h1 {
    margin: 0;
    font-size: 24px;
    color: #a78bfa;
  }
  
  .header-stats {
    display: flex;
    gap: 30px;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .stat-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }
  
  .stat-value {
    font-size: 18px;
    font-weight: 600;
  }
  
  .stat-value.price {
    color: #26a69a;
  }
  
  .stat-value.profit {
    color: #26a69a;
  }
  
  .stat-value.loss {
    color: #ef5350;
  }
  
  .trading-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-auto-rows: auto;
    gap: 20px;
    padding: 20px;
    padding-bottom: 40px;
  }
  
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    min-height: 300px;
  }
  
  .chart-panel {
    position: relative;
    min-height: 500px;
    grid-column: span 2;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .reset-btn {
    padding: 15px 20px;
    background: rgba(156, 163, 175, 0.1);
    border: 1px solid rgba(156, 163, 175, 0.3);
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    color: #9ca3af;
    white-space: nowrap;
  }
  
  .reset-btn:hover {
    background: rgba(156, 163, 175, 0.2);
    border-color: rgba(156, 163, 175, 0.5);
    color: #d1d5db;
  }
  
  .tabs {
    display: flex;
    gap: 10px;
  }
  
  .tab {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #888;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .tab:hover {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
  }
  
  .tab.active {
    background: rgba(74, 0, 224, 0.3);
    border-color: #a78bfa;
    color: #a78bfa;
  }
  
  .code-editor-section {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .code-header {
    margin-bottom: 20px;
  }
  
  .code-header h3 {
    margin: 0 0 5px 0;
    font-size: 14px;
    color: #a78bfa;
    font-family: 'Monaco', 'Consolas', monospace;
  }
  
  .code-info {
    font-size: 12px;
    color: #888;
  }
  
  .code-editor {
    flex: 1;
    background: #1a1a1a;
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    padding: 15px;
    overflow-y: auto;
    overflow-x: auto;
  }
  
  .code-editor pre {
    margin: 0;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
  }
  
  .code-editor code {
    color: #d1d4dc;
    white-space: pre;
  }
  
  .panel-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    max-height: 600px;
  }
  
  .chart-panel .panel-content {
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  
  .chart-panel .panel-content > :global(.chart-container) {
    flex: 1;
    min-height: 400px;
  }
  
  .trading-panel {
    min-height: 400px;
  }
  
  .history-panel {
    min-height: 400px;
  }
  
  .granularity-transition {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(74, 0, 224, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 10;
  }
  
  .granularity-transition.active {
    opacity: 1;
  }
  
  .chart-controls {
    display: flex;
    gap: 10px;
  }
  
  .granularity-buttons {
    display: flex;
    gap: 5px;
  }
  
  .granularity-btn {
    padding: 6px 12px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .granularity-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .granularity-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }
  
  .granularity-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .period-buttons {
    display: flex;
    gap: 10px;
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.05);
    border-top: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .period-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #9ca3af;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .period-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
  }
  
  .period-btn.active {
    background: rgba(74, 0, 224, 0.4);
    color: #a78bfa;
    border-color: #a78bfa;
  }
  
  .balances {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  
  .balance-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 14px;
  }
  
  .balance-item span:last-child {
    font-weight: 600;
  }
  
  .balance-value {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: default;
  }
  
  .balance-value.editable {
    cursor: pointer;
  }
  
  .balance-value.editable:hover {
    color: #a78bfa;
  }
  
  .edit-icon {
    font-size: 12px;
    opacity: 0.5;
  }
  
  .balance-value:hover .edit-icon {
    opacity: 1;
  }
  
  .balance-edit {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  
  .balance-edit input {
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.5);
    color: #d1d4dc;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    width: 100px;
    outline: none;
  }
  
  .balance-edit input:focus {
    border-color: #a78bfa;
    background: rgba(74, 0, 224, 0.2);
  }
  
  .balance-item span.long {
    color: #26a69a;
  }
  
  .balance-item span.vault {
    color: #a78bfa;
    font-weight: 600;
  }
  
  .balance-item span.profit {
    color: #26a69a;
  }
  
  .balance-item span.loss {
    color: #ef5350;
  }
  
  .strategy-section {
    margin-bottom: 20px;
  }
  
  .strategy-section label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  .strategy-section select {
    padding: 8px 12px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .strategy-section select:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
  }
  
  .strategy-section select:focus {
    outline: none;
    border-color: #a78bfa;
    background: rgba(74, 0, 224, 0.2);
  }
  
  .strategy-section select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .strategy-section select option {
    background: #1a1a1a;
    color: #d1d4dc;
  }
  
  .control-buttons {
    margin-top: 20px;
    display: flex;
    gap: 10px;
  }
  
  .start-btn, .stop-btn {
    flex: 1;
    padding: 15px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .start-btn {
    background: #a78bfa;
    color: white;
  }
  
  .start-btn:hover {
    background: #8b5cf6;
  }
  
  .stop-btn {
    background: #ef5350;
    color: white;
  }
  
  .stop-btn:hover {
    background: #d32f2f;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 15px;
    padding: 10px;
    background: rgba(74, 0, 224, 0.1);
    border-radius: 4px;
    font-size: 14px;
    color: #a78bfa;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    background: #a78bfa;
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
  
  .positions-panel {
    min-height: 400px;
  }
  
  .trigger-gauge-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    position: relative;
    overflow: hidden;
    min-height: 300px;
  }
  
  .trigger-gauge-panel::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(167, 139, 250, 0.05) 0%, transparent 70%);
    animation: pulse-glow 4s ease-in-out infinite;
  }
  
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
  
  .gauge-container {
    position: relative;
    z-index: 1;
  }
  
  .gauge-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .gauge-header h3 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .gauge-price {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  
  .price-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }
  
  .price-value {
    font-size: 20px;
    font-weight: 700;
    color: #26a69a;
    text-shadow: 0 0 20px rgba(38, 166, 154, 0.3);
  }
  
  .gauge-visual {
    position: relative;
    margin: 15px 0;
  }
  
  .gauge-arc {
    position: relative;
    height: 120px;
  }
  
  .gauge-svg {
    width: 100%;
    height: 100%;
  }
  
  .gauge-progress {
    transition: stroke-dasharray 0.5s ease;
  }
  
  .gauge-pointer {
    filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.8));
  }
  
  .gauge-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -20%);
    text-align: center;
  }
  
  .gauge-percentage {
    font-size: 28px;
    font-weight: 700;
    color: #a78bfa;
    text-shadow: 0 0 20px rgba(167, 139, 250, 0.5);
  }
  
  .gauge-subtitle {
    font-size: 14px;
    color: #758696;
    margin-top: 5px;
  }
  
  .gauge-levels {
    position: relative;
    height: 20px;
    margin-top: 20px;
  }
  
  .level-marker {
    position: absolute;
    transform: translateX(-50%);
  }
  
  .marker-line {
    width: 2px;
    height: 10px;
    background: rgba(74, 0, 224, 0.3);
    margin: 0 auto;
  }
  
  .marker-label {
    font-size: 11px;
    color: #758696;
    margin-top: 4px;
    white-space: nowrap;
  }
  
  .gauge-stats {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .gauge-stat {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  
  .stat-icon {
    font-size: 20px;
  }
  
  .stat-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .gauge-stat .stat-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }
  
  .gauge-stat .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: #d1d4dc;
  }
  
  .gauge-stat .stat-value.highlight {
    color: #a78bfa;
    text-shadow: 0 0 10px rgba(167, 139, 250, 0.3);
  }
  
  .next-trigger-section {
    background: rgba(74, 0, 224, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .trigger-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .trigger-header h3 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
  }
  
  .recent-high {
    font-size: 14px;
    color: #758696;
  }
  
  .trigger-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .trigger-stats {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  
  .trigger-stats .stat-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .trigger-stats .label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }
  
  .trigger-stats .value {
    font-size: 16px;
    font-weight: 600;
    color: #d1d4dc;
  }
  
  .trigger-stats .value.highlight {
    color: #a78bfa;
  }
  
  .trigger-stats .value.price {
    color: #26a69a;
  }
  
  .trigger-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .progress-bar {
    position: relative;
    height: 24px;
    background: rgba(74, 0, 224, 0.1);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 12px;
    overflow: hidden;
  }
  
  .progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, rgba(74, 0, 224, 0.3), rgba(167, 139, 250, 0.5));
    border-radius: 12px;
    transition: width 0.3s ease;
  }
  
  .progress-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: 600;
    color: #d1d4dc;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  
  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #758696;
  }
  
  .positions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .no-positions {
    text-align: center;
    color: #758696;
    padding: 20px;
  }
  
  .position-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    border: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .position-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  
  .position-details {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #d1d4dc;
  }
  
  .position-details span.profit {
    color: #26a69a;
  }
  
  .position-details span.loss {
    color: #ef5350;
  }
  
  .trades-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .no-trades {
    text-align: center;
    color: #758696;
    padding: 20px;
  }
  
  .trade-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
    border: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .trade-item.buy {
    border-left: 3px solid #26a69a;
  }
  
  .trade-item.sell {
    border-left: 3px solid #ef5350;
  }
  
  .trade-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .trade-type {
    font-weight: 600;
    font-size: 14px;
  }
  
  .trade-item.buy .trade-type {
    color: #26a69a;
  }
  
  .trade-item.sell .trade-type {
    color: #ef5350;
  }
  
  .trade-time {
    font-size: 12px;
    color: #758696;
  }
  
  .trade-details {
    display: flex;
    gap: 15px;
    font-size: 13px;
    color: #d1d4dc;
    flex-wrap: wrap;
  }
  
  .trade-details span.profit {
    color: #26a69a;
    font-weight: 600;
  }
  
  .trade-details span.loss {
    color: #ef5350;
    font-weight: 600;
  }
  
  .vault-allocation {
    color: #a78bfa;
    font-size: 12px;
  }
  
  .sync-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    padding: 6px 12px;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 4px;
    font-size: 12px;
  }
  
  .sync-icon {
    font-size: 14px;
  }
  
  .sync-text {
    color: #a78bfa;
    font-weight: 500;
  }
  
  .sync-indicator {
    display: inline-block;
    font-size: 0.75em;
    color: #4ade80;
    background: rgba(74, 222, 128, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
    margin-left: 10px;
    font-weight: normal;
    vertical-align: middle;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  .timeframe-locked-indicator {
    background: rgba(255, 165, 0, 0.1);
    color: #ffa500;
    padding: 8px 12px;
    margin: 10px 0;
    border-radius: 4px;
    border: 1px solid rgba(255, 165, 0, 0.3);
    text-align: center;
    font-size: 0.9em;
    animation: pulse 2s infinite;
  }
  
  .required-timeframe {
    margin-top: 5px;
    font-size: 0.85em;
    color: #ff9999;
  }
  
  .period-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: rgba(30, 30, 30, 0.5);
  }
  
  .period-btn:disabled:hover {
    background: rgba(30, 30, 30, 0.5);
    border-color: rgba(74, 0, 224, 0.2);
  }
  
  /* Three Zone Chart Styles */
  .zone-prices {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    margin-top: 10px;
  }
  
  .zone-price {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .zone-price.buy .zone-label {
    color: #ef4444;
  }
  
  .zone-price.current .zone-label {
    color: #3b82f6;
  }
  
  .zone-price.sell .zone-label {
    color: #22c55e;
  }
  
  .zone-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .zone-value {
    font-size: 16px;
    font-weight: 600;
    color: #d1d4dc;
  }
  
  .zone-price.buy .zone-value {
    color: #ef4444;
  }
  
  .zone-price.current .zone-value {
    color: #3b82f6;
  }
  
  .zone-price.sell .zone-value {
    color: #22c55e;
  }
  
  .three-zone-chart {
    margin: 20px 0;
    position: relative;
    display: flex;
    justify-content: center;
  }
  
  .zone-svg {
    width: 100%;
    max-width: 240px;
    height: auto;
  }
  
  .gauge-section {
    transition: stroke-opacity 0.3s ease;
  }
  
  .gauge-section.buy-section {
    stroke-opacity: 0.8;
  }
  
  .gauge-section.hold-section {
    stroke-opacity: 0.7;
  }
  
  .gauge-section.sell-section {
    stroke-opacity: 0.8;
  }
  
  .gauge-section:hover {
    stroke-opacity: 1;
  }
  
  .gauge-needle {
    transition: transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
    transform-origin: 120px 120px;
  }
  
  .needle-tip {
    filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.6));
  }
  
  .gauge-outline {
    opacity: 0.3;
  }
  
  .zone-stats {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .zone-stat {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  
  .zone-stat .stat-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .zone-stat .stat-label {
    font-size: 12px;
    color: #758696;
    text-transform: uppercase;
  }
  
  .zone-stat .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: #d1d4dc;
  }
  
  .zone-stat .stat-value.highlight {
    color: #a78bfa;
    text-shadow: 0 0 10px rgba(167, 139, 250, 0.3);
  }
  
  /* Trade indicator styles - no hover effects */
  .trade-indicator {
    cursor: default;
  }
  
  /* Needle animation for better visibility */
  .gauge-needle {
    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: 120px 120px;
  }
  
  .needle-group {
    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .needle-tip {
    filter: drop-shadow(0 0 12px rgba(167, 139, 250, 1));
  }
  
  
  /* Tooltip styles */
  .trade-tooltip {
    position: absolute;
    background: rgba(20, 20, 20, 0.95);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 4px;
    padding: 8px 12px;
    color: #d1d4dc;
    font-size: 12px;
    pointer-events: none;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    white-space: nowrap;
  }
  
  .trade-tooltip-header {
    font-weight: 600;
    margin-bottom: 4px;
    color: #a78bfa;
  }
  
  .trade-tooltip-detail {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  
  .trade-tooltip-label {
    color: #758696;
  }
  
  /* Current buy indicator styles - no hover effects */
  .current-buy-indicator {
    cursor: default;
  }
</style>