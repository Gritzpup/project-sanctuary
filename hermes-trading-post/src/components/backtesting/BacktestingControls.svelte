<script lang="ts">
  import BacktestingControlsContainer from './controls/BacktestingControlsContainer.svelte';
  
  export let selectedStrategyType: string;
  export let strategies: Array<any>;
  export let strategyParams: Record<string, any>;
  export let startBalance: number;
  export let makerFeePercent: number;
  export let takerFeePercent: number;
  export let feeRebatePercent: number;
  export let isSynced: boolean;
  export let paperTradingActive: boolean;
  export let isRunning: boolean;
  export let currentPrice: number = 0;
  export let customPresets: Array<any> = [];
  export let selectedPresetIndex: number = 0;
  export let showSaveSuccess: boolean = false;
  export let showSyncSuccess: boolean = false;
</script>

<BacktestingControlsContainer
  {selectedStrategyType}
  {strategies}
  {strategyParams}
  {startBalance}
  {makerFeePercent}
  {takerFeePercent}
  {feeRebatePercent}
  {isSynced}
  {paperTradingActive}
  {isRunning}
  {currentPrice}
  {customPresets}
  {selectedPresetIndex}
  {showSaveSuccess}
  {showSyncSuccess}
  on:syncToPaperTrading
  on:runBacktest
  on:updateStrategy
  on:strategyChange
  on:parameterChange
  on:balanceChange
  on:feeChange
  on:saveAsPreset
  on:loadPreset
  on:deletePreset
  on:createStrategy
  on:deleteStrategy
  on:saveBackup
  on:loadBackup
  on:deleteBackup
  on:updateBackup
  on:importBackup
  on:loadBackups
/>