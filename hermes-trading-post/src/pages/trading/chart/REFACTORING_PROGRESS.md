# Chart Refactoring Progress

## ✅ Phase 1: Extract Utilities (Code Organization)

### Utilities Created
- [x] **granularityHelpers.ts** - Centralized granularity logic
  - [x] Created utility with all granularities (1m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 1D)
  - [x] Replaced duplicate in ChartCore.svelte
  - [x] Replaced duplicate in ChartInfo.svelte  
  - [x] Replaced duplicate in ChartAPIService.ts
  - [ ] ~~Test granularity functionality~~ (Skipped - wasn't working before, focusing on organization)

- [ ] **priceFormatters.ts** - Standardized price formatting
  - [ ] Create utility
  - [ ] Find and replace price formatting duplicates
  - [ ] Test price display consistency

- [ ] **timeHelpers.ts** - Centralized time calculations
  - [ ] Create utility
  - [ ] Find and replace time calculation duplicates
  - [ ] Test time displays

## 🔄 Phase 2: Break Down ChartInfo.svelte (684 lines → ~100 lines)

- [ ] **TrafficLight.svelte** (~150 lines)
  - [ ] Extract traffic light logic and display
  - [ ] Handle price direction and waiting states
  - [ ] Test traffic light functionality

- [ ] **CandleCounter.svelte** (~80 lines)
  - [ ] Extract candle counting logic
  - [ ] Handle visible/total candle display
  - [ ] Test counter updates

- [ ] **PriceDisplay.svelte** (~100 lines)
  - [ ] Extract price display and formatting
  - [ ] Handle current price and changes
  - [ ] Test price updates

- [ ] **CandleCountdown.svelte** (~120 lines)
  - [ ] Extract countdown timer logic
  - [ ] Handle next candle timing
  - [ ] Test countdown accuracy

- [ ] **TimeDisplay.svelte** (~80 lines)
  - [ ] Extract time range display
  - [ ] Handle time formatting
  - [ ] Test time range updates

- [ ] **PerformanceMonitor.svelte** (~60 lines)
  - [ ] Extract performance monitoring
  - [ ] Handle FPS and performance stats
  - [ ] Test monitoring functionality

## 🔄 Phase 3: Refactor ChartCore.svelte (512 lines → ~150 lines)

- [ ] **useDataLoader.svelte.ts** hook
  - [ ] Extract data loading logic
  - [ ] Handle API requests and caching
  - [ ] Test data loading

- [ ] **useRealtimeSubscription.svelte.ts** hook
  - [ ] Extract WebSocket subscription logic
  - [ ] Handle real-time updates
  - [ ] Test real-time functionality

## 📋 Notes

- **Granularity Issue**: Timescale vs timeframe buttons were set up properly before - could potentially get granularity working quickly by examining those
- **Current Focus**: Code organization and removing duplicates, not fixing broken functionality yet
- **Testing Strategy**: Skip testing non-working features, focus on maintaining existing working functionality

## 🎯 Current Task
Working on priceFormatters utility to standardize price display across components.