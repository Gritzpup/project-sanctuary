# ⚡ Hermes Trading Performance Upgrade

**Goal**: 70-80% performance improvement, Bloomberg-grade speed

---

## 📊 Performance Optimization Phases

### Phase 1: Button Debouncing & Loading Guards ✅ COMPLETE
- [x] Add 200ms debounce to timeframe buttons (TimeframeControls.svelte)
- [x] Add 200ms debounce to granularity buttons (GranularityControls.svelte)
- [x] Add loading guard to ChartControlsService to prevent double-clicks
- [x] Remove console.log from button handlers
- [x] Test button responsiveness - ensure no double-loads
- [x] Verify buttons navigate to correct intervals

**Status**: ✅ Phase 1 Complete - Implemented 200ms debouncing on all timeframe/granularity button handlers (3 files: TimeframeControls, GranularityControls, PaperTrading TimeframeControls). Added loading guards to ChartControlsService to prevent simultaneous loads. Removed console.log from TimeframeControls. All changes compiled successfully and deployed.

---

### Phase 2: Orderbook Rendering Optimization (Pending)
- [ ] Memoize number formatting (price/volume)
- [ ] Replace toLocaleString() with fast formatter
- [ ] Implement object pooling for orderbook rows
- [ ] Batch updates - collect 5-10 WS messages before render
- [ ] Remove console.log from hot paths (mouse moves, hover)
- [ ] Limit depth processing to visible range only
- [ ] Remove unnecessary spread operators

**Expected Impact**: 70-80% reduction in orderbook lag

---

### Phase 3: WebSocket Message Batching (Pending)
- [ ] Implement batch accumulator (10ms window)
- [ ] Deduplicate redundant price updates
- [ ] Process batched messages instead of individual ones
- [ ] Add SharedArrayBuffer for zero-copy price forwarding

**Expected Impact**: 60% reduction in WS processing overhead

---

### Phase 4: Chart Rendering Optimization (Pending)
- [ ] Replace setData() with incremental update()
- [ ] Memoize chart data conversion
- [ ] Debounce positioning logic in $effect
- [ ] Remove unnecessary object spreading in chart updates
- [ ] Cache calculated chart values

**Expected Impact**: 60fps smooth chart updates

---

### Phase 5: Reactive State Optimization (Pending)
- [ ] Batch dataStore notifications
- [ ] Optimize $derived.by() dependencies
- [ ] Implement selective subscriber updates
- [ ] Remove unnecessary object spreads

**Expected Impact**: 50% reduction in reactive overhead

---

### Phase 6: Micro-Optimizations (Pending)
- [ ] Remove Date.now() modulo checks in ticker handler
- [ ] Replace Math.max(...array) with loop
- [ ] Use Map.has() before Map.set()
- [ ] Cache midPrice calculations
- [ ] Use typed arrays for price/volume data

**Expected Impact**: 15-20% cumulative improvement

---

## 📈 Metrics Before/After

### Before Optimization
- Orderbook: 264 array ops/sec, 240 format calls/sec
- WebSocket: 100+ individual message processes/sec
- Chart: Full data replacement on every update
- Buttons: No debouncing, multiple loads possible

### After Optimization (Target)
- Orderbook: <50 ops/sec, <10 format calls/sec (cache hits)
- WebSocket: Batched processing, 10-20 batches/sec
- Chart: Incremental updates, 60fps smooth
- Buttons: Debounced, loading guards, instant feedback

---

## 🔧 Files Being Modified

### Phase 1
- `src/pages/trading/chart/components/controls/components/TimeframeControls.svelte`
- `src/pages/trading/chart/components/controls/components/GranularityControls.svelte`
- `src/pages/trading/chart/services/ChartControlsService.svelte`
- `src/pages/PaperTrading/components/chart-controls/TimeframeControls.svelte`

### Phase 2
- `src/pages/trading/orderbook/stores/orderbookStore.svelte.ts`
- `src/pages/trading/orderbook/components/DepthChart.svelte`
- `src/pages/trading/orderbook/components/OrderbookList.svelte`

### Phase 3
- `src/services/api/coinbaseWebSocket.ts`
- `backend/src/services/coinbaseWebSocket.js`

### Phase 4
- `src/pages/trading/chart/components/canvas/ChartCanvas.svelte`
- `src/pages/trading/chart/components/canvas/ChartDataManager.svelte`
- `src/pages/trading/chart/hooks/useDataLoader.svelte.ts`

### Phase 5
- `src/pages/trading/chart/stores/dataStore.svelte.ts`

### Phase 6
- Various hot-path optimizations across files

---

## 📝 Commit History

### Phase 1: Button Debouncing & Loading Guards
- **Files Modified**:
  - `src/pages/trading/chart/components/controls/components/TimeframeControls.svelte` - Added 200ms debounce to button handler
  - `src/pages/trading/chart/components/controls/components/GranularityControls.svelte` - Added 200ms debounce to button handler
  - `src/pages/trading/chart/components/controls/services/ChartControlsService.svelte` - Added loading guards to prevent simultaneous loads
  - `src/pages/PaperTrading/components/chart-controls/TimeframeControls.svelte` - Added 200ms debounce to button handler
- **Impact**: Prevents rapid double-clicks from triggering multiple simultaneous data loads, ensuring responsive and clean button behavior
- **Performance Gain**: Eliminates double-load race conditions, reduces unnecessary data fetches during rapid button clicks

