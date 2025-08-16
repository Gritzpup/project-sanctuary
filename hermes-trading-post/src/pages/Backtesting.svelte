<script lang="ts">
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import BacktestingChart from './Backtesting/BacktestingChart.svelte';
  import BacktestingControls from './Backtesting/BacktestingControls.svelte';
  import BacktestingResults from './Backtesting/BacktestingResults.svelte';
  import BacktestingStrategyParams from './Backtesting/BacktestingStrategyParams.svelte';
  import BacktestingBackups from './Backtesting/BacktestingBackups.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { BacktestingEngine } from '../services/backtestingEngine';
  import { ReverseRatioStrategy } from '../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../strategies/implementations/VWAPBounceStrategy';
  import { MicroScalpingStrategy } from '../strategies/implementations/MicroScalpingStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  import type { BacktestConfig, BacktestResult } from '../strategies/base/StrategyTypes';
  import type { CandleData } from '../types/coinbase';
  import { historicalDataService, HistoricalDataService } from '../services/historicalDataService';
  import { strategyStore, syncStatus } from '../stores/strategyStore';
  
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
  let activeTab: 'config' | 'code' | 'backups' = 'config';
  let strategySourceCode = '';
  
  // Visual feedback state
  let showSaveSuccess = false;
  
  // Strategy management state
  let backupName = '';
  let backupDescription = '';
  let showImportDialog = false;
  let importJsonText = '';
  
  // Backup management state
  let savedBackups: Array<{
    key: string;
    name: string;
    description: string;
    strategyType: string;
    savedDate: number;
    parameters: any;
    startBalance?: number;
    makerFeePercent?: number;
    takerFeePercent?: number;
    feeRebatePercent?: number;
  }> = [];
  let selectedBackupKey: string = '';
  let showBackupDialog = false;
  let editingBackupKey: string = '';
  
  // Strategy development IDE state
  let showStrategyEditor = false;
  let newStrategyName = '';
  let newStrategyLabel = '';
  let newStrategyDescription = '';
  let newStrategyCode = '';
  let editingStrategy: string | null = null;
  let customStrategies: CustomStrategy[] = [];
  
  interface CustomStrategy {
    value: string;
    label: string;
    description: string;
    code: string;
    isCustom: true;
  }
  
  // Built-in strategy definitions
  const builtInStrategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio', description: 'Grid trading with reverse position sizing', isCustom: false },
    { value: 'grid-trading', label: 'Grid Trading', description: 'Classic grid trading strategy', isCustom: false },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion', description: 'Trade RSI oversold/overbought', isCustom: false },
    { value: 'dca', label: 'Dollar Cost Averaging', description: 'Regular periodic purchases', isCustom: false },
    { value: 'vwap-bounce', label: 'VWAP Bounce', description: 'Trade VWAP support/resistance', isCustom: false },
    { value: 'micro-scalping', label: 'Micro Scalping (1H)', description: 'High-frequency 1H trading with 0.8% entries', isCustom: false },
    { value: 'proper-scalping', label: 'Proper Scalping', description: 'Professional scalping with RSI, MACD, and stop losses', isCustom: false }
  ];
  
  // Reactive combined strategies list
  $: strategies = [...builtInStrategies, ...customStrategies];
  
  // Manual sync state
  let isSynced = false;
  let lastSyncedStrategy = '';
  let lastSyncedParams = {};
  let lastSyncedBalance = 0;
  let lastSyncedMakerFee = 0;
  let lastSyncedTakerFee = 0;
  let paperTradingActive = false;
  
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
  let selectedPresetIndex: number = 0;
  
  // Strategy-specific parameters
  let strategyParams: Record<string, any> = {
    'reverse-ratio': {
      initialDropPercent: 0.02,
      levelDropPercent: 0.015,
      ratioMultiplier: 1.0,
      profitTarget: 0.85,
      maxLevels: 12,
      lookbackPeriod: 3,
      positionSizeMode: 'percentage',
      basePositionPercent: 8,
      basePositionAmount: 50,
      maxPositionPercent: 96,
      vaultConfig: {
        btcVaultPercent: 14.3,
        usdGrowthPercent: 14.3,
        usdcVaultPercent: 71.4,
        compoundFrequency: 'trade',
        minCompoundAmount: 0.01,
        autoCompound: true,
        btcVaultTarget: 0.1,
        usdcVaultTarget: 10000,
        rebalanceThreshold: 5
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
      amountPerBuy: 100,
      dropThreshold: 5
    },
    'vwap-bounce': {
      vwapPeriod: 20,
      deviationBuy: 2,
      deviationSell: 2
    },
    'micro-scalping': {
      initialDropPercent: 0.3,
      levelDropPercent: 0.4,
      ratioMultiplier: 1.5,
      profitTarget: 0.8,
      maxLevels: 3,
      lookbackPeriod: 12,
      basePositionPercent: 25,
      maxPositionPercent: 85
    },
    'proper-scalping': {
      positionSize: 5,
      maxOpenPositions: 3,
      rsiPeriod: 7,
      rsiOverbought: 75,
      rsiOversold: 25,
      macdFast: 3,
      macdSlow: 10,
      macdSignal: 16,
      stopLoss: 0.5,
      profitTarget: 1.0,
      trailingStop: true,
      trailingStopPercent: 0.3,
      minVolume: 1000000,
      trendAlignment: true,
      emaFast: 9,
      emaSlow: 21
    }
  };
  
  // Check if current configuration matches synced configuration
  $: {
    selectedStrategyType;
    strategyParams[selectedStrategyType];
    startBalance;
    makerFeePercent;
    takerFeePercent;
    
    isSynced = checkIfSynced(
      selectedStrategyType,
      strategyParams[selectedStrategyType],
      startBalance,
      makerFeePercent,
      takerFeePercent
    );
  }
  
  function checkIfSynced(
    currentStrategy: string,
    currentParams: any,
    currentBalance: number,
    currentMakerFee: number,
    currentTakerFee: number
  ): boolean {
    if (!lastSyncedStrategy) return false;
    if (lastSyncedStrategy !== currentStrategy) return false;
    if (JSON.stringify(lastSyncedParams) !== JSON.stringify(currentParams)) return false;
    if (lastSyncedBalance !== currentBalance) return false;
    if (lastSyncedMakerFee !== currentMakerFee) return false;
    if (lastSyncedTakerFee !== currentTakerFee) return false;
    return true;
  }
  
  function syncToPaperTrading() {
    if (paperTradingActive) {
      const shouldSync = confirm('Paper Trading is currently active. Syncing will update the strategy for the next trading session. Continue?');
      if (!shouldSync) return;
    }
    
    const isCustom = customStrategies.some(s => s.value === selectedStrategyType);
    const customStrategy = customStrategies.find(s => s.value === selectedStrategyType);
    
    strategyStore.setStrategy(
      selectedStrategyType, 
      strategyParams[selectedStrategyType] || {},
      isCustom,
      customStrategy?.code
    );
    
    strategyStore.setBalanceAndFees(startBalance, {
      maker: makerFeePercent / 100,
      taker: takerFeePercent / 100
    });
    
    strategyStore.setCustomStrategies(customStrategies);
    
    // Call the new sync method to emit the sync event
    strategyStore.syncToPaperTrading();
    
    lastSyncedStrategy = selectedStrategyType;
    lastSyncedParams = { ...strategyParams[selectedStrategyType] };
    lastSyncedBalance = startBalance;
    lastSyncedMakerFee = makerFeePercent;
    lastSyncedTakerFee = takerFeePercent;
    
    isSynced = true;
    
    console.log('Strategy synced to Paper Trading:', selectedStrategyType);
    alert('Strategy synchronized with Paper Trading! ✅');
  }
  
  function loadSavedPresetForTimeframe() {
    const timeframeKey = `preset_${selectedStrategyType}_${selectedPeriod}_${selectedGranularity}`;
    const savedIndex = localStorage.getItem(timeframeKey);
    if (savedIndex !== null) {
      const index = parseInt(savedIndex);
      if (index >= 0 && index < customPresets.length) {
        selectedPresetIndex = index;
        applyPreset(index);
        return;
      }
    }
    
    if (customPresets.length > 0) {
      selectedPresetIndex = 0;
      applyPreset(0);
    }
  }
  
  function savePresetForTimeframe(index: number) {
    const timeframeKey = `preset_${selectedStrategyType}_${selectedPeriod}_${selectedGranularity}`;
    localStorage.setItem(timeframeKey, index.toString());
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
  
  function getNextBackupNumber(strategyType: string): number {
    // Get all existing backups for this strategy type
    const existingNumbers: number[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`strategy_config_${strategyType}_`)) {
        try {
          const backup = JSON.parse(localStorage.getItem(key));
          // Extract number from names like "reverse-ratio-1", "reverse-ratio-2", etc.
          const match = backup.name.match(new RegExp(`^${strategyType}-(\\d+)$`));
          if (match) {
            existingNumbers.push(parseInt(match[1]));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // Find the next available number
    if (existingNumbers.length === 0) return 1;
    return Math.max(...existingNumbers) + 1;
  }

  function saveCurrentStrategy(useAutoName: boolean = false) {
    if (!currentStrategy) return;
    
    const timestamp = Date.now();
    const dateStr = new Date(timestamp).toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    });
    
    let finalBackupName: string;
    
    if (useAutoName) {
      // Auto-generate name like "reverse-ratio-1", "reverse-ratio-2", etc.
      const nextNumber = getNextBackupNumber(selectedStrategyType);
      finalBackupName = `${selectedStrategyType}-${nextNumber}`;
    } else {
      // Use provided name or fallback to timestamp-based name
      finalBackupName = backupName.trim() 
        ? `${backupName.trim()} (${dateStr})`
        : `${selectedStrategyType} - ${dateStr}`;
    }
    
    const configKey = `strategy_config_${selectedStrategyType}_${timestamp}`;
    
    const config = {
      name: finalBackupName,
      description: backupDescription.trim(),
      strategyType: selectedStrategyType,
      parameters: { ...strategyParams[selectedStrategyType] },
      startBalance: startBalance,
      makerFeePercent: makerFeePercent,
      takerFeePercent: takerFeePercent,
      feeRebatePercent: feeRebatePercent,
      savedDate: timestamp
    };
    
    localStorage.setItem(configKey, JSON.stringify(config));
    
    backupName = '';
    backupDescription = '';
    
    console.log('Configuration saved:', config.name);
    
    // Show visual feedback instead of alert
    showSaveSuccess = true;
    setTimeout(() => {
      showSaveSuccess = false;
    }, 2000);
  }
  
  function loadSavedBackups() {
    savedBackups = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('strategy_config_')) {
        try {
          const backup = JSON.parse(localStorage.getItem(key));
          savedBackups.push({ key, ...backup });
        } catch (e) {
          console.error('Failed to parse backup:', key);
        }
      }
    }
    savedBackups.sort((a, b) => b.savedDate - a.savedDate);
  }
  
  function deleteBackup(key: string) {
    if (confirm('Are you sure you want to delete this backup?')) {
      localStorage.removeItem(key);
      loadSavedBackups();
    }
  }
  
  function loadBackup(key: string) {
    const backup = savedBackups.find(b => b.key === key);
    if (backup) {
      selectedStrategyType = backup.strategyType;
      strategyParams[backup.strategyType] = { ...backup.parameters };
      
      if (backup.startBalance !== undefined) startBalance = backup.startBalance;
      if (backup.makerFeePercent !== undefined) makerFeePercent = backup.makerFeePercent;
      if (backup.takerFeePercent !== undefined) takerFeePercent = backup.takerFeePercent;
      if (backup.feeRebatePercent !== undefined) feeRebatePercent = backup.feeRebatePercent;
      
      updateCurrentStrategy();
      activeTab = 'config';
      alert(`Configuration "${backup.name}" loaded successfully!`);
    }
  }
  
  function renameBackup(key: string, newName: string) {
    const item = localStorage.getItem(key);
    if (item) {
      const backup = JSON.parse(item);
      backup.name = newName;
      localStorage.setItem(key, JSON.stringify(backup));
      loadSavedBackups();
    }
  }
  
  function importStrategy() {
    try {
      const imported = JSON.parse(importJsonText);
      
      if (imported.code && imported.label && imported.value) {
        const newStrategy = {
          value: imported.value || `imported-${Date.now()}`,
          label: imported.label,
          description: imported.description || '',
          code: imported.code,
          isCustom: true
        };
        
        customStrategies = [...customStrategies, newStrategy];
        saveCustomStrategies();
        
        strategyParams[newStrategy.value] = imported.parameters || {
          positionSize: 0.1,
          stopLoss: 2,
          takeProfit: 3,
          lookbackPeriod: 20,
          threshold: 1
        };
        
        selectedStrategyType = newStrategy.value;
        updateCurrentStrategy();
      } else if (imported.parameters && imported.strategyType) {
        if (!strategyParams[imported.strategyType]) {
          alert('Strategy type not found: ' + imported.strategyType);
          return;
        }
        
        strategyParams[imported.strategyType] = { ...imported.parameters };
        selectedStrategyType = imported.strategyType;
        
        if (imported.startBalance !== undefined) startBalance = imported.startBalance;
        if (imported.makerFeePercent !== undefined) makerFeePercent = imported.makerFeePercent;
        if (imported.takerFeePercent !== undefined) takerFeePercent = imported.takerFeePercent;
        if (imported.feeRebatePercent !== undefined) feeRebatePercent = imported.feeRebatePercent;
        
        updateCurrentStrategy();
      } else {
        alert('Invalid import format');
        return;
      }
      
      showImportDialog = false;
      importJsonText = '';
      
      console.log('Import successful');
    } catch (error) {
      alert('Error importing: ' + error.message);
    }
  }
  
  const CUSTOM_STRATEGIES_KEY = 'hermes_custom_strategies';
  
  function loadCustomStrategies() {
    try {
      const saved = localStorage.getItem(CUSTOM_STRATEGIES_KEY);
      if (saved) {
        customStrategies = JSON.parse(saved);
        console.log(`Loaded ${customStrategies.length} custom strategies`);
        
        customStrategies.forEach(strategy => {
          if (!strategyParams[strategy.value]) {
            strategyParams[strategy.value] = {
              positionSize: 0.1,
              stopLoss: 2,
              takeProfit: 3,
              lookbackPeriod: 20,
              threshold: 1
            };
          }
        });
      }
    } catch (error) {
      console.error('Error loading custom strategies:', error);
      customStrategies = [];
    }
  }
  
  function saveCustomStrategies() {
    localStorage.setItem(CUSTOM_STRATEGIES_KEY, JSON.stringify(customStrategies));
  }
  
  function editStrategy(strategyValue: string) {
    const strategy = customStrategies.find(s => s.value === strategyValue);
    if (strategy) {
      showStrategyEditor = true;
      editingStrategy = strategyValue;
      newStrategyName = strategy.value;
      newStrategyLabel = strategy.label;
      newStrategyDescription = strategy.description;
      newStrategyCode = strategy.code;
    }
  }
  
  function saveStrategy() {
    if (!newStrategyName.trim() || !newStrategyLabel.trim() || !newStrategyCode.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (!/^[a-z0-9-]+$/.test(newStrategyName)) {
      alert('Strategy name must be lowercase alphanumeric with hyphens only');
      return;
    }
    
    if (builtInStrategies.some(s => s.value === newStrategyName)) {
      alert('Cannot override built-in strategies');
      return;
    }
    
    if (editingStrategy) {
      customStrategies = customStrategies.map(s => 
        s.value === editingStrategy 
          ? { value: newStrategyName, label: newStrategyLabel, description: newStrategyDescription, code: newStrategyCode, isCustom: true }
          : s
      );
    } else {
      customStrategies = [...customStrategies, {
        value: newStrategyName,
        label: newStrategyLabel,
        description: newStrategyDescription,
        code: newStrategyCode,
        isCustom: true
      }];
      
      strategyParams[newStrategyName] = {
        positionSize: 0.1,
        stopLoss: 2,
        takeProfit: 3,
        lookbackPeriod: 20,
        threshold: 1
      };
    }
    
    saveCustomStrategies();
    showStrategyEditor = false;
    
    selectedStrategyType = newStrategyName;
    updateCurrentStrategy();
  }
  
  function deleteCustomStrategy(strategyValue: string) {
    if (!confirm(`Delete custom strategy "${strategyValue}"? This cannot be undone.`)) {
      return;
    }
    
    customStrategies = customStrategies.filter(s => s.value !== strategyValue);
    saveCustomStrategies();
    
    if (selectedStrategyType === strategyValue) {
      selectedStrategyType = strategies[0].value;
      updateCurrentStrategy();
    }
  }
  
  function exportCurrentStrategy() {
    const strategy = customStrategies.find(s => s.value === selectedStrategyType);
    if (strategy) {
      const exportData = JSON.stringify(strategy, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${strategy.value}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const configExport = {
        strategyType: selectedStrategyType,
        label: strategies.find(s => s.value === selectedStrategyType)?.label,
        parameters: strategyParams[selectedStrategyType],
        startBalance: startBalance,
        makerFeePercent: makerFeePercent,
        takerFeePercent: takerFeePercent,
        feeRebatePercent: feeRebatePercent,
        exportedDate: Date.now()
      };
      const exportData = JSON.stringify(configExport, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedStrategyType}-config.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
  
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
      
      chartDataCache.set(cacheKey, { data: historicalCandles, timestamp: Date.now() });
      
      console.log(`Loaded ${historicalCandles.length} candles for ${selectedPeriod}/${selectedGranularity}`);
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
  
  async function selectGranularity(granularity: string) {
    console.log('selectGranularity called:', granularity, 'valid:', isGranularityValid(granularity, selectedPeriod));
    if (isGranularityValid(granularity, selectedPeriod)) {
      selectedGranularity = granularity;
      loadSavedPresetForTimeframe();
      await loadChartData(true);
    }
  }
  
  async function selectPeriod(period: string) {
    console.log('selectPeriod called:', period);
    selectedPeriod = period;
    
    if (!isGranularityValid(selectedGranularity, period)) {
      const validOptions = validGranularities[period];
      if (validOptions && validOptions.length > 0) {
        const middleIndex = Math.floor(validOptions.length / 2);
        selectedGranularity = validOptions[middleIndex];
        console.log('Auto-selected granularity:', selectedGranularity);
      }
    }
    
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    
    if (['1H', '4H', '5D'].includes(period)) {
      refreshInterval = setInterval(async () => {
        console.log('Auto-refreshing chart data...');
        await loadChartData(true);
      }, 30000) as unknown as number;
    }
    
    loadSavedPresetForTimeframe();
    await loadChartData(true);
  }
  
  function createStrategy(type: string): Strategy {
    try {
      const params = strategyParams[type] || {};
      console.log('Creating strategy:', type, 'with params:', params);
      
      const customStrategy = customStrategies.find(s => s.value === type);
      if (customStrategy) {
        return createCustomStrategyInstance(customStrategy.code, params);
      }
      
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
        default:
          throw new Error(`Unknown strategy type: ${type}`);
      }
    } catch (error) {
      console.error('Failed to create strategy:', error);
      throw error;
    }
  }
  
  function createCustomStrategyInstance(code: string, params: any): Strategy {
    try {
      const cleanCode = code
        .replace(/import\s+.*?from\s+.*?;/gs, '')
        .replace(/export\s+class\s+/g, 'class ');
      
      const strategyFactory = new Function('params', `
        class Strategy {
          constructor(name) {
            this.name = name;
          }
          getName() { return this.name; }
          getMetrics() { 
            return { 
              totalTrades: 0, 
              winningTrades: 0, 
              losingTrades: 0, 
              totalReturn: 0, 
              maxDrawdown: 0, 
              sharpeRatio: 0, 
              winRate: 0, 
              profitFactor: 0 
            }; 
          }
        }
        
        ${cleanCode}
        
        if (typeof CustomStrategy !== 'undefined') {
          return new CustomStrategy(params);
        } else {
          throw new Error('CustomStrategy class not found in code');
        }
      `);
      
      return strategyFactory(params);
    } catch (error) {
      console.error('Error creating custom strategy:', error);
      console.error('Strategy code:', code);
      throw new Error(`Failed to compile custom strategy: ${error.message}`);
    }
  }
  
  function updateCurrentStrategy() {
    try {
      console.log('Updating strategy to:', selectedStrategyType);
      currentStrategy = createStrategy(selectedStrategyType);
      console.log('Strategy created successfully:', currentStrategy.getName());
      loadStrategySourceCode();
      
      if (selectedStrategyType === 'reverse-ratio') {
        loadSavedPresetForTimeframe();
      }
    } catch (error) {
      console.error('Failed to update strategy:', error);
      currentStrategy = null;
      alert(`Failed to create strategy: ${error.message}`);
    }
  }
  
  async function loadStrategySourceCode() {
    const customStrategy = customStrategies.find(s => s.value === selectedStrategyType);
    if (customStrategy) {
      strategySourceCode = customStrategy.code;
      return;
    }
    
    try {
      const strategyPath = `/src/strategies/implementations/${getStrategyFileName(selectedStrategyType)}.ts`;
      const response = await fetch(strategyPath);
      if (response.ok) {
        strategySourceCode = await response.text();
      } else {
        strategySourceCode = getStrategySourcePlaceholder(selectedStrategyType);
      }
    } catch (error) {
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
    return `// Source code for ${type} strategy
// Implementation details would be shown here
export class ${getStrategyFileName(type)} extends Strategy {
  // Strategy implementation...
}`;
  }
  
  async function runBacktest() {
    if (!currentStrategy) {
      console.error('Strategy not initialized');
      alert('Strategy not initialized. Please select a strategy.');
      return;
    }
    
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
      let endTime = new Date();
      let startTime = new Date();
      
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
      
      console.log('Using loaded chart data for backtesting...');
      if (!historicalCandles || historicalCandles.length === 0) {
        await loadChartData(true);
      }
      
      console.log(`Using ${historicalCandles.length} candles for backtesting`);
      
      if (historicalCandles.length > 0) {
        const firstTime = historicalCandles[0].time;
        const isMilliseconds = firstTime > 1000000000000;
        
        startTime = new Date(isMilliseconds ? firstTime : firstTime * 1000);
        endTime = new Date(isMilliseconds ? historicalCandles[historicalCandles.length - 1].time : historicalCandles[historicalCandles.length - 1].time * 1000);
      }
      
      const config = {
        initialBalance: startBalance,
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        feePercent: 0.75,
        makerFeePercent: makerFeePercent,
        takerFeePercent: takerFeePercent,
        feeRebatePercent: feeRebatePercent,
        slippage: 0.1
      };
      
      backtestingEngine = new BacktestingEngine(currentStrategy, config);
      
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
      
      historicalCandles = [...historicalCandles];
    } catch (error) {
      console.error('Backtest failed:', error);
      alert(`Failed to run backtest: ${error.message || 'Unknown error'}. Please check the console for details.`);
    } finally {
      isRunning = false;
    }
  }
  
  function getBtcPositions(): string {
    if (!backtestResults || !backtestResults.equity || backtestResults.equity.length === 0) {
      return '0.000000';
    }
    
    const finalEquity = backtestResults.equity[backtestResults.equity.length - 1];
    const btcTotal = finalEquity.btcBalance || 0;
    const btcVault = backtestResults.metrics.btcGrowth || 0;
    
    const btcPositions = btcTotal - btcVault;
    
    return btcPositions.toFixed(6);
  }
  
  let refreshInterval: number | null = null;
  
  onMount(async () => {
    console.log('Backtesting component mounted');
    console.log('Initial state:', { selectedStrategyType, startBalance, selectedPeriod, selectedGranularity });
    
    loadSavedPresetForTimeframe();
    updateCurrentStrategy();
    
    await loadChartData(true);
    
    if (['1H', '4H', '5D'].includes(selectedPeriod)) {
      refreshInterval = setInterval(async () => {
        console.log('Auto-refreshing chart data...');
        await loadChartData(true);
      }, 30000) as unknown as number;
    }
    
    loadCustomStrategies();
    
    const unsubscribe = strategyStore.subscribe(state => {
      if (state.balance !== undefined) {
        startBalance = state.balance;
      }
      if (state.fees) {
        makerFeePercent = state.fees.maker * 100;
        takerFeePercent = state.fees.taker * 100;
      }
      paperTradingActive = state.paperTradingActive || false;
    });
    
    updateCurrentStrategy();
    
    return () => {
      unsubscribe();
    };
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  });
  
  if (customPresets.length === 0) {
    customPresets = [
      {
        name: 'GRID SCALP',
        initialDropPercent: 0.01,
        levelDropPercent: 0.008,
        profitTarget: 0.85,
        basePositionPercent: 6,
        maxPositionPercent: 96,
        maxLevels: 16,
        ratioMultiplier: 1.0,
        lookbackPeriod: 2
      },
      {
        name: 'PROGRESSIVE',
        initialDropPercent: 0.02,
        levelDropPercent: 0.015,
        profitTarget: 1.0,
        basePositionPercent: 10,
        maxPositionPercent: 95,
        maxLevels: 10,
        ratioMultiplier: 1.1,
        lookbackPeriod: 3
      },
      {
        name: 'SAFE GRID',
        initialDropPercent: 0.03,
        levelDropPercent: 0.02,
        profitTarget: 1.2,
        basePositionPercent: 12,
        maxPositionPercent: 96,
        maxLevels: 8,
        ratioMultiplier: 1.0,
        lookbackPeriod: 4
      }
    ];
    localStorage.setItem('reverseRatioPresets', JSON.stringify(customPresets));
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
      <div class="header-controls">
        <button 
          class="run-button"
          class:running={isRunning}
          on:click={runBacktest}
          disabled={isRunning}
        >
          {#if isRunning}
            <span class="spinner"></span>
            Running...
          {:else}
            ▶️ Run Backtest
          {/if}
        </button>
        
        <button 
          class="sync-button"
          class:synced={$syncStatus.status === 'synced'}
          class:out-of-sync={$syncStatus.status === 'out-of-sync'}
          on:click={syncToPaperTrading}
          title="{$syncStatus.message}"
        >
          {#if $syncStatus.status === 'synced'}
            ✅ Synced
          {:else if $syncStatus.status === 'out-of-sync'}
            ⚠️ Sync to Paper Trading
          {:else}
            📤 Sync to Paper Trading
          {/if}
        </button>
      </div>
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
          <BacktestingChart
            {historicalCandles}
            backtestTrades={backtestResults?.trades || []}
            {selectedGranularity}
            {selectedPeriod}
            {isLoadingChart}
            {autoGranularityActive}
            on:selectGranularity={(e) => selectGranularity(e.detail.granularity)}
            on:selectPeriod={(e) => selectPeriod(e.detail.period)}
          />
          
          <!-- Strategy Configuration -->
          <BacktestingControls
            bind:selectedStrategyType
            {strategies}
            bind:strategyParams
            bind:startBalance
            bind:makerFeePercent
            bind:takerFeePercent
            bind:feeRebatePercent
            {isSynced}
            {paperTradingActive}
            {isRunning}
            {currentPrice}
            {customPresets}
            {selectedPresetIndex}
            {strategySourceCode}
            {showSaveSuccess}
            on:syncToPaperTrading={syncToPaperTrading}
            on:runBacktest={runBacktest}
            on:updateStrategy={updateCurrentStrategy}
            on:applyPreset={(e) => applyPreset(e.detail.index)}
            on:savePresetForTimeframe={(e) => savePresetForTimeframe(e.detail.index)}
            on:updatePresetName={(e) => updatePresetName(e.detail.index, e.detail.newName)}
            on:addNewPreset={addNewPreset}
            on:deletePreset={(e) => deletePreset(e.detail.index)}
            on:saveCurrentAsPreset={(e) => saveCurrentAsPreset(e.detail.index)}
            on:saveCurrentStrategy={(e) => saveCurrentStrategy(e.detail?.useAutoName || false)}
            on:loadSavedBackups={loadSavedBackups}
            on:importStrategy={(e) => { importJsonText = e.detail.jsonText; importStrategy(); }}
            on:exportCurrentStrategy={exportCurrentStrategy}
            on:editStrategy={(e) => editStrategy(e.detail.strategyType)}
            on:deleteCustomStrategy={(e) => deleteCustomStrategy(e.detail.strategyType)}
            on:saveStrategy={(e) => {
              newStrategyName = e.detail.name;
              newStrategyLabel = e.detail.label;
              newStrategyDescription = e.detail.description;
              newStrategyCode = e.detail.code;
              editingStrategy = e.detail.editing;
              saveStrategy();
            }}
            on:saveStrategyConfig={(e) => {
              backupName = e.detail.name;
              backupDescription = e.detail.description;
              saveCurrentStrategy();
            }}
          >
            <!-- Strategy-specific parameters slot -->
            <div slot="strategy-params">
              <BacktestingStrategyParams
                {selectedStrategyType}
                bind:strategyParams
                {currentPrice}
                {startBalance}
                {customPresets}
                {selectedPresetIndex}
                on:applyPreset={(e) => applyPreset(e.detail.index)}
                on:updatePresetName={(e) => updatePresetName(e.detail.index, e.detail.newName)}
                on:addNewPreset={addNewPreset}
                on:deletePreset={(e) => deletePreset(e.detail.index)}
                on:saveCurrentAsPreset={(e) => saveCurrentAsPreset(e.detail.index)}
              />
            </div>
            
            <!-- Backups content slot -->
            <div slot="backups-content">
              <BacktestingBackups
                {savedBackups}
                on:saveCurrentStrategy={(e) => saveCurrentStrategy(e.detail?.useAutoName || false)}
                on:loadSavedBackups={loadSavedBackups}
                on:loadBackup={(e) => loadBackup(e.detail.key)}
                on:deleteBackup={(e) => deleteBackup(e.detail.key)}
                on:renameBackup={(e) => renameBackup(e.detail.key, e.detail.newName)}
                on:saveStrategyConfig={(e) => {
                  backupName = e.detail.name;
                  backupDescription = e.detail.description;
                  saveCurrentStrategy();
                }}
              />
            </div>
          </BacktestingControls>
        </div><!-- End of panels-row -->
        
        <!-- Results Panel - Now spans full width below -->
        <BacktestingResults
          {backtestResults}
          {selectedStrategyType}
          {strategyParams}
          {selectedGranularity}
          {startBalance}
        />
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
  
  .header-controls {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .run-button, .sync-button {
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid rgba(74, 0, 224, 0.5);
    background: rgba(74, 0, 224, 0.1);
    color: #a78bfa;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .run-button:hover:not(:disabled), .sync-button:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.7);
    transform: translateY(-1px);
  }
  
  .run-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .run-button.running {
    background: rgba(74, 0, 224, 0.3);
  }
  
  .sync-button.synced {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
  
  .sync-button.out-of-sync {
    border-color: rgba(245, 158, 11, 0.5);
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }
  
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(167, 139, 250, 0.3);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
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
</style>