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
    margin-bottom: var(--space-xxl);
    padding-bottom: var(--space-xl);
    border-bottom: 1px solid var(--border-primary);
  }
  
  .param-group:last-child {
    border-bottom: none;
  }
  
  .param-group-title {
    margin: 0 0 var(--space-md) 0;
    color: var(--color-primary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
  }
  
  .config-section {
    margin-bottom: var(--space-xl);
  }
  
  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
  }
  
  input[type="number"],
  select {
    background: var(--bg-surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: var(--space-sm) var(--space-md);
    font-size: var(--font-size-sm);
    transition: all var(--transition-normal);
  }
  
  input[type="number"]:focus,
  select:focus {
    outline: none;
    border-color: var(--border-primary-hover);
    background: var(--bg-primary);
  }
  
  .input-hint {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .price-preview {
    font-size: var(--font-size-xs);
    color: var(--color-primary);
    background: var(--bg-primary-active);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    margin-top: var(--space-xs);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }
  
  .position-size-warning {
    color: var(--color-warning);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
  }
  
  .position-preview {
    background: var(--bg-surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    margin-top: var(--space-md);
  }
  
  .position-preview h5 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--color-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
  }
  
  .preview-table {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .preview-row {
    display: flex;
    align-items: center;
    font-size: var(--font-size-xs);
    font-family: var(--font-family-mono, 'Courier New', monospace);
  }
  
  .preview-row.total {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border-primary);
    font-weight: var(--font-weight-semibold);
  }
  
  .preview-level {
    flex: 0 0 80px;
    color: var(--text-secondary);
  }
  
  .preview-amount {
    flex: 0 0 100px;
    color: var(--text-primary);
    text-align: right;
  }
  
  .preview-percent {
    flex: 0 0 80px;
    color: var(--text-secondary);
    text-align: right;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .param-group {
      margin-bottom: var(--space-xl);
      padding-bottom: var(--space-lg);
    }
    
    .config-section {
      margin-bottom: var(--space-lg);
    }
    
    .preview-level {
      flex: 0 0 70px;
    }
    
    .preview-amount {
      flex: 0 0 90px;
    }
    
    .preview-percent {
      flex: 0 0 70px;
    }
  }
</style>