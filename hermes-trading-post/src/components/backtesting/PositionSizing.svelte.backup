<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let strategyParams: Record<string, any>;
  export let startBalance: number;
  
  const dispatch = createEventDispatcher();
  
  function updateParam(key: string, value: any) {
    dispatch('updateParam', { key, value });
  }
  
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
  
  $: positionSizes = calculatePositionSizes(startBalance);
  $: totalCommitted = positionSizes.reduce((sum, pos) => sum + pos.amount, 0);
  $: totalPercentage = (totalCommitted / startBalance) * 100;
</script>

<div class="position-sizing-section">
  <h3 class="text-accent">Position Sizing</h3>
  
  <div class="form-grid">
    <label class="form-label">
      Position Size Mode
      <select 
        class="select-base"
        bind:value={strategyParams['reverse-descending-grid'].positionSizeMode}
        on:change={() => updateParam('positionSizeMode', strategyParams['reverse-descending-grid'].positionSizeMode)}
      >
        <option value="percentage">Percentage of Balance</option>
        <option value="fixed">Fixed Dollar Amount</option>
      </select>
    </label>
    
    {#if strategyParams['reverse-descending-grid'].positionSizeMode === 'percentage'}
      <label class="form-label">
        Base Position Percentage
        <input 
          type="number" 
          class="input-base"
          bind:value={strategyParams['reverse-descending-grid'].basePositionPercent}
          min="1" 
          max="50" 
          step="0.1"
          on:input={() => updateParam('basePositionPercent', strategyParams['reverse-descending-grid'].basePositionPercent)}
        />
        <span class="input-hint">Percentage of balance for first position</span>
      </label>
    {:else}
      <label class="form-label">
        Base Position Amount ($)
        <input 
          type="number" 
          class="input-base"
          bind:value={strategyParams['reverse-descending-grid'].basePositionAmount}
          min="10" 
          step="10"
          on:input={() => updateParam('basePositionAmount', strategyParams['reverse-descending-grid'].basePositionAmount)}
        />
        <span class="input-hint">Fixed dollar amount for first position</span>
      </label>
    {/if}
    
    <label class="form-label">
      Ratio Multiplier
      <input 
        type="number" 
        class="input-base"
        bind:value={strategyParams['reverse-descending-grid'].ratioMultiplier}
        min="1" 
        max="5" 
        step="0.1"
        on:input={() => updateParam('ratioMultiplier', strategyParams['reverse-descending-grid'].ratioMultiplier)}
      />
      <span class="input-hint">How much to increase each level (1 = equal sizes)</span>
    </label>
    
    <label class="form-label">
      Max Levels
      <input 
        type="number" 
        class="input-base"
        bind:value={strategyParams['reverse-descending-grid'].maxLevels}
        min="1" 
        max="10" 
        step="1"
        on:input={() => updateParam('maxLevels', strategyParams['reverse-descending-grid'].maxLevels)}
      />
      <span class="input-hint">Maximum number of positions to open</span>
    </label>
  </div>
  
  <!-- Position Preview -->
  <div class="position-preview">
    <h4 class="text-secondary">Position Size Preview</h4>
    <div class="preview-grid">
      {#each positionSizes as pos}
        <div class="preview-item">
          <span class="level">Level {pos.level}:</span>
          <span class="amount">${pos.amount.toFixed(2)}</span>
          <span class="percentage">({pos.percentage.toFixed(1)}%)</span>
        </div>
      {/each}
    </div>
    <div class="preview-total" class:warning={totalPercentage > 80}>
      <strong>Total Committed: ${totalCommitted.toFixed(2)} ({totalPercentage.toFixed(1)}%)</strong>
    </div>
  </div>
</div>

<style>
  .position-sizing-section {
    padding: var(--space-lg);
    background: var(--surface-elevated);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-lg);
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
  }
  
  .form-label {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }
  
  .input-hint {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-style: italic;
  }
  
  .position-preview {
    background: var(--surface-panel);
    padding: var(--space-md);
    border-radius: var(--radius-md);
  }
  
  .preview-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin: var(--space-md) 0;
  }
  
  .preview-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Courier New', monospace;
    font-size: var(--font-size-sm);
  }
  
  .level {
    color: var(--text-secondary);
  }
  
  .amount {
    color: var(--text-accent);
    font-weight: var(--font-weight-medium);
  }
  
  .percentage {
    color: var(--text-muted);
  }
  
  .preview-total {
    padding-top: var(--space-md);
    border-top: 1px solid var(--border-primary);
    color: var(--text-primary);
    text-align: center;
  }
  
  .preview-total.warning {
    color: var(--color-warning);
  }
</style>