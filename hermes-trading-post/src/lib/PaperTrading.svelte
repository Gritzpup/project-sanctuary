<script lang="ts">
  import Chart from './Chart.svelte';
  import CollapsibleSidebar from './CollapsibleSidebar.svelte';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { paperTradingService } from '../services/paperTradingService';
  import { ReverseRatioStrategy } from '../strategies/implementations/ReverseRatioStrategy';
  import { GridTradingStrategy } from '../strategies/implementations/GridTradingStrategy';
  import { RSIMeanReversionStrategy } from '../strategies/implementations/RSIMeanReversionStrategy';
  import { DCAStrategy } from '../strategies/implementations/DCAStrategy';
  import { VWAPBounceStrategy } from '../strategies/implementations/VWAPBounceStrategy';
  import type { Strategy } from '../strategies/base/Strategy';
  
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
  
  let selectedGranularity = '1m';
  let selectedPeriod = '1H';
  let autoGranularityActive = false;
  
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
  
  // UI state
  let isEditingBalance = false;
  let editingBalance = '10000';
  
  const strategies = [
    { value: 'reverse-ratio', label: 'Reverse Ratio Buying' },
    { value: 'grid-trading', label: 'Grid Trading' },
    { value: 'rsi-mean-reversion', label: 'RSI Mean Reversion' },
    { value: 'dca', label: 'Dollar Cost Averaging' },
    { value: 'vwap-bounce', label: 'VWAP Bounce' }
  ];
  
  function createStrategy(type: string): Strategy {
    // Use default parameters for now
    switch (type) {
      case 'reverse-ratio':
        return new ReverseRatioStrategy({});
      case 'grid-trading':
        return new GridTradingStrategy({});
      case 'rsi-mean-reversion':
        return new RSIMeanReversionStrategy({});
      case 'dca':
        return new DCAStrategy({});
      case 'vwap-bounce':
        return new VWAPBounceStrategy({});
      default:
        throw new Error(`Unknown strategy type: ${type}`);
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
  
  onMount(() => {
    updateStatus();
    currentStrategy = createStrategy(selectedStrategyType);
    loadStrategySourceCode();
  });
  
  onDestroy(() => {
    if (statusInterval) {
      clearInterval(statusInterval);
    }
    if (isRunning) {
      paperTradingService.stop();
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
    if (selectedGranularity !== newGranularity) {
      selectedGranularity = newGranularity;
      autoGranularityActive = true;
      
      setTimeout(() => {
        autoGranularityActive = false;
      }, 2000);
    }
  }
  
  async function startTrading() {
    if (!paperTradingService || isRunning) return;
    
    currentStrategy = createStrategy(selectedStrategyType);
    await loadStrategySourceCode();
    paperTradingService.start(currentStrategy, 'BTC-USD', balance);
    isRunning = true;
    
    // Start periodic status updates
    statusInterval = setInterval(updateStatus, 1000);
  }
  
  function stopTrading() {
    if (!paperTradingService || !isRunning) return;
    
    paperTradingService.stop();
    isRunning = false;
    
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
  
  $: totalValue = balance + (btcBalance * currentPrice) + vaultBalance;
  $: unrealizedPnl = positions.reduce((total, pos) => {
    return total + ((currentPrice - pos.entryPrice) * pos.size);
  }, 0);
  $: returnPercent = ((totalValue - 10000) / 10000) * 100;
  
  // Calculate next buy trigger for all strategies
  let recentHigh = currentPrice || 0;
  let recentLow = currentPrice || 0;
  let tradingHistory: number[] = [];
  let lastTradeTime = 0;
  
  $: {
    // Track price history for calculations
    if (currentPrice > 0) {
      tradingHistory = [...tradingHistory.slice(-300), currentPrice];
      if (tradingHistory.length > 0) {
        recentHigh = Math.max(...tradingHistory);
        recentLow = Math.min(...tradingHistory);
      } else {
        recentHigh = currentPrice;
        recentLow = currentPrice;
      }
    }
    
    // Update last trade time if we have trades
    if (trades.length > 0) {
      const lastBuyTrade = [...trades].reverse().find(t => t.side === 'buy');
      if (lastBuyTrade) {
        lastTradeTime = lastBuyTrade.timestamp;
      }
    }
  }
  
  $: dropFromHigh = recentHigh > 0 ? ((recentHigh - currentPrice) / recentHigh) * 100 : 0;
  $: riseFromLow = recentLow > 0 ? ((currentPrice - recentLow) / recentLow) * 100 : 0;
  
  // Calculate next buy level based on selected strategy
  $: nextBuyLevel = (() => {
    const currentPositionCount = positions.length;
    
    switch (selectedStrategyType) {
      case 'reverse-ratio': {
        const levels = [5, 10, 15, 20, 25]; // Drop percentages for each level
        if (currentPositionCount >= 5) return null;
        
        for (let level of levels) {
          if (dropFromHigh < level) {
            return {
              type: 'price',
              label: 'Drop Target',
              value: `${level}%`,
              price: recentHigh * (1 - level / 100),
              progress: (dropFromHigh / level) * 100,
              description: `${level}% drop from high`
            };
          }
        }
        return null;
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
          price: recentHigh * (1 - targetDrop / 100),
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
          price: currentPrice * (1 - estimatedDropForOversold / 100),
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
          price: currentPrice, // DCA buys at market price
          progress: progress,
          description: 'Daily accumulation'
        };
      }
      
      case 'vwap-bounce': {
        // VWAP strategy: Buy when price is below VWAP (simplified)
        const vwapDiscount = 2; // Buy 2% below VWAP
        const estimatedVWAP = recentHigh * 0.98; // Simplified VWAP estimate
        const targetPrice = estimatedVWAP * (1 - vwapDiscount / 100);
        
        return {
          type: 'indicator',
          label: 'VWAP Target',
          value: 'Below VWAP',
          price: targetPrice,
          progress: Math.max(0, Math.min(100, ((estimatedVWAP - currentPrice) / (estimatedVWAP - targetPrice)) * 100)),
          description: `${vwapDiscount}% below VWAP`
        };
      }
      
      default:
        return null;
    }
  })();
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
      
      <!-- Trading Controls -->
      <div class="panel trading-panel">
        <div class="panel-header">
          <h2>Automated Trading</h2>
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
            <label>
              Strategy
              <select bind:value={selectedStrategyType} disabled={isRunning} on:change={loadStrategySourceCode}>
                {#each strategies as strat}
                  <option value={strat.value}>{strat.label}</option>
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
                <div class="trade-item" class:buy={trade.side === 'buy'} class:sell={trade.side === 'sell'}>
                  <div class="trade-header">
                    <span class="trade-type">{trade.side.toUpperCase()}</span>
                    <span class="trade-time">{new Date(trade.timestamp).toLocaleString()}</span>
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
      
      <!-- Next Buy Trigger Indicator -->
      {#if nextBuyLevel}
        <div class="trigger-gauge-panel">
          <div class="gauge-container">
            <div class="gauge-header">
              <h3>🎯 Next Buy Zone</h3>
              <div class="gauge-price">
                <span class="price-label">Trigger at</span>
                <span class="price-value">${nextBuyLevel.price.toFixed(2)}</span>
              </div>
            </div>
            
            <div class="gauge-visual">
              <div class="gauge-arc">
                <svg viewBox="0 0 200 120" class="gauge-svg">
                  <!-- Background arc -->
                  <path d="M 20 100 A 80 80 0 0 1 180 100" 
                        fill="none" 
                        stroke="rgba(74, 0, 224, 0.2)" 
                        stroke-width="15"
                        stroke-linecap="round"/>
                  
                  <!-- Progress arc -->
                  <path d="M 20 100 A 80 80 0 0 1 180 100" 
                        fill="none" 
                        stroke="url(#gaugeGradient)" 
                        stroke-width="15"
                        stroke-linecap="round"
                        stroke-dasharray="{251.33 * (nextBuyLevel.progress / 100)} 251.33"
                        class="gauge-progress"/>
                  
                  <!-- Gradient definition -->
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style="stop-color:#4a00e0;stop-opacity:1" />
                      <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:1" />
                    </linearGradient>
                  </defs>
                  
                  <!-- Pointer -->
                  <circle cx="{20 + 160 * (nextBuyLevel.progress / 100)}" 
                          cy="{100 - 80 * Math.sin(Math.PI * nextBuyLevel.progress / 100)}" 
                          r="8" 
                          fill="#a78bfa" 
                          class="gauge-pointer">
                    <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite"/>
                  </circle>
                </svg>
                
                <div class="gauge-center">
                  <div class="gauge-percentage">{nextBuyLevel.progress.toFixed(1)}%</div>
                  <div class="gauge-subtitle">{nextBuyLevel.description || 'to trigger'}</div>
                </div>
              </div>
              
              <div class="gauge-levels">
                <div class="level-marker" style="left: 0%">
                  <div class="marker-line"></div>
                  <div class="marker-label">0%</div>
                </div>
                <div class="level-marker" style="left: 50%">
                  <div class="marker-line"></div>
                  <div class="marker-label">{(nextBuyLevel.dropPercent / 2).toFixed(1)}%</div>
                </div>
                <div class="level-marker" style="left: 100%">
                  <div class="marker-line"></div>
                  <div class="marker-label">{nextBuyLevel.dropPercent}%</div>
                </div>
              </div>
            </div>
            
            <div class="gauge-stats">
              <div class="gauge-stat">
                <div class="stat-info">
                  <span class="stat-icon">💵</span>
                  <span class="stat-label">Current Price</span>
                </div>
                <span class="stat-value">${currentPrice.toFixed(2)}</span>
              </div>
              <div class="gauge-stat">
                <div class="stat-info">
                  <span class="stat-icon">
                    {#if nextBuyLevel.type === 'time'}
                      ⏰
                    {:else if nextBuyLevel.type === 'indicator'}
                      📊
                    {:else}
                      📉
                    {/if}
                  </span>
                  <span class="stat-label">{nextBuyLevel.label}</span>
                </div>
                <span class="stat-value">{nextBuyLevel.value}</span>
              </div>
              <div class="gauge-stat">
                <div class="stat-info">
                  <span class="stat-icon">🎯</span>
                  <span class="stat-label">Target Price</span>
                </div>
                <span class="stat-value highlight">${nextBuyLevel.price.toFixed(2)}</span>
              </div>
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
    padding: 6px 10px;
    background: rgba(239, 83, 80, 0.1);
    border: 1px solid rgba(239, 83, 80, 0.3);
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
    color: #ef5350;
  }
  
  .reset-btn:hover {
    background: rgba(239, 83, 80, 0.2);
    border-color: rgba(239, 83, 80, 0.5);
    transform: rotate(180deg);
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
  }
  
  .start-btn, .stop-btn {
    width: 100%;
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
</style>