# Hermes Trading Post - Project Structure

## 📁 Directory Organization

```
src/
├── components/          # Reusable UI components
│   ├── backtesting/    # Backtesting-specific components
│   ├── chart/          # Chart components (core, controls, data)
│   ├── charts/         # Specialized chart visualizations
│   ├── news/           # News feed components
│   ├── papertrading/   # Paper trading components
│   │   ├── controls/   # Trading control panels
│   │   ├── layout/     # Layout components
│   │   ├── testing/    # Test-related components
│   │   ├── trading/    # Trading execution components
│   │   ├── visualization/ # Data visualization
│   │   ├── BotManager.svelte         # Bot instance management
│   │   ├── OpenPositions.svelte      # Position display
│   │   ├── PaperTradingHeader.svelte # Header component
│   │   ├── PerformanceMetrics.svelte # Performance stats
│   │   ├── StrategyControls.svelte   # Strategy selection
│   │   ├── TradingHistory.svelte     # Trade history
│   │   ├── TradingStateManager.svelte # Trading state logic
│   │   └── index.ts
│   └── trading/        # General trading components
│
├── lib/                # Utility libraries
│
├── pages/              # Page components (routes)
│   ├── BacktestingRefactored.svelte
│   ├── ChartRefactored.svelte
│   ├── Dashboard.svelte
│   ├── NewsRefactored.svelte
│   ├── PaperTradingRefactored.svelte
│   ├── Portfolio.svelte
│   ├── Trading.svelte
│   ├── VaultRefactored.svelte
│   └── old-monolithic-backup/  # Legacy code for reference
│
├── services/           # Business logic and API services
│   ├── cache/          # Cache management modules
│   │   ├── ChunkManager.ts    # Data chunking logic
│   │   ├── MetadataManager.ts # Cache metadata handling
│   │   └── index.ts
│   ├── chart/          # Chart data modules
│   │   ├── ChartDataManager.ts      # Data state management
│   │   ├── ChartWebSocketHandler.ts # WebSocket connections
│   │   ├── GranularityManager.ts    # Granularity transitions
│   │   ├── ChartDataLoader.ts       # Data loading logic
│   │   ├── ChartCacheManager.ts     # Cache operations
│   │   └── index.ts
│   ├── coinbaseApi.ts         # Coinbase API integration
│   ├── coinbaseWebSocket.ts   # Real-time price feeds
│   ├── chartDataFeed.ts        # Chart data management (facade)
│   ├── indexedDBCache.ts       # Browser storage
│   ├── paperTradingService.ts # Paper trading logic
│   ├── backtestingEngine.ts   # Backtesting engine
│   └── [other services]
│
├── stores/             # Svelte stores for state management
│   ├── chartPreferencesStore.ts
│   ├── navigationStore.ts
│   ├── sidebarStore.ts
│   └── strategyStore.ts
│
├── strategies/         # Trading strategy implementations
│   ├── base/          # Base strategy classes
│   └── implementations/ # Specific strategy implementations
│
├── styles/            # Global styles and CSS
│
└── types/             # TypeScript type definitions
    ├── coinbase.ts
    └── index.ts
```

## 🔧 Key Files

### Entry Points
- `App.svelte` - Main application component with routing
- `main.ts` - Application bootstrap

### Component Index Files
- `components/index.ts` - Central export for all components
- `components/papertrading/index.ts` - Paper trading component exports
- `types/index.ts` - Type definition exports
- `strategies/index.ts` - Strategy exports

## 📦 Component Organization

### Modularized Components (Refactored ✅)
- **PaperTradingRefactored** → Split into:
  - StrategyControls
  - OpenPositions
  - TradingHistory
  - PerformanceMetrics
  - MarketGauge

- **BacktestingRefactored** → Uses modular components
- **VaultRefactored** → Properly componentized
- **NewsRefactored** → Clean component structure
- **ChartRefactored** → Minimal wrapper using chart components

### Pages Still Using Monolithic Structure
- Dashboard.svelte (524 lines) - Could be further modularized
- Trading.svelte (414 lines) - Could be further modularized
- Portfolio.svelte (132 lines) - Small enough, likely fine

## 🎯 Import Patterns

### Good Practice
```typescript
// Import from index files when available
import { StrategyControls, OpenPositions } from '@/components/papertrading';

// Import services directly
import { paperTradingService } from '@/services/paperTradingService';

// Import types from central index
import type { Strategy, Position } from '@/types';
```

### Avoid
```typescript
// Don't use deep imports when index exists
import StrategyControls from '@/components/papertrading/StrategyControls.svelte';

// Don't import from backup folders
import OldComponent from '@/pages/old-monolithic-backup/...';
```

## 🚀 Quick Start for Developers

1. **Adding a new component**: Place in appropriate `/components/` subfolder
2. **Adding a new page**: Create in `/pages/` and add route in `App.svelte`
3. **Adding a service**: Place in `/services/` (consider subdirectory if many related files)
4. **Adding a strategy**: Implement in `/strategies/implementations/`
5. **Adding types**: Define in `/types/index.ts` or create new file in `/types/`

## 🔄 Recent Improvements

- ✅ Modularized PaperTradingRefactored (reduced from 1390 to 1170 lines)
- ✅ Created reusable components for trading panels
- ✅ Added component index files for cleaner imports
- ✅ Organized components into logical subdirectories
- ✅ Preserved all legacy code in backup folder for reference
- ✅ Broke down chartDataFeed.ts into 5 focused modules
- ✅ Created chart service modules (ChartDataManager, ChartWebSocketHandler, etc.)
- ✅ Extracted cache management into ChunkManager and MetadataManager
- ✅ Added BotManager and TradingStateManager components
- ✅ Created PaperTradingHeader component

## 📝 TODO: Future Improvements

1. [ ] Consolidate duplicate chart components
2. [ ] Organize services into subdirectories
3. [ ] Further modularize Dashboard.svelte
4. [ ] Further modularize Trading.svelte
5. [ ] Add JSDoc comments to key functions
6. [ ] Create unit tests for critical components
7. [ ] Remove old-monolithic-backup folder once stable