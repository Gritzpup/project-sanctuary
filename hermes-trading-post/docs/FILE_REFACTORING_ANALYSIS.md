# File Refactoring Analysis - Breaking Down Large Files

**Analysis Date**: October 18, 2025
**Threshold**: 300 lines
**Files Over Threshold**: 30 total (23 frontend, 8 backend)
**Estimated Refactoring Time**: 8-12 hours
**Risk Level**: MEDIUM (requires careful extraction and testing)

---

## CRITICAL - 1000+ Lines (Break Down Immediately)

### 1. DepthChart.svelte - 1,486 lines ⚠️⚠️⚠️

**Location**: `/src/pages/trading/orderbook/components/DepthChart.svelte`
**Issue**: Monolithic depth chart component with all functionality in one file
**Responsibility**: Depth chart rendering, overlays, interactions, calculations

**Breakdown Strategy**:
```
DepthChart.svelte (1486 lines)
├── DepthChartCore.svelte (300-400 lines) - Core chart rendering
├── DepthChartCalculations.ts (200-300 lines) - Order book calculations
├── DepthChartInteractions.ts (150-200 lines) - Mouse events, tooltips
├── DepthChartLegend.svelte (100-150 lines) - Legend display
├── DepthChartStats.svelte (100-150 lines) - Statistics panel
└── DepthChartHelpers.ts (100-150 lines) - Utility functions
```

**Extraction Candidates**:
1. **Order book calculation logic** → Extract to `services/orderbook/OrderBookAnalyzer.ts`
2. **Chart rendering logic** → Create `DepthChartCore.svelte` (grid, lines, axes)
3. **Interaction handlers** → Create `useDepthChartInteractions.svelte.ts` hook
4. **Display components** → Split legend, stats, annotations into sub-components
5. **Color/styling logic** → Extract to `utils/DepthChartStyles.ts`

**Benefits**:
- Easier to test calculations separately
- Reusable order book analyzer
- Simpler component hierarchy
- Easier to add features

---

### 2. dataStore.svelte.ts - 822 lines ⚠️⚠️

**Location**: `/src/pages/trading/chart/stores/dataStore.svelte.ts`
**Issue**: Global store with all chart data logic in one file
**Responsibility**: Chart data, subscriptions, updates, caching logic

**Breakdown Strategy**:
```
dataStore.svelte.ts (822 lines)
├── dataStore.svelte.ts (300-350 lines) - Core store definition
├── dataStoreSubscriptions.svelte.ts (200-250 lines) - Subscription handlers
├── dataStoreTransformations.ts (150-200 lines) - Data transformations
├── dataStoreCaching.ts (100-150 lines) - Cache management
└── dataStoreHelpers.ts (50-100 lines) - Utility functions
```

**Extraction Candidates**:
1. **Subscription logic** → Extract to `hooks/useDataStoreSubscriptions.svelte.ts`
2. **Data transformation** → Extract to `services/chart/DataTransformations.ts`
3. **Cache logic** → Extract to `services/chart/DataCacheManager.ts`
4. **Event handlers** → Extract to `services/chart/DataStoreEventHandlers.ts`

**Benefits**:
- Easier to test subscription logic
- Reusable transformation functions
- Cleaner store definition
- Better separation of concerns

---

### 3. orderbookStore.svelte.ts - 595 lines ⚠️

**Location**: `/src/pages/trading/orderbook/stores/orderbookStore.svelte.ts`
**Issue**: Single file with all orderbook state logic
**Responsibility**: Order book state, updates, subscriptions, calculations

**Breakdown Strategy**:
```
orderbookStore.svelte.ts (595 lines)
├── orderbookStore.svelte.ts (250-300 lines) - Core store
├── orderbookUpdaters.ts (150-200 lines) - Update logic
├── orderbookCalculations.ts (100-150 lines) - Calculations
└── orderbookHelpers.ts (50-100 lines) - Utilities
```

**Extraction Candidates**:
1. **Update handlers** → Extract to `services/orderbook/OrderBookUpdater.ts`
2. **Calculations** → Extract to `services/orderbook/OrderBookCalculator.ts`
3. **Spread/skew logic** → Extract to `services/orderbook/SpreadAnalyzer.ts`

---

## HIGH PRIORITY - 400-1000 Lines (Refactor Soon)

### 4. ChartCanvas.svelte - 525 lines ⚠️

**Purpose**: Main canvas rendering component
**Issues**:
- Canvas drawing logic mixed with React logic
- Event handling inline
- Calculations mixed with rendering

**Split Into**:
- `ChartCanvasCore.svelte` (250 lines) - Canvas rendering
- `ChartCanvasEvents.ts` (150 lines) - Event handlers
- `useCanvasDrawing.svelte.ts` (125 lines) - Drawing logic

---

### 5. RedisChartDataProvider.ts - 488 lines ⚠️

**Purpose**: Redis data provider for charts
**Issues**:
- Multiple responsibilities (fetch, parse, cache, transform)
- Complex logic for different data types

**Split Into**:
- `RedisChartDataProvider.ts` (200 lines) - Core provider
- `RedisCandleParser.ts` (150 lines) - Candle parsing
- `RedisVolumeParser.ts` (138 lines) - Volume parsing

---

### 6. PaperTradingOrchestrator.ts - 465 lines ⚠️

**Purpose**: Paper trading orchestration
**Issues**:
- Mixing strategy execution, position management, and state updates
- All trading logic in one file

**Split Into**:
- `PaperTradingOrchestrator.ts` (200 lines) - Core orchestration
- `PaperTradingExecutor.ts` (150 lines) - Trade execution
- `PaperTradingStateManager.ts` (115 lines) - State management

---

### 7. ImportDialog.svelte - 460 lines ⚠️

**Purpose**: Import dialog component
**Issues**:
- File parsing, validation, and UI in one component
- Multiple concerns mixed together

**Split Into**:
- `ImportDialog.svelte` (250 lines) - UI and orchestration
- `FileParser.ts` (120 lines) - File parsing logic
- `ImportValidator.ts` (90 lines) - Validation logic

---

### 8. RedisCandleStorage.ts - 454 lines ⚠️

**Purpose**: Redis candle storage service
**Issues**:
- Storage operations, metadata, cleanup in one file

**Split Into**:
- `RedisCandleStorage.ts` (200 lines) - Storage operations
- `RedisCandleMetadata.ts` (150 lines) - Metadata management
- `RedisCandleCleanup.ts` (104 lines) - Cleanup logic

---

### 9. ChartCore.svelte - 445 lines ⚠️

**Purpose**: Core chart component
**Issues**:
- Plugin management, initialization, and rendering mixed
- Too many concerns in one component

**Split Into**:
- `ChartCore.svelte` (250 lines) - Core chart rendering
- `useChartPlugins.svelte.ts` (150 lines) - Plugin management
- `ChartInitialization.ts` (45 lines) - Chart setup

---

### 10. MicroScalpingStrategy.ts - 432 lines ⚠️

**Purpose**: Micro scalping strategy implementation
**Issues**:
- Entry logic, exit logic, calculations all mixed
- Hard to test individual components

**Split Into**:
- `MicroScalpingStrategy.ts` (150 lines) - Main strategy
- `MicroScalpingEntryLogic.ts` (150 lines) - Entry signals
- `MicroScalpingExitLogic.ts` (132 lines) - Exit signals

---

## MEDIUM PRIORITY - 350-400 Lines (Refactor This Sprint)

### 11. WebSocketService.ts - 422 lines
**Split Into**: Core service (200 lines), Event handlers (150 lines), Reconnection logic (72 lines)

### 12. ChartAPIService.ts - 422 lines
**Split Into**: API calls (200 lines), Data transformation (150 lines), Error handling (72 lines)

### 13. CollapsibleSidebar.svelte - 418 lines
**Split Into**: Sidebar core (250 lines), Animation logic (100 lines), State management (68 lines)

### 14. Formatters.ts - 416 lines
**Split Into**: Number formatters (150 lines), Date formatters (150 lines), String formatters (116 lines)

### 15. RedisChartService.ts - 416 lines
**Split Into**: Service core (200 lines), Caching logic (150 lines), Helpers (66 lines)

### 16. ChartIndexedDBCache.ts - 412 lines
**Split Into**: Cache operations (200 lines), Index management (150 lines), Cleanup (62 lines)

### 17. useRealtimeSubscription.svelte.ts - 410 lines
**Split Into**: Subscription core (200 lines), Event handlers (150 lines), Cleanup (60 lines)

### 18. tradingBackendService.ts - 408 lines
**Split Into**: Service core (200 lines), API calls (150 lines), Error handling (58 lines)

### 19. BacktestingResults.svelte - 407 lines
**Split Into**: Results display (250 lines), Stats calculation (100 lines), Charts (57 lines)

### 20. ChartStatus.svelte - 406 lines
**Split Into**: Status display (250 lines), Traffic light logic (100 lines), Helpers (56 lines)

---

## LOWER PRIORITY - 300-350 Lines (Next Sprint)

### 21-30. Other Files Over 300 Lines:
- APIService.ts (397 lines)
- CodeEditorTab.svelte (395 lines)
- BacktestingBackups.svelte (390 lines)
- DepthChartOverlays.svelte (382 lines)
- ChartContainer.svelte (373 lines)
- BacktestStats.svelte (370 lines)
- coinbaseWebSocket.ts (366 lines)
- ChartDataOrchestrator.ts (357 lines)
- ChartInfo.svelte (345 lines)
- ... (backend files)

---

## BACKEND FILES - Over 300 Lines

### Backend Critical Files:

**1. backend/src/index.js - 1,053 lines** ⚠️⚠️⚠️
**Issue**: Everything in main file - routes, middleware, initialization
**Split Into**:
- `index.js` (200 lines) - Entry point
- `routes/index.js` (200 lines) - Route setup
- `middleware/index.js` (200 lines) - Middleware setup
- `services/index.js` (200 lines) - Service initialization
- `config/index.js` (253 lines) - Configuration

**2. backend/src/services/coinbaseWebSocket.js - 947 lines** ⚠️⚠️
**Issue**: All WebSocket logic in one file
**Split Into**:
- `CoinbaseWebSocket.js` (400 lines) - Core connection
- `CoinbaseWebSocketHandlers.js` (300 lines) - Message handlers
- `CoinbaseWebSocketReconnection.js` (247 lines) - Reconnection logic

**3. backend/src/services/trading/TradingOrchestrator.js - 761 lines** ⚠️
**Split Into**:
- `TradingOrchestrator.js` (300 lines) - Main orchestrator
- `TradingStateManager.js` (250 lines) - State management
- `TradingEventBroadcaster.js` (211 lines) - Event broadcasting

**4. backend/src/services/redis/RedisCandleStorage.js - 612 lines** ⚠️
**Split Into**:
- `RedisCandleStorage.js` (250 lines) - Storage ops
- `RedisCandleMetadata.js` (200 lines) - Metadata
- `RedisCandleCleanup.js` (162 lines) - Cleanup

**5. backend/src/services/redis/RedisOrderbookCache.js - 500 lines** ⚠️
**Split Into**:
- `RedisOrderbookCache.js` (250 lines) - Cache ops
- `RedisOrderbookUpdater.js` (150 lines) - Updates
- `RedisOrderbookHelpers.js` (100 lines) - Helpers

**6. backend/src/routes/trading.js - 413 lines** ⚠️
**Split Into**:
- `routes/trading.js` (150 lines) - Route definitions
- `routes/handlers/trading.js` (150 lines) - Handlers
- `routes/validation/trading.js` (113 lines) - Validation

**7. backend/src/services/botManager.js - 389 lines** ⚠️
**Split Into**:
- `BotManager.js` (200 lines) - Bot management
- `BotCreator.js` (100 lines) - Bot creation
- `BotRegistry.js` (89 lines) - Bot registry

**8. backend/src/services/CacheWarmer.js - 329 lines** ⚠️
**Split Into**:
- `CacheWarmer.js` (150 lines) - Warming logic
- `CacheWarmingScheduler.js` (100 lines) - Scheduling
- `CacheWarmingHelpers.js` (79 lines) - Helpers

---

## Refactoring Strategy

### Priority Tiers:

**TIER 1 - CRITICAL (This Week)**
- DepthChart.svelte (1,486 → 400 lines)
- dataStore.svelte.ts (822 → 350 lines)
- orderbookStore.svelte.ts (595 → 300 lines)
- backend/src/index.js (1,053 → 200 lines)
- backend/src/services/coinbaseWebSocket.js (947 → 400 lines)

**TIER 2 - HIGH (Next 2 Weeks)**
- ChartCanvas.svelte (525 → 300 lines)
- RedisChartDataProvider.ts (488 → 200 lines)
- PaperTradingOrchestrator.ts (465 → 200 lines)
- ImportDialog.svelte (460 → 250 lines)
- RedisCandleStorage.ts (454 → 200 lines)

**TIER 3 - MEDIUM (Sprint After)**
- ChartCore.svelte (445 → 250 lines)
- MicroScalpingStrategy.ts (432 → 150 lines)
- WebSocketService.ts (422 → 200 lines)
- ChartAPIService.ts (422 → 200 lines)

**TIER 4 - LOWER (Future)**
- All 300-350 line files

---

## Impact Analysis

### Benefits of Refactoring:

**Code Quality**
- Easier to understand individual files
- Better testability
- Reduced cyclomatic complexity
- Clearer separation of concerns

**Performance**
- Smaller bundle size (lazy loading possible)
- Easier to tree-shake unused code
- Better code caching

**Maintainability**
- Easier to find bugs
- Easier to add features
- Better onboarding for new developers
- Reduced cognitive load

**Testing**
- Unit tests easier to write
- Edge cases easier to cover
- Mocking dependencies simpler

---

## Extraction Patterns

### Pattern 1: Service Extraction
```typescript
// Before: Logic in component
// After: Extract to service
→ Move calculations to `services/MyCalculator.ts`
→ Import and use in component
```

### Pattern 2: Hook Extraction
```svelte
// Before: Logic in component
// After: Extract to hook
→ Move subscriptions to `hooks/useMyData.svelte.ts`
→ Call hook in component
```

### Pattern 3: Sub-component Extraction
```svelte
// Before: Large component with multiple sections
// After: Split into sub-components
<MainComponent>
  <SubComponentA>
  <SubComponentB>
  <SubComponentC>
</MainComponent>
```

### Pattern 4: State Extraction
```typescript
// Before: State in component store
// After: Split store into modules
→ Create `stores/data.svelte.ts`
→ Create `stores/ui.svelte.ts`
→ Create `stores/cache.svelte.ts`
```

---

## Implementation Plan

### Phase 1: Frontend Critical Files (Week 1)
```bash
1. Split DepthChart.svelte (1486 → 400)
2. Split dataStore.svelte.ts (822 → 350)
3. Split orderbookStore.svelte.ts (595 → 300)
Estimated: 6-8 hours
```

### Phase 2: Backend Critical Files (Week 1)
```bash
1. Refactor index.js (1053 → 200)
2. Split coinbaseWebSocket.js (947 → 400)
3. Split TradingOrchestrator.js (761 → 300)
Estimated: 5-7 hours
```

### Phase 3: Frontend High Priority (Week 2)
```bash
1. Split ChartCanvas.svelte (525 → 300)
2. Split RedisChartDataProvider.ts (488 → 200)
3. Split PaperTradingOrchestrator.ts (465 → 200)
4. Split ImportDialog.svelte (460 → 250)
5. Split RedisCandleStorage.ts (454 → 200)
Estimated: 8-10 hours
```

### Phase 4: Backend High Priority (Week 2)
```bash
1. Split Redis services
2. Refactor trading routes
3. Split botManager.js
Estimated: 5-7 hours
```

---

## Rollout Checklist

For each file refactor:
- [ ] Create extraction plan with exact line numbers
- [ ] Create sub-files/services
- [ ] Move code with minimal changes
- [ ] Update imports in original file
- [ ] Update all consumers of original file
- [ ] Run type checking: `npm run check`
- [ ] Run tests: `npm run test`
- [ ] Verify no visual regressions
- [ ] Commit with descriptive message
- [ ] Create PR for review

---

## Risk Mitigation

**Risks**:
- Breaking imports during refactoring
- Creating circular dependencies
- Missing test coverage
- Performance regressions

**Mitigations**:
- Use TypeScript for type safety
- Run linter after each refactor
- Add tests before refactoring
- Profile bundle size before/after
- Do one file at a time
- Small, focused PRs
- Peer review each refactor

---

## Estimated Timeline

| Phase | Files | Hours | Risk | Timeline |
|-------|-------|-------|------|----------|
| 1 (Frontend Critical) | 3 | 6-8 | HIGH | Week 1 |
| 2 (Backend Critical) | 3 | 5-7 | HIGH | Week 1 |
| 3 (Frontend High) | 5 | 8-10 | MEDIUM | Week 2 |
| 4 (Backend High) | 3 | 5-7 | MEDIUM | Week 2 |
| 5 (Medium Priority) | 13 | 15-20 | LOW | Week 3-4 |
| 6 (Lower Priority) | 3+ | 10-15 | VERY LOW | Future |
| **TOTAL** | **30** | **50-70 hours** | **MEDIUM** | **4-6 weeks** |

---

## Next Steps

1. **Review this analysis** - Verify file breakdown makes sense
2. **Choose a starting file** - Recommend starting with `DepthChart.svelte`
3. **Create detailed extraction plan** - Specific line ranges
4. **Extract one file** - Do one complete refactor
5. **Test thoroughly** - Verify no regressions
6. **Document pattern** - For reuse on other files
7. **Repeat** - Apply pattern to other files

---

**Document prepared by**: Code Analysis
**Status**: Ready for implementation
**Priority**: HIGH (Improved maintainability & developer experience)
