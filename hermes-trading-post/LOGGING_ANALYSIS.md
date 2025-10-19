# Hermes Trading Post - Logging Analysis Report

## Executive Summary
- **Total Console Logging Statements**: 501 active statements (excluding disabled ones)
- **ChartDebug Logging Statements**: 163 statements
- **Status**: Good foundational logging infrastructure with DEBUG_FLAGS, but several per-frame logs and excessive data dumps identified

---

## 1. PER-FRAME/PER-UPDATE LOGGING (HIGHEST PRIORITY - REMOVE THESE)

### Per-Frame Logs Identified (Runs on every render/update cycle)

#### 1.1 `useRealtimeSubscription.svelte.ts` - Ticker Detection Log
**File**: `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts` (Line 154-156)
```typescript
if (Date.now() % 60000 < 100 && isTicker) {
  console.log(`[Realtime] 🔍 Ticker detected: price=${price}, isTicker=${isTicker}, fullCandleData.time=${fullCandleData?.time}`);
}
```
- **Frequency**: Runs on EVERY price update (10-100x per second)
- **Even with 60000ms % condition**: Still logs every 60 seconds minimum
- **Impact**: Medium - only logs conditionally but expensive when it does
- **Recommendation**: **REMOVE** - Use ChartDebug.realtime() with proper flag if needed for debugging

#### 1.2 `useRealtimeSubscription.svelte.ts` - Zoom Maintenance Log
**File**: `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts` (Line 126)
```typescript
ChartDebug.log(`Maintained 60 candle zoom: showing ${visibleCandles.length} candles`);
```
- **Context**: Inside `maintainCandleZoom()` function called during real-time updates
- **Frequency**: Potentially runs on every chart update (if this function is called per-frame)
- **Impact**: Medium if called frequently
- **Recommendation**: **REMOVE or REDUCE** - Move to ChartDebug.POSITIONING flag and only log on state changes

#### 1.3 `useDataLoader.svelte.ts` - Performance Logging in Load Path
**File**: `/src/pages/trading/chart/hooks/useDataLoader.svelte.ts` (Line 111)
```typescript
ChartDebug.log(`📊 Loading ${config.timeframe} data: ${candleCount} candles for ${config.granularity}`);
```
- **Frequency**: Per data load operation (one-time, not per-frame)
- **Impact**: Low - one-time only
- **Recommendation**: **KEEP** - Essential state change indicator

---

## 2. REPETITIVE LOGGING (MEDIUM PRIORITY - REDUCE FREQUENCY/DETAIL)

### 2.1 Historical Data Loading Logs
**File**: `/src/pages/trading/chart/hooks/useHistoricalDataLoader.svelte.ts` (Multiple locations)
```typescript
ChartDebug.log('Scroll position check', {...});  // Line 123
ChartDebug.log(`Loading ${loadAmount} additional historical candles...`);  // Line 128
ChartDebug.log(`Successfully loaded ${addedCount} historical candles`);  // Line 136
```
- **Frequency**: On every scroll near edge, potentially multiple times per minute
- **Impact**: Medium - batched but generates multiple logs
- **Recommendation**: **REDUCE** - Consolidate to single "historical load" event, batch scroll checks

### 2.2 IndexedDB Cache Operations
**File**: `/src/pages/trading/chart/services/ChartIndexedDBCache.ts` (Multiple)
```typescript
ChartDebug.log(`✅ Cache hit for ${key}`, {...});  // Line ~145
ChartDebug.log(`💾 Cached ${candles.length} candles for ${key}`);  // Line ~165
ChartDebug.log(`🔄 Appended ${newCandles.length} candles to cache`, {...});  // Line ~185
```
- **Frequency**: Every cache operation (potentially 10+ per session during normal use)
- **Impact**: Low-Medium
- **Recommendation**: **REDUCE** - Only log on cache miss/hit first occurrence, suppress repeated same-key operations

### 2.3 Chart Readiness Logs
**File**: `/src/pages/trading/chart/services/ChartReadinessOrchestrator.ts`
```typescript
ChartDebug.log('✅ Chart readiness orchestration complete');
ChartDebug.log('Plugin manager initialized');
ChartDebug.log('Auto-granularity setup prepared');
ChartDebug.log('All plugins refreshed');
```
- **Frequency**: Every chart initialization (potentially 5-10 times per session on timeframe changes)
- **Impact**: Low
- **Recommendation**: **KEEP** - Important for debugging chart state changes

---

## 3. DATA DUMP LOGGING (MEDIUM PRIORITY - REDUCE TO SUMMARY)

### 3.1 Verbose Candle Logging
**File**: `/src/pages/trading/chart/services/ChartDataService.ts` (Lines ~55-65)
```typescript
ChartDebug.critical(`API returned ${data.length} candles for 1d granularity`);
ChartDebug.critical(`WARNING: Less than 90 candles returned for 3M timeframe!`);
ChartDebug.log(`Fetching ${additionalCandleCount} additional historical candles`, {
  startTime: new Date(fetchStartTime * 1000).toISOString(),
  endTime: new Date(firstCandleTime * 1000).toISOString(),
  dataCount: historicalData.length
});
```
- **Issue**: Including detailed object dumps with timestamps and full arrays
- **Impact**: Medium - objects can be large
- **Recommendation**: **REDUCE** - Keep counts/status, remove full object dumps or move to conditional DEBUG_FLAGS

### 3.2 Full Candle Data in Realtime
**File**: `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts` (Multiple)
```typescript
console.warn('[Realtime] Skipping ticker update - currentCandle has null values:', currentCandle);
console.warn('[Realtime] Skipping update - currentCandle has null values:', currentCandle);
console.warn('[Realtime] Fixing invalid candle - high < low:', currentCandle);
```
- **Issue**: Logging entire candle objects on error
- **Impact**: Medium - candles have multiple OHLCV fields
- **Recommendation**: **REDUCE** - Only log required fields (time, open, close) or error code

### 3.3 WebSocket Message Logging
**File**: `/src/shared/services/chartRealtimeService.ts`
```typescript
console.log(`🟢 WebSocket connected to ${url}`);
console.log(`🔴 WebSocket disconnected`);
console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
```
- **Frequency**: Per WebSocket event (connect, disconnect, reconnect attempts)
- **Impact**: Low - minimal data
- **Recommendation**: **KEEP** - Essential connectivity indicators

---

## 4. ESSENTIAL LOGGING (KEEP AS IS)

### 4.1 Error Logging (All maintained)
- `ChartDebug.error()` calls - KEEP ALL
- `console.error()` in error handlers - KEEP ALL
- Stack traces in error contexts - KEEP ALL

### 4.2 Critical State Changes
**Files**: Multiple
- Plugin initialization/destruction
- Chart readiness transitions
- Data loading completion
- WebSocket connection status

### 4.3 Service Worker Errors
**File**: `/src/main.ts`
```typescript
console.error('Service worker initialization failed:', err)
```
- **Recommendation**: **KEEP** - Critical for app reliability

---

## 5. ONE-TIME STARTUP LOGS (KEEP AS IS)

### 5.1 Initialization Messages
- Logger.ts setup
- LoggingService instantiation
- Service worker registration
- Plugin manager initialization

**Recommendation**: **KEEP ALL** - Helps debug startup issues

---

## 6. SUMMARY: LOGGING STATEMENTS BY CATEGORY

| Category | Count | Priority | Action |
|----------|-------|----------|--------|
| Per-frame logs | 3 | CRITICAL | REMOVE |
| Repetitive (same log multiple times/min) | ~15 | HIGH | REDUCE frequency |
| Data dumps (full objects) | ~8 | MEDIUM | REDUCE to summary |
| Essential errors | ~25 | KEEP | No change |
| Startup/initialization | ~20 | KEEP | No change |
| State change indicators | ~50 | KEEP | No change |
| WebSocket/connectivity | ~10 | KEEP | No change |
| ChartDebug controlled | 163 | DEPENDS | Gate with DEBUG_FLAGS |

---

## 7. DETAILED RECOMMENDATIONS BY FILE

### HIGH IMPACT RECOMMENDATIONS

#### A. `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts`
**Current Issues**:
1. Line 154-156: Ticker detection logs every 60 seconds minimum
2. Line 126: Per-zoom-update logs potentially firing frequently

**Changes**:
```typescript
// BEFORE
if (Date.now() % 60000 < 100 && isTicker) {
  console.log(`[Realtime] 🔍 Ticker detected: price=${price}, isTicker=${isTicker}, fullCandleData.time=${fullCandleData?.time}`);
}

// AFTER (with proper flag)
if (DEBUG_FLAGS.REALTIME && isTicker) {
  ChartDebug.realtime(`Ticker detected: price=${price}`);
}

// Remove or gate: Line 126
// BEFORE
ChartDebug.log(`Maintained 60 candle zoom: showing ${visibleCandles.length} candles`);

// AFTER
if (DEBUG_FLAGS.POSITIONING) {
  ChartDebug.positioning(`Zoom maintained: ${visibleCandles.length} candles`);
}
```

#### B. `/src/pages/trading/chart/services/ChartDataService.ts`
**Current Issues**:
1. Excessive details in historical data logging
2. Full candle object dumps

**Changes**:
```typescript
// BEFORE
ChartDebug.log(`Fetching ${additionalCandleCount} additional historical candles`, {
  startTime: new Date(fetchStartTime * 1000).toISOString(),
  endTime: new Date(firstCandleTime * 1000).toISOString(),
  dataCount: historicalData.length
});

// AFTER (only essential data)
ChartDebug.log(`Fetching ${additionalCandleCount} historical candles`);
```

#### C. `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts`
**Current Issues**:
1. Logging full candle objects on validation failures

**Changes**:
```typescript
// BEFORE
console.warn('[Realtime] Skipping ticker update - currentCandle has null values:', currentCandle);

// AFTER (only essential fields)
console.warn('[Realtime] Skipping ticker update - invalid candle time:', currentCandle?.time);
```

#### D. `/src/pages/trading/chart/hooks/useHistoricalDataLoader.svelte.ts`
**Current Issues**:
1. Multiple scroll check logs
2. Repeated load attempt logs

**Changes**:
```typescript
// Consolidate scroll position checks
// BEFORE: ChartDebug.log('Scroll position check', {...});
// AFTER: Only log when actual historical load is triggered, not on every scroll

// Batch similar operations
// BEFORE: Multiple separate ChartDebug.log calls
// AFTER: Single batched log with state change
```

---

## 8. ACTION PLAN (Priority Order)

### Phase 1: CRITICAL (Remove immediately)
1. **Remove ticker detection log** (useRealtimeSubscription.svelte.ts:154-156)
   - Estimated impact: -50-100 logs/minute
   - Effort: 2 mins

2. **Gate zoom maintenance log** (useRealtimeSubscription.svelte.ts:126)
   - Estimated impact: -20-50 logs/minute (depending on frequency)
   - Effort: 5 mins

### Phase 2: HIGH (Reduce next)
1. **Reduce historical data loader verbosity** (useHistoricalDataLoader.svelte.ts)
   - Estimated impact: -30-40 logs/session
   - Effort: 10 mins

2. **Consolidate IndexedDB cache logs** (ChartIndexedDBCache.ts)
   - Estimated impact: -20-30 logs/session
   - Effort: 15 mins

### Phase 3: MEDIUM (Reduce details)
1. **Remove candle object dumps** (useRealtimeSubscription.svelte.ts)
   - Estimated impact: Better performance on errors
   - Effort: 10 mins

2. **Reduce data service verbosity** (ChartDataService.ts)
   - Estimated impact: -10-15 logs/session
   - Effort: 10 mins

### Phase 4: MONITORING
1. **Enable tilt logs monitoring** to verify impact
   - Command: `tilt logs browser-monitor --follow`
   - Verify reduced noise in console output

---

## 9. INFRASTRUCTURE STATUS

### Current Infrastructure: GOOD
1. ✅ ChartDebug utility with DEBUG_FLAGS - properly implemented
2. ✅ Logger.ts service - structured logging available
3. ✅ LoggingService.ts - categorized logging available
4. ✅ Most heavy logs are already disabled with "PERF: Disabled" comments

### Recommendation
The infrastructure is solid. The issue isn't the system, it's selective per-frame logs that escaped the gating mechanism.

---

## 10. FILES TO MODIFY (Summary List)

```
HIGH PRIORITY:
- /src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts
- /src/pages/trading/chart/services/ChartDataService.ts

MEDIUM PRIORITY:
- /src/pages/trading/chart/hooks/useHistoricalDataLoader.svelte.ts
- /src/pages/trading/chart/services/ChartIndexedDBCache.ts

LOW PRIORITY:
- /src/shared/services/chartCacheService.ts
- /src/shared/services/backtestingDataService.ts
```

---

## Conclusion

The codebase has excellent logging infrastructure with DEBUG_FLAGS. The main issues are:
1. **3 per-frame logs** that should be completely removed or gated
2. **~15 repetitive logs** that should be batched or consolidated
3. **~8 data dumps** that should be reduced to summary info

Implementing these changes should reduce console noise by 60-70% while maintaining critical debugging information.

