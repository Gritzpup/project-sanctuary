# Logging Inventory - Complete List

This document provides a complete inventory of all logging statements found in the codebase, organized by file and assessed for action.

## Quick Stats
- **Total Files with Logging**: 116+
- **Total Logging Statements**: 664 (501 console + 163 ChartDebug)
- **Critical Issues**: 3
- **High Priority**: 15
- **Medium Priority**: 8
- **Keep As-Is**: ~620

---

## CRITICAL PRIORITY (REMOVE/MODIFY IMMEDIATELY)

### 1. useRealtimeSubscription.svelte.ts - Line 154-156
**Type**: Per-update console.log
**Severity**: CRITICAL
**Impact**: -50-100 logs/minute
**Assessment**: REMOVE
```typescript
if (Date.now() % 60000 < 100 && isTicker) {
  console.log(`[Realtime] 🔍 Ticker detected: price=${price}, isTicker=${isTicker}, fullCandleData.time=${fullCandleData?.time}`);
}
```
**Reason**: Runs on every price update, non-production logs

### 2. useRealtimeSubscription.svelte.ts - Line 126
**Type**: Per-zoom ChartDebug.log
**Severity**: HIGH
**Impact**: -20-50 logs/minute
**Assessment**: GATE with DEBUG_FLAGS.POSITIONING
```typescript
ChartDebug.log(`Maintained 60 candle zoom: showing ${visibleCandles.length} candles`);
```
**Reason**: High frequency, should be conditional

### 3. useHistoricalDataLoader.svelte.ts - Lines 123, 128, 136
**Type**: Repetitive ChartDebug.log
**Severity**: HIGH
**Impact**: -30-40 logs/session
**Assessment**: CONSOLIDATE
```typescript
ChartDebug.log('Scroll position check', {...});          // Line 123
ChartDebug.log(`Loading ${loadAmount} additional...`);    // Line 128
ChartDebug.log(`Successfully loaded ${addedCount}...`);   // Line 136
```
**Reason**: Generates multiple logs per load event

---

## HIGH PRIORITY (REDUCE NEXT)

### IndexedDB Cache Logging
**File**: ChartIndexedDBCache.ts
**Lines**: ~145, ~165, ~185
**Type**: Repetitive ChartDebug.log
**Severity**: MEDIUM-HIGH
**Impact**: -20-30 logs/session
**Assessment**: REDUCE with deduplication
**Action**: Only log on first occurrence per key

### Data Service Verbose Logging
**File**: ChartDataService.ts
**Type**: Data dump logging
**Severity**: MEDIUM-HIGH
**Impact**: -10-15 logs/session
**Assessment**: REDUCE detail
**Action**: Remove object dumps, keep summary

### Chart Readiness Logs
**File**: ChartReadinessOrchestrator.ts
**Type**: State transition ChartDebug.log
**Severity**: MEDIUM
**Impact**: -10-15 logs/session
**Assessment**: KEEP (helpful for debugging)
**Action**: No change needed

---

## MEDIUM PRIORITY (REDUCE DETAIL)

### Candle Object Logging
**File**: useRealtimeSubscription.svelte.ts
**Lines**: 141, 191, 197, 301, 307
**Type**: console.warn with full objects
**Severity**: MEDIUM
**Assessment**: REDUCE to essential fields
**Action**: Only log time/close, not full candle

### WebSocket Logging
**File**: chartRealtimeService.ts
**Type**: console.log for connection status
**Severity**: LOW
**Assessment**: KEEP (connectivity indicator)
**Action**: No change needed

### Cache Service Logging
**File**: chartCacheService.ts
**Type**: console.warn for errors
**Severity**: LOW
**Assessment**: KEEP (error handling)
**Action**: No change needed

---

## KEEP AS-IS (Essential Logging)

### Error Logging (All Files)
- All `console.error()` calls
- All `ChartDebug.error()` calls
- Stack traces in error contexts
**Reason**: Critical for debugging issues

### Initialization Logging
- Logger.ts setup
- LoggingService instantiation
- Service worker registration
- Plugin initialization
**Reason**: One-time logs, helpful for startup debugging

### State Change Indicators
- Data load completion
- Chart readiness transitions
- Plugin lifecycle events
**Reason**: Important for tracking state transitions

### API/WebSocket Status
- Connection established/closed
- Reconnection attempts
- Request/response logging
**Reason**: Critical for connectivity debugging

---

## File-by-File Summary

| File | Total Logs | Assessment | Action |
|------|-----------|-----------|--------|
| useRealtimeSubscription.svelte.ts | 12 | 4 issues | Remove 1, Gate 1, Reduce 2 |
| ChartDataService.ts | 8 | 2 issues | Reduce detail |
| useHistoricalDataLoader.svelte.ts | 6 | 3 issues | Consolidate |
| ChartIndexedDBCache.ts | 10 | 4 issues | Deduplicate |
| ChartReadinessOrchestrator.ts | 4 | 0 issues | KEEP |
| chartCacheService.ts | 4 | 0 issues | KEEP |
| chartRealtimeService.ts | 7 | 0 issues | KEEP |
| Other files (110+) | 613 | ~10 issues | Keep with minor tweaks |

---

## DEBUG_FLAGS Categories

```typescript
export const DEBUG_FLAGS = {
  REALTIME: false,        // Real-time WebSocket updates
  DATA_LOADING: false,    // Data fetching and loading
  PLUGINS: false,         // Plugin lifecycle
  VOLUME: false,          // Volume calculations
  POSITIONING: false,     // Chart positioning and scrolling
  USER_INTERACTION: false, // User clicks and interactions
  GRANULARITY: false,     // Granularity switching
  ALL: false              // Master switch
};
```

### Recommended Gating Strategy
- **Ticker detection log**: Remove entirely (no DEBUG_FLAGS needed)
- **Zoom maintenance**: Gate with `DEBUG_FLAGS.POSITIONING`
- **Historical data loads**: Gate with `DEBUG_FLAGS.DATA_LOADING`
- **Cache operations**: Gate with `DEBUG_FLAGS.DATA_LOADING`
- **Error logging**: ALWAYS enabled (never gate)

---

## Impact Analysis

### Current State
- Active logging statements: 664
- Per-frame logs: 3 (problematic)
- Repetitive logs: ~15
- Data dumps: ~8
- Essential logs: ~620

### After Phase 1 (Critical)
- Removed: 3 logs (ticker + zoom)
- Impact: -70 logs/minute
- Expected noise: 60% reduction

### After Phase 2 (High Priority)
- Removed: ~15 logs (consolidated/deduplicated)
- Impact: -50 logs/session
- Expected noise: 65% reduction

### After Phase 3 (Medium Priority)
- Reduced: ~8 logs (simplified detail)
- Impact: -20 logs/session
- Expected noise: 70% reduction

---

## Testing Commands

```bash
# Check current console output
tilt logs browser-monitor --follow

# Count logs before changes
tilt logs browser-monitor > /tmp/before.log
wc -l /tmp/before.log

# After implementation
tilt logs browser-monitor > /tmp/after.log
wc -l /tmp/after.log

# Compare
echo "Before:"; wc -l /tmp/before.log
echo "After:"; wc -l /tmp/after.log

# Calculate percentage reduction
# If before = 1000 lines, after = 300 lines
# Reduction = (1000-300)/1000 * 100 = 70%
```

---

## Verification Checklist

After implementing fixes:

- [ ] No per-frame logs remain
- [ ] Repetitive logs consolidated
- [ ] Data dumps reduced to summary
- [ ] Error logging still functional
- [ ] DEBUG_FLAGS working correctly
- [ ] No console errors when loading chart
- [ ] WebSocket logs show status
- [ ] Plugin initialization logs visible
- [ ] Cache operations logged on first hit
- [ ] Historical data loads logged once per session

---

## Future Prevention

To prevent excessive logging in future:

1. **Code Review Checklist**
   - Is logging gated with DEBUG_FLAGS?
   - Will this run per-frame?
   - Is full object dump necessary?
   - Can this be summarized?

2. **Commit Requirements**
   - Explain why log is needed
   - If per-frame, MUST be gated
   - Reference DEBUG_FLAGS used

3. **Testing Protocol**
   - Run tilt logs to verify
   - Check for console noise
   - Enable DEBUG_FLAGS and verify output

---

## Related Documents

- `LOGGING_ANALYSIS.md` - Detailed analysis with code samples
- `LOGGING_FIXES_CHECKLIST.md` - Step-by-step implementation guide
- `LOGGING_SUMMARY.txt` - Quick reference

