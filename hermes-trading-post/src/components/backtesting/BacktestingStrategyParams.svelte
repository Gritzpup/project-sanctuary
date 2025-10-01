<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PresetManager from './params/PresetManager.svelte';
  import ReverseRatioParams from './params/ReverseRatioParams.svelte';
  import VaultConfig from './params/VaultConfig.svelte';
  import GenericStrategyParams from './params/GenericStrategyParams.svelte';
  
  export let selectedStrategyType: string;
  export let strategyParams: Record<string, any>;
  export let currentPrice: number = 0;
  export let startBalance: number;
  export let customPresets: Array<any>;
  export let selectedPresetIndex: number;
  
  const dispatch = createEventDispatcher();
  
  function handlePresetEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }
</script>

{#if selectedStrategyType === 'reverse-ratio'}
  <PresetManager 
    {customPresets} 
    {selectedPresetIndex}
    on:applyPreset={handlePresetEvent}
    on:updatePresetName={handlePresetEvent}
    on:addNewPreset={handlePresetEvent}
    on:deletePreset={handlePresetEvent}
    on:saveCurrentAsPreset={handlePresetEvent}
  />
  
  <ReverseRatioParams 
    {strategyParams} 
    {currentPrice} 
    {startBalance} 
  />
  
  <VaultConfig {strategyParams} />
{:else}
  <GenericStrategyParams {selectedStrategyType} {strategyParams} />
{/if}