# Modular Chart Architecture

This is a modern, modular implementation of the trading chart component using Svelte 5 and TradingView Lightweight Charts.

## Architecture Overview

```
chart/
├── Chart.svelte                 # Main orchestrator component
├── services/                    # Business logic layer
│   ├── ChartDataService.ts      # Data fetching and caching
│   ├── ChartAPIService.ts       # API and WebSocket handling
│   ├── ChartCacheService.ts     # Intelligent caching
│   └── ChartStateService.ts     # State management
├── stores/                      # Svelte 5 reactive stores
│   ├── chartStore.svelte.ts     # Chart configuration and instance
│   ├── dataStore.svelte.ts      # Candle data management
│   ├── statusStore.svelte.ts    # Status and notifications
│   └── performanceStore.svelte.ts # Performance monitoring
├── types/                       # TypeScript definitions
│   ├── chart.types.ts
│   ├── data.types.ts
│   └── plugin.types.ts
└── utils/                       # Helper utilities
    └── RealtimeCandleAggregator.ts
```

## Usage

### Basic Usage

```svelte
<script>
  import Chart from '$lib/trading/chart/Chart.svelte';
</script>

<Chart 
  pair="BTC-USD" 
  onGranularityChange={(granularity) => console.log('New granularity:', granularity)}
/>
```

### With Custom Controls

```svelte
<script>
  import Chart from '$lib/trading/chart/Chart.svelte';
  import { chartStore } from '$lib/trading/chart/stores/chartStore.svelte.ts';
  
  // Change timeframe
  function changeTimeframe(tf) {
    chartStore.setTimeframe(tf);
  }
  
  // Change granularity
  function changeGranularity(g) {
    chartStore.setGranularity(g);
  }
</script>

<div class="controls">
  <button onclick={() => changeTimeframe('1H')}>1H</button>
  <button onclick={() => changeTimeframe('1D')}>1D</button>
  <button onclick={() => changeGranularity('1m')}>1m</button>
  <button onclick={() => changeGranularity('5m')}>5m</button>
</div>

<Chart pair="BTC-USD" />
```

### Accessing Chart Data

```javascript
import { dataStore } from '$lib/trading/chart/stores/dataStore.svelte.ts';

// Get current candles
const candles = dataStore.candles;

// Get latest price
const price = dataStore.latestPrice;

// Get statistics
const stats = dataStore.stats;
```

### Monitoring Performance

```javascript
import { performanceStore } from '$lib/trading/chart/stores/performanceStore.svelte.ts';

// Start monitoring
performanceStore.startMonitoring();

// Get performance stats
const { fps, renderTime, cacheHitRate } = performanceStore.stats;

// Get performance issues
const issues = performanceStore.summary.issues;
```

## Migration from Old Chart.svelte

### Before (Monolithic)
```svelte
<Chart 
  {pair} 
  {dataFeed}
  period={selectedPeriod}
  granularity={selectedGranularity}
  {onGranularityChange}
/>
```

### After (Modular)
```svelte
<script>
  import Chart from '$lib/trading/chart/Chart.svelte';
  import { chartStore } from '$lib/trading/chart/stores/chartStore.svelte.ts';
  
  // Set initial config
  chartStore.updateConfig({
    timeframe: selectedPeriod,
    granularity: selectedGranularity
  });
</script>

<Chart {pair} {onGranularityChange} />
```

## Benefits

1. **Separation of Concerns**: Each service handles a specific responsibility
2. **Testability**: Services can be unit tested independently
3. **Performance**: Fine-grained reactivity with Svelte 5's $state
4. **Extensibility**: Easy to add new features without touching core logic
5. **Debugging**: Clear separation makes issues easier to isolate

## Advanced Features

### Custom Indicators (Coming in Phase 2)
```javascript
import { PluginManager } from '$lib/trading/chart/plugins/PluginManager';

const smaPlugin = new SMAPlugin({ period: 20 });
pluginManager.register(smaPlugin);
```

### Multi-Pane Support (Coming in Phase 4)
```svelte
<Chart>
  <ChartPane slot="main-pane" />
  <VolumePane slot="indicator-panes" />
  <RSIPane slot="indicator-panes" />
</Chart>
```

## Performance Tips

1. Use `performanceStore` to monitor FPS and render times
2. Enable caching for historical data
3. Adjust update throttling for realtime data
4. Use production builds for best performance

## Troubleshooting

### Chart not rendering
- Check console for initialization errors
- Verify API endpoints are accessible
- Ensure container has defined dimensions

### Poor performance
- Check `performanceStore.summary` for issues
- Reduce update frequency with `RealtimeCandleAggregator.setThrottle()`
- Disable unnecessary features (grid, crosshair)

### Data not updating
- Check WebSocket connection in `statusStore`
- Verify realtime subscription is active
- Check browser console for errors