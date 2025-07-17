# 📊 Modular Trading Chart Documentation

A modern, extensible trading chart component built with Svelte 5 and TradingView Lightweight Charts.

## 🚀 Features

- **Modular Architecture**: Clean separation of concerns with services, stores, and components
- **Plugin System**: Extensible architecture for indicators, overlays, and custom features
- **Multi-Pane Support**: Display multiple chart panes for indicators like RSI
- **Real-time Updates**: WebSocket integration for live price updates
- **Performance Optimized**: Built-in performance monitoring and optimization
- **Svelte 5 Reactivity**: Using the latest `$state` runes for fine-grained updates
- **TypeScript**: Full type safety throughout the codebase

## 📁 Architecture Overview

```
chart/
├── Chart.svelte                    # Main public API component
├── ChartContainer.svelte           # Full-featured container
├── core/                           # Core chart functionality
│   ├── ChartCore.svelte           # Chart initialization and lifecycle
│   └── ChartPanes.svelte          # Multi-pane layout manager
├── components/                     # UI components
│   ├── canvas/
│   │   └── ChartCanvas.svelte     # TradingView chart wrapper
│   ├── controls/
│   │   └── ChartControls.svelte   # Timeframe and granularity controls
│   ├── status/
│   │   └── ChartStatus.svelte     # Connection status indicator
│   └── overlays/
│       ├── ChartInfo.svelte       # Information overlay
│       ├── ChartError.svelte      # Error display
│       └── ChartDebug.svelte      # Debug panel
├── services/                       # Business logic
│   ├── ChartDataService.ts        # Data fetching and caching
│   ├── ChartAPIService.ts         # API and WebSocket handling
│   ├── ChartCacheService.ts       # Intelligent caching
│   └── ChartStateService.ts       # State management
├── stores/                         # Svelte 5 reactive stores
│   ├── chartStore.svelte.ts       # Chart configuration
│   ├── dataStore.svelte.ts        # Candle data
│   ├── statusStore.svelte.ts      # Status updates
│   └── performanceStore.svelte.ts # Performance metrics
├── plugins/                        # Plugin system
│   ├── base/                      # Base classes
│   ├── series/                    # Series plugins (Volume)
│   ├── indicators/                # Technical indicators
│   └── primitives/                # Drawing primitives
├── hooks/                          # Svelte hooks
│   ├── useChart.svelte.ts         # Chart instance access
│   ├── useDataFeed.svelte.ts      # Data management
│   └── useIndicators.svelte.ts    # Indicator management
└── utils/                          # Helper functions
```

## 🎯 Quick Start

### Basic Usage

```svelte
<script>
  import Chart from '$lib/trading/chart/Chart.svelte';
</script>

<Chart pair="BTC-USD" />
```

### With Options

```svelte
<Chart 
  pair="BTC-USD"
  showControls={true}
  showStatus={true}
  showInfo={true}
  enablePlugins={true}
  defaultPlugins={['volume']}
  multiPane={false}
  onReady={(chart, pluginManager) => {
    console.log('Chart ready!');
  }}
/>
```

## 📋 Component Props

### Chart Component

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pair` | `string` | `'BTC-USD'` | Trading pair to display |
| `showControls` | `boolean` | `true` | Show timeframe/granularity controls |
| `showStatus` | `boolean` | `true` | Show connection status indicator |
| `showInfo` | `boolean` | `true` | Show info overlay (price, candles) |
| `showDebug` | `boolean` | `false` | Show debug panel |
| `enablePlugins` | `boolean` | `true` | Enable plugin system |
| `defaultPlugins` | `string[]` | `['volume']` | Plugins to load by default |
| `multiPane` | `boolean` | `false` | Enable multi-pane support |
| `onReady` | `function` | `undefined` | Callback when chart is ready |
| `onGranularityChange` | `function` | `undefined` | Granularity change callback |

## 🔌 Plugin System

### Available Plugins

1. **Volume Plugin**: Display trading volume
2. **SMA Plugin**: Simple Moving Average
3. **EMA Plugin**: Exponential Moving Average
4. **RSI Plugin**: Relative Strength Index
5. **Order Lines Plugin**: Display order levels
6. **Position Markers Plugin**: Show entry/exit points

### Using Plugins

```javascript
// Add indicator
const smaPlugin = new SMAPlugin({ period: 20, color: '#2196F3' });
await chart.addPlugin(smaPlugin);

// Remove plugin
await chart.removePlugin('sma-20');

// Update plugin settings
pluginManager.updatePluginSettings('sma-20', { color: '#FF9800' });
```

### Creating Custom Plugins

```typescript
import { Plugin, type PluginConfig } from './plugins/base/Plugin';

export class MyCustomPlugin extends Plugin {
  constructor() {
    super({
      id: 'my-custom-plugin',
      name: 'My Custom Plugin',
      version: '1.0.0'
    });
  }

  protected async onInitialize(): Promise<void> {
    // Initialize your plugin
    const chart = this.getChart();
    // Add your custom logic
  }

  protected async onDestroy(): Promise<void> {
    // Cleanup
  }

  protected onEnable(): void {
    // Plugin enabled
  }

  protected onDisable(): void {
    // Plugin disabled
  }

  protected onSettingsUpdate(oldSettings: any, newSettings: any): void {
    // Handle settings changes
  }
}
```

## 🪝 Hooks

### useChart

Access chart instance and utilities:

```javascript
import { useChart } from './hooks/useChart.svelte';

const { chart, series, pluginManager, stores, actions } = useChart();

// Take screenshot
const screenshot = await actions.takeScreenshot();

// Export data
const csvData = actions.exportData();

// Fit content
actions.fitContent();
```

### useDataFeed

Manage chart data:

```javascript
import { useDataFeed } from './hooks/useDataFeed.svelte';

const { 
  candles, 
  latestPrice, 
  stats,
  loadData,
  reloadData,
  clearCache 
} = useDataFeed();

// Get price change
const change = getPriceChange();
console.log(`Price changed: ${change.percentage}%`);
```

### useIndicators

Manage technical indicators:

```javascript
import { useIndicators } from './hooks/useIndicators.svelte';

const { 
  indicators,
  addIndicator,
  removeIndicator,
  getIndicatorValue 
} = useIndicators();

// Add SMA
const smaId = await addIndicator({
  type: 'sma',
  settings: { period: 20 }
});

// Get latest value
const smaValue = getIndicatorValue(smaId);
```

## 🎨 Stores

### chartStore

```javascript
import { chartStore } from './stores/chartStore.svelte';

// Update configuration
chartStore.setTimeframe('1D');
chartStore.setGranularity('15m');
chartStore.setTheme('dark');

// Toggle indicators
chartStore.toggleIndicator('sma');

// Access state
const config = chartStore.config;
const isLoading = chartStore.isLoading;
```

### dataStore

```javascript
import { dataStore } from './stores/dataStore.svelte';

// Access data
const candles = dataStore.candles;
const latestPrice = dataStore.latestPrice;
const stats = dataStore.stats;

// Load data
await dataStore.loadData('BTC-USD', '1m', startTime, endTime);

// Subscribe to realtime
dataStore.subscribeToRealtime('BTC-USD', '1m', (candle) => {
  console.log('New candle:', candle);
});
```

### statusStore

```javascript
import { statusStore } from './stores/statusStore.svelte';

// Set status
statusStore.setLoading('Loading data...');
statusStore.setReady();
statusStore.setError('Connection failed');

// Access status
const status = statusStore.status;
const displayText = statusStore.displayText;
const isError = statusStore.isError();
```

### performanceStore

```javascript
import { performanceStore } from './stores/performanceStore.svelte';

// Start monitoring
performanceStore.startMonitoring();

// Access metrics
const { fps, renderTime, cacheHitRate } = performanceStore.stats;
const { performance, issues } = performanceStore.summary;

// Record metrics
performanceStore.recordRenderTime(16);
performanceStore.recordCacheHit();
```

## 🔧 Advanced Features

### Multi-Pane Support

```svelte
<Chart 
  multiPane={true}
  onReady={(chart, pluginManager) => {
    // Add RSI to separate pane
    const rsiPlugin = new RSIPlugin();
    await pluginManager.register(rsiPlugin);
    chart.addPane('rsi', 25); // 25% height
  }}
/>
```

### Custom Themes

```javascript
chartStore.updateConfig({
  theme: 'dark',
  showGrid: true,
  showCrosshair: true
});
```

### Export Functionality

```javascript
import { exportToCSV, downloadCSV } from './utils/chartHelpers';

const csvData = exportToCSV(dataStore.candles);
downloadCSV(csvData, 'chart-data.csv');
```

## 🚀 Performance Tips

1. **Enable Caching**: Data is cached by default for 5 minutes
2. **Use Throttling**: Real-time updates are throttled to prevent excessive renders
3. **Monitor Performance**: Use `performanceStore` to track FPS and render times
4. **Lazy Load Plugins**: Only load plugins when needed
5. **Optimize Indicators**: Use efficient calculation algorithms

## 🐛 Debugging

Enable debug mode to see detailed information:

```svelte
<Chart showDebug={true} />
```

Access debug data programmatically:

```javascript
const debugData = {
  chart: chartStore.state,
  data: dataStore.stats,
  status: statusStore.history,
  performance: performanceStore.metrics
};
console.log('Debug:', debugData);
```

## 📝 Migration Guide

### From Old Chart.svelte

```svelte
<!-- Old -->
<Chart 
  {pair} 
  {dataFeed}
  period={selectedPeriod}
  granularity={selectedGranularity}
/>

<!-- New -->
<script>
  import { chartStore } from './stores/chartStore.svelte';
  
  chartStore.updateConfig({
    timeframe: selectedPeriod,
    granularity: selectedGranularity
  });
</script>

<Chart {pair} />
```

## 🔒 Security

- All external API calls go through service layer
- Input validation at service boundaries
- WebSocket connections are authenticated
- No sensitive data in client-side cache

## 📦 Bundle Size

The modular architecture allows for tree-shaking:
- Core chart: ~50KB gzipped
- Each plugin: ~5-10KB
- Full bundle with all features: ~120KB gzipped

## 🤝 Contributing

1. Follow the existing architecture patterns
2. Add tests for new features
3. Update documentation
4. Ensure TypeScript types are complete

## 📄 License

This is part of the Project Sanctuary trading platform.