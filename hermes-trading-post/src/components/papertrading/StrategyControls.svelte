<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let selectedStrategyType: string = 'reverse-ratio';
  export let strategies: any[] = [];
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  export let balance: number = 10000;
  export let btcBalance: number = 0;
  export let vaultBalance: number = 0;
  export let btcVaultBalance: number = 0;
  export let positions: any[] = [];
  export let currentPrice: number = 0;
  export let botTabs: any[] = [];
  export let activeBotInstance: any = null;
  
  // Additional stats tracking
  export let totalTrades: number = 0;
  export let totalReturn: number = 0;
  export let startingBalance: number = 10000;
  export let totalFees: number = 0;
  export let totalRebates: number = 0;
  export let totalRebalance: number = 0;
  
  // Calculate derived stats
  $: growth = balance - startingBalance;
  $: growthPercent = ((balance - startingBalance) / startingBalance * 100);
  $: totalValue = balance + (btcBalance * currentPrice);
  $: totalPL = totalValue - startingBalance;
  $: netFeesAfterRebase = totalFees - totalRebates;
  $: btcVaultValue = btcBalance * currentPrice;
  $: btcVaultUsdValue = btcVaultBalance * currentPrice;
  $: currentOpenPosition = positions.length > 0 ? positions[0].size || 0 : 0;
  
  // Calculate position stats
  $: totalPositionSize = positions.reduce((sum, pos) => sum + (pos.size || 0), 0);
  $: averageEntryPrice = positions.length > 0 && totalPositionSize > 0 ? 
    positions.reduce((sum, pos) => sum + ((pos.entryPrice || 0) * (pos.size || 0)), 0) / totalPositionSize : 0;
  
  const dispatch = createEventDispatcher();
  
  function handleStrategyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    dispatch('strategyChange', { value: select.value });
  }
  
  function startTrading() {
    console.log('StrategyControls startTrading clicked!');
    console.log('Dispatching start event...');
    dispatch('start');
    console.log('Start event dispatched');
  }
  
  
  function pauseTrading() {
    dispatch('pause');
  }
  
  function resumeTrading() {
    dispatch('resume');
  }
  
  function selectBot(botId: string) {
    dispatch('selectBot', { botId });
  }

  // Force component re-render when props change
  $: reactiveKey = `${isRunning}-${isPaused}-${Date.now()}`;
  $: {
    console.log('🔥 StrategyControls REACTIVE UPDATE:', { isRunning, isPaused, reactiveKey });
  }
  
  function getBotStatus(bot: any): 'idle' | 'running' | 'paused' | 'empty' {
    if (!bot) return 'empty';
    // For Bot 1 (reverse-ratio bot), use the backend status
    if (bot.name === 'Bot 1' || bot.id === 'reverse-ratio-bot-1' || bot.id === 'bot-1') {
      const status = isRunning ? (isPaused ? 'paused' : 'running') : 'idle';
      console.log(`🎯 getBotStatus - Bot: ${bot.name} (${bot.id}), isRunning: ${isRunning}, isPaused: ${isPaused} → status: "${status}"`);
      return status;
    }
    return bot.status || 'idle';
  }
  
  function getStatusColor(status: string): string {
    const color = (() => {
      switch (status) {
        case 'running': return '#22c55e';
        case 'paused': return '#f59e0b';
        default: return '#6b7280'; // Gray for idle/empty/default
      }
    })();
    console.log(`🎨 getStatusColor("${status}") → ${color}`);
    return color;
  }
</script>

<div class="panel strategy-panel">
  <div class="panel-header">
    <h2>Strategy Controls</h2>
  </div>
  <div class="panel-content">
    <!-- Strategy selection -->
    <div class="control-group">
      <label for="strategy-select">Strategy</label>
      <select 
        id="strategy-select"
        bind:value={selectedStrategyType}
        on:change={handleStrategyChange}
        disabled={isRunning}
      >
        {#each strategies as strategy}
          <option value={strategy.value}>{strategy.label}</option>
        {/each}
      </select>
    </div>
    
    <!-- Bot Status Buttons -->
    <div class="control-group">
      <label>Bot Status</label>
      <div class="bot-status-row">
        {#each Array(6) as _, i (reactiveKey + i)}
          {@const botIndex = i + 1}
          {@const bot = botTabs.find(b => b.name === `Bot ${botIndex}`) || { id: `bot-${botIndex}`, name: `Bot ${botIndex}`, status: 'empty' }}
          {@const status = getBotStatus(bot)}
          {@const statusColor = getStatusColor(status)}
          {@const isActive = activeBotInstance ? (bot.id === activeBotInstance.id) : (botIndex === 1)}
          <button 
            class="bot-status-btn-compact"
            class:active={isActive}
            class:running={status === 'running'}
            class:paused={status === 'paused'}
            on:click={() => selectBot(bot.id)}
            title="{bot.name} - {status}"
          >
            <span class="bot-number-compact">Bot {botIndex}</span>
            <div 
              class="status-light-compact" 
              style="background-color: {statusColor};"
            ></div>
          </button>
        {/each}
      </div>
    </div>
    
    <!-- Balance Controls (moved above stats) -->
    <div class="control-group">
      <label>Account Balances</label>
      <div class="balance-controls-simple">
        <div class="balance-pair">
          <span class="balance-label-inline">USD</span>
          <input 
            type="number" 
            class="balance-input-inline"
            bind:value={balance}
            min="0"
            step="100"
            placeholder="10000"
            on:change={() => dispatch('balanceChange', { balance })}
          />
        </div>
        
        <div class="balance-pair">
          <span class="balance-label-inline">USDC Vault</span>
          <span class="vault-balance-inline">
            ${vaultBalance.toFixed(2)}
          </span>
        </div>
        
        <div class="balance-pair">
          <span class="balance-label-inline">BTC Vault</span>
          <span class="vault-balance-inline">
            ${btcVaultUsdValue.toFixed(2)}
          </span>
        </div>
      </div>
    </div>


    <!-- Stats Panel -->
    <div class="control-group">
      <label>Trading Stats</label>
      <div class="stats-panel">
        <div class="stats-grid">
          <div class="stat-item">Start: <span class="stat-value">${startingBalance.toLocaleString()}</span></div>
          <div class="stat-item">Growth: <span class="stat-value" class:profit={growth > 0} class:loss={growth < 0}>{growth > 0 ? '+' : ''}${growth.toLocaleString()}</span></div>
          <div class="stat-item">Rebalance: <span class="stat-value" class:profit={totalRebalance > 0}>${totalRebalance.toFixed(2)}</span></div>
          <div class="stat-item">Fees: <span class="stat-value">${totalFees.toFixed(2)}</span></div>
          <div class="stat-item">Position Size: <span class="stat-value">{totalPositionSize.toFixed(6)} BTC</span></div>
          <div class="stat-item">Avg Entry: <span class="stat-value">${averageEntryPrice > 0 ? averageEntryPrice.toLocaleString() : 'N/A'}</span></div>
          <div class="stat-item">Return: <span class="stat-value" class:profit={growthPercent > 0} class:loss={growthPercent < 0}>{growthPercent > 0 ? '+' : ''}{growthPercent.toFixed(1)}%</span></div>
          <div class="stat-item">Total: <span class="stat-value">${totalValue.toLocaleString()}</span></div>
          <div class="stat-item">Trades: <span class="stat-value">{totalTrades}</span></div>
          <div class="stat-item">P/L: <span class="stat-value" class:profit={totalPL > 0} class:loss={totalPL < 0}>{totalPL > 0 ? '+' : ''}${totalPL.toLocaleString()}</span></div>
        </div>
      </div>
    </div>
    
    <!-- Trading Controls (at bottom) -->
    <div class="trading-controls">
      <div class="main-controls">
        {#if !isRunning}
          <button class="control-btn start-btn" on:click={startTrading}>
            <span class="btn-icon">▶</span>
            Start Trading
          </button>
          <button class="control-btn reset-btn" on:click={() => dispatch('reset')}>
            <span class="btn-icon">↻</span>
            Reset
          </button>
        {:else if isPaused}
          <button class="control-btn resume-btn" on:click={resumeTrading}>
            <span class="btn-icon">▶</span>
            Resume
          </button>
          <button class="control-btn reset-btn" on:click={() => dispatch('reset')}>
            <span class="btn-icon">↻</span>
            Reset
          </button>
        {:else}
          <button class="control-btn pause-btn" on:click={pauseTrading}>
            <span class="btn-icon">⏸</span>
            Pause
          </button>
          <button class="control-btn reset-btn" on:click={() => dispatch('reset')}>
            <span class="btn-icon">↻</span>
            Reset
          </button>
        {/if}
      </div>
    </div>

  </div>
</div>

<style>
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 8px;
    overflow: hidden;
  }

  .strategy-panel {
    width: 100%;
    min-width: 350px;
    flex-shrink: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    background: rgba(15, 15, 15, 0.95);
    padding: 15px 20px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.3);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #a78bfa;
    font-weight: 500;
  }

  .panel-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    height: 100%;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }

  .control-group:has(.balance-controls-simple) {
    margin-bottom: 8px;
  }

  .control-group label {
    font-size: 13px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }

  select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    color: #d1d4dc;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  select:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.4);
    background: rgba(255, 255, 255, 0.05);
  }

  select:hover {
    border-color: rgba(74, 0, 224, 0.4);
    background: rgba(255, 255, 255, 0.05);
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  select option {
    background: #0a0a0a;
    color: #d1d4dc;
    padding: 8px 12px;
    border: none;
  }

  select option:hover {
    background: rgba(74, 0, 224, 0.1);
  }

  select option:checked {
    background: rgba(74, 0, 224, 0.2);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    font-size: 14px;
    color: #d1d4dc;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot.running {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
  }

  .status-dot.paused {
    background: #f59e0b;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
  }

  .status-dot.idle {
    background: #6b7280;
  }

  /* Bot Status Grid */
  .bot-status-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 8px;
  }

  .bot-status-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    color: #9ca3af;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.2s ease;
    min-height: 32px;
  }

  .bot-status-btn:hover {
    background: rgba(74, 0, 224, 0.1);
    border-color: rgba(74, 0, 224, 0.4);
    color: #d1d4dc;
  }

  .bot-status-btn.active {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: #a78bfa;
  }

  .bot-status-btn.running {
    border-color: rgba(34, 197, 94, 0.4);
  }

  .bot-status-btn.paused {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .bot-status-btn.running.active {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .bot-status-btn.paused.active {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.5);
  }

  .bot-number {
    flex: 1;
    text-align: left;
  }

  .status-light {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.3);
  }

  .balance-input, .btc-balance {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    color: #26a69a;
    font-family: 'Courier New', monospace;
    width: 100%;
  }

  /* Simpler balance controls */
  .balance-controls-simple {
    display: flex;
    gap: 24px;
    margin-bottom: 8px;
  }

  .balance-pair {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .balance-label-inline {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }

  .balance-input-inline {
    width: 100px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    color: #26a69a;
    font-size: 14px;
    font-family: 'Courier New', monospace;
    font-weight: 500;
  }

  .btc-balance-inline {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    color: #26a69a;
    font-size: 14px;
    font-family: 'Courier New', monospace;
  }

  .vault-balance-inline {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    color: #a78bfa;
    font-size: 14px;
    font-family: 'Courier New', monospace;
  }

  .balance-input:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  .strategy-info {
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    min-height: 40px;
  }

  .strategy-description {
    font-size: 13px;
    color: #888;
    line-height: 1.4;
  }

  .positions-summary-quick {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 6px;
    font-size: 14px;
  }

  .positions-count {
    color: #a78bfa;
    font-weight: 500;
  }

  .positions-pnl {
    font-weight: 500;
    font-family: 'Courier New', monospace;
  }

  .positions-pnl.profit {
    color: #26a69a;
  }

  .positions-pnl.loss {
    color: #ef4444;
  }

  .no-positions-text {
    color: #888;
    font-style: italic;
  }

  .trading-controls {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
  }

  .main-controls {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .start-btn, .resume-btn, .pause-btn, .stop-btn {
    flex: 1;
  }

  .start-btn, .pause-btn {
    flex: 2;
  }

  .reset-btn {
    flex: 1;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: 1px solid;
    border-radius: 6px;
    background: rgba(74, 0, 224, 0.1);
    color: #a78bfa;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .control-btn:hover {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
  }

  .start-btn {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .start-btn:hover, .resume-btn:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .resume-btn {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .pause-btn {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
    color: #f59e0b;
  }

  .pause-btn:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.5);
  }

  .stop-btn {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .stop-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .reset-btn {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 12px 16px;
    min-width: 40px;
    flex-shrink: 0;
    height: 100%;
  }

  .reset-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }

  .reset-btn .btn-icon {
    font-size: 14px;
  }

  .btn-icon {
    font-size: 12px;
    line-height: 1;
  }

  /* Compact Bot Status Row */
  .bot-status-row {
    display: flex;
    gap: 0;
    margin-top: 8px;
  }

  .bot-status-btn-compact {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 6px;
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 0;
    color: #9ca3af;
    cursor: pointer;
    font-size: 9px;
    font-weight: 500;
    transition: all 0.2s ease;
    min-height: 20px;
    flex: 1;
  }

  .bot-status-btn-compact:not(:first-child) {
    border-left: none;
  }

  .bot-status-btn-compact:hover {
    background: rgba(74, 0, 224, 0.1);
    border-color: rgba(74, 0, 224, 0.4);
    color: #d1d4dc;
  }

  .bot-status-btn-compact.active {
    background: rgba(74, 0, 224, 0.2);
    border-color: rgba(74, 0, 224, 0.5);
    color: #a78bfa;
  }

  .bot-status-btn-compact.running {
    border-color: rgba(34, 197, 94, 0.4);
  }

  .bot-status-btn-compact.paused {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .bot-status-btn-compact.running.active {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .bot-status-btn-compact.paused.active {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.5);
  }

  .bot-number-compact {
    flex: none;
    font-size: 12px;
  }

  .status-light-compact {
    position: absolute;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  }

  /* Stats Panel */
  .stats-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 4px;
    padding: 6px 8px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 4px;
    margin: 0;
  }

  .stat-item {
    font-size: 14px;
    line-height: 1.2;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    margin: 0;
    padding: 1px 0;
  }

  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: #d1d4dc;
    font-family: 'Courier New', monospace;
    display: inline;
  }

  .stat-value.profit {
    color: #26a69a;
  }

  .stat-value.loss {
    color: #ef4444;
  }

  /* Responsive adjustments */
  @media (max-width: 1400px) {
    .strategy-panel {
      width: 100%;
      max-width: none;
    }
    
    .trading-controls {
      flex-direction: row;
    }
    
    .control-btn {
      flex: 1;
    }
  }
</style>