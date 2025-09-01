<script lang="ts">
  import StrategySelector from '../StrategySelector.svelte';
  import BalanceConfiguration from '../BalanceConfiguration.svelte';
  import FeeConfiguration from '../FeeConfiguration.svelte';
  
  export let selectedStrategyType: string;
  export let strategies: Array<any>;
  export let showSaveSuccess: boolean = false;
  export let startBalance: number;
  export let makerFeePercent: number;
  export let takerFeePercent: number;
  export let feeRebatePercent: number;
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  function handleStrategyEvent(event: CustomEvent) {
    dispatch(event.type, event.detail);
  }
</script>

<div class="config-tab">
  <div class="config-section">
    <StrategySelector 
      bind:selectedStrategyType
      {strategies}
      {showSaveSuccess}
      on:updateStrategy={handleStrategyEvent}
      on:saveCurrentStrategy={handleStrategyEvent}
      on:importStrategy={handleStrategyEvent}
      on:exportStrategy={handleStrategyEvent}
      on:editStrategy={handleStrategyEvent}
      on:deleteStrategy={handleStrategyEvent}
    />
  </div>
  
  <div class="config-section">
    <BalanceConfiguration bind:startBalance />
  </div>
  
  <div class="config-section">
    <FeeConfiguration 
      bind:makerFeePercent
      bind:takerFeePercent
      bind:feeRebatePercent
    />
  </div>
  
  <div class="strategy-params">
    <slot name="strategy-params" />
  </div>
</div>