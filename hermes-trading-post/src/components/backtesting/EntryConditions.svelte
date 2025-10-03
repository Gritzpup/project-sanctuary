<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let strategyParams: Record<string, any>;
  
  const dispatch = createEventDispatcher();
  
  function updateParam(key: string, value: any) {
    dispatch('updateParam', { key, value });
  }
</script>

<div class="entry-conditions-section">
  <h3 class="text-accent">Entry Conditions</h3>
  
  <div class="form-grid">
    <label class="form-label">
      Initial Drop Percentage (%)
      <input 
        type="number" 
        class="input-base"
        bind:value={strategyParams['reverse-descending-grid'].initialDropPercent}
        min="0.1" 
        max="20" 
        step="0.1"
        on:input={() => updateParam('initialDropPercent', strategyParams['reverse-descending-grid'].initialDropPercent)}
      />
      <span class="input-hint">Percentage drop to trigger first buy</span>
    </label>
    
    <label class="form-label">
      Additional Drop Percentage (%)
      <input 
        type="number" 
        class="input-base"
        bind:value={strategyParams['reverse-descending-grid'].additionalDropPercent}
        min="0.1" 
        max="10" 
        step="0.1"
        on:input={() => updateParam('additionalDropPercent', strategyParams['reverse-descending-grid'].additionalDropPercent)}
      />
      <span class="input-hint">Additional drop for each subsequent level</span>
    </label>
    
    <label class="form-label">
      Minimum Time Between Buys (minutes)
      <input 
        type="number" 
        class="input-base"
        bind:value={strategyParams['reverse-descending-grid'].minTimeBetweenBuys}
        min="1" 
        max="1440" 
        step="1"
        on:input={() => updateParam('minTimeBetweenBuys', strategyParams['reverse-descending-grid'].minTimeBetweenBuys)}
      />
      <span class="input-hint">Cooldown period between purchases</span>
    </label>
    
    <label class="form-label">
      Stop Loss Percentage (%)
      <input 
        type="number" 
        class="input-base"
        bind:value={strategyParams['reverse-descending-grid'].stopLossPercent}
        min="0" 
        max="50" 
        step="1"
        on:input={() => updateParam('stopLossPercent', strategyParams['reverse-descending-grid'].stopLossPercent)}
      />
      <span class="input-hint">Set to 0 to disable stop loss</span>
    </label>
  </div>
</div>

<style>
  .entry-conditions-section {
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
</style>