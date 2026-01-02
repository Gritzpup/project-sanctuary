<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { StrategyCode } from './BacktestingControlsTypes';
  
  export let strategies: Array<any>;
  export let selectedStrategyType: string;
  
  const dispatch = createEventDispatcher();
  
  let strategySourceCode = '';
  let showStrategyEditor = false;
  let newStrategyName = '';
  let newStrategyLabel = '';
  let newStrategyDescription = '';
  let newStrategyCode = '';
  let editingStrategy: string | null = null;

  function createNewStrategy() {
    showStrategyEditor = true;
    editingStrategy = null;
    newStrategyName = '';
    newStrategyLabel = '';
    newStrategyDescription = '';
    newStrategyCode = '';
  }

  function editStrategy(strategyValue: string) {
    const strategy = strategies.find(s => s.value === strategyValue);
    if (strategy) {
      showStrategyEditor = true;
      editingStrategy = strategyValue;
      newStrategyName = strategy.value;
      newStrategyLabel = strategy.label;
      newStrategyDescription = strategy.description;
      newStrategyCode = strategy.code || '';
    }
  }

  function saveStrategy() {
    const strategyData: StrategyCode = {
      name: newStrategyName,
      label: newStrategyLabel,
      description: newStrategyDescription,
      code: newStrategyCode
    };
    
    if (editingStrategy) {
      dispatch('updateStrategy', { strategy: strategyData, originalName: editingStrategy });
    } else {
      dispatch('createStrategy', { strategy: strategyData });
    }
    
    showStrategyEditor = false;
    resetEditor();
  }

  function deleteStrategy(strategyValue: string) {
    if (confirm(`Are you sure you want to delete the strategy "${strategyValue}"?`)) {
      dispatch('deleteStrategy', { strategyValue });
    }
  }

  function resetEditor() {
    newStrategyName = '';
    newStrategyLabel = '';
    newStrategyDescription = '';
    newStrategyCode = '';
    editingStrategy = null;
  }

  function closeEditor() {
    showStrategyEditor = false;
    resetEditor();
  }

  function loadStrategyCode() {
    const strategy = strategies.find(s => s.value === selectedStrategyType);
    if (strategy) {
      strategySourceCode = strategy.code || '// No source code available for this strategy';
    }
  }

  // Load code when strategy changes
  $: if (selectedStrategyType) {
    loadStrategyCode();
  }
</script>

<div class="code-section">
  <div class="code-header">
    <h4>Strategy Source Code</h4>
    <div class="code-actions">
      <button class="btn-base btn-sm" onclick={createNewStrategy}>
        Create New Strategy
      </button>
      <button class="btn-base btn-sm" onclick={() => editStrategy(selectedStrategyType)}>
        Edit Current Strategy
      </button>
    </div>
  </div>

  <!-- Strategy Code Display -->
  <div class="code-display">
    <pre><code>{strategySourceCode}</code></pre>
  </div>

  <!-- Custom Strategies List -->
  {#if strategies.filter(s => s.isCustom).length > 0}
    <div class="custom-strategies">
      <h4>Custom Strategies</h4>
      {#each strategies.filter(s => s.isCustom) as strategy}
        <div class="strategy-item">
          <div class="strategy-info">
            <strong>{strategy.label}</strong>
            <span class="strategy-description">{strategy.description}</span>
          </div>
          <div class="strategy-actions">
            <button class="btn-base btn-xs" onclick={() => editStrategy(strategy.value)}>
              Edit
            </button>
            <button class="btn-base btn-xs btn-danger" onclick={() => deleteStrategy(strategy.value)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Strategy Editor Modal -->
{#if showStrategyEditor}
  <div class="strategy-editor-overlay" onclick={closeEditor} role="button" tabindex="0" aria-label="Close dialog" onkeydown={(e) => e.key === 'Enter' && closeEditor()}>
    <div class="strategy-editor-modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-labelledby="strategy-editor-title" aria-modal="true" tabindex="-1">
      <div class="modal-header">
        <h3 id="strategy-editor-title">
          {editingStrategy ? 'Edit Strategy' : 'Create New Strategy'}
        </h3>
        <button class="btn-base btn-sm" onclick={closeEditor}>✕</button>
      </div>

      <div class="modal-content">
        <div class="form-group">
          <label for="strategy-name">Strategy Name (unique identifier):</label>
          <input 
            id="strategy-name"
            class="input-base"
            type="text"
            bind:value={newStrategyName}
            placeholder="e.g., my-custom-strategy"
          />
        </div>

        <div class="form-group">
          <label for="strategy-label">Display Label:</label>
          <input 
            id="strategy-label"
            class="input-base"
            type="text"
            bind:value={newStrategyLabel}
            placeholder="e.g., My Custom Strategy"
          />
        </div>

        <div class="form-group">
          <label for="strategy-description">Description:</label>
          <input 
            id="strategy-description"
            class="input-base"
            type="text"
            bind:value={newStrategyDescription}
            placeholder="Brief description of the strategy"
          />
        </div>

        <div class="form-group">
          <label for="strategy-code">Strategy Code:</label>
          <textarea 
            id="strategy-code"
            class="textarea-base code-editor"
            bind:value={newStrategyCode}
            placeholder="Enter your strategy code here..."
            rows="20"
          ></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-base btn-secondary" onclick={closeEditor}>
          Cancel
        </button>
        <button
          class="btn-base btn-primary"
          onclick={saveStrategy}
          disabled={!newStrategyName || !newStrategyLabel || !newStrategyCode}
        >
          {editingStrategy ? 'Update Strategy' : 'Create Strategy'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .code-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm);
  }

  .code-header h4 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .code-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .code-display {
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    background: var(--surface-elevated);
    overflow: auto;
    max-height: 400px;
  }

  .code-display pre {
    margin: 0;
    padding: var(--space-md);
    white-space: pre-wrap;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--font-size-xs);
    line-height: 1.4;
    color: var(--text-secondary);
  }

  .custom-strategies {
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: var(--space-md);
    background: var(--surface-elevated);
  }

  .custom-strategies h4 {
    margin: 0 0 var(--space-sm) 0;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .strategy-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm);
    border: 1px solid var(--border-secondary);
    border-radius: 4px;
    margin-bottom: var(--space-xs);
  }

  .strategy-item:last-child {
    margin-bottom: 0;
  }

  .strategy-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .strategy-description {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .strategy-actions {
    display: flex;
    gap: var(--space-xs);
  }

  /* Modal Styles */
  .strategy-editor-overlay {
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
    padding: var(--space-md);
  }

  .strategy-editor-modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border-primary);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .modal-content {
    padding: var(--space-md);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md);
    border-top: 1px solid var(--border-primary);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
  }

  .code-editor {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: var(--font-size-xs);
    line-height: 1.4;
    resize: vertical;
  }

  .btn-danger {
    background: var(--error-bg);
    color: var(--error-text);
    border-color: var(--error-border);
  }

  .btn-danger:hover {
    background: var(--error-bg-hover);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .code-header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .code-actions {
      justify-content: stretch;
    }
    
    .strategy-item {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-sm);
    }
    
    .strategy-actions {
      justify-content: stretch;
    }
    
    .strategy-editor-overlay {
      padding: var(--space-xs);
    }
    
    .modal-actions {
      flex-direction: column;
    }
  }
</style>