<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let customPresets: Array<any>;
  export let selectedPresetIndex: number;
  
  const dispatch = createEventDispatcher();
  
  let isEditingPresets = false;
  let editingPresetName = '';
  
  function applyPreset(index: number) {
    dispatch('applyPreset', { index });
  }
  
  function updatePresetName(index: number, newName: string) {
    dispatch('updatePresetName', { index, newName });
  }
  
  function addNewPreset() {
    dispatch('addNewPreset');
  }
  
  function deletePreset(index: number) {
    dispatch('deletePreset', { index });
  }
  
  function saveCurrentAsPreset(index: number) {
    dispatch('saveCurrentAsPreset', { index });
  }
  
  function startEditingPreset(index: number, currentName: string) {
    isEditingPresets = true;
    editingPresetName = currentName;
  }
  
  function finishEditingPreset(index: number) {
    if (editingPresetName.trim()) {
      updatePresetName(index, editingPresetName.trim());
    }
    isEditingPresets = false;
    editingPresetName = '';
  }
</script>

<div class="preset-manager">
  <h3 class="text-accent">Configuration Presets</h3>
  
  <div class="preset-actions">
    <button class="btn-base btn-sm btn-secondary" on:click={addNewPreset}>
      + New Preset
    </button>
    <button class="btn-base btn-sm" on:click={() => isEditingPresets = !isEditingPresets}>
      {isEditingPresets ? 'Done Editing' : 'Edit Presets'}
    </button>
  </div>
  
  <div class="preset-grid">
    {#each customPresets as preset, index}
      <div class="preset-item" class:active={selectedPresetIndex === index}>
        <div class="preset-header">
          {#if isEditingPresets}
            <input 
              type="text" 
              class="input-base preset-name-input"
              bind:value={preset.name}
              on:blur={() => finishEditingPreset(index)}
              on:keydown={(e) => e.key === 'Enter' && finishEditingPreset(index)}
            />
          {:else}
            <span class="preset-name">{preset.name}</span>
          {/if}
          
          <div class="preset-actions">
            {#if !isEditingPresets}
              <button 
                class="btn-base btn-xs btn-success"
                on:click={() => applyPreset(index)}
              >
                Apply
              </button>
              <button 
                class="btn-base btn-xs"
                on:click={() => saveCurrentAsPreset(index)}
              >
                Save Current
              </button>
            {:else}
              <button 
                class="btn-base btn-xs btn-error"
                on:click={() => deletePreset(index)}
              >
                Delete
              </button>
            {/if}
          </div>
        </div>
        
        {#if preset.description}
          <div class="preset-description">
            {preset.description}
          </div>
        {/if}
        
        <div class="preset-summary">
          <span class="summary-item">Drop: {preset.params?.initialDropPercent || 0}%</span>
          <span class="summary-item">Levels: {preset.params?.maxLevels || 0}</span>
          <span class="summary-item">Size: {preset.params?.basePositionPercent || preset.params?.basePositionAmount || 0}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .preset-manager {
    padding: var(--space-lg);
    background: var(--surface-elevated);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-lg);
  }
  
  .preset-actions {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
  }
  
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-md);
  }
  
  .preset-item {
    padding: var(--space-md);
    background: var(--surface-panel);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    transition: all var(--transition-normal);
  }
  
  .preset-item.active {
    border-color: var(--color-primary);
    background: var(--bg-primary-subtle);
  }
  
  .preset-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
  }
  
  .preset-name {
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .preset-name-input {
    font-size: var(--font-size-sm);
    padding: var(--space-xs);
  }
  
  .preset-actions {
    display: flex;
    gap: var(--space-xs);
  }
  
  .preset-description {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-bottom: var(--space-sm);
    font-style: italic;
  }
  
  .preset-summary {
    display: flex;
    gap: var(--space-md);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
  
  .summary-item {
    font-family: 'Courier New', monospace;
  }
</style>