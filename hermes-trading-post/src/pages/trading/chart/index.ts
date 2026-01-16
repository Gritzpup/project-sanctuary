// Main components
export { default as Chart } from './Chart.svelte';
export { default as ChartContainer } from './ChartContainer.svelte';

// Core components
export { default as ChartCore } from './core/ChartCore.svelte';
export { default as ChartPanes } from './core/ChartPanes.svelte';

// UI Components
export { default as ChartCanvas } from './components/canvas/ChartCanvas.svelte';
export { default as ChartControls } from './components/controls/ChartControls.svelte';
export { default as ChartStatus } from './components/status/ChartStatus.svelte';
export { default as ChartInfo } from './components/overlays/ChartInfo.svelte';
export { default as ChartError } from './components/overlays/ChartError.svelte';
export { default as ChartDebug } from './components/overlays/ChartDebug.svelte';

// Stores
export { chartStore } from './stores/chartStore.svelte';
export { dataStore } from './stores/dataStore.svelte';
export { statusStore } from './stores/statusStore.svelte';
export { performanceStore } from './stores/performanceStore.svelte';

// Services
export { ChartDataService } from './services/ChartDataService';
export { ChartAPIService } from './services/ChartAPIService';
export { ChartCacheService } from './services/ChartCacheService';
export { ChartStateService } from './services/ChartStateService';

// Hooks
export { useChart } from './hooks/useChart.svelte';
export { useDataFeed } from './hooks/useDataFeed.svelte';
export { useIndicators } from './hooks/useIndicators.svelte';

// Plugins
export * from './plugins';

// Utilities
export * from './utils/chartHelpers';
export * from './utils/constants';
export { RealtimeCandleAggregator } from './utils/RealtimeCandleAggregator';

// Types
export * from './types/chart.types';
export * from './types/data.types';
// Note: plugin.types exports are already included via ./plugins