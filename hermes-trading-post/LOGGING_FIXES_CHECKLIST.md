# Logging Fixes Checklist

This document provides a step-by-step guide to fix excessive logging in the hermes-trading-post codebase.

## PHASE 1: CRITICAL FIXES (HIGH IMPACT)

### [ ] Fix 1.1: Remove Ticker Detection Log
**File**: `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts` (Lines 154-156)
**Current Code**:
```typescript
// 🔍 DEBUG: Log ticker detection once per minute
if (Date.now() % 60000 < 100 && isTicker) {
  console.log(`[Realtime] 🔍 Ticker detected: price=${price}, isTicker=${isTicker}, fullCandleData.time=${fullCandleData?.time}`);
}
```

**Action**: REMOVE these 3 lines entirely (they serve no production purpose and create noise)

**Replacement**: None needed - ticker handling logic remains intact

**Testing**: 
- [ ] Verify price updates still work
- [ ] Check browser console for reduced noise
- [ ] Run: `tilt logs browser-monitor --follow`

**Impact**: Removes ~50-100 logs/minute

---

### [ ] Fix 1.2: Gate Zoom Maintenance Log with DEBUG_FLAGS
**File**: `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts` (Line 126)
**Current Code**:
```typescript
ChartDebug.log(`Maintained 60 candle zoom: showing ${visibleCandles.length} candles`);
```

**Action**: Replace with gated version
**New Code**:
```typescript
if (DEBUG_FLAGS.POSITIONING) {
  ChartDebug.positioning(`Zoom maintained: ${visibleCandles.length} candles`);
}
```

**Note**: Must import DEBUG_FLAGS at top of file:
```typescript
import { DEBUG_FLAGS, ChartDebug } from '../utils/debug';
```

**Testing**:
- [ ] Verify zoom still works normally
- [ ] Enable DEBUG_FLAGS.POSITIONING to see log
- [ ] Disable it to verify log is hidden

**Impact**: Removes zoom logs from normal operation, keeps for debugging

---

## PHASE 2: HIGH PRIORITY FIXES

### [ ] Fix 2.1: Consolidate Historical Data Loading Logs
**File**: `/src/pages/trading/chart/hooks/useHistoricalDataLoader.svelte.ts`

**Current Code (Lines 123, 128, 136)**:
```typescript
ChartDebug.log('Scroll position check', {...});  // Every scroll
ChartDebug.log(`Loading ${loadAmount} additional historical candles...`);
ChartDebug.log(`Successfully loaded ${addedCount} historical candles`);
```

**Action**: Consolidate into single batched event
**New Code**:
```typescript
// Remove scroll position check log entirely (too frequent)
// Keep only the load completion log:
ChartDebug.log(`Historical data: loaded ${addedCount} new candles`);
```

**Testing**:
- [ ] Verify historical loading still works
- [ ] Check console shows only one log per load event
- [ ] Scroll chart and verify no excessive logs

**Impact**: Removes 30-40 logs per session

---

### [ ] Fix 2.2: Reduce IndexedDB Cache Logging
**File**: `/src/pages/trading/chart/services/ChartIndexedDBCache.ts`

**Current Code (Multiple locations)**:
```typescript
ChartDebug.log(`✅ Cache hit for ${key}`, {...});  // Line ~145
ChartDebug.log(`💾 Cached ${candles.length} candles for ${key}`);  // Line ~165
ChartDebug.log(`🔄 Appended ${newCandles.length} candles to cache`, {...});  // Line ~185
```

**Action**: Only log on first occurrence per key
**Add at top of class**:
```typescript
private loggedCacheKeys = new Set<string>();

private logCacheEvent(message: string, key: string) {
  if (!this.loggedCacheKeys.has(key)) {
    ChartDebug.log(message);
    this.loggedCacheKeys.add(key);
  }
}
```

**New Code**:
```typescript
this.logCacheEvent(`Cache hit for ${key}`, key);  // Only logs once per key
this.logCacheEvent(`Cached ${candles.length} candles`, key);  // Only logs once
// Skip append logging entirely (too frequent)
```

**Testing**:
- [ ] First load logs cache hit
- [ ] Subsequent loads do NOT log
- [ ] Switch to different pair, logs again
- [ ] IndexedDB functionality unchanged

**Impact**: Reduces 20-30 logs per session

---

## PHASE 3: MEDIUM PRIORITY FIXES

### [ ] Fix 3.1: Reduce Full Candle Object Logging
**File**: `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts`

**Current Code (Lines 141, 191, 197, 301, 307)**:
```typescript
console.warn('⚠️ [Realtime] No historical candles available, skipping real-time update');
console.warn('[Realtime] Skipping ticker update - currentCandle has null values:', currentCandle);
console.warn('[Realtime] Fixing invalid candle - high < low:', currentCandle);
```

**Action**: Log only essential fields
**New Code**:
```typescript
console.warn('⚠️ [Realtime] No historical candles available');
console.warn('[Realtime] Skipping ticker update - invalid candle time:', currentCandle?.time);
console.warn('[Realtime] Invalid candle: high=${currentCandle?.high} < low=${currentCandle?.low}');
```

**Testing**:
- [ ] Verify error messages still clear
- [ ] Check logs show required info but not full objects
- [ ] Error handling unchanged

**Impact**: Better performance on errors, cleaner logs

---

### [ ] Fix 3.2: Reduce Data Service Verbosity
**File**: `/src/pages/trading/chart/services/ChartDataService.ts`

**Current Code**:
```typescript
ChartDebug.log(`Fetching ${additionalCandleCount} additional historical candles`, {
  startTime: new Date(fetchStartTime * 1000).toISOString(),
  endTime: new Date(firstCandleTime * 1000).toISOString(),
  dataCount: historicalData.length
});
```

**Action**: Simplify to essentials
**New Code**:
```typescript
ChartDebug.log(`Fetching ${additionalCandleCount} historical candles`);
```

**Testing**:
- [ ] Historical loading still works
- [ ] Logs are simpler but informative
- [ ] No console errors

**Impact**: Removes 10-15 logs per session

---

## PHASE 4: VERIFICATION

### [ ] Verify All Changes
Before considering this complete, verify:

1. **Console Logging Reduced**:
   ```bash
   tilt logs browser-monitor --follow
   # Should see ~70% reduction in console noise
   ```

2. **Error Handling Intact**:
   - [ ] Test chart load error scenarios
   - [ ] Verify error messages are clear
   - [ ] Check WebSocket disconnect/reconnect logs

3. **Debugging Still Possible**:
   - [ ] Enable individual DEBUG_FLAGS
   - [ ] Verify logs appear when flags enabled
   - [ ] Test ALL flag enables everything

4. **Performance Improved**:
   - [ ] Monitor memory usage in DevTools
   - [ ] Check console performance (fewer logs = faster)
   - [ ] Verify UI responsiveness unchanged

5. **No Regressions**:
   - [ ] Test chart loading with different timeframes
   - [ ] Test real-time updates
   - [ ] Test cache operations
   - [ ] Test historical data loading

---

## Testing Command Reference

### View Current Logging
```bash
# Check browser console logs
tilt logs browser-monitor --follow

# Filter for specific log types
tilt logs browser-monitor 2>&1 | grep -i "error|warn|critical"

# Count logs per type
tilt logs browser-monitor 2>&1 | grep -o "\[.*\]" | sort | uniq -c | sort -rn
```

### Monitor Performance
```bash
# Watch console in real-time while interacting with chart
tilt logs browser-monitor --follow

# Record baseline before changes
tilt logs browser-monitor > /tmp/before.log

# After changes
tilt logs browser-monitor > /tmp/after.log

# Compare
wc -l /tmp/before.log /tmp/after.log
```

### Enable Debug Flags
In browser console:
```javascript
// Open Developer Tools Console and run:
window.logger?.debug('ChartDebug', 'Debug message here');

// Or modify debug.ts to enable flags temporarily:
// DEBUG_FLAGS.ALL = true;  // Temporarily enable all
// DEBUG_FLAGS.REALTIME = true;  // Enable specific category
```

---

## Rollback Plan (If Issues Arise)

If any fixes cause issues:

1. **Identify which fix caused it** (narrow it down)
2. **Revert that specific fix** using git:
   ```bash
   git checkout src/path/to/file.ts
   ```
3. **Keep other fixes** that are working
4. **Create issue** documenting the problem

---

## Success Criteria

All fixes are complete when:

- [ ] 3 critical per-frame logs are REMOVED
- [ ] Repetitive logs are REDUCED with consolidation
- [ ] Data dumps show summary only
- [ ] Console noise reduced by 60-70%
- [ ] Error logging still functional
- [ ] DEBUG_FLAGS working for all categories
- [ ] No regressions in functionality
- [ ] Developers can enable detailed logging when needed

---

## Files Modified Summary

```
Total Files Changed: 6

HIGH PRIORITY (modify first):
  [x] useRealtimeSubscription.svelte.ts  (2 fixes)
  [x] ChartDataService.ts               (1 fix)

MEDIUM PRIORITY (modify next):
  [x] useHistoricalDataLoader.svelte.ts (1 fix)
  [x] ChartIndexedDBCache.ts            (1 fix)

LOW PRIORITY (optional):
  [ ] chartCacheService.ts
  [ ] backtestingDataService.ts
```

---

## Questions?

Refer to `/LOGGING_ANALYSIS.md` for detailed analysis or `/LOGGING_SUMMARY.txt` for quick reference.

