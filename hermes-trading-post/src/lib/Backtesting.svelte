<script lang="ts">
  import BacktestChart from '../components/BacktestChart.svelte';
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import CompoundGrowthChart from '../components/CompoundGrowthChart.svelte';
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
  export let sidebarCollapsed = false;
  
  const dispatch = createEventDispatcher();
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;
  let isLoadingChart = false;
  
  // Cache for chart data with timestamps
  const chartDataCache = new Map<string, { data: CandleData[], timestamp: number }>();
  const CACHE_DURATION = 60000; // 1 minute cache duration
  
  function toggleSidebar() {
    dispatch('toggle');
  }
  
  function handleNavigation(event: CustomEvent) {
    dispatch('navigate', event.detail);
  }
  
  // Backtesting state
  let selectedStrategyType = 'reverse-ratio'; // Default strategy
  let startBalance = 1000;  // Default $1000 for meaningful micro-scalping
  let backtestResults: BacktestResult | null = null;
  let isRunning = false;
  let backtestingEngine: BacktestingEngine;
  let currentStrategy: Strategy | null = null;
  let historicalCandles: CandleData[] = [];
  
  // Fee configuration - ACTUAL Coinbase Advanced Trading fees
  let makerFeePercent = 0.35;  // Correct maker fee: 0.35%
  let takerFeePercent = 0.75;  // Correct taker fee: 0.75%
  let feeRebatePercent = 25;   // 25% fee rebate that compounds into balance!
  
  // Tab state for strategy panel
  let activeTab: 'config' | 'code' | 'backup' = 'config';
  let strategySourceCode = '';
  
  // Backup system state
  let savedStrategies: SavedStrategy[] = [];
  let selectedStrategies = new Set<string>();
  let bulkDeleteMode = false;
  let backupName = '';
  let backupDescription = '';
  let showImportDialog = false;
  let importJsonText = '';
  
  interface SavedStrategy {
    id: string;
    name: string;
    description: string;
    savedDate: number;
    strategyType: string;
    parameters: any;
    backtestResults?: {
      winRate: number;
      totalReturn: number;
      trades: number;
      profitFactor: number;
      sharpeRatio: number;
    };
  }
  
  // Compound growth chart
  let compoundCanvas: HTMLCanvasElement;
  
  // Auto-refresh interval
  let refreshInterval: number | null = null;
  
  // Custom presets management
  interface StrategyPreset {
    name: string;
    initialDropPercent: number;
    levelDropPercent: number;
    profitTarget: number;
    basePositionPercent: number;
    maxPositionPercent: number;
    ratioMultiplier: number;
  }
  
  let customPresets: StrategyPreset[] = JSON.parse(localStorage.getItem('reverseRatioPresets') || '[]');
  let selectedPresetIndex: number = -1;
  let isEditingPresets = false;
  let editingPresetName = '';
  
  // Load saved preset for current timeframe combination
  function loadSavedPresetForTimeframe() {
    const timeframeKey = `preset_${selectedPeriod}_${selectedGranularity}`;
    const savedIndex = localStorage.getItem(timeframeKey);
    if (savedIndex !== null) {
      const index = parseInt(savedIndex);
      if (index >= 0 && index < customPresets.length) {
        selectedPresetIndex = index;
        applyPreset(index);
        console.log(`Loaded saved preset ${index} for ${selectedPeriod}/${selectedGranularity}`);
      }
    }
  }
  
  // Save preset selection for current timeframe
  function savePresetForTimeframe(index: number) {
    const timeframeKey = `preset_${selectedPeriod}_${selectedGranularity}`;
    localStorage.setItem(timeframeKey, index.toString());
    console.log(`Saved preset ${index} for ${selectedPeriod}/${selectedGranularity}`);
  }
  
  // Check for old presets - FORCE CLEAR to update to new grid system
  let hasOldPresets = true; // SET TO TRUE TO FORCE CLEAR OLD PRESETS
  // This will reset all presets to the new grid-based approach
  
  // Force clear old presets or initialize with new ones
  if (customPresets.length === 0 || hasOldPresets) {
    if (hasOldPresets) {
      console.warn('[Backtesting] Clearing old presets with unprofitable targets...');
    }
    customPresets = [
      {
        name: 'GRID SCALP',
        initialDropPercent: 0.01,   // Hair-trigger 0.01%
        levelDropPercent: 0.008,    // Ultra-tight 0.008% grids
        profitTarget: 0.85,         // 0.85% = tiny profit
        basePositionPercent: 6,     // 6% per level
        maxPositionPercent: 96,     // 16 levels × 6% = 96%
        maxLevels: 16,              // 16 micro levels!
        ratioMultiplier: 1.0,       // Equal sizing
        lookbackPeriod: 2           // 2 candle ultra-fast
      },
      {
        name: 'PROGRESSIVE',
        initialDropPercent: 0.02,
        levelDropPercent: 0.015,
        profitTarget: 1.0,          // 1.0% = 0.175% net
        basePositionPercent: 10,    // Start with 10%
        maxPositionPercent: 95,
        maxLevels: 10,
        ratioMultiplier: 1.1,       // Gentle 10% increases
        lookbackPeriod: 3
      },
      {
        name: 'SAFE GRID',
        initialDropPercent: 0.03,
        levelDropPercent: 0.02,
        profitTarget: 1.2,          // 1.2% = 0.375% net
        basePositionPercent: 12,    // 12% per level
        maxPositionPercent: 96,
        maxLevels: 8,               // 8 levels × 12% = 96%
        ratioMultiplier: 1.0,       // Equal sizing
        lookbackPeriod: 4
      }
    ];
    localStorage.setItem('reverseRatioPresets', JSON.stringify(customPresets));
    
    // Also clear all saved preset selections
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('preset_')) {
        localStorage.removeItem(key);
      }
    });
  }
  
  function saveCurrentAsPreset(index: number) {
    const preset = customPresets[index];
    preset.initialDropPercent = strategyParams['reverse-ratio'].initialDropPercent;
    preset.levelDropPercent = strategyParams['reverse-ratio'].levelDropPercent;
    preset.profitTarget = strategyParams['reverse-ratio'].profitTarget;
    preset.basePositionPercent = strategyParams['reverse-ratio'].basePositionPercent;
    preset.maxPositionPercent = strategyParams['reverse-ratio'].maxPositionPercent;
    preset.ratioMultiplier = strategyParams['reverse-ratio'].ratioMultiplier;
    
    customPresets = [...customPresets];
    localStorage.setItem('reverseRatioPresets', JSON.stringify(customPresets));
  }
  
  function applyPreset(index: number) {
    if (index < 0 || index >= customPresets.length) return;
    const preset = customPresets[index];
    
    strategyParams['reverse-ratio'].initialDropPercent = preset.initialDropPercent;
    strategyParams['reverse-ratio'].levelDropPercent = preset.levelDropPercent;
    strategyParams['reverse-ratio'].profitTarget = preset.profitTarget;
    strategyParams['reverse-ratio'].basePositionPercent = preset.basePositionPercent;
    strategyParams['reverse-ratio'].maxPositionPercent = preset.maxPositionPercent;
    strategyParams['reverse-ratio'].ratioMultiplier = preset.ratioMultiplier;
    
    selectedPresetIndex = index;
    // Save this preset selection for the current timeframe
    savePresetForTimeframe(index);
  }
  
  function updatePresetName(index: number, newName: string) {
    customPresets[index].name = newName;
    customPresets = [...customPresets];
    localStorage.setItem('reverseRatioPresets', JSON.stringify(customPresets));
  }
  
  function addNewPreset() {
    const newPreset: StrategyPreset = {
      name: `Preset ${customPresets.length + 1}`,
      initialDropPercent: strategyParams['reverse-ratio'].initialDropPercent,
      levelDropPercent: strategyParams['reverse-ratio'].levelDropPercent,
      profitTarget: strategyParams['reverse-ratio'].profitTarget,
      basePositionPercent: strategyParams['reverse-ratio'].basePositionPercent,
      maxPositionPercent: strategyParams['reverse-ratio'].maxPositionPercent,
      ratioMultiplier: strategyParams['reverse-ratio'].ratioMultiplier
    };
    customPresets = [...customPresets, newPreset];
    localStorage.setItem('reverseRatioPresets', JSON.stringify(customPresets));
  }
  
  function deletePreset(index: number) {
    customPresets = customPresets.filter((_, i) => i !== index);
    localStorage.setItem('reverseRatioPresets', JSON.stringify(customPresets));
    if (selectedPresetIndex === index) selectedPresetIndex = -1;
  }
  
  // Calculate position sizes for preview
  function calculatePositionSizes(balance: number = startBalance): Array<{level: number, amount: number, percentage: number}> {
    const params = strategyParams['reverse-ratio'];
    const sizes = [];
    
    for (let level = 1; level <= Math.min(params.maxLevels, 5); level++) {
      let amount: number;
      
      if (params.positionSizeMode === 'fixed') {
        if (params.ratioMultiplier === 1) {
          amount = params.basePositionAmount * level;
        } else {
          const levelRatio = Math.pow(params.ratioMultiplier, level - 1);
          amount = params.basePositionAmount * levelRatio;
        }
      } else {
        const basePercent = params.basePositionPercent / 100;
        if (params.ratioMultiplier === 1) {
          amount = balance * (basePercent * level);
        } else {
          const levelRatio = Math.pow(params.ratioMultiplier, level - 1);
          amount = balance * (basePercent * levelRatio);
        }
      }
      
      sizes.push({
        level,
        amount,
        percentage: (amount / balance) * 100
      });
    }
    
    return sizes;
  }
  
  // Removed automatic timeframe configs - manual control only

  // Strategy-specific parameters - TRUE GRID SCALPING
  let strategyParams: Record<string, any> = {
    'reverse-ratio': {
      initialDropPercent: 0.02,  // First buy at 0.02% drop
      levelDropPercent: 0.015,   // 0.015% increments between levels
      ratioMultiplier: 1.0,      // EQUAL sizing (no multiplier!)
      profitTarget: 0.85,        // 0.85% profit = 0.025% net (minimal but frequent)
      maxLevels: 12,             // 12 levels for deep grids
      lookbackPeriod: 3,         // Ultra-fast 3 candle lookback
      positionSizeMode: 'percentage',
      basePositionPercent: 8,    // Only 8% per level (12 levels × 8% = 96%)
      basePositionAmount: 50,
      maxPositionPercent: 96,    // Use up to 96% of total capital
      // Vault configuration
      vaultConfig: {
        btcVaultPercent: 14.3,    // 1/7 of profits to BTC vault
        usdGrowthPercent: 14.3,   // 1/7 of profits to grow USD
        usdcVaultPercent: 71.4,   // 5/7 of profits to USDC vault
        compoundFrequency: 'trade',
        minCompoundAmount: 0.01,
        autoCompound: true,
        btcVaultTarget: 0.1,      // Target 0.1 BTC
        usdcVaultTarget: 10000,   // Target $10k USDC
        rebalanceThreshold: 5     // Rebalance if 5% off target
      }
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
    
    // Load saved preset for initial timeframe
    loadSavedPresetForTimeframe();
    
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
  
  // Load saved strategies on mount
  onMount(() => {
    loadSavedStrategies();
  });
  
  // Backup System Functions
  const STORAGE_KEY = 'hermes_saved_strategies';
  
  function loadSavedStrategies() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        savedStrategies = JSON.parse(saved);
        console.log(`Loaded ${savedStrategies.length} saved strategies`);
      }
    } catch (error) {
      console.error('Error loading saved strategies:', error);
      savedStrategies = [];
    }
  }
  
  function saveCurrentStrategy() {
    if (!currentStrategy || !backupName.trim()) return;
    
    // Check if a strategy with the same name exists
    const existingStrategy = savedStrategies.find(s => s.name === backupName.trim());
    
    if (existingStrategy) {
      if (!confirm(`A strategy named "${backupName.trim()}" already exists. Do you want to overwrite it?`)) {
        return;
      }
      // Remove the existing strategy
      savedStrategies = savedStrategies.filter(s => s.id !== existingStrategy.id);
    }
    
    const newStrategy: SavedStrategy = {
      id: `${selectedStrategyType}-${Date.now()}`,
      name: backupName.trim(),
      description: backupDescription.trim(),
      savedDate: Date.now(),
      strategyType: selectedStrategyType,
      parameters: { ...strategyParams[selectedStrategyType] },
      backtestResults: backtestResults ? {
        winRate: backtestResults.metrics.winRate || 0,
        totalReturn: backtestResults.metrics.totalReturn || 0,
        trades: backtestResults.metrics.totalTrades || 0,
        profitFactor: backtestResults.metrics.profitFactor || 0,
        sharpeRatio: backtestResults.metrics.sharpeRatio || 0
      } : undefined
    };
    
    savedStrategies = [...savedStrategies, newStrategy];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedStrategies));
    
    // Clear form
    backupName = '';
    backupDescription = '';
    
    // Show success (you could add a toast notification here)
    console.log('Strategy saved:', newStrategy.name);
  }
  
  function restoreStrategy(strategy: SavedStrategy) {
    if (!confirm(`Restore strategy "${strategy.name}"? This will overwrite current settings.`)) {
      return;
    }
    
    // Update strategy type
    selectedStrategyType = strategy.strategyType;
    
    // Restore parameters
    strategyParams[strategy.strategyType] = { ...strategy.parameters };
    
    // Update current strategy
    updateCurrentStrategy();
    
    // Switch to config tab to show restored settings
    activeTab = 'config';
    
    console.log('Strategy restored:', strategy.name);
  }
  
  function deleteStrategy(id: string) {
    const strategy = savedStrategies.find(s => s.id === id);
    if (!strategy || !confirm(`Delete strategy "${strategy.name}"?`)) {
      return;
    }
    
    savedStrategies = savedStrategies.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedStrategies));
    
    console.log('Strategy deleted:', strategy.name);
  }
  
  function toggleStrategySelection(id: string) {
    if (selectedStrategies.has(id)) {
      selectedStrategies.delete(id);
    } else {
      selectedStrategies.add(id);
    }
    selectedStrategies = new Set(selectedStrategies); // Trigger reactivity
  }
  
  function toggleSelectAll() {
    if (selectedStrategies.size === savedStrategies.length) {
      selectedStrategies.clear();
    } else {
      selectedStrategies = new Set(savedStrategies.map(s => s.id));
    }
    selectedStrategies = new Set(selectedStrategies); // Trigger reactivity
  }
  
  function deleteSelectedStrategies() {
    if (selectedStrategies.size === 0) return;
    
    if (!confirm(`Delete ${selectedStrategies.size} selected strategies?`)) {
      return;
    }
    
    savedStrategies = savedStrategies.filter(s => !selectedStrategies.has(s.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedStrategies));
    selectedStrategies.clear();
    bulkDeleteMode = false;
    
    console.log(`Deleted ${selectedStrategies.size} strategies`);
  }
  
  function exportStrategy(strategy: SavedStrategy) {
    const exportData = JSON.stringify(strategy, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategy.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function importStrategy() {
    try {
      const strategy = JSON.parse(importJsonText);
      
      // Validate structure
      if (!strategy.name || !strategy.strategyType || !strategy.parameters) {
        throw new Error('Invalid strategy format');
      }
      
      // Generate new ID to avoid conflicts
      strategy.id = `${strategy.strategyType}-${Date.now()}`;
      strategy.savedDate = Date.now();
      
      savedStrategies = [...savedStrategies, strategy];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedStrategies));
      
      // Close dialog and clear
      showImportDialog = false;
      importJsonText = '';
      
      console.log('Strategy imported:', strategy.name);
    } catch (error) {
      alert('Error importing strategy: ' + error.message);
    }
  }
  
  function isStrategyActive(strategy: SavedStrategy): boolean {
    if (selectedStrategyType !== strategy.strategyType) return false;
    
    const currentParams = strategyParams[selectedStrategyType];
    const savedParams = strategy.parameters;
    
    // Compare key parameters
    return (
      currentParams.profitTarget === savedParams.profitTarget &&
      currentParams.initialDropPercent === savedParams.initialDropPercent &&
      currentParams.basePositionPercent === savedParams.basePositionPercent &&
      currentParams.maxLevels === savedParams.maxLevels
    );
  }
  
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
        connectionStatus = 'connected';
        return;
      } else {
        console.log('Cache expired for:', cacheKey);
        chartDataCache.delete(cacheKey);
      }
    }
    
    isLoadingChart = true;
    connectionStatus = 'loading';
    
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
      connectionStatus = 'error';
    } finally {
      isLoadingChart = false;
      if (connectionStatus === 'loading') {
        connectionStatus = 'connected';
      }
    }
  }
  
  // Removed automatic timeframe updates - manual control only

  async function selectGranularity(granularity: string) {
    console.log('selectGranularity called:', granularity, 'valid:', isGranularityValid(granularity, selectedPeriod));
    if (isGranularityValid(granularity, selectedPeriod)) {
      selectedGranularity = granularity;
      loadSavedPresetForTimeframe(); // Load saved preset for this timeframe combination
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
    
    loadSavedPresetForTimeframe(); // Load saved preset for this timeframe combination
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
      let endTime = new Date();
      let startTime = new Date();
      
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
      
      // Use the already loaded chart data for backtesting
      console.log('Using loaded chart data for backtesting...');
      // Ensure we have fresh data
      if (!historicalCandles || historicalCandles.length === 0) {
        await loadChartData(true);
      }
      
      console.log(`Using ${historicalCandles.length} candles for backtesting`);
      
      // Use actual data time range
      if (historicalCandles.length > 0) {
        // Check if time is in seconds or milliseconds
        const firstTime = historicalCandles[0].time;
        const isMilliseconds = firstTime > 1000000000000; // Unix timestamp in ms is > 1 trillion
        
        startTime = new Date(isMilliseconds ? firstTime : firstTime * 1000);
        endTime = new Date(isMilliseconds ? historicalCandles[historicalCandles.length - 1].time : historicalCandles[historicalCandles.length - 1].time * 1000);
      }
      
      console.log('Time range:', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        firstCandle: historicalCandles[0] ? new Date(historicalCandles[0].time > 1000000000000 ? historicalCandles[0].time : historicalCandles[0].time * 1000).toISOString() : 'none',
        lastCandle: historicalCandles[historicalCandles.length - 1] ? new Date(historicalCandles[historicalCandles.length - 1].time > 1000000000000 ? historicalCandles[historicalCandles.length - 1].time : historicalCandles[historicalCandles.length - 1].time * 1000).toISOString() : 'none'
      });
      
      // Configure backtesting engine
      const config = {
        initialBalance: startBalance,
        startTime: Math.floor(startTime.getTime() / 1000), // Convert to seconds
        endTime: Math.floor(endTime.getTime() / 1000),     // Convert to seconds
        feePercent: 0.75, // Legacy fee (keeping for compatibility)
        makerFeePercent: makerFeePercent,
        takerFeePercent: takerFeePercent,
        feeRebatePercent: feeRebatePercent,
        slippage: 0.1   // 0.1% slippage
      };
      
      // Create and run backtesting engine
      backtestingEngine = new BacktestingEngine(currentStrategy, config);
      
      // Convert candles to have time in seconds for consistency
      const candlesWithSecondsTime = historicalCandles.map(candle => ({
        ...candle,
        time: candle.time > 1000000000000 ? Math.floor(candle.time / 1000) : candle.time
      }));
      
      backtestResults = await backtestingEngine.runBacktest(candlesWithSecondsTime);
      
      if (!backtestResults) {
        throw new Error('Backtest returned no results');
      }
      
      console.log('Backtest completed:', backtestResults);
      console.log('Backtest metrics:', backtestResults?.metrics);
      console.log('Trades for chart:', backtestResults?.trades);
      console.log('Number of trades:', backtestResults?.trades?.length || 0);
      
      // Force chart update
      historicalCandles = [...historicalCandles]; // Trigger reactive update
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
  
  function getBtcPositions(): string {
    if (!backtestResults || !backtestResults.equity || backtestResults.equity.length === 0) {
      return '0.000000';
    }
    
    // Get the final equity state
    const finalEquity = backtestResults.equity[backtestResults.equity.length - 1];
    const btcTotal = finalEquity.btcBalance || 0;
    const btcVault = backtestResults.metrics.btcGrowth || 0;
    
    // BTC positions = total BTC - BTC vault
    const btcPositions = btcTotal - btcVault;
    
    return btcPositions.toFixed(6);
  }
  
  function drawCompoundChart() {
    if (!compoundCanvas || !backtestResults?.chartData) return;
    
    const ctx = compoundCanvas.getContext('2d');
    if (!ctx) return;
    
    const width = compoundCanvas.width;
    const height = compoundCanvas.height;
    const padding = 40;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);
    
    // Get data points
    const data = backtestResults.chartData;
    if (!data || data.length === 0) return;
    
    // Calculate max values
    const maxValue = Math.max(...data.map(d => Math.max(d.balance, d.portfolioValue)));
    const minTime = data[0].timestamp;
    const maxTime = data[data.length - 1].timestamp;
    
    // Scale functions
    const xScale = (timestamp: number) => padding + ((timestamp - minTime) / (maxTime - minTime)) * (width - 2 * padding);
    const yScale = (value: number) => height - padding - (value / maxValue) * (height - 2 * padding);
    
    // Draw grid lines
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * (height - 2 * padding)) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      // Value labels
      const value = maxValue * (1 - i / 5);
      ctx.fillStyle = '#758696';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`$${value.toFixed(0)}`, padding - 10, y + 4);
    }
    
    // Draw vault balance line (compounding growth)
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = xScale(point.timestamp);
      const y = yScale(point.balance);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw portfolio value line (BTC holdings + cash)
    ctx.strokeStyle = '#26a69a';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = xScale(point.timestamp);
      const y = yScale(point.portfolioValue);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Legend
    const legendY = 20;
    ctx.font = '14px monospace';
    
    // Vault balance legend
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(width - 200, legendY, 20, 3);
    ctx.fillStyle = '#d1d4dc';
    ctx.textAlign = 'left';
    ctx.fillText('Vault Balance (Compounding)', width - 170, legendY + 5);
    
    // Portfolio value legend
    ctx.strokeStyle = '#26a69a';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(width - 200, legendY + 25);
    ctx.lineTo(width - 180, legendY + 25);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d1d4dc';
    ctx.fillText('Total Portfolio Value', width - 170, legendY + 30);
    
    // Calculate compound growth rate
    const startValue = data[0].balance;
    const endValue = data[data.length - 1].balance;
    const timeInYears = (maxTime - minTime) / (365 * 24 * 60 * 60 * 1000);
    const compoundRate = timeInYears > 0 ? (Math.pow(endValue / startValue, 1 / timeInYears) - 1) * 100 : 0;
    
    // Display compound growth rate
    ctx.fillStyle = '#ffa726';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Compound Annual Growth Rate: ${compoundRate.toFixed(1)}%`, width / 2, height - 10);
  }
  
  // Draw compound chart when results update
  $: if (backtestResults && compoundCanvas) {
    requestAnimationFrame(drawCompoundChart);
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
                data={historicalCandles.map(candle => ({
                  ...candle,
                  time: candle.time > 1000000000000 ? Math.floor(candle.time / 1000) : candle.time
                }))}
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
          <button class="run-btn" on:click={() => { updateCurrentStrategy(); runBacktest(); }} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run Backtest'}
          </button>
        </div>
        <div class="tabs">
          <button class="tab" class:active={activeTab === 'config'} on:click={() => activeTab = 'config'}>
            Config
          </button>
          <button class="tab" class:active={activeTab === 'code'} on:click={() => activeTab = 'code'}>
            Source Code
          </button>
          <button class="tab" class:active={activeTab === 'backup'} on:click={() => activeTab = 'backup'}>
            Backup
          </button>
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
              <span class="input-hint">$1000+ recommended for micro-scalping profitability</span>
            </label>
          </div>
          
          <div class="config-section">
            <h4 style="color: #a78bfa; margin-bottom: 10px;">Fee Structure</h4>
            <label>
              Maker Fee (%)
              <input type="number" bind:value={makerFeePercent} min="0" max="2" step="0.05" />
            </label>
          </div>
          
          <div class="config-section">
            <label>
              Taker Fee (%)
              <input type="number" bind:value={takerFeePercent} min="0" max="2" step="0.05" />
            </label>
          </div>
          
          <div class="config-section">
            <label>
              Fee Rebate (%)
              <input type="number" bind:value={feeRebatePercent} min="0" max="100" step="5" />
            </label>
          </div>
          
          <div class="strategy-params">
            {#if selectedStrategyType === 'reverse-ratio'}
              <div class="timeframe-notice" class:ultra-scalp={strategyParams['reverse-ratio'].profitTarget <= 1.0}>
                <span class="notice-icon">
                  {#if strategyParams['reverse-ratio'].profitTarget < 0.825}
                    ⚠️
                  {:else if strategyParams['reverse-ratio'].profitTarget <= 1.0}
                    🚀
                  {:else}
                    ⚡
                  {/if}
                </span>
                {#if strategyParams['reverse-ratio'].profitTarget < 0.825}
                  WARNING: {strategyParams['reverse-ratio'].profitTarget}% profit = {(strategyParams['reverse-ratio'].profitTarget - 0.825).toFixed(3)}% NET LOSS!
                {:else if strategyParams['reverse-ratio'].profitTarget <= 1.0}
                  MICRO SCALP: {strategyParams['reverse-ratio'].profitTarget}% profit ({(strategyParams['reverse-ratio'].profitTarget - 0.825).toFixed(3)}% net)
                {:else if strategyParams['reverse-ratio'].profitTarget <= 1.5}
                  QUICK PROFIT: {strategyParams['reverse-ratio'].profitTarget}% profit ({(strategyParams['reverse-ratio'].profitTarget - 0.825).toFixed(3)}% net)
                {:else}
                  SAFE PROFIT: {strategyParams['reverse-ratio'].profitTarget}% profit ({(strategyParams['reverse-ratio'].profitTarget - 0.825).toFixed(3)}% net)
                {/if}
              </div>
              
              <!-- Preset Management -->
              <div class="preset-management">
                <div class="preset-tabs">
                  {#each customPresets as preset, index}
                    <button 
                      class="preset-tab"
                      class:active={selectedPresetIndex === index}
                      on:click={() => {
                        selectedPresetIndex = index;
                        applyPreset(index);
                      }}
                    >
                      <span class="preset-tab-name">{preset.name}</span>
                      <span class="preset-tab-info">{preset.initialDropPercent}% → {preset.profitTarget}%</span>
                    </button>
                  {/each}
                  
                  <button 
                    class="preset-action-btn"
                    on:click={() => isEditingPresets = !isEditingPresets}
                    title={isEditingPresets ? "Close preset editor" : "Manage presets"}
                  >
                    {isEditingPresets ? '✕' : '⚙️'}
                  </button>
                </div>
                
                {#if isEditingPresets}
                  <div class="preset-editor">
                    <h4>Manage Presets</h4>
                    <div class="preset-list">
                      {#each customPresets as preset, index}
                        <div class="preset-item">
                          {#if editingPresetName === `${index}`}
                            <input 
                              type="text" 
                              value={preset.name}
                              on:blur={(e) => {
                                updatePresetName(index, e.target.value);
                                editingPresetName = '';
                              }}
                              on:keydown={(e) => {
                                if (e.key === 'Enter') {
                                  updatePresetName(index, e.target.value);
                                  editingPresetName = '';
                                }
                              }}
                              autofocus
                              class="preset-name-input"
                            />
                          {:else}
                            <span 
                              class="preset-name"
                              on:click={() => editingPresetName = `${index}`}
                            >
                              {preset.name}
                            </span>
                          {/if}
                          <div class="preset-actions">
                            <button 
                              class="preset-mini-btn save"
                              on:click={() => saveCurrentAsPreset(index)}
                              title="Save current settings to this preset"
                            >
                              💾
                            </button>
                            <button 
                              class="preset-mini-btn apply"
                              on:click={() => applyPreset(index)}
                              title="Apply this preset"
                            >
                              ✓
                            </button>
                            <button 
                              class="preset-mini-btn delete"
                              on:click={() => deletePreset(index)}
                              title="Delete this preset"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      {/each}
                    </div>
                    <button 
                      class="add-preset-btn"
                      on:click={addNewPreset}
                    >
                      + Add New Preset
                    </button>
                  </div>
                {/if}
              </div>
              
              <!-- Position Sizing Section -->
              <div class="param-group">
                <h4 class="param-group-title">Position Sizing</h4>
                
                <div class="config-section">
                  <label>
                    Position Size Mode
                    <select bind:value={strategyParams['reverse-ratio'].positionSizeMode}>
                      <option value="percentage">Percentage of Balance</option>
                      <option value="fixed">Fixed Dollar Amount</option>
                    </select>
                  </label>
                </div>
                
                {#if strategyParams['reverse-ratio'].positionSizeMode === 'percentage'}
                  <div class="config-section">
                    <label>
                      Base Position Size (%)
                      <input type="number" bind:value={strategyParams['reverse-ratio'].basePositionPercent} min="1" max="95" step="1" />
                      <span class="input-hint">Percentage of balance for first buy level</span>
                      {#if strategyParams['reverse-ratio'].basePositionPercent >= 80}
                        <span class="position-size-warning">⚠️ HIGH RISK: Using {strategyParams['reverse-ratio'].basePositionPercent}% of capital!</span>
                      {/if}
                    </label>
                  </div>
                {:else}
                  <div class="config-section">
                    <label>
                      Base Position Amount ($)
                      <input type="number" bind:value={strategyParams['reverse-ratio'].basePositionAmount} min="10" max="1000" step="10" />
                      <span class="input-hint">Dollar amount for first buy level</span>
                    </label>
                  </div>
                {/if}
                
                <div class="config-section">
                  <label>
                    Ratio Multiplier
                    <input type="number" bind:value={strategyParams['reverse-ratio'].ratioMultiplier} min="1" max="5" step="0.25" />
                    <span class="input-hint">How much to increase position size per level</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    Max Total Position (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].maxPositionPercent} min="10" max="100" step="5" />
                    <span class="input-hint">Maximum percentage of balance to use across all levels</span>
                  </label>
                </div>
                
                <!-- Position Sizing Preview -->
                <div class="position-preview">
                  <h5>Position Size Preview (First 5 levels)</h5>
                  <div class="preview-table">
                    {#each calculatePositionSizes(startBalance) as level}
                      <div class="preview-row">
                        <span class="preview-level">Level {level.level}:</span>
                        <span class="preview-amount">${level.amount.toFixed(2)}</span>
                        <span class="preview-percent">({level.percentage.toFixed(1)}%)</span>
                      </div>
                    {/each}
                    <div class="preview-row total">
                      <span class="preview-level">Total:</span>
                      <span class="preview-amount">
                        ${calculatePositionSizes(startBalance).reduce((sum, l) => sum + l.amount, 0).toFixed(2)}
                      </span>
                      <span class="preview-percent">
                        ({calculatePositionSizes(startBalance).reduce((sum, l) => sum + l.percentage, 0).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Entry Conditions Section -->
              <div class="param-group">
                <h4 class="param-group-title">Entry Conditions</h4>
                
                <div class="config-section">
                  <label>
                    Initial Drop (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].initialDropPercent} min="0.01" max="10" step="0.01" />
                    <span class="input-hint">Price drop from recent high to trigger first buy</span>
                    {#if currentPrice > 0}
                      <span class="price-preview">
                        At current price ${currentPrice.toFixed(2)}, this means buying at ${(currentPrice * (1 - strategyParams['reverse-ratio'].initialDropPercent / 100)).toFixed(2)}
                      </span>
                    {/if}
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    Level Drop (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].levelDropPercent} min="0.01" max="10" step="0.01" />
                    <span class="input-hint">Additional drop between each buy level</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    Max Levels
                    <input type="number" bind:value={strategyParams['reverse-ratio'].maxLevels} min="3" max="30" step="1" />
                    <span class="input-hint">Maximum number of buy levels</span>
                  </label>
                </div>
              </div>
              
              <!-- Exit Strategy Section -->
              <div class="param-group">
                <h4 class="param-group-title">Exit Strategy</h4>
                
                <div class="config-section">
                  <label>
                    Profit Target (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].profitTarget} min="0.1" max="20" step="0.05" />
                    <span class="input-hint">Sell all positions when first entry reaches this profit</span>
                    {#if currentPrice > 0 && strategyParams['reverse-ratio'].initialDropPercent > 0}
                      <span class="price-preview">
                        Sell target: ${(currentPrice * (1 - strategyParams['reverse-ratio'].initialDropPercent / 100) * (1 + strategyParams['reverse-ratio'].profitTarget / 100)).toFixed(2)}
                      </span>
                    {/if}
                  </label>
                </div>
              </div>
              
              <!-- Vault Configuration Section -->
              <div class="param-group">
                <h4 class="param-group-title">Vault Configuration</h4>
                
                <div class="config-section">
                  <h5 class="config-subtitle">Profit Distribution</h5>
                  <label>
                    BTC Vault Allocation (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.btcVaultPercent} min="0" max="100" step="0.1" />
                    <span class="input-hint">Percentage of profits allocated to BTC vault (default: 14.3% = 1/7)</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    USD Growth Allocation (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.usdGrowthPercent} min="0" max="100" step="0.1" />
                    <span class="input-hint">Percentage of profits to grow trading balance (default: 14.3% = 1/7)</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    USDC Vault Allocation (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.usdcVaultPercent} min="0" max="100" step="0.1" />
                    <span class="input-hint">Percentage of profits to USDC vault (default: 71.4% = 5/7)</span>
                  </label>
                  {#if strategyParams['reverse-ratio'].vaultConfig.btcVaultPercent + strategyParams['reverse-ratio'].vaultConfig.usdGrowthPercent + strategyParams['reverse-ratio'].vaultConfig.usdcVaultPercent !== 100}
                    <span class="warning-text">⚠️ Allocations should sum to 100% (current: {(strategyParams['reverse-ratio'].vaultConfig.btcVaultPercent + strategyParams['reverse-ratio'].vaultConfig.usdGrowthPercent + strategyParams['reverse-ratio'].vaultConfig.usdcVaultPercent).toFixed(1)}%)</span>
                  {/if}
                </div>
                
                <div class="config-section">
                  <h5 class="config-subtitle">Compound Settings</h5>
                  <label>
                    Compound Frequency
                    <select bind:value={strategyParams['reverse-ratio'].vaultConfig.compoundFrequency}>
                      <option value="trade">Every Trade</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <span class="input-hint">How often to compound profits</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    Min Compound Amount ($)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.minCompoundAmount} min="0.01" max="100" step="0.01" />
                    <span class="input-hint">Minimum profit required to trigger compound</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    <input type="checkbox" bind:checked={strategyParams['reverse-ratio'].vaultConfig.autoCompound} />
                    Auto-Compound
                    <span class="input-hint">Automatically compound vault earnings</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <h5 class="config-subtitle">Vault Targets (Optional)</h5>
                  <label>
                    BTC Vault Target
                    <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.btcVaultTarget} min="0" max="10" step="0.01" />
                    <span class="input-hint">Target BTC amount for vault (optional)</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    USDC Vault Target ($)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.usdcVaultTarget} min="0" max="1000000" step="100" />
                    <span class="input-hint">Target USDC amount for vault (optional)</span>
                  </label>
                </div>
                
                <div class="config-section">
                  <label>
                    Rebalance Threshold (%)
                    <input type="number" bind:value={strategyParams['reverse-ratio'].vaultConfig.rebalanceThreshold} min="0" max="20" step="0.5" />
                    <span class="input-hint">Rebalance when allocation deviates by this percentage</span>
                  </label>
                </div>
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
          {:else if activeTab === 'backup'}
            <div class="backup-section">
              <!-- Save Current Strategy -->
              <div class="save-strategy-form">
                <h3>💾 Save Current Strategy</h3>
                <div class="form-group">
                  <input 
                    type="text" 
                    bind:value={backupName} 
                    placeholder="Strategy name..."
                    class="backup-input"
                  />
                  <textarea 
                    bind:value={backupDescription} 
                    placeholder="Description (optional)..."
                    class="backup-textarea"
                    rows="2"
                  />
                  <button 
                    class="save-btn"
                    on:click={saveCurrentStrategy}
                    disabled={!backupName.trim() || !currentStrategy}
                  >
                    Save Strategy
                  </button>
                </div>
              </div>
              
              <!-- Saved Strategies List -->
              <div class="saved-strategies-section">
                <div class="section-header">
                  <h3>📁 Saved Strategies</h3>
                  <div class="header-actions">
                    {#if savedStrategies.length > 0}
                      <button class="bulk-delete-btn" on:click={() => bulkDeleteMode = !bulkDeleteMode}>
                        {bulkDeleteMode ? '✖ Cancel' : '🗑️ Bulk Delete'}
                      </button>
                    {/if}
                    <button class="import-btn" on:click={() => showImportDialog = true}>
                      📥 Import
                    </button>
                  </div>
                </div>
                
                {#if bulkDeleteMode && savedStrategies.length > 0}
                  <div class="bulk-delete-controls">
                    <label class="select-all">
                      <input 
                        type="checkbox" 
                        checked={selectedStrategies.size === savedStrategies.length}
                        on:change={toggleSelectAll}
                      />
                      Select All ({selectedStrategies.size}/{savedStrategies.length})
                    </label>
                    <button 
                      class="delete-selected-btn" 
                      disabled={selectedStrategies.size === 0}
                      on:click={deleteSelectedStrategies}
                    >
                      🗑️ Delete Selected ({selectedStrategies.size})
                    </button>
                  </div>
                {/if}
                
                {#if savedStrategies.length === 0}
                  <div class="empty-state">
                    <p>No saved strategies yet. Run a backtest and save your winning configurations!</p>
                  </div>
                {:else}
                  <div class="strategy-grid">
                    {#each savedStrategies as strategy (strategy.id)}
                      <div class="saved-strategy-card" class:active-strategy={isStrategyActive(strategy)} class:selected={bulkDeleteMode && selectedStrategies.has(strategy.id)}>
                        {#if bulkDeleteMode}
                          <input 
                            type="checkbox" 
                            class="strategy-checkbox"
                            checked={selectedStrategies.has(strategy.id)}
                            on:change={() => toggleStrategySelection(strategy.id)}
                          />
                        {/if}
                        <div class="strategy-header">
                          <h4>{strategy.name}</h4>
                          <span class="strategy-date">
                            {new Date(strategy.savedDate).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div class="strategy-type">
                          {strategies.find(s => s.value === strategy.strategyType)?.label || strategy.strategyType}
                        </div>
                        
                        {#if strategy.description}
                          <p class="strategy-description">{strategy.description}</p>
                        {/if}
                        
                        {#if strategy.backtestResults}
                          <div class="strategy-stats">
                            <span class="stat">
                              <strong>Win Rate:</strong> {strategy.backtestResults.winRate.toFixed(1)}%
                            </span>
                            <span class="stat">
                              <strong>Return:</strong> {strategy.backtestResults.totalReturn.toFixed(2)}%
                            </span>
                            <span class="stat">
                              <strong>Trades:</strong> {strategy.backtestResults.trades}
                            </span>
                          </div>
                        {/if}
                        
                        <div class="strategy-actions">
                          <button class="action-btn restore" on:click={() => restoreStrategy(strategy)}>
                            🔄 Restore
                          </button>
                          <button class="action-btn export" on:click={() => exportStrategy(strategy)}>
                            📤 Export
                          </button>
                          <button class="action-btn delete" on:click={() => deleteStrategy(strategy.id)}>
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
              
              <!-- Import Dialog -->
              {#if showImportDialog}
                <div class="import-dialog-overlay" on:click={() => showImportDialog = false}>
                  <div class="import-dialog" on:click|stopPropagation>
                    <h3>Import Strategy</h3>
                    <textarea
                      bind:value={importJsonText}
                      placeholder="Paste exported strategy JSON here..."
                      rows="10"
                    />
                    <div class="dialog-actions">
                      <button on:click={importStrategy}>Import</button>
                      <button on:click={() => { showImportDialog = false; importJsonText = ''; }}>Cancel</button>
                    </div>
                  </div>
                </div>
              {/if}
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
            {:else if backtestResults.metrics.totalTrades === 1 && selectedStrategyType === 'reverse-ratio'}
              <div class="single-trade-notice">
                <h3>⚠️ Only 1 buy level was used</h3>
                <p>The Reverse Ratio strategy only triggered one buy because:</p>
                <ul>
                  <li>Price dropped {strategyParams['reverse-ratio'].initialDropPercent}% to trigger the first buy</li>
                  <li>Price didn't drop another {strategyParams['reverse-ratio'].levelDropPercent}% for the second level</li>
                  <li>Strategy is waiting for {strategyParams['reverse-ratio'].profitTarget}% profit to sell</li>
                </ul>
                <p><strong>For {selectedGranularity} timeframe, consider:</strong></p>
                <ul>
                  <li>Use the ⚡ optimized parameters (click the timeframe to apply)</li>
                  <li>Lower profit target for quicker exits</li>
                  <li>Adjust position sizes to use more capital on first level</li>
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
                <span class="result-label">USDC Vault Balance</span>
                <span class="result-value profit">${backtestResults.metrics.vaultBalance.toFixed(2)}</span>
              </div>
              <div class="result-item">
                <span class="result-label">BTC Vault</span>
                <span class="result-value">{backtestResults.metrics.btcGrowth.toFixed(6)} BTC</span>
              </div>
              <div class="result-item">
                <span class="result-label">BTC Open Positions</span>
                <span class="result-value">{getBtcPositions()} BTC</span>
              </div>
              {#if backtestResults.metrics.initialBalanceGrowth}
                <div class="result-item">
                  <span class="result-label">Starting Balance Growth</span>
                  <span class="result-value profit">
                    ${backtestResults.metrics.initialBalanceGrowth.toFixed(2)} 
                    ({backtestResults.metrics.initialBalanceGrowthPercent.toFixed(2)}%)
                  </span>
                </div>
              {/if}
              {#if backtestResults.metrics.totalFees}
                <div class="result-item">
                  <span class="result-label">Total Fees Paid</span>
                  <span class="result-value loss">
                    ${backtestResults.metrics.totalFees.toFixed(2)}
                    {#if backtestResults.metrics.totalFeeRebates > 0}
                      (Rebates: ${backtestResults.metrics.totalFeeRebates.toFixed(2)})
                    {/if}
                  </span>
                </div>
              {/if}
            </div>
            
            <h3>All Trades ({backtestResults.trades.length})</h3>
            <div class="trades-list">
              {#each backtestResults.trades.slice().reverse() as trade}
                <div class="trade-item" class:buy={trade.type === 'buy'} class:sell={trade.type === 'sell'}>
                  <div class="trade-header">
                    <span class="trade-type">{trade.type.toUpperCase()}</span>
                    <span class="trade-date">{new Date(trade.timestamp * 1000).toLocaleDateString()}</span>
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
            
            {#if backtestResults?.chartData}
              <div class="compound-growth-section">
                <h3>Compound Growth Visualization</h3>
                <CompoundGrowthChart 
                  vaultData={backtestResults.chartData.vaultGrowth || []}
                  btcData={backtestResults.chartData.btcGrowth || []}
                  totalValueData={backtestResults.equity.map(e => ({ time: e.timestamp, value: e.value }))}
                  initialBalance={startBalance}
                />
              </div>
            {/if}
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
    width: calc(100% - 250px);
    transition: all 0.3s ease;
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
    height: 600px;
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
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .strategy-panel {
    min-height: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .results-panel {
    min-height: 400px;
  }
  
  .panel-header {
    padding: 15px 20px;
    background: rgba(74, 0, 224, 0.1);
    border-bottom: none;
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
    gap: 0;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    padding: 0;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }
  
  .tab {
    padding: 12px 24px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #888;
    cursor: pointer;
    border-radius: 0;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    position: relative;
  }
  
  .tab:hover {
    background: rgba(74, 0, 224, 0.1);
    color: #a78bfa;
  }
  
  .tab.active {
    background: rgba(74, 0, 224, 0.15);
    border-bottom: 2px solid #a78bfa;
    color: #a78bfa;
  }

  /* Tab separators */
  .tab:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 25%;
    height: 50%;
    width: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  /* Remove separator for active tab and the one before it */
  .tab.active::after,
  .tab.active + .tab::after {
    display: none;
  }
  
  .code-editor-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* Important for proper flex behavior */
    height: 100%;
  }
  
  .code-header {
    margin-bottom: 15px;
    flex-shrink: 0; /* Prevent header from shrinking */
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
    min-height: 0; /* Important for proper scrolling */
    max-height: 100%;
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
    white-space: pre;
    word-break: normal;
  }
  
  /* Custom scrollbar for code editor */
  .code-editor::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  .code-editor::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  .code-editor::-webkit-scrollbar-thumb {
    background: rgba(167, 139, 250, 0.3);
    border-radius: 4px;
  }
  
  .code-editor::-webkit-scrollbar-thumb:hover {
    background: rgba(167, 139, 250, 0.5);
  }
  
  .code-editor::-webkit-scrollbar-corner {
    background: transparent;
  }
  
  .panel-content {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    min-height: 0; /* Important for flex children */
  }
  
  .strategy-panel .panel-content {
    overflow-y: auto; /* Enable scrolling for strategy content */
    overflow-x: hidden;
    max-height: calc(100vh - 400px); /* Ensure content doesn't exceed viewport */
  }
  
  /* Custom scrollbar for strategy panel */
  .strategy-panel .panel-content::-webkit-scrollbar {
    width: 8px;
  }
  
  .strategy-panel .panel-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  .strategy-panel .panel-content::-webkit-scrollbar-thumb {
    background: rgba(167, 139, 250, 0.3);
    border-radius: 4px;
  }
  
  .strategy-panel .panel-content::-webkit-scrollbar-thumb:hover {
    background: rgba(167, 139, 250, 0.5);
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
  
  .timeframe-notice {
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 6px;
    padding: 10px 15px;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #a78bfa;
  }
  
  .notice-icon {
    font-size: 16px;
  }
  
  /* Run button in header */
  .panel-header .run-btn {
    padding: 8px 20px;
    background: #a78bfa;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .panel-header .run-btn:hover:not(:disabled) {
    background: #8b5cf6;
  }
  
  .panel-header .run-btn:disabled {
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
  
  .compound-growth-section {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid rgba(74, 0, 224, 0.3);
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
    flex-shrink: 0; /* Prevent params from shrinking */
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
  
  .single-trade-notice {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  
  .single-trade-notice h3 {
    margin: 0 0 10px 0;
    color: #fbbf24;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .single-trade-notice p {
    margin: 10px 0;
    color: #d1d4dc;
    font-size: 14px;
  }
  
  .single-trade-notice ul {
    margin: 10px 0 0 20px;
    padding: 0;
    list-style-type: disc;
  }
  
  .single-trade-notice li {
    margin: 5px 0;
    color: #9ca3af;
    font-size: 13px;
  }
  
  .single-trade-notice strong {
    color: #fcd34d;
  }
  
  .compound-chart {
    margin-top: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .compound-chart canvas {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }
  
  /* Strategy Parameter Groups */
  .param-group {
    margin-bottom: 25px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .param-group-title {
    color: #a78bfa;
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .config-section label {
    position: relative;
  }
  
  .input-hint {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 4px;
    line-height: 1.3;
  }
  
  .config-subtitle {
    color: #9ca3af;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 10px;
    margin-top: 5px;
  }
  
  .warning-text {
    display: block;
    color: #fbbf24;
    font-size: 0.75rem;
    margin-top: 5px;
    background: rgba(251, 191, 36, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(251, 191, 36, 0.2);
  }
  
  select {
    width: 100%;
    padding: 8px 12px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  select:hover {
    border-color: #4b5563;
  }
  
  select:focus {
    outline: none;
    border-color: #a78bfa;
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
  }
  
  /* Position Sizing Preview */
  .position-preview {
    margin-top: 20px;
    padding: 15px;
    background: rgba(167, 139, 250, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(167, 139, 250, 0.2);
  }
  
  .position-preview h5 {
    color: #a78bfa;
    font-size: 0.85rem;
    margin-bottom: 10px;
    font-weight: 600;
  }
  
  .preview-table {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .preview-row {
    display: grid;
    grid-template-columns: 80px 100px 80px;
    gap: 10px;
    font-size: 0.85rem;
    padding: 4px 0;
  }
  
  .preview-row.total {
    border-top: 1px solid rgba(167, 139, 250, 0.3);
    padding-top: 8px;
    margin-top: 4px;
    font-weight: 600;
    color: #d8b4fe;
  }
  
  .preview-level {
    color: #9ca3af;
  }
  
  .preview-amount {
    color: #e5e7eb;
    text-align: right;
  }
  
  .preview-percent {
    color: #6b7280;
    text-align: right;
  }
  
  .price-preview {
    display: block;
    font-size: 0.7rem;
    color: #a78bfa;
    margin-top: 4px;
    font-weight: 500;
  }
  
  .timeframe-notice.ultra-scalp {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  
  /* Preset Management */
  .preset-management {
    margin-bottom: 20px;
    padding: 15px;
    background: rgba(167, 139, 250, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(167, 139, 250, 0.15);
  }
  
  .preset-tabs {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .preset-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 16px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 140px;
  }
  
  .preset-tab:hover {
    background: #374151;
    border-color: #4b5563;
    color: #e5e7eb;
  }
  
  .preset-tab.active {
    background: rgba(167, 139, 250, 0.2);
    border-color: #a78bfa;
    color: #ffffff;
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
    transform: translateY(-2px);
  }
  
  .preset-tab-name {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 4px;
    text-align: center;
  }
  
  .preset-tab-info {
    font-size: 0.75rem;
    opacity: 0.8;
    text-align: center;
  }
  
  .preset-action-btn {
    padding: 8px 12px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .preset-action-btn:hover {
    background: #374151;
    border-color: #4b5563;
  }
  
  .preset-editor {
    margin-top: 15px;
    padding: 15px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .preset-editor h4 {
    color: #a78bfa;
    font-size: 0.9rem;
    margin-bottom: 10px;
  }
  
  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }
  
  .preset-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    border: 1px solid transparent;
    transition: all 0.2s;
  }
  
  .preset-item:hover {
    border-color: rgba(167, 139, 250, 0.3);
    background: rgba(255, 255, 255, 0.08);
  }
  
  .preset-name {
    flex: 1;
    color: #e5e7eb;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }
  
  .preset-name:hover {
    background: rgba(167, 139, 250, 0.1);
  }
  
  .preset-name-input {
    flex: 1;
    padding: 4px 8px;
    background: #1f2937;
    border: 1px solid #a78bfa;
    border-radius: 4px;
    color: #e5e7eb;
    font-size: 0.85rem;
    outline: none;
  }
  
  .preset-actions {
    display: flex;
    gap: 4px;
  }
  
  .preset-mini-btn {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .preset-mini-btn.save {
    color: #60a5fa;
  }
  
  .preset-mini-btn.save:hover {
    background: rgba(96, 165, 250, 0.1);
    border-color: #60a5fa;
  }
  
  .preset-mini-btn.apply {
    color: #34d399;
  }
  
  .preset-mini-btn.apply:hover {
    background: rgba(52, 211, 153, 0.1);
    border-color: #34d399;
  }
  
  .preset-mini-btn.delete {
    color: #f87171;
  }
  
  .preset-mini-btn.delete:hover {
    background: rgba(248, 113, 113, 0.1);
    border-color: #f87171;
  }
  
  .add-preset-btn {
    width: 100%;
    padding: 8px 16px;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 6px;
    color: #a78bfa;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .add-preset-btn:hover {
    background: rgba(167, 139, 250, 0.2);
    border-color: #a78bfa;
    transform: translateY(-1px);
  }
  
  .position-size-warning {
    display: block;
    margin-top: 4px;
    padding: 6px 12px;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 4px;
    color: #fbbf24;
    font-size: 0.85rem;
    font-weight: 600;
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* Backup Tab Styles */
  .backup-section {
    display: flex;
    flex-direction: column;
    gap: 30px;
    height: 100%;
    overflow-y: auto;
  }

  .save-strategy-form {
    background: rgba(74, 0, 224, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 20px;
  }

  .save-strategy-form h3 {
    margin: 0 0 15px 0;
    color: #a78bfa;
    font-size: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .backup-input,
  .backup-textarea {
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 14px;
    transition: all 0.2s;
  }

  .backup-input:focus,
  .backup-textarea:focus {
    outline: none;
    border-color: #a78bfa;
    background: rgba(74, 0, 224, 0.1);
  }

  .backup-textarea {
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
  }

  .save-btn {
    padding: 10px 20px;
    background: #a78bfa;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .save-btn:hover:not(:disabled) {
    background: #8b5cf6;
    transform: translateY(-1px);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .saved-strategies-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .section-header h3 {
    margin: 0;
    color: #a78bfa;
    font-size: 16px;
  }

  .import-btn {
    padding: 8px 16px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #a78bfa;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .import-btn:hover {
    background: rgba(74, 0, 224, 0.3);
    border-color: #a78bfa;
  }

  .empty-state {
    text-align: center;
    color: #758696;
    padding: 40px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(74, 0, 224, 0.3);
    border-radius: 8px;
  }

  .strategy-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 15px;
    overflow-y: auto;
    padding-right: 5px;
  }

  .saved-strategy-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 15px;
    transition: all 0.2s;
    position: relative;
  }
  
  .saved-strategy-card.selected {
    background: rgba(74, 0, 224, 0.15);
    border-color: #a78bfa;
  }
  
  .strategy-checkbox {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .saved-strategy-card:hover {
    background: rgba(74, 0, 224, 0.05);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .saved-strategy-card.active-strategy {
    border-color: #a78bfa;
    background: rgba(167, 139, 250, 0.1);
  }

  .strategy-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 8px;
  }

  .strategy-header h4 {
    margin: 0;
    font-size: 14px;
    color: #d1d4dc;
  }

  .strategy-date {
    font-size: 11px;
    color: #758696;
  }

  .strategy-type {
    font-size: 12px;
    color: #a78bfa;
    margin-bottom: 8px;
  }

  .strategy-description {
    font-size: 12px;
    color: #9ca3af;
    margin: 8px 0;
    line-height: 1.4;
  }

  .strategy-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 12px 0;
    padding: 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    font-size: 11px;
  }

  .strategy-stats .stat {
    display: flex;
    justify-content: space-between;
    color: #9ca3af;
  }

  .strategy-stats .stat strong {
    color: #d1d4dc;
  }

  .strategy-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .action-btn {
    flex: 1;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    color: #9ca3af;
  }

  .action-btn.restore {
    color: #26a69a;
    border-color: rgba(38, 166, 154, 0.3);
  }

  .action-btn.restore:hover {
    background: rgba(38, 166, 154, 0.1);
    border-color: #26a69a;
  }

  .action-btn.export {
    color: #60a5fa;
    border-color: rgba(96, 165, 250, 0.3);
  }

  .action-btn.export:hover {
    background: rgba(96, 165, 250, 0.1);
    border-color: #60a5fa;
  }

  .action-btn.delete {
    color: #ef5350;
    border-color: rgba(239, 83, 80, 0.3);
  }

  .action-btn.delete:hover {
    background: rgba(239, 83, 80, 0.1);
    border-color: #ef5350;
  }

  /* Import Dialog Styles */
  .import-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .import-dialog {
    background: #1a1a1a;
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    padding: 25px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }

  .import-dialog h3 {
    margin: 0 0 15px 0;
    color: #a78bfa;
    font-size: 18px;
  }

  .import-dialog textarea {
    width: 100%;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 4px;
    color: #d1d4dc;
    font-family: monospace;
    font-size: 12px;
    resize: vertical;
  }

  .import-dialog textarea:focus {
    outline: none;
    border-color: #a78bfa;
    background: rgba(74, 0, 224, 0.1);
  }

  .dialog-actions {
    display: flex;
    gap: 10px;
    margin-top: 15px;
    justify-content: flex-end;
  }

  .dialog-actions button {
    padding: 8px 20px;
    background: rgba(74, 0, 224, 0.2);
    border: 1px solid rgba(74, 0, 224, 0.3);
    color: #d1d4dc;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dialog-actions button:first-child {
    background: #a78bfa;
    border-color: #a78bfa;
    color: white;
  }

  .dialog-actions button:first-child:hover {
    background: #8b5cf6;
  }

  .dialog-actions button:last-child:hover {
    background: rgba(74, 0, 224, 0.3);
    border-color: rgba(74, 0, 224, 0.5);
  }
</style>