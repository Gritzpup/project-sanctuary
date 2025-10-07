<script lang="ts">
  export let selectedStrategyType: string;
  export let strategyParams: Record<string, any>;
</script>

{#if selectedStrategyType === 'grid-trading'}
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
      <input type="number" bind:value={strategyParams['rsi-mean-reversion'].oversoldLevel} min="10" max="40" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Overbought Level
      <input type="number" bind:value={strategyParams['rsi-mean-reversion'].overboughtLevel} min="60" max="90" step="5" />
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
      Interval (Hours)
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
      Drop Threshold (%)
      <input type="number" bind:value={strategyParams['dca'].dropThreshold} min="1" max="20" step="1" />
      <span class="input-hint">Extra buy when price drops this %</span>
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
      Buy Deviation
      <input type="number" bind:value={strategyParams['vwap-bounce'].deviationBuy} min="1" max="5" step="0.5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Sell Deviation
      <input type="number" bind:value={strategyParams['vwap-bounce'].deviationSell} min="1" max="5" step="0.5" />
    </label>
  </div>
{:else if selectedStrategyType === 'micro-scalping'}
  <div class="config-section">
    <label>
      Initial Drop (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].initialDropPercent} min="0.1" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Level Drop (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].levelDropPercent} min="0.1" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Ratio Multiplier
      <input type="number" bind:value={strategyParams['micro-scalping'].ratioMultiplier} min="1" max="3" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Profit Target (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].profitTarget} min="0.5" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Max Levels
      <input type="number" bind:value={strategyParams['micro-scalping'].maxLevels} min="2" max="10" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Lookback Period
      <input type="number" bind:value={strategyParams['micro-scalping'].lookbackPeriod} min="5" max="50" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Base Position (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].basePositionPercent} min="5" max="50" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Max Position (%)
      <input type="number" bind:value={strategyParams['micro-scalping'].maxPositionPercent} min="50" max="100" step="5" />
    </label>
  </div>
{:else if selectedStrategyType === 'proper-scalping'}
  <div class="config-section">
    <label>
      Position Size (%)
      <input type="number" bind:value={strategyParams['proper-scalping'].positionSize} min="1" max="20" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Max Open Positions
      <input type="number" bind:value={strategyParams['proper-scalping'].maxOpenPositions} min="1" max="10" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      RSI Period
      <input type="number" bind:value={strategyParams['proper-scalping'].rsiPeriod} min="5" max="20" step="1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      RSI Overbought
      <input type="number" bind:value={strategyParams['proper-scalping'].rsiOverbought} min="60" max="90" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      RSI Oversold
      <input type="number" bind:value={strategyParams['proper-scalping'].rsiOversold} min="10" max="40" step="5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Stop Loss (%)
      <input type="number" bind:value={strategyParams['proper-scalping'].stopLoss} min="0.1" max="5" step="0.1" />
    </label>
  </div>
  <div class="config-section">
    <label>
      Profit Target (%)
      <input type="number" bind:value={strategyParams['proper-scalping'].profitTarget} min="0.5" max="10" step="0.5" />
    </label>
  </div>
  <div class="config-section">
    <label>
      <input type="checkbox" bind:checked={strategyParams['proper-scalping'].trailingStop} />
      Use Trailing Stop
    </label>
  </div>
  {#if strategyParams['proper-scalping'].trailingStop}
    <div class="config-section">
      <label>
        Trailing Stop (%)
        <input type="number" bind:value={strategyParams['proper-scalping'].trailingStopPercent} min="0.1" max="2" step="0.1" />
      </label>
    </div>
  {/if}
{/if}

<style>
  .config-section {
    margin-bottom: 20px;
  }
  
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  input[type="number"] {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px 12px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  input[type="number"]:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.6);
    background: rgba(255, 255, 255, 0.08);
  }
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  
  .input-hint {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
</style>