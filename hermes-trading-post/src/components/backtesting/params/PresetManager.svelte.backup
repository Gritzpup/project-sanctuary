<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let customPresets: Array<any>;
  export let selectedPresetIndex: number;

  const dispatch = createEventDispatcher();

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
</script>

<div class="preset-management">
  <div class="preset-controls">
    <label class="preset-select-label">
      Quick Presets
      <select 
        bind:value={selectedPresetIndex}
        on:change={() => {
          applyPreset(selectedPresetIndex);
        }}
        class="preset-dropdown"
      >
        {#each customPresets as preset, index}
          <option value={index}>
            {preset.name} ({preset.initialDropPercent}% → {preset.profitTarget}%)
          </option>
        {/each}
      </select>
    </label>
  </div>
</div>

<style>
  .preset-management {
    margin-bottom: 20px;
  }
  
  .preset-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .preset-select-label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #d1d4dc;
  }
  
  .preset-dropdown {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(74, 0, 224, 0.3);
    border-radius: 6px;
    color: #d1d4dc;
    padding: 8px 12px;
    font-size: 13px;
  }
</style>