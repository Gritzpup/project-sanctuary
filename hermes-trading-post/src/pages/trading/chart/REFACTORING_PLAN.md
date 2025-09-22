# Chart Codebase Refactoring Plan

## Executive Summary

The chart codebase is well-structured but has grown to include some very large files and duplicate code. This plan outlines a systematic approach to improve modularity, eliminate duplication, and enhance testability.

## Current Issues Identified

### 🚨 Critical Issues (Must Fix)
1. **ChartInfo.svelte (684 lines)** - Monolithic component doing too much
2. **ChartCore.svelte (512 lines)** - Complex orchestrator with mixed responsibilities
3. **Duplicate granularity mapping** - Found in 3+ files
4. **Duplicate price formatting** - Multiple implementations
5. **WebSocket logic scattered** - Across multiple services

### ⚠️ Medium Priority Issues
1. **ChartAPIService.ts (373 lines)** - Mixed API and WebSocket concerns
2. **Status management** - Logic spread across multiple components
3. **Time utilities** - Repeated implementations
4. **Missing error boundaries** - No proper error isolation

### ✅ What's Working Well
1. **Folder structure** - Good separation of concerns
2. **Store pattern** - Proper reactive state management
3. **Plugin architecture** - Extensible and modular
4. **TypeScript usage** - Good type safety

## Refactoring Strategy

### Phase 1: Extract Utilities (Low Risk) - Week 1

#### 1.1 Create Shared Utilities
```typescript
// src/pages/trading/chart/utils/granularityHelpers.ts
export const GRANULARITY_SECONDS = {
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '4h': 14400, '1d': 86400
} as const;

export function getGranularitySeconds(granularity: string): number
export function alignTimeToGranularity(time: number, granularity: string): number
export function getNextCandleTime(currentTime: number, granularity: string): number
```

```typescript
// src/pages/trading/chart/utils/priceFormatters.ts
export interface FormatOptions {
  currency?: string;
  decimals?: number;
  compact?: boolean;
}

export function formatPrice(price: number | null, options?: FormatOptions): string
export function formatPriceChange(oldPrice: number, newPrice: number): string
export function formatVolume(volume: number): string
```

```typescript
// src/pages/trading/chart/utils/timeHelpers.ts
export function formatTime(timestamp: number): string
export function formatDuration(seconds: number): string
export function getTimeToNextCandle(granularity: string): number
export function isMarketOpen(timestamp?: number): boolean
```

#### 1.2 Create Validation Utilities
```typescript
// src/pages/trading/chart/utils/validationHelpers.ts
export function isValidCandle(candle: CandlestickData): boolean
export function isValidConfig(config: ChartConfig): boolean
export function validateDataIntegrity(candles: CandlestickData[]): ValidationResult
```

### Phase 2: Break Down ChartInfo.svelte (Medium Risk) - Week 2

#### 2.1 Extract Specialized Components
```
src/pages/trading/chart/components/info/
├── ChartInfo.svelte (main container, ~100 lines)
├── TrafficLight.svelte (~150 lines)
├── CandleCounter.svelte (~80 lines)
├── CandleCountdown.svelte (~120 lines)
├── PriceDisplay.svelte (~100 lines)
├── TimeDisplay.svelte (~80 lines)
└── PerformanceMonitor.svelte (~60 lines)
```

#### 2.2 Extract Business Logic Hooks
```typescript
// src/pages/trading/chart/hooks/useTrafficLight.svelte.ts
export function useTrafficLight(dataStore: DataStore) {
  let priceDirection = $state<'up' | 'down' | 'neutral'>('neutral');
  let isWaitingForPrice = $state(true);
  
  // Price change detection logic
  // Traffic light state management
  
  return {
    get status() { /* computed status */ },
    get color() { /* computed color */ }
  };
}
```

```typescript
// src/pages/trading/chart/hooks/useCandleCountdown.svelte.ts
export function useCandleCountdown(granularity: string) {
  let timeToNext = $state(0);
  let isActive = $state(false);
  
  // Countdown logic
  // Auto-refresh on new candle
  
  return {
    get timeToNext() { return timeToNext; },
    get formattedTime() { /* format remaining time */ }
  };
}
```

### Phase 3: Refactor ChartCore.svelte (High Risk) - Week 3

#### 3.1 Extract Data Management Logic
```typescript
// src/pages/trading/chart/hooks/useDataLoader.svelte.ts
export function useDataLoader(config: ChartConfig) {
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  
  async function loadData() { /* data loading logic */ }
  async function checkAndFillGaps() { /* gap detection logic */ }
  
  return { loadData, checkAndFillGaps, isLoading, error };
}
```

```typescript
// src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts
export function useRealtimeSubscription(pair: string, granularity: string) {
  let isConnected = $state(false);
  let lastUpdate = $state<number | null>(null);
  
  function subscribe() { /* subscription logic */ }
  function unsubscribe() { /* cleanup logic */ }
  
  return { subscribe, unsubscribe, isConnected, lastUpdate };
}
```

#### 3.2 Create Specialized Services
```typescript
// src/pages/trading/chart/services/DataGapFiller.ts
export class DataGapFiller {
  async detectGaps(candles: CandlestickData[], granularity: string): Promise<GapInfo[]>
  async fillGaps(gaps: GapInfo[]): Promise<CandlestickData[]>
  createBridgeCandles(from: number, to: number, granularity: string): CandlestickData[]
}
```

### Phase 4: Split Service Concerns (Medium Risk) - Week 4

#### 4.1 Separate WebSocket from API
```typescript
// src/pages/trading/chart/services/ChartWebSocketService.ts
export class ChartWebSocketService {
  private connections = new Map<string, WebSocket>();
  private subscribers = new Map<string, Set<Function>>();
  
  connect(url: string): Promise<void>
  subscribe(channel: string, callback: Function): UnsubscribeFn
  disconnect(url: string): void
}
```

#### 4.2 Create Centralized Data Manager
```typescript
// src/pages/trading/chart/services/ChartDataManager.ts
export class ChartDataManager {
  constructor(
    private apiService: ChartAPIService,
    private wsService: ChartWebSocketService,
    private cacheService: ChartCacheService
  ) {}
  
  async loadHistoricalData(config: ChartConfig): Promise<CandlestickData[]>
  setupRealtimeUpdates(config: ChartConfig): UnsubscribeFn
  async fillDataGaps(gaps: GapInfo[]): Promise<CandlestickData[]>
}
```

### Phase 5: Add Comprehensive Testing (Ongoing) - Week 5

#### 5.1 Unit Tests
- All utility functions (100% coverage)
- Store state management
- Service method testing
- Component logic testing

#### 5.2 Integration Tests
- Data flow from API to UI
- WebSocket connection and updates
- Error recovery mechanisms
- Performance monitoring

#### 5.3 E2E Tests
- Complete chart loading flow
- Real-time update processing
- User interaction scenarios
- Cross-browser compatibility

## Implementation Guidelines

### 🔧 Technical Guidelines

1. **Preserve Existing APIs** - Don't break current integrations
2. **Gradual Migration** - Replace one piece at a time
3. **Feature Flags** - Use flags to switch between old/new implementations
4. **Comprehensive Testing** - Test each change thoroughly
5. **Performance Monitoring** - Ensure no performance regressions

### 📋 Code Standards

1. **File Size Limits**
   - Components: ≤200 lines
   - Services: ≤250 lines
   - Utilities: ≤150 lines
   - Hooks: ≤100 lines

2. **Function Complexity**
   - Max 20 lines per function
   - Single responsibility principle
   - Clear naming conventions

3. **Import Organization**
   - External libraries first
   - Internal utilities second
   - Component imports last

### 🔍 Review Checklist

Before merging any refactoring:

- [ ] All existing tests pass
- [ ] New functionality is tested
- [ ] Performance benchmarks maintained
- [ ] Documentation updated
- [ ] No breaking API changes
- [ ] Bundle size impact assessed

## Expected Benefits

### 📈 Immediate Benefits (Weeks 1-2)
- Eliminated duplicate code
- Improved code consistency
- Better utility reusability
- Easier debugging

### 🚀 Medium-term Benefits (Weeks 3-4)
- Smaller, focused components
- Better separation of concerns
- Improved testability
- Faster development cycles

### 🎯 Long-term Benefits (Week 5+)
- Comprehensive test coverage
- Better error handling
- Performance optimizations
- Easier feature additions

## Risk Mitigation

### 🛡️ Low-Risk Changes (Phase 1)
- Extract utilities behind same APIs
- Add tests before changing implementation
- Use TypeScript for compile-time safety

### ⚠️ Medium-Risk Changes (Phases 2-3)
- Feature flags for A/B testing
- Gradual rollout to subset of users
- Performance monitoring in production
- Quick rollback procedures

### 🚨 High-Risk Changes (Phase 4)
- Extensive testing in staging environment
- Gradual migration of components
- Monitoring and alerting setup
- Staff availability for incident response

## Success Metrics

### 📊 Code Quality Metrics
- File size reduction: Target 30% average decrease
- Code duplication: Target <5% duplicate blocks
- Test coverage: Target >85% line coverage
- Build time: Maintain or improve current times

### 🔧 Developer Experience Metrics
- Time to implement new features: Target 25% reduction
- Bug discovery time: Target 40% improvement
- Code review time: Target 30% reduction
- Onboarding time for new developers: Target 50% reduction

### 🎯 User Experience Metrics
- Chart load time: Maintain <500ms
- Real-time update latency: Maintain <100ms
- Memory usage: Target 20% reduction
- Error rates: Target <0.1% user sessions

## Timeline Summary

| Week | Phase | Risk Level | Key Deliverables |
|------|-------|------------|------------------|
| 1 | Extract Utilities | Low | granularityHelpers, priceFormatters, timeHelpers, validationHelpers |
| 2 | Break Down ChartInfo | Medium | TrafficLight, CandleCounter, CandleCountdown, PriceDisplay components |
| 3 | Refactor ChartCore | High | useDataLoader, useRealtimeSubscription hooks, simplified ChartCore |
| 4 | Split Services | Medium | ChartWebSocketService, ChartDataManager |
| 5 | Testing & Polish | Low | Comprehensive test suite, performance monitoring |

## Next Steps

1. **Review and Approve Plan** - Team review of refactoring strategy
2. **Set Up Testing Framework** - Ensure robust testing infrastructure
3. **Create Feature Flags** - Set up ability to toggle old/new implementations
4. **Start Phase 1** - Begin with low-risk utility extraction
5. **Monitor and Adapt** - Adjust plan based on learnings from each phase

This refactoring plan will transform the chart codebase into a more maintainable, testable, and scalable system while preserving all existing functionality and performance characteristics.