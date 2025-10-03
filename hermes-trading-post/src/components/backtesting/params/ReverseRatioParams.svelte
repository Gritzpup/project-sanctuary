<script lang="ts">
  export let strategyParams: Record<string, any>;
  export let currentPrice: number = 0;
  export let startBalance: number;

  function calculatePositionSizes(balance: number = startBalance): Array<{level: number, amount: number, percentage: number}> {
    const params = strategyParams['reverse-descending-grid'];
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
</script>

<!-- Position Sizing Section -->
<div class="param-group">
  <h4 class="param-group-title">Position Sizing</h4>
  
  <div class="config-section">
    <label>
      Position Size Mode
      <select bind:value={strategyParams['reverse-descending-grid'].positionSizeMode}>
        <option value="percentage">Percentage of Balance</option>
        <option value="fixed">Fixed Dollar Amount</option>
      </select>
    </label>
  </div>
  
  {#if strategyParams['reverse-descending-grid'].positionSizeMode === 'percentage'}
    <div class="config-section">
      <label>
        Base Position Size (%)
        <input type="number" bind:value={strategyParams['reverse-descending-grid'].basePositionPercent} min="1" max="95" step="1" />
        <span class="input-hint">Percentage of balance for first buy level</span>
        {#if strategyParams['reverse-descending-grid'].basePositionPercent >= 80}
          <span class="position-size-warning">⚠️ HIGH RISK: Using {strategyParams['reverse-descending-grid'].basePositionPercent}% of capital!</span>
        {/if}
      </label>
    </div>
  {:else}
    <div class="config-section">
      <label>
        Base Position Amount ($)
        <input type="number" bind:value={strategyParams['reverse-descending-grid'].basePositionAmount} min="10" max="1000" step="10" />
        <span class="input-hint">Dollar amount for first buy level</span>
      </label>
    </div>
  {/if}
  
  <div class="config-section">
    <label>
      Ratio Multiplier
      <input type="number" bind:value={strategyParams['reverse-descending-grid'].ratioMultiplier} min="1" max="5" step="0.25" />
      <span class="input-hint">How much to increase position size per level</span>
    </label>
  </div>
  
  <div class="config-section">
    <label>
      Max Total Position (%)
      <input type="number" bind:value={strategyParams['reverse-descending-grid'].maxPositionPercent} min="10" max="100" step="5" />
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
      <input type="number" bind:value={strategyParams['reverse-descending-grid'].initialDropPercent} min="0.01" max="10" step="0.01" />
      <span class="input-hint">Price drop from recent high to trigger first buy</span>
      {#if currentPrice > 0}
        <span class="price-preview">
          At current price ${currentPrice.toFixed(2)}, this means buying at ${(currentPrice * (1 - strategyParams['reverse-descending-grid'].initialDropPercent / 100)).toFixed(2)}
        </span>
      {/if}
    </label>
  </div>
  
  <div class="config-section">
    <label>
      Level Drop (%)
      <input type="number" bind:value={strategyParams['reverse-descending-grid'].levelDropPercent} min="0.01" max="10" step="0.01" />
      <span class="input-hint">Additional drop between each buy level</span>
    </label>
  </div>
  
  <div class="config-section">
    <label>
      Max Levels
      <input type="number" bind:value={strategyParams['reverse-descending-grid'].maxLevels} min="3" max="30" step="1" />
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
      <input type="number" bind:value={strategyParams['reverse-descending-grid'].profitTarget} min="0.1" max="20" step="0.05" />
      <span class="input-hint">Sell all positions when first entry reaches this profit</span>
      {#if currentPrice > 0 && strategyParams['reverse-descending-grid'].initialDropPercent > 0}
        <span class="price-preview">
          Sell target: ${(currentPrice * (1 - strategyParams['reverse-descending-grid'].initialDropPercent / 100) * (1 + strategyParams['reverse-descending-grid'].profitTarget / 100)).toFixed(2)}
        </span>
      {/if}
    </label>
  </div>
</div>

<style>
  .param-group {
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(74, 0, 224, 0.2);
  }
  
  .param-group:last-child {
    border-bottom: none;
  }
  
  .param-group-title {
    margin: 0 0 15px 0;
    color: #a78bfa;
    font-size: 16px;
    font-weight: 600;
  }
  
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
  
  input[type="number"],
  select {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 10px 12px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  input[type="number"]:focus,
  select:focus {
    outline: none;
    border-color: rgba(74, 0, 224, 0.6);
    background: rgba(255, 255, 255, 0.08);
  }
  
  .input-hint {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
  
  .price-preview {
    font-size: 12px;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.1);
    padding: 5px 10px;
    border-radius: 4px;
    margin-top: 5px;
  }
  
  .position-size-warning {
    color: #ffa726;
    font-size: 12px;
    font-weight: 600;
  }
  
  .position-preview {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(74, 0, 224, 0.2);
    border-radius: 8px;
    padding: 15px;
    margin-top: 15px;
  }
  
  .position-preview h5 {
    margin: 0 0 10px 0;
    color: #a78bfa;
    font-size: 14px;
  }
  
  .preview-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .preview-row {
    display: flex;
    align-items: center;
    font-size: 13px;
  }
  
  .preview-row.total {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(74, 0, 224, 0.2);
    font-weight: 600;
  }
  
  .preview-level {
    flex: 0 0 80px;
    color: #888;
  }
  
  .preview-amount {
    flex: 0 0 100px;
    color: #d1d4dc;
    text-align: right;
  }
  
  .preview-percent {
    flex: 0 0 80px;
    color: #888;
    text-align: right;
  }
</style>