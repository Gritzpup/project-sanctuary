# Phase 15: Medium-Priority Optimizations

**Date**: October 20, 2025
**Focus**: Eliminate 4 medium-impact performance bottlenecks
**Status**: 🚀 **READY FOR IMPLEMENTATION**

---

## OPTIMIZATION TARGETS

### Fix #9: Array Slicing Optimization

**File**: `src/pages/trading/chart/hooks/useDataLoader.svelte.ts:134-150`

**Problem**:
- `getVisibleCandles()` uses `.slice()` to get last N candles
- Creates new array object every time: memory allocation
- Called frequently by chart positioning/rendering
- With 1440 candles, slicing 60 times/second = 60 allocations/sec
- **Impact**: Unnecessary memory pressure and GC

**Solution**:
- Replace `.slice()` with array indices (view pattern)
- Return reference-based view instead of copy
- Use wrapper object with start/end indices
- Lazy-materialize only when needed

**Implementation**:
```typescript
// Instead of:
export function getVisibleCandles(candles: any[], visibleCount: number): any[] {
  if (candles.length <= visibleCount) return candles;
  return candles.slice(-visibleCount);
}

// Do this:
export class ArrayView<T> {
  constructor(
    private array: T[],
    private startIndex: number,
    private endIndex: number
  ) {}

  get length(): number {
    return this.endIndex - this.startIndex;
  }

  get(index: number): T | undefined {
    const actualIndex = this.startIndex + index;
    if (actualIndex < this.startIndex || actualIndex >= this.endIndex) return undefined;
    return this.array[actualIndex];
  }

  // Materialize only when needed
  toArray(): T[] {
    return this.array.slice(this.startIndex, this.endIndex);
  }
}

export function getVisibleCandles(
  candles: any[],
  visibleCount: number
): ArrayView<any> | any[] {
  if (candles.length <= visibleCount) return candles;

  const startIndex = Math.max(0, candles.length - visibleCount);
  return new ArrayView(candles, startIndex, candles.length);
}
```

**Expected Impact**:
- Array allocations: 60/sec → 0/sec (**100% reduction**)
- Memory overhead: Per-slice allocation eliminated
- CPU cache efficiency: Improved (no copy operation)
- **Overall**: 5-10% reduction in memory allocations

---

### Fix #10: String Allocation Reduction

**File**: `src/pages/trading/orderbook/components/OrderbookView.svelte` (estimated)

**Problem**:
- Format price strings repeatedly (bid/ask displays)
- Template literals create new string objects constantly
- `formatPrice(price, decimals)` called 100+ times per render
- Each call allocates new string: memory churn
- **Impact**: String allocation pressure, GC overhead

**Solution**:
- Cache formatted price strings with `price -> string` map
- Reuse formatted strings for same prices (common case)
- Auto-invalidate cache when precision changes
- Lazy-format on first access

**Implementation**:
```typescript
class PriceFormatter {
  private cache: Map<string, string> = new Map();
  private maxCacheSize: number = 1000;
  private lastClearTime: number = Date.now();
  private CACHE_TTL_MS: number = 60000; // Clear every minute

  format(price: number, decimals: number): string {
    const cacheKey = `${price}:${decimals}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Format and cache
    const formatted = price.toFixed(decimals);

    if (this.cache.size < this.maxCacheSize) {
      this.cache.set(cacheKey, formatted);
    } else if (Date.now() - this.lastClearTime > this.CACHE_TTL_MS) {
      // Periodically clear to prevent unbounded growth
      this.cache.clear();
      this.lastClearTime = Date.now();
      this.cache.set(cacheKey, formatted);
    }

    return formatted;
  }
}
```

**Expected Impact**:
- String allocations: 100+/render → <10/render (**95% reduction**)
- Cache hit rate: >85% (most prices repeat)
- Memory churn: Dramatically reduced
- **Overall**: 10-15% reduction in memory allocations

---

### Fix #11: Input Handler Debouncing

**File**: `src/pages/trading/chart/components/controls/ChartControls.svelte` (estimated)

**Problem**:
- Input handlers (search, filter, zoom) fire on every keystroke
- Each keystroke triggers state update, validation, API call
- 10 keystrokes/second = 10 state updates, 10 validations, 10 API calls
- No throttling/debouncing: excessive work
- **Impact**: High CPU usage, unnecessary API calls

**Solution**:
- Debounce input handlers with configurable delay
- Only fire on final keystroke (after 300ms pause)
- Cancel pending requests when new input arrives
- Batch multiple inputs into single update

**Implementation**:
```typescript
// Utility debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}

// Usage in component
const handleSearch = debounce((query: string) => {
  // API call happens here
  searchOrderbook(query);
}, 300);

// In template
<input onchange={(e) => handleSearch(e.target.value)} />
```

**Expected Impact**:
- API calls: 10/sec → <1/sec (**90% reduction**)
- State updates: 10/sec → <1/sec (**90% reduction**)
- CPU usage: 30-40% reduction for input-heavy pages
- Network bandwidth: Significantly reduced
- **Overall**: 20-30% reduction in CPU during user input

---

### Fix #12: Cache Warming Strategies

**File**: `src/pages/trading/chart/services/ChartPrefetcher.ts` (estimated)

**Problem**:
- Chart data loaded on-demand when user changes granularity
- Cold cache: 2-3 second wait for data load
- User perceives lag when switching timeframes
- No predictive loading: wastes opportunity
- **Impact**: Poor UX for frequent timeframe switching

**Solution**:
- Pre-fetch adjacent timeframes in background (predictive loading)
- Warm cache with historical data during idle time
- Prefetch popular granularities (1m, 5m, 1h, 1d)
- Use lower-priority requests (async, background)

**Implementation**:
```typescript
class ChartPrefetcher {
  private prefetchQueue: Array<{granularity: string; priority: number}> = [];
  private isProcessing: boolean = false;
  private processedGranularities: Set<string> = new Set();

  async prefetchAdjacentTimeframes(currentGranularity: string): Promise<void> {
    const adjacentGranularities = this.getAdjacentGranularities(currentGranularity);

    for (const granularity of adjacentGranularities) {
      if (this.processedGranularities.has(granularity)) continue;

      this.prefetchQueue.push({
        granularity,
        priority: 10 // Lower priority than user requests
      });
    }

    if (!this.isProcessing) {
      this.processPrefetchQueue();
    }
  }

  private async processPrefetchQueue(): Promise<void> {
    if (this.prefetchQueue.length === 0) return;

    this.isProcessing = true;
    this.prefetchQueue.sort((a, b) => b.priority - a.priority);

    while (this.prefetchQueue.length > 0) {
      const { granularity } = this.prefetchQueue.shift()!;

      try {
        // Use lower-priority fetch with longer timeout
        await this.prefetchCandles(granularity, {
          timeout: 30000, // 30s timeout (longer than normal)
          priority: 'low',
          background: true
        });

        this.processedGranularities.add(granularity);
      } catch (error) {
        // Silently fail - prefetch is best-effort
      }

      // Yield to main thread periodically
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  private getAdjacentGranularities(current: string): string[] {
    const granularities = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
    const currentIndex = granularities.indexOf(current);

    return [
      granularities[currentIndex - 1],
      granularities[currentIndex + 1]
    ].filter(g => g !== undefined);
  }
}
```

**Expected Impact**:
- Timeframe switch latency: 2-3s → <500ms (**80% improvement**)
- Smooth UX: User perception of responsiveness improved
- Background prefetch: Happens during idle time (no impact)
- Cache hit rate: >90% for adjacent timeframes
- **Overall**: Better UX with minimal CPU cost

---

## IMPLEMENTATION STRATEGY

### Phase 15a: Array Slicing (LOW RISK)
- Internal optimization only
- No API changes
- Can test independently
- **Time**: 1-2 hours

### Phase 15b: String Caching (LOW RISK)
- Localized to formatting functions
- Cache invalidation handles edge cases
- Existing tests should pass
- **Time**: 1-2 hours

### Phase 15c: Input Debouncing (MEDIUM RISK)
- Needs careful testing with user interactions
- Must not break responsive feel
- API call reduction needs verification
- **Time**: 2-3 hours

### Phase 15d: Cache Warming (LOW RISK)
- Background operation only
- Doesn't affect current UX
- Can disable if needed
- **Time**: 2-3 hours

---

## PERFORMANCE EXPECTATIONS

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Array allocations/sec | 60+ | <5 | **95%** |
| String allocations/sec | 100+ | <10 | **95%** |
| API calls during input | 10/sec | <1/sec | **90%** |
| Timeframe switch latency | 2-3s | <500ms | **80%** |
| Overall memory churn | High | Low | **70%+** |

---

## TESTING RECOMMENDATIONS

### Unit Tests
- ArrayView indexing and length calculations
- PriceFormatter cache invalidation
- Debounce delay and cancellation
- Prefetch queue ordering

### Integration Tests
- Chart operates normally with ArrayView
- Prices display correctly with cached formatting
- Input handlers work as expected with debounce
- Timeframe switching feels responsive

### Performance Tests
- Memory allocation profiling
- API call frequency verification
- CPU usage during input
- Cache hit rate validation

### User Experience Tests
- Search/filter responsiveness
- Timeframe switching smoothness
- No "lag" perception
- Natural feel of interactions

---

## RISK ASSESSMENT

| Fix | Risk | Mitigation | Rollback |
|-----|------|-----------|----------|
| #9 | LOW | Unit tests + comparison with slice() | Replace with slice() |
| #10 | LOW | TTL-based invalidation | Disable caching |
| #11 | MEDIUM | Adjust debounce timing as needed | Remove debounce |
| #12 | LOW | Background operation only | Disable prefetch |

---

## SUCCESS CRITERIA

- ✅ No new assertion errors or exceptions
- ✅ Chart operates normally with optimizations
- ✅ API calls reduced as expected
- ✅ UI remains responsive to user input
- ✅ Memory allocations reduced by 70%+
- ✅ All existing tests pass
- ✅ User experience maintained or improved

---

## DEPLOYMENT STRATEGY

**Recommended Order**:
1. Fix #9 (Array slicing) - Low risk, independent
2. Fix #10 (String caching) - Low risk, independent
3. Fix #12 (Cache warming) - Low risk, background only
4. Fix #11 (Input debouncing) - Medium risk, careful testing

**Safe Rollout**:
- Test each fix in isolation for 30 minutes
- Deploy together for combined benefit
- Monitor metrics for 1 hour post-deploy
- Have quick rollback plan ready

---

## ESTIMATED COMPLETION

- Implementation: 6-10 hours
- Testing: 3-4 hours
- Documentation: 1-2 hours
- **Total**: 10-16 hours

---

## NEXT PHASES

- **Phase 16**: Low-priority optimizations (Web Workers, lazy loading)
- **Phase 17**: Architecture improvements (state management, rendering)
- **Phase 18**: Advanced optimizations (SIMD, GPU acceleration)

---

**Ready to implement Phase 15? 🚀**

Let me know which fix to start with, or I can do all four in sequence!
