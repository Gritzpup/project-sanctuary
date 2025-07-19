<script lang="ts">
  import BacktestChart from '../components/BacktestChart.svelte';
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { BacktestingEngine } from '../services/backtestingEngine';
  import { ReverseRatioStrategy } from '../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../strategies/implementations/VWAPBounceStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  import type { BacktestConfig, BacktestResult } from '../strategies/base/StrategyTypes';
  import type { CandleData } from '../types/coinbase';
  import { historicalDataService, HistoricalDataService } from '../services/historicalDataService';
  import BacktestStats from '../components/BacktestStats.svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  
  const dispatch = createEventDispatcher();
  
  let sidebarCollapsed = false;
  let selectedGranularity = '1h';
  let selectedPeriod = '1M';
  let autoGranularityActive = false;
  let isLoadingChart = false;
  
  // Cache for chart data with timestamps
  const chartDataCache = new Map<string, { data: CandleData[], timestamp: number }>();
  const CACHE_DURATION = 60000; // 1 minute cache duration
  
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  // Backtesting state
  let selectedStrategyType = 'reverse-ratio'; // Default strategy
  let startBalance = 10000;
  let backtestResults: BacktestResult | null = null;
  let isRunning = false;
  let backtestingEngine: BacktestingEngine;
  let currentStrategy: Strategy | null = null;
  let historicalCandles: CandleData[] = [];
  
  // Tab state for strategy panel
  let activeTab: 'config' | 'code' = 'config';
  let strategySourceCode = '';
  
  // Auto-refresh interval
  let refreshInterval: number | null = null;
  
  // Strategy-specific parameters
  let strategyParams: Record<string, any> = {
    'reverse-ratio': {
      initialDropPercent: 3,  // Lowered from 5% to 3% to trigger more trades
      levelDropPercent: 5,
      ratioMultiplier: 2,
      profitTarget: 7,
      maxLevels: 5
    },
    'grid-trading': {
      gridLevels: 10,
      gridSpacing: 1,
      positionSize: 0.1,
      takeProfit: 2
    },
    'rsi-mean-reversion': {
      rsiPeriod: 14,
      oversoldLevel: 30,
      overboughtLevel: 70,
      positionSize: 0.1
    },
    'dca': {
      intervalHours: 24,
      amountPerBuy: 100,  // Changed from amountPerInterval to match DCAStrategy.ts
      dropThreshold: 5   // Extra buy when price drops this %
    },
    'vwap-bounce': {
      vwapPeriod: 20,
      deviationBuy: 2,
      deviationSell: 2
    }
  };
  
  onMount(async () => {
    console.log('Backtesting component mounted');
    console.log('Initial state:', { selectedStrategyType, startBalance, selectedPeriod, selectedGranularity });
    updateCurrentStrategy();
    
    // Load initial historical data for display
    await loadChartData(true); // Force refresh on mount
    
    // Set up auto-refresh every 30 seconds for short timeframes
    if (['1H', '4H', '5D'].includes(selectedPeriod)) {
      refreshInterval = setInterval(async () => {
        console.log('Auto-refreshing chart data...');
        await loadChartData(true);
      }, 30000) as unknown as number; // Refresh every 30 seconds
    }
    
  });
  
  onDestroy(() => {
    // Cleanup on unmount
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
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
  
  async function loadChartData(forceRefresh = false) {
    const cacheKey = `${selectedPeriod}-${selectedGranularity}`;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh && chartDataCache.has(cacheKey)) {
      const cached = chartDataCache.get(cacheKey)!;
      const age = Date.now() - cached.timestamp;
      
      if (age < CACHE_DURATION) {
        console.log('Loading chart data from cache:', cacheKey, `(age: ${age}ms)`);
        historicalCandles = cached.data;
        return;
      } else {
        console.log('Cache expired for:', cacheKey);
        chartDataCache.delete(cacheKey);
      }
    }
    
    isLoadingChart = true;
    
    try {
      console.log('Loading chart data for:', selectedPeriod, selectedGranularity);
      const endTime = new Date();
      const startTime = new Date();
      
      // Calculate start time based on selected period
      switch (selectedPeriod) {
        case '1H':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '4H':
          startTime.setHours(startTime.getHours() - 4);
          break;
        case '5D':
          startTime.setDate(startTime.getDate() - 5);
          break;
        case '1M':
          startTime.setMonth(startTime.getMonth() - 1);
          break;
        case '3M':
          startTime.setMonth(startTime.getMonth() - 3);
          break;
        case '6M':
          startTime.setMonth(startTime.getMonth() - 6);
          break;
        case '1Y':
          startTime.setFullYear(startTime.getFullYear() - 1);
          break;
        case '5Y':
          startTime.setFullYear(startTime.getFullYear() - 5);
          break;
        default:
          startTime.setMonth(startTime.getMonth() - 1);
      }
      
      // Convert granularity string to seconds
      const granularityMap: Record<string, number> = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '6h': 21600,
        '1D': 86400
      };
      
      const granularitySeconds = granularityMap[selectedGranularity] || 3600;
      
      console.log('Fetching data with params:', { startTime, endTime, granularitySeconds });
      
      historicalCandles = await historicalDataService.fetchHistoricalData({
        symbol: 'BTC-USD',
        startTime,
        endTime,
        granularity: granularitySeconds
      });
      
      // Cache the data with timestamp
      chartDataCache.set(cacheKey, { data: historicalCandles, timestamp: Date.now() });
      
      console.log(`Loaded ${historicalCandles.length} candles for ${selectedPeriod}/${selectedGranularity}`);
      if (historicalCandles.length > 0) {
        console.log('First candle:', historicalCandles[0]);
        console.log('Last candle:', historicalCandles[historicalCandles.length - 1]);
      }
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      isLoadingChart = false;
    }
  }
  
  async function selectGranularity(granularity: string) {
    console.log('selectGranularity called:', granularity, 'valid:', isGranularityValid(granularity, selectedPeriod));
    if (isGranularityValid(granularity, selectedPeriod)) {
      selectedGranularity = granularity;
      await loadChartData(true); // Force refresh with new granularity
    }
  }
  
  async function selectPeriod(period: string) {
    console.log('selectPeriod called:', period);
    selectedPeriod = period;
    
    // If current granularity is not valid for new period, select the best default
    if (!isGranularityValid(selectedGranularity, period)) {
      const validOptions = validGranularities[period];
      if (validOptions && validOptions.length > 0) {
        const middleIndex = Math.floor(validOptions.length / 2);
        selectedGranularity = validOptions[middleIndex];
        console.log('Auto-selected granularity:', selectedGranularity);
      }
    }
    
    // Update refresh interval based on new period
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    
    // Set up auto-refresh for short timeframes
    if (['1H', '4H', '5D'].includes(period)) {
      refreshInterval = setInterval(async () => {
        console.log('Auto-refreshing chart data...');
        await loadChartData(true);
      }, 30000) as unknown as number;
    }
    
    await loadChartData(true); // Force refresh with new period
  }
  
  const strategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio Buying', description: 'Buy on drops, sell at 7% profit' },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Place orders at regular intervals' },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought' },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Buy at regular intervals' },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade bounces off VWAP' }
  ];
  
  function createStrategy(type: string): Strategy {
    try {
      const params = strategyParams[type];
      console.log('Creating strategy:', type, 'with params:', params);
      
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
        default:
          throw new Error(`Unknown strategy type: ${type}`);
      }
    } catch (error) {
      console.error('Failed to create strategy:', error);
      throw error;
    }
  }
  
  function updateCurrentStrategy() {
    try {
      console.log('Updating strategy to:', selectedStrategyType);
      currentStrategy = createStrategy(selectedStrategyType);
      console.log('Strategy created successfully:', currentStrategy.getName());
      loadStrategySourceCode();
    } catch (error) {
      console.error('Failed to update strategy:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        strategyType: selectedStrategyType,
        params: strategyParams[selectedStrategyType]
      });
      currentStrategy = null;
      alert(`Failed to create strategy: ${error.message}`);
    }
  }
  
  async function loadStrategySourceCode() {
    // Fetch the source code for the selected strategy
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
      'vwap-bounce': 'VWAPBounceStrategy'
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
  
  function handleChartGranularityChange(newGranularity: string) {
    if (selectedGranularity !== newGranularity) {
      selectedGranularity = newGranularity;
      autoGranularityActive = true;
      
      setTimeout(() => {
        autoGranularityActive = false;
      }, 2000);
    }
  }
  
  async function runBacktest() {
    if (!currentStrategy) {
      console.error('Strategy not initialized');
      alert('Strategy not initialized. Please select a strategy.');
      return;
    }
    
    // Validate strategy is properly initialized
    try {
      console.log('Validating strategy:', {
        name: currentStrategy.getName(),
        config: currentStrategy.getConfig(),
        state: currentStrategy.getState()
      });
    } catch (validationError) {
      console.error('Strategy validation failed:', validationError);
      alert('Strategy validation failed. Please try selecting a different strategy.');
      return;
    }
    
    isRunning = true;
    backtestResults = null;
    
    try {
      // Set up time range for backtest
      const endTime = new Date();
      const startTime = new Date();
      
      // Determine time range based on selected period
      switch (selectedPeriod) {
        case '1H':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '4H':
          startTime.setHours(startTime.getHours() - 4);
          break;
        case '5D':
          startTime.setDate(startTime.getDate() - 5);
          break;
        case '1M':
          startTime.setMonth(startTime.getMonth() - 1);
          break;
        case '3M':
          startTime.setMonth(startTime.getMonth() - 3);
          break;
        case '6M':
          startTime.setMonth(startTime.getMonth() - 6);
          break;
        case '1Y':
          startTime.setFullYear(startTime.getFullYear() - 1);
          break;
        case '5Y':
          startTime.setFullYear(startTime.getFullYear() - 5);
          break;
        default:
          startTime.setMonth(startTime.getMonth() - 1);
      }
      
      // Fetch historical data
      console.log('Fetching historical data...');
      const granularity = HistoricalDataService.getOptimalGranularity(startTime, endTime);
      historicalCandles = await historicalDataService.fetchHistoricalData({
        symbol: 'BTC-USD',
        startTime,
        endTime,
        granularity
      });
      
      console.log(`Fetched ${historicalCandles.length} candles`);
      console.log('Time range:', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        firstCandle: historicalCandles[0] ? new Date(historicalCandles[0].time).toISOString() : 'none',
        lastCandle: historicalCandles[historicalCandles.length - 1] ? new Date(historicalCandles[historicalCandles.length - 1].time).toISOString() : 'none'
      });
      
      // Configure backtesting engine
      const config = {
        initialBalance: startBalance,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        feePercent: 0.6, // Coinbase fee
        slippage: 0.1   // 0.1% slippage
      };
      
      // Create and run backtesting engine
      backtestingEngine = new BacktestingEngine(currentStrategy, config);
      backtestResults = await backtestingEngine.runBacktest(historicalCandles);
      
      console.log('Backtest completed:', backtestResults);
      console.log('Backtest metrics:', backtestResults.metrics);
      console.log('Chart data:', backtestResults.chartData);
    } catch (error) {
      console.error('Backtest failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        strategy: currentStrategy?.getName(),
        candles: historicalCandles?.length || 0
      });
      alert(`Failed to run backtest: ${error.message || 'Unknown error'}. Please check the console for details.`);
    } finally {
      isRunning = false;
    }
  }
  
  
  function clearResults() {
    backtestResults = null;
    historicalCandles = [];
  }
</script>

<div class="dashboard-layout">
  <CollapsibleSidebar 
    {sidebarCollapsed} 
    activeSection="backtesting"
    on:toggle={toggleSidebar} 
    on:navigate={handleNavigation} 
  />
  
  <main class="dashboard-content" class:expanded={sidebarCollapsed}>
    <div class="header">
      <h1>Backtesting</h1>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">BTC/USD</span>
          <span class="stat-value price">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Status</span>
          <span class="stat-value status {connectionStatus}">{connectionStatus}</span>
        </div>
      </div>
    </div>
    
    <div class="content-wrapper">
      <div class="backtest-grid">
        <!-- Row containing Chart and Strategy panels side by side -->
        <div class="panels-row">
          <!-- Chart Panel -->
          <div class="panel chart-panel">
            <div class="granularity-transition" class:active={autoGranularityActive}>
              Switching to {selectedGranularity}
            </div>
            <div class="panel-header">
              <h2>BTC/USD Chart {#if isLoadingChart}<span class="loading-indicator">🔄</span>{/if}</h2>
              <div class="chart-controls">
                <div class="granularity-buttons">
                  <button class="granularity-btn" class:active={selectedGranularity === '1m'} class:disabled={!isGranularityValid('1m', selectedPeriod)} on:click={() => selectGranularity('1m')}>1m</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '5m'} class:disabled={!isGranularityValid('5m', selectedPeriod)} on:click={() => selectGranularity('5m')}>5m</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '15m'} class:disabled={!isGranularityValid('15m', selectedPeriod)} on:click={() => selectGranularity('15m')}>15m</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '1h'} class:disabled={!isGranularityValid('1h', selectedPeriod)} on:click={() => selectGranularity('1h')}>1h</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '6h'} class:disabled={!isGranularityValid('6h', selectedPeriod)} on:click={() => selectGranularity('6h')}>6h</button>
                  <button class="granularity-btn" class:active={selectedGranularity === '1D'} class:disabled={!isGranularityValid('1D', selectedPeriod)} on:click={() => selectGranularity('1D')}>1D</button>
                </div>
              </div>
            </div>
            <div class="panel-content">
              {#if isLoadingChart}
                <div class="loading-overlay">
                  <div class="loading-spinner"></div>
                  <div class="loading-text">Loading chart data...</div>
                  {#if selectedPeriod === '5Y'}
                    <div class="loading-hint">This may take a few seconds for large datasets</div>
                  {/if}
                </div>
              {/if}
              <BacktestChart 
                data={historicalCandles}
                trades={backtestResults?.trades || []}
              />
              <div class="period-buttons">
                <button class="period-btn" class:active={selectedPeriod === '1H'} on:click={() => selectPeriod('1H')}>1H</button>
                <button class="period-btn" class:active={selectedPeriod === '4H'} on:click={() => selectPeriod('4H')}>4H</button>
                <button class="period-btn" class:active={selectedPeriod === '5D'} on:click={() => selectPeriod('5D')}>5D</button>
                <button class="period-btn" class:active={selectedPeriod === '1M'} on:click={() => selectPeriod('1M')}>1M</button>
                <button class="period-btn" class:active={selectedPeriod === '3M'} on:click={() => selectPeriod('3M')}>3M</button>
                <button class="period-btn" class:active={selectedPeriod === '6M'} on:click={() => selectPeriod('6M')}>6M</button>
                <button class="period-btn" class:active={selectedPeriod === '1Y'} on:click={() => selectPeriod('1Y')}>1Y</button>
                <button class="period-btn" class:active={selectedPeriod === '5Y'} on:click={() => selectPeriod('5Y')}>5Y</button>
              </div>
            </div>
          </div>
          
          <!-- Strategy Configuration -->
          <div class="panel strategy-panel">
        <div class="panel-header">
          <h2>Strategy</h2>
          <div class="tabs">
            <button class="tab" class:active={activeTab === 'config'} on:click={() => activeTab = 'config'}>
              Configuration
            </button>
            <button class="tab" class:active={activeTab === 'code'} on:click={() => activeTab = 'code'}>
              Source Code
            </button>
          </div>
        </div>
        <div class="panel-content">
          {#if activeTab === 'config'}
            <div class="config-section">
              <label>
                Strategy
                <select bind:value={selectedStrategyType} on:change={updateCurrentStrategy}>
                  {#each strategies as strat}
                    <option value={strat.value}>{strat.label}</option>
                  {/each}
                </select>
              </label>
              {#if strategies.find(s => s.value === selectedStrategyType)}
                <div class="strategy-description">
                  {strategies.find(s => s.value === selectedStrategyType).description}
                </div>
              {/if}
            </div>
          
          <div class="config-section">
            <label>
              Starting Balance
              <input type="number" bind:value={startBalance} min="100" step="100" />
            </label>
          </div>
          
          <div class="strategy-params">
            {#if selectedStrategyType === 'reverse-ratio'}
              <div class="config-section">
                <label>
                  Initial Drop (%)
                  <input type="number" bind:value={strategyParams['reverse-ratio'].initialDropPercent} min="1" max="10" step="0.5" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Level Drop (%)
                  <input type="number" bind:value={strategyParams['reverse-ratio'].levelDropPercent} min="1" max="10" step="0.5" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Ratio Multiplier
                  <input type="number" bind:value={strategyParams['reverse-ratio'].ratioMultiplier} min="1.5" max="5" step="0.5" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Profit Target (%)
                  <input type="number" bind:value={strategyParams['reverse-ratio'].profitTarget} min="3" max="20" step="1" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Max Levels
                  <input type="number" bind:value={strategyParams['reverse-ratio'].maxLevels} min="3" max="10" step="1" />
                </label>
              </div>
            {:else if selectedStrategyType === 'grid-trading'}
              <div class="config-section">
                <label>
                  Grid Levels
                  <input type="number" bind:value={strategyParams['grid-trading'].gridLevels} min="5" max="20" step="1" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Grid Spacing (%)
                  <input type="number" bind:value={strategyParams['grid-trading'].gridSpacing} min="0.5" max="5" step="0.5" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Position Size
                  <input type="number" bind:value={strategyParams['grid-trading'].positionSize} min="0.01" max="1" step="0.01" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Take Profit (%)
                  <input type="number" bind:value={strategyParams['grid-trading'].takeProfit} min="1" max="10" step="0.5" />
                </label>
              </div>
            {:else if selectedStrategyType === 'rsi-mean-reversion'}
              <div class="config-section">
                <label>
                  RSI Period
                  <input type="number" bind:value={strategyParams['rsi-mean-reversion'].rsiPeriod} min="7" max="30" step="1" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Oversold Level
                  <input type="number" bind:value={strategyParams['rsi-mean-reversion'].oversoldLevel} min="20" max="40" step="5" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Overbought Level
                  <input type="number" bind:value={strategyParams['rsi-mean-reversion'].overboughtLevel} min="60" max="80" step="5" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Position Size
                  <input type="number" bind:value={strategyParams['rsi-mean-reversion'].positionSize} min="0.01" max="1" step="0.01" />
                </label>
              </div>
            {:else if selectedStrategyType === 'dca'}
              <div class="config-section">
                <label>
                  Buy Interval (hours)
                  <input type="number" bind:value={strategyParams['dca'].intervalHours} min="1" max="168" step="1" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Amount Per Buy ($)
                  <input type="number" bind:value={strategyParams['dca'].amountPerBuy} min="10" max="1000" step="10" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Extra Buy on Drop (%)
                  <input type="number" bind:value={strategyParams['dca'].dropThreshold} min="0" max="10" step="1" />
                </label>
              </div>
            {:else if selectedStrategyType === 'vwap-bounce'}
              <div class="config-section">
                <label>
                  VWAP Period
                  <input type="number" bind:value={strategyParams['vwap-bounce'].vwapPeriod} min="10" max="50" step="5" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Bounce Threshold (%)
                  <input type="number" bind:value={strategyParams['vwap-bounce'].bounceThreshold} min="0.1" max="2" step="0.1" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Volume Multiplier
                  <input type="number" bind:value={strategyParams['vwap-bounce'].volumeMultiplier} min="1" max="3" step="0.1" />
                </label>
              </div>
              <div class="config-section">
                <label>
                  Position Size
                  <input type="number" bind:value={strategyParams['vwap-bounce'].positionSize} min="0.01" max="1" step="0.01" />
                </label>
              </div>
            {/if}
          </div>
          
          <div class="backtest-buttons">
            <button class="run-btn" on:click={() => { updateCurrentStrategy(); runBacktest(); }} disabled={isRunning}>
              {isRunning ? 'Running...' : 'Run Backtest'}
            </button>
            <button class="clear-btn" on:click={clearResults} disabled={!backtestResults || isRunning}>
              Clear Results
            </button>
          </div>
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
        </div><!-- End of panels-row -->
        
        <!-- Results Panel - Now spans full width below -->
        <div class="panel results-panel">
        <div class="panel-header">
          <h2>Backtest Results</h2>
        </div>
        <div class="panel-content">
          {#if !backtestResults}
            <div class="no-results">
              <p>Configure your strategy and run a backtest to see results</p>
            </div>
          {:else}
            {#if backtestResults.metrics.totalTrades === 0}
              <div class="no-trades-notice">
                <h3>No trades were executed</h3>
                <p>The strategy didn't find any trading opportunities in this period.</p>
                <p>Try:</p>
                <ul>
                  <li>Lowering the "Initial Drop (%)" parameter (currently {strategyParams[selectedStrategyType].initialDropPercent}%)</li>
                  <li>Selecting a different time period with more volatility</li>
                  <li>Using a different strategy like DCA or Grid Trading</li>
                </ul>
              </div>
            {/if}
            <div class="results-summary">
              <div class="result-item">
                <span class="result-label">Total Trades</span>
                <span class="result-value">{backtestResults.metrics.totalTrades}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Win Rate</span>
                <span class="result-value">{backtestResults.metrics.winRate.toFixed(1)}%</span>
              </div>
              <div class="result-item">
                <span class="result-label">Total Return</span>
                <span class="result-value" class:profit={backtestResults.metrics.totalReturn > 0} class:loss={backtestResults.metrics.totalReturn < 0}>
                  ${backtestResults.metrics.totalReturn.toFixed(2)} ({backtestResults.metrics.totalReturnPercent.toFixed(2)}%)
                </span>
              </div>
              <div class="result-item">
                <span class="result-label">Max Drawdown</span>
                <span class="result-value loss">{backtestResults.metrics.maxDrawdown.toFixed(2)}%</span>
              </div>
              <div class="result-item">
                <span class="result-label">Sharpe Ratio</span>
                <span class="result-value">{backtestResults.metrics.sharpeRatio.toFixed(2)}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Profit Factor</span>
                <span class="result-value">{backtestResults.metrics.profitFactor.toFixed(2)}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Vault Balance</span>
                <span class="result-value profit">${backtestResults.metrics.vaultBalance.toFixed(2)}</span>
              </div>
              <div class="result-item">
                <span class="result-label">BTC Holdings</span>
                <span class="result-value">{backtestResults.metrics.btcGrowth.toFixed(6)} BTC</span>
              </div>
            </div>
            
            <h3>All Trades ({backtestResults.trades.length})</h3>
            <div class="trades-list">
              {#each backtestResults.trades.slice().reverse() as trade}
                <div class="trade-item" class:buy={trade.type === 'buy'} class:sell={trade.type === 'sell'}>
                  <div class="trade-header">
                    <span class="trade-type">{trade.type.toUpperCase()}</span>
                    <span class="trade-date">{new Date(trade.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div class="trade-details">
                    <span>Price: ${trade.price.toLocaleString()}</span>
                    <span>Size: {trade.size.toFixed(6)} BTC</span>
                    <span>Value: ${trade.value.toFixed(2)}</span>
                    {#if trade.profit !== undefined}
                      <span class:profit={trade.profit > 0} class:loss={trade.profit < 0}>
                        P&L: ${trade.profit.toFixed(2)}
                      </span>
                    {/if}
                    <span class="trade-reason">{trade.reason}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      </div><!-- End of backtest-grid -->
    </div><!-- End of content-wrapper -->
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
    transition: margin-left 0.3s ease;
  }
  
  .dashboard-content.expanded {
    margin-left: 80px;
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
  
  .stat-value.status {
    font-size: 14px;
  }
  
  .stat-value.connected {
    color: #26a69a;
  }
  
  .stat-value.disconnected,
  .stat-value.error {
    color: #ef5350;
  }
  
  .stat-value.loading {
    color: #ffa726;
  }
  
  .content-wrapper {
    flex: 1;
    overflow-y: auto;
  }

  .backtest-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }
  
  .panels-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
  }
  
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }
  
  .chart-panel {
    position: relative;
    height: 500px;
    max-height: 500px;
    overflow: hidden;
  }
  
  .strategy-panel {
    min-height: 500px;
  }
  
  .results-panel {
    min-height: 400px;
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
    max-width: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  
  .code-editor pre {
    margin: 0;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
  }
  
  .code-editor code {
    color: #d1d4dc;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .panel-content {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  
  .chart-panel .panel-content {
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  
  .chart-panel .panel-content > :global(.chart-container) {
    flex: 1;
    height: 100%;
    max-height: calc(100% - 40px); /* Subtract period buttons height */
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
  
  .granularity-btn:disabled,
  .granularity-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: rgba(74, 0, 224, 0.05);
    color: #4a5568;
  }
  
  .granularity-btn:disabled:hover,
  .granularity-btn.disabled:hover {
    background: rgba(74, 0, 224, 0.05);
    color: #4a5568;
    transform: none;
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
  
  .config-section {
    margin-bottom: 15px;
  }
  
  .config-section label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  .config-section input,
  .config-section select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 14px;
  }

  .config-section select {
    background-color: #1a1a1a;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a78bfa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 20px;
    padding-right: 40px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .config-section select option {
    background-color: #1a1a1a;
    color: #d1d4dc;
  }
  
  .config-section input:focus,
  .config-section select:focus {
    outline: none;
    border-color: #a78bfa;
    background-color: rgba(74, 0, 224, 0.1);
  }

  .config-section select:hover {
    border-color: #8b5cf6;
  }
  
  .backtest-buttons {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  
  .run-btn, .clear-btn {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .run-btn {
    background: #a78bfa;
    color: white;
  }
  
  .run-btn:hover:not(:disabled) {
    background: #8b5cf6;
  }
  
  .clear-btn {
    background: rgba(74, 0, 224, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .clear-btn:hover:not(:disabled) {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .run-btn:disabled, .clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .no-results {
    text-align: center;
    color: #758696;
    padding: 40px 20px;
  }
  
  .results-summary {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .result-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 14px;
    border: 1px solid rgba(74, 0, 224, 0.15);
  }
  
  .result-label {
    color: #758696;
  }
  
  .result-value {
    font-weight: 600;
    color: #d1d4dc;
  }
  
  .result-value.profit {
    color: #26a69a;
  }
  
  .result-value.loss {
    color: #ef5350;
  }
  
  .results-panel h3 {
    margin: 20px 0 10px 0;
    font-size: 14px;
    color: #a78bfa;
  }
  
  .trades-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 5px;
  }
  
  /* Custom scrollbar for trades list */
  .trades-list::-webkit-scrollbar {
    width: 6px;
  }
  
  .trades-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  .trades-list::-webkit-scrollbar-thumb {
    background: rgba(167, 139, 250, 0.3);
    border-radius: 3px;
  }
  
  .trades-list::-webkit-scrollbar-thumb:hover {
    background: rgba(167, 139, 250, 0.5);
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
  
  .trade-date {
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
  
  .strategy-description {
    font-size: 12px;
    color: #758696;
    margin-top: 5px;
    font-style: italic;
  }
  
  .strategy-params {
    margin-top: 20px;
  }
  
  .trade-reason {
    color: #758696;
    font-style: italic;
    font-size: 12px;
  }
  
  .stats-section {
    padding: 20px;
    background: #0f0f0f;
    border-top: 1px solid rgba(74, 0, 224, 0.3);
    margin-top: auto;
    flex-shrink: 0;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(10, 10, 10, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(167, 139, 250, 0.2);
    border-radius: 50%;
    border-top-color: #a78bfa;
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .loading-text {
    margin-top: 20px;
    color: #a78bfa;
    font-size: 16px;
    font-weight: 500;
  }
  
  .loading-hint {
    margin-top: 10px;
    color: #758696;
    font-size: 13px;
  }
  
  .loading-indicator {
    display: inline-block;
    margin-left: 10px;
    animation: spin 1s linear infinite;
  }
  
  .no-trades-notice {
    background: rgba(255, 152, 0, 0.1);
    border: 1px solid rgba(255, 152, 0, 0.3);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .no-trades-notice h3 {
    margin: 0 0 10px 0;
    color: #ffa726;
    font-size: 16px;
  }
  
  .no-trades-notice p {
    margin: 10px 0;
    color: #d1d4dc;
    font-size: 14px;
  }
  
  .no-trades-notice ul {
    margin: 10px 0 0 20px;
    padding: 0;
    list-style-type: disc;
  }
  
  .no-trades-notice li {
    margin: 5px 0;
    color: #9ca3af;
    font-size: 13px;
  }
</style>