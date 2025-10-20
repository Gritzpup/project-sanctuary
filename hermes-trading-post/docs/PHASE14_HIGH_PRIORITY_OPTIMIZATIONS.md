# Phase 14: High-Priority Optimizations

**Date**: October 20, 2025
**Focus**: Eliminate 3 high-impact performance bottlenecks identified in Phase 13 analysis
**Status**: 🚀 **READY TO IMPLEMENT**

---

## OPTIMIZATION TARGETS

### Fix #6: ChartDataManager Full Array Sort → Incremental Sorting

**File**: `src/pages/trading/chart/components/canvas/ChartDataManager.svelte:57-120`

**Problem**:
- Every new candle triggers `updateChartData()`
- Full sort on entire array: O(n log n) complexity
- With 1440 candles (1 day of 1m data), that's ~10,000 operations per update
- Real-time updates: 10-30 Hz = 100,000-300,000 sort operations per second
- **Impact**: Massive CPU overhead on each price tick

**Solution**:
- Track if data is already sorted with `isSorted()` check
- Use binary search to find insertion point for new candles
- Only sort if data is truly out of order (rare)
- Replace full sort with O(n) linear scan when needed

**Implementation**:
```typescript
// Add helper functions
function isSorted(candles: any[]): boolean {
  for (let i = 1; i < candles.length; i++) {
    const prevTime = typeof candles[i-1].time === 'string'
      ? parseInt(candles[i-1].time)
      : candles[i-1].time;
    const currTime = typeof candles[i].time === 'string'
      ? parseInt(candles[i].time)
      : candles[i].time;

    if (prevTime > currTime) return false;
  }
  return true;
}

function binarySearch(candles: any[], targetTime: number): number {
  let left = 0, right = candles.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = typeof candles[mid].time === 'string'
      ? parseInt(candles[mid].time)
      : candles[mid].time;

    if (midTime === targetTime) return mid;
    if (midTime < targetTime) left = mid + 1;
    else right = mid - 1;
  }

  return left; // Insertion point
}
```

**Expected Impact**:
- Sort operations: 100,000+/sec → <1,000/sec (**99% reduction**)
- CPU usage: 40-50% → 5-10% (**80-90% reduction**)
- Update latency: 50ms → <5ms (**90% improvement**)

---

### Fix #7: VolumePlugin Color Recalculation → Caching

**File**: `src/pages/trading/chart/plugins/series/VolumePlugin.ts:141-230`

**Problem**:
- Volume bars colored based on price direction (up/down)
- Every data update recalculates all colors
- Checking `candle.close >= prevCandle.close` for each bar repeatedly
- With 1440 bars + real-time updates: 1440+ comparisons per update
- **Impact**: Unnecessary memory allocations and CPU cycles

**Solution**:
- Cache color decisions with `colorCache: Map<number, {isPriceUp: boolean, color: string}>`
- Only recalculate colors when new candles arrive
- For updates to existing candles, only recalculate the affected bar
- Use version/TTL system to invalidate cache when needed

**Implementation**:
```typescript
// Add to VolumePlugin class
private colorCache: Map<number, { isPriceUp: boolean; color: string }> = new Map();
private lastCacheVersion: number = 0;

private getColorForCandle(index: number, candle: any, prevCandle: any, settings: VolumePluginSettings): string {
  const cacheKey = index;

  // Check if cached
  const cached = this.colorCache.get(cacheKey);
  if (cached) return cached.color;

  // Calculate color
  const isPriceUp = prevCandle ? candle.close >= prevCandle.close : true;
  const color = isPriceUp
    ? (settings.upColor || '#26a69aCC')
    : (settings.downColor || '#ef5350CC');

  // Cache result
  this.colorCache.set(cacheKey, { isPriceUp, color });

  return color;
}

// Clear cache when data changes significantly
private shouldClearColorCache(newCandleCount: number): boolean {
  const timeSinceLastClear = Date.now() - this.lastCacheClearTime;
  const cacheSize = this.colorCache.size;

  // Clear if cache is 2x larger than data (indicating stale entries)
  // or every 30 seconds for TTL-based invalidation
  return cacheSize > newCandleCount * 2 || timeSinceLastClear > 30000;
}
```

**Expected Impact**:
- Color calculations: 1440+/update → <10/update (**99% reduction**)
- Memory allocations: 1440/sec → <100/sec (**99% reduction**)
- GPU rendering: Faster color lookups from cache
- **Overall**: 30-40% reduction in volume plugin overhead

---

### Fix #8: orderbookStore Array Allocations → Memoization

**File**: `src/pages/trading/orderbook/stores/orderbookStore.svelte.ts:400-500`

**Problem**:
- `getBids()` and `getAsks()` called frequently by UI components
- Each call filters, sorts, and slices array: O(n log n) operation
- Creates new array object every time: memory churn
- With 100+ bids/asks: 100+ allocations per update
- Real-time updates: 10-30 Hz = 1,000-3,000 array allocations per second
- **Impact**: Garbage collection overhead, memory pressure

**Solution**:
- Cache results per requested count: `Map<count, CachedData>`
- Track data version: when data changes, invalidate cache
- Return cached result if count matches and data hasn't changed
- Automatic TTL-based cache invalidation (1-2 seconds)

**Implementation**:
```typescript
// Add to orderbookStore class
private bidsMemoCache: Map<number, any[]> = new Map();
private asksMemoCache: Map<number, any[]> = new Map();
private lastBidsCacheVersion: number = 0;
private lastAsksCacheVersion: number = 0;
private lastBidsUpdateTime: number = 0;
private lastAsksUpdateTime: number = 0;

public getBids(count: number = 50): any[] {
  const now = Date.now();
  const timeSinceUpdate = now - this.lastBidsUpdateTime;

  // Cache miss if:
  // 1. Not in cache
  // 2. Different count requested
  // 3. Data has changed (version mismatch)
  // 4. Cache expired (>2 seconds old)
  const cached = this.bidsMemoCache.get(count);
  if (cached && this.lastBidsCacheVersion === this.currentBidsVersion && timeSinceUpdate < 2000) {
    return cached;
  }

  // Calculate new value
  const result = this._bids
    .filter(b => b.price > 0)
    .sort((a, b) => b.price - a.price) // Descending
    .slice(0, count);

  // Cache it
  this.bidsMemoCache.set(count, result);
  this.lastBidsCacheVersion = this.currentBidsVersion;
  this.lastBidsUpdateTime = now;

  // Clear old cache entries for other counts
  if (this.bidsMemoCache.size > 5) {
    const keys = Array.from(this.bidsMemoCache.keys());
    const oldestKey = keys[0];
    this.bidsMemoCache.delete(oldestKey);
  }

  return result;
}
```

**Expected Impact**:
- Array allocations: 1,000-3,000/sec → <100/sec (**95% reduction**)
- Sort operations: Eliminated for cached calls
- Memory churn: Dramatic reduction in GC pressure
- UI responsiveness: Faster component updates
- **Overall**: 50-60% reduction in orderbook store overhead

---

## IMPLEMENTATION STRATEGY

### Phase 14a: ChartDataManager Sorting (LOW RISK)
- Minimal API changes
- Backward compatible
- Can test in isolation
- Expected time: 2-3 hours

### Phase 14b: VolumePlugin Color Caching (LOW RISK)
- Internal caching only
- No API changes
- Can test with existing tests
- Expected time: 1-2 hours

### Phase 14c: orderbookStore Memoization (MEDIUM RISK)
- Public API unchanged
- Internal caching strategy
- Needs testing with multiple UI components
- Expected time: 2-3 hours

---

## PERFORMANCE EXPECTATIONS

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Chart update sort ops/sec | 100,000+ | <1,000 | **99%** |
| Volume color calcs/update | 1440+ | <10 | **99%** |
| Orderbook allocations/sec | 1,000-3,000 | <100 | **95%** |
| Chart update latency | 50ms | <5ms | **90%** |
| Overall CPU (trading UI) | 60-70% | 15-25% | **60-75%** |
| Memory GC pauses | Frequent | Rare | Significant |

---

## TESTING RECOMMENDATIONS

### Unit Tests
- `isSorted()` function with various arrays
- `binarySearch()` with edge cases
- VolumePlugin color cache invalidation
- orderbookStore cache version tracking

### Integration Tests
- Chart updates with rapid price changes
- Volume colors update correctly
- Orderbook displays correct bid/ask counts
- No memory leaks over 5-minute trading session

### Performance Tests
- Measure CPU usage before/after each fix
- Monitor memory allocations
- Track GC pause times
- Compare chart update latency

### Stress Tests
- Rapid price updates (100 Hz L2 stream)
- Large orderbook (1000+ levels)
- Extended trading session (1+ hour)
- Multiple chart timeframes open simultaneously

---

## DEPLOYMENT STRATEGY

**Recommended Order**:
1. Fix #6 (ChartDataManager) - No dependency on others
2. Fix #7 (VolumePlugin) - Independent optimization
3. Fix #8 (orderbookStore) - Can be tested in parallel

**Safe Rollout**:
- Test each fix in isolation for 1 hour
- Deploy together for maximum combined benefit
- Monitor metrics for 30 minutes post-deploy
- Have rollback plan ready

---

## RISK ASSESSMENT

| Fix | Risk | Mitigation | Rollback |
|-----|------|-----------|----------|
| #6 | LOW | Unit tests + perf tests | Remove isSorted check |
| #7 | LOW | TTL-based invalidation | Disable cache |
| #8 | MEDIUM | Cache version tracking | Clear all caches |

---

## SUCCESS CRITERIA

- ✅ No new assertion errors or exceptions
- ✅ Chart updates maintain <50ms latency
- ✅ CPU usage reduced by 60-75%
- ✅ Memory allocations reduced by 95%+
- ✅ All existing tests pass
- ✅ Performance regression tests pass

---

## NEXT PHASES

- **Phase 15**: Medium-priority optimizations (array slicing, string allocations)
- **Phase 16**: Low-priority optimizations (event debouncing, cache warming)
- **Phase 17**: Architecture improvements (worker threads, IndexedDB optimization)

---

## ESTIMATED COMPLETION

- Implementation: 5-8 hours
- Testing: 3-4 hours
- Documentation: 1-2 hours
- **Total**: 9-14 hours

---

## COMMIT STRATEGY

```bash
# Separate commits for each fix for easier review and rollback
git commit -m "Phase 14a: ChartDataManager - incremental sorting optimization"
git commit -m "Phase 14b: VolumePlugin - color calculation caching"
git commit -m "Phase 14c: orderbookStore - bid/ask memoization"
```

---

**Ready to proceed with Phase 14a (ChartDataManager optimization)? 🚀**
