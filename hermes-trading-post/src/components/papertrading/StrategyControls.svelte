<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let selectedStrategyType: string = 'reverse-ratio';
  export let strategies: any[] = [];
  export let isRunning: boolean = false;
  export let isPaused: boolean = false;
  export let balance: number = 10000;
  export let btcBalance: number = 0;
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
  
  // Calculate derived stats
  $: growth = balance - startingBalance;
  $: growthPercent = ((balance - startingBalance) / startingBalance * 100);
  $: totalValue = balance + (btcBalance * currentPrice);
  $: totalPL = totalValue - startingBalance;
  $: netFeesAfterRebase = totalFees - totalRebates;
  $: btcVaultValue = btcBalance * currentPrice;
  $: currentOpenPosition = positions.length > 0 ? positions[0].size || 0 : 0;
  
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
  
  function getBotStatus(bot: any): 'idle' | 'running' | 'paused' | 'empty' {
    if (!bot) return 'empty';
    // For Bot 1 (reverse-ratio bot), use the backend status
    if (bot.name === 'Bot 1' || bot.id === 'reverse-ratio-bot-1') {
      return isRunning ? (isPaused ? 'paused' : 'running') : 'idle';
    }
    return bot.status || 'idle';
  }
  
  function getStatusColor(status: string): string {
    switch (status) {
      case 'running': return '#22c55e';
      case 'paused': return '#f59e0b';
      default: return '#6b7280'; // Gray for idle/empty/default
    }
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
        {#each Array(6) as _, i}
          {@const botIndex = i + 1}
          {@const bot = botTabs.find(b => b.name === `Bot ${botIndex}`) || { id: `bot-${botIndex}`, name: `Bot ${botIndex}`, status: 'empty' }}
          {@const status = getBotStatus(bot)}
          {@const isActive = activeBotInstance ? (bot.id === activeBotInstance.id) : (botIndex === 1)}
          <button 
            class="bot-status-btn-compact"
            class:active={isActive}
            class:running={status === 'running'}
            class:paused={status === 'paused'}
            on:click={() => selectBot(bot.id)}
            title="{bot.name} - {status}"
          >
            <span class="bot-number-compact">{botIndex}</span>
            <div 
              class="status-light-compact" 
              style="background-color: {getStatusColor(status)}"
            ></div>
          </button>
        {/each}
      </div>
    </div>
    
    <!-- Stats Panel -->
    <div class="control-group">
      <label>Trading Stats</label>
      <div class="stats-panel">
        <div class="stats-grid">
          <div class="stat-item">BTC: <span class="stat-value">{btcBalance.toFixed(6)}</span></div>
          <div class="stat-item">Start: <span class="stat-value">${startingBalance.toLocaleString()}</span></div>
          <div class="stat-item">USDC: <span class="stat-value">${balance.toLocaleString()}</span></div>
          <div class="stat-item">Growth: <span class="stat-value" class:profit={growth > 0} class:loss={growth < 0}>{growth > 0 ? '+' : ''}${growth.toLocaleString()}</span></div>
          <div class="stat-item">BTC Val: <span class="stat-value">${btcVaultValue.toLocaleString()}</span></div>
          <div class="stat-item">Fees: <span class="stat-value">${totalFees.toFixed(2)}</span></div>
          <div class="stat-item">Trades: <span class="stat-value">{totalTrades}</span></div>
          <div class="stat-item">Net Fees: <span class="stat-value">${netFeesAfterRebase.toFixed(2)}</span></div>
          <div class="stat-item">Return: <span class="stat-value" class:profit={growthPercent > 0} class:loss={growthPercent < 0}>{growthPercent > 0 ? '+' : ''}{growthPercent.toFixed(1)}%</span></div>
          <div class="stat-item">Total: <span class="stat-value">${totalValue.toLocaleString()}</span></div>
          <div class="stat-item">Open: <span class="stat-value">{currentOpenPosition.toFixed(6)}</span></div>
          <div class="stat-item">P/L: <span class="stat-value" class:profit={totalPL > 0} class:loss={totalPL < 0}>{totalPL > 0 ? '+' : ''}${totalPL.toLocaleString()}</span></div>
        </div>
      </div>
    </div>
    
    <!-- Editable Balance -->
    <div class="control-group">
      <label>USD Balance</label>
      <input 
        type="number" 
        class="balance-input"
        bind:value={balance}
        min="0"
        step="100"
        placeholder="Enter starting balance..."
        on:change={() => dispatch('balanceChange', { balance })}
      />
    </div>
    
    <!-- BTC Balance -->
    {#if btcBalance > 0}
      <div class="control-group">
        <label>BTC Balance</label>
        <div class="btc-balance">
          {btcBalance.toFixed(8)} BTC
        </div>
      </div>
    {/if}
    
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
    gap: 20px;
    flex: 1;
    height: 100%;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }

  .control-group label {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
  }

  select {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    font-size: 14px;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    justify-content: space-between;
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

  .start-btn {
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
    gap: 4px;
    margin-top: 8px;
  }

  .bot-status-btn-compact {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 3px;
    color: #9ca3af;
    cursor: pointer;
    font-size: 9px;
    font-weight: 500;
    transition: all 0.2s ease;
    min-height: 20px;
    flex: 1;
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
    flex: 1;
    text-align: center;
    font-size: 8px;
  }

  .status-light-compact {
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
    padding: 2px 3px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0px 2px;
    margin: 0;
  }

  .stat-item {
    font-size: 12px;
    line-height: 1;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    margin: 0;
    padding: 0;
  }

  .stat-value {
    font-size: 12px;
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