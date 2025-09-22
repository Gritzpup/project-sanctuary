# Hermes Trading Post - Codebase Structure

This document outlines the modular architecture and organization of the Hermes Trading Post application.

## 🏗️ Architecture Overview

The codebase follows a feature-based architecture with clear separation of concerns:

```
src/
├── components/          # Reusable UI components
├── pages/              # Route-based page components  
├── services/           # Business logic and data services
├── stores/             # State management
├── strategies/         # Trading strategy implementations
├── styles/             # Global and component styles
├── types/              # TypeScript type definitions
└── utils/              # Centralized utility functions
```

## 📁 Directory Structure

### `/src/components/`

**Organized by feature and shared components:**

```
components/
├── shared/             # Reusable components across features
│   └── charts/         # Base chart components and themes
├── charts/             # Basic chart components
├── backtesting/        # Backtesting-specific components
├── papertrading/       # Paper trading components
├── vault/              # Vault management components
├── layout/             # Layout and navigation components
├── news/               # News and market data components
└── trading/            # Trading interface components
```

**Key Shared Components:**
- `BaseChart.svelte` - Unified chart foundation for all charts
- Chart themes and configurations
- Reusable UI patterns

### `/src/pages/`

**Page-level components with nested feature components:**

```
pages/
├── trading/
│   └── chart/          # Advanced trading chart system
│       ├── components/ # Chart-specific components
│       ├── hooks/      # Chart data hooks
│       ├── services/   # Chart services
│       ├── stores/     # Chart state management
│       └── utils/      # Chart utilities
├── Backtesting.svelte
├── PaperTrading.svelte
├── Portfolio.svelte
├── Vault.svelte
└── Dashboard.svelte
```

### `/src/services/`

**Domain-driven service organization:**

```
services/
├── api/               # External API integrations
├── cache/             # Data caching and persistence
├── chart/             # Chart data management
├── data/              # Data processing and aggregation
├── state/             # Application state services
└── trading/           # Trading logic and execution
```

**Key Services:**
- `CandleAggregationService` - Unified historical and real-time candle processing
- `ChartDataManager` - Chart data lifecycle management
- `PaperTradingManager` - Trading simulation logic

### `/src/utils/`

**Centralized utility functions:**

```
utils/
├── formatters/        # All formatting utilities
│   ├── numberFormatters.ts    # Number and currency formatting
│   ├── priceFormatters.ts     # Price-specific formatting
│   ├── timeFormatters.ts      # Date and time formatting
│   ├── percentFormatters.ts   # Percentage and P&L formatting
│   └── index.ts               # Unified exports
└── index.ts           # Main utils export
```

## 🔄 Import Patterns

### Centralized Imports

**✅ Recommended:**
```typescript
// Single import for all utilities
import { formatPrice, formatPercent, formatTime } from '@/utils';

// Feature-based imports
import { BaseChart } from '@/components/shared';
import { BacktestExecutor } from '@/services/backtesting';
```

**❌ Avoid:**
```typescript
// Deep import paths
import { formatPrice } from '../../utils/formatters/priceFormatters';
import { formatPercent } from '../../../utils/formatters/percentFormatters';
```

### Index File Strategy

Every directory contains an `index.ts` file that:
- Exports all public components/utilities
- Provides clean import paths
- Prevents deep import dependencies

## 🔧 Component Patterns

### Chart Components

**Hierarchy:**
1. `BaseChart.svelte` - Core chart functionality
2. Feature-specific charts (extend BaseChart)
3. Chart indicators and overlays

**Example Usage:**
```svelte
<script>
  import { BaseChart } from '@/components/shared';
  
  // Configure chart
  const chartOptions = getChartOptions('dark');
</script>

<BaseChart 
  {data} 
  seriesType="candlestick"
  chartOptions={chartOptions}
  on:chartReady={handleChartReady}
/>
```

### Formatting Utilities

**Unified Interface:**
```typescript
// All formatters follow consistent patterns
formatPrice(123.45)          // "$123.45"
formatPercent(12.5)          // "+12.50%"
formatTime(timestamp)        // "14:30:25"
formatNumber(1234567)        // "1,234,567"
```

## 🏪 State Management

### Store Organization

```
stores/
├── chartPreferencesStore.ts  # Chart settings and preferences
├── navigationStore.ts        # App navigation state
├── sidebarStore.ts           # Sidebar visibility and state
└── strategyStore.ts          # Trading strategy configurations
```

### Chart-Specific Stores

Located in `/pages/trading/chart/stores/`:
- `chartStore.svelte.ts` - Chart configuration and state
- `dataStore.svelte.ts` - Chart data and caching
- `statusStore.svelte.ts` - Chart loading and error states
- `performanceStore.svelte.ts` - Performance monitoring

## 🧪 Testing Structure

```
pages/trading/chart/tests/
├── browserTestRunner.js      # Browser-based test runner
├── chartTestSuite.ts         # Chart component tests
└── runTests.ts               # Test execution
```

## 📊 Data Flow

### Chart Data Pipeline

1. **Data Sources:**
   - Historical: Coinbase API
   - Real-time: WebSocket streams

2. **Processing:**
   - `CandleAggregationService` - Unified aggregation
   - `ChartDataManager` - Data lifecycle
   - `IndexedDBCache` - Local persistence

3. **Consumption:**
   - Chart components receive processed data
   - Real-time updates via reactive stores

### Trading Data Flow

1. **Strategy Selection** → `StrategyStore`
2. **Market Data** → `PaperTradingManager`
3. **Trade Execution** → `TradeExecutor`
4. **State Persistence** → `TradingPersistence`

## 🎨 Styling Organization

### CSS Structure

```
styles/
├── base.css              # Base styles and CSS reset
├── components.css        # Shared component styles
├── utilities.css         # Utility classes
├── index.css             # Main style imports
├── backtesting.css       # Backtesting page styles
├── paper-trading.css     # Paper trading styles
└── sidebar.css           # Navigation styles
```

### Component Styles

- Component-specific styles are co-located in `.svelte` files
- Shared styles use CSS custom properties for theming
- Chart themes defined in `/components/shared/charts/themes.ts`

## 🔧 Development Guidelines

### Adding New Features

1. **Components:** Start with shared components, extend as needed
2. **Services:** Follow domain-driven organization
3. **Utils:** Add to appropriate formatter category
4. **Types:** Update centralized type definitions

### Code Reuse

1. **Before creating:** Check existing utilities and components
2. **Formatters:** Always use centralized formatting functions
3. **Charts:** Extend BaseChart for new chart types
4. **Services:** Compose existing services rather than duplicating

### Import Standards

1. **Use absolute imports:** `@/utils` instead of `../../utils`
2. **Import from index files:** Avoid deep imports
3. **Group imports:** External, internal, relative
4. **Export consistently:** All directories have index.ts

## 🚀 Performance Considerations

### Chart Performance

- **BaseChart** handles resize optimization
- **Data virtualization** for large datasets
- **Memoization** in reactive computations

### Bundle Optimization

- **Tree shaking:** Enabled via index.ts exports
- **Code splitting:** Page-level chunks
- **Shared utilities:** Prevent duplication

## 📝 Migration Notes

### Recent Improvements

1. **Centralized Formatters:** All formatting moved to `/utils/formatters/`
2. **Unified Chart Base:** `BaseChart.svelte` replaces duplicate chart logic
3. **Consolidated Aggregation:** `CandleAggregationService` combines historical/real-time
4. **Index Files:** Clean import paths throughout codebase

### Breaking Changes

- Import paths updated to use centralized utilities
- Chart components now extend BaseChart
- Aggregation services unified under single interface

This structure provides a maintainable, scalable foundation that eliminates code duplication while maintaining clear feature boundaries.