# E2E Test Plan (Phase 22)

**Status**: READY FOR IMPLEMENTATION
**Framework**: Playwright
**Browsers**: Chrome, Firefox, Safari
**Target Coverage**: 4-6 critical user flows

---

## E2E Test Scenarios

### Test 1: Application Load and Chart Display

**What it tests:**
- App loads successfully
- Chart renders with data
- Real-time updates are received
- Performance is acceptable

**Steps:**
```
1. Navigate to http://localhost:5173/trading
2. Wait for chart to load (max 5s)
3. Verify at least 100 candles visible
4. Wait 10 seconds for real-time updates
5. Verify at least 1 new candle appeared
6. Measure FPS (should be > 30)
```

**Expected Results:**
- ✅ Chart loads within 5 seconds
- ✅ 100+ candles visible
- ✅ Real-time candles updated
- ✅ FPS > 30

---

### Test 2: Chart Interactions

**What it tests:**
- Chart panning works
- Chart zooming works
- Timeframe switching works
- Indicators display correctly

**Steps:**
```
1. Load chart (BTC-USD:1m)
2. Pan chart left/right
3. Verify candles scroll smoothly
4. Zoom in/out
5. Switch timeframe (1m → 5m → 15m)
6. Verify data updates
7. Add indicator (Volume)
8. Verify indicator displays
```

**Expected Results:**
- ✅ Panning is smooth (no lag)
- ✅ Zooming works both directions
- ✅ Timeframe changes load data
- ✅ Indicators render correctly

---

### Test 3: Orderbook Display and Updates

**What it tests:**
- Orderbook loads with data
- Bid/ask prices update in real-time
- Orderbook is synchronized with chart

**Steps:**
```
1. Load trading page with orderbook
2. Verify orderbook has bids and asks
3. Wait 10 seconds
4. Verify bid/ask prices changed
5. Verify spread is reasonable (< 1%)
6. Verify orderbook syncs with chart price
```

**Expected Results:**
- ✅ Orderbook loads with bids/asks
- ✅ Prices update in real-time
- ✅ No data gaps
- ✅ Chart price matches orderbook mid

---

### Test 4: Store Persistence

**What it tests:**
- User preferences persist
- Theme persists across reload
- Chart settings persist

**Steps:**
```
1. Load app
2. Change theme to light mode
3. Set chart granularity to 5m
4. Refresh page
5. Verify theme is still light
6. Verify granularity is still 5m
7. Close browser
8. Reopen browser
9. Verify settings persisted
```

**Expected Results:**
- ✅ Theme persisted
- ✅ Chart granularity persisted
- ✅ Preferences survived page reload
- ✅ Preferences survived browser close

---

### Test 5: Error Recovery

**What it tests:**
- App recovers from network errors
- Circuit breaker activates on connection failure
- Graceful fallback to cached data

**Steps:**
```
1. Load app
2. Simulate network offline (DevTools)
3. Verify error message displays
4. Wait 10 seconds
5. Restore network connection
6. Verify automatic reconnection
7. Verify data refreshes
8. Check metrics for error events
```

**Expected Results:**
- ✅ Error message displays
- ✅ App doesn't crash
- ✅ Auto-recovery within 10s
- ✅ Data refreshes after recovery
- ✅ Metrics logged error event

---

### Test 6: Performance Monitoring

**What it tests:**
- Metrics collector is working
- Monitoring dashboard displays metrics
- Memory usage is stable
- FPS is consistent

**Steps:**
```
1. Load app
2. Open metrics dashboard (F12 → console)
3. Run for 2 minutes
4. Verify FPS stays > 30
5. Verify memory < 200MB
6. Verify no console errors
7. Verify metrics data collected
```

**Expected Results:**
- ✅ Metrics display in dashboard
- ✅ FPS > 30 sustained
- ✅ Memory < 200MB
- ✅ No memory leaks
- ✅ No console errors

---

## Implementation Commands

### Setup Playwright
```bash
npm install -D @playwright/test
npx playwright install
```

### Run E2E Tests
```bash
# All E2E tests
npm run test:e2e

# Specific test
npm run test:e2e -- e2e/critical-flows.spec.ts

# Debug mode
npx playwright test --debug

# Visual mode (see browser)
npx playwright test --headed
```

### View Test Reports
```bash
# HTML report
npx playwright show-report
```

---

## Test File Structure

```
e2e/
├── critical-flows.spec.ts
│   ├── should load app and display chart
│   ├── should interact with chart
│   └── should display orderbook
│
├── performance.spec.ts
│   ├── should maintain FPS > 30
│   ├── should use memory efficiently
│   └── should collect metrics
│
├── reliability.spec.ts
│   ├── should recover from network error
│   ├── should persist user preferences
│   └── should auto-reconnect
│
└── fixtures/
    ├── chart-page.ts
    ├── orderbook-page.ts
    └── metrics-helper.ts
```

---

## Success Criteria

- ✅ All 6 test flows pass on Chrome
- ✅ All 6 test flows pass on Firefox
- ✅ All 6 test flows pass on Safari
- ✅ Average test execution time < 10s per flow
- ✅ No flaky tests (100% consistent pass rate)
- ✅ Performance metrics captured
- ✅ Error scenarios handled gracefully

---

## Performance Targets (E2E)

| Metric | Target | Status |
|--------|--------|--------|
| App load time | < 5s | ✅ |
| Chart render | < 100ms | ✅ |
| Orderbook update | < 50ms | ✅ |
| FPS (sustained) | > 30 | ✅ |
| Memory peak | < 200MB | ✅ |
| Auto-recovery time | < 10s | ✅ |

---

## Monitoring & Reporting

### Metrics Collected
- Load time per page
- FPS during interactions
- Memory usage over time
- Network latency
- Error count
- Recovery time

### Reports Generated
- Test summary (passed/failed/flaky)
- Performance metrics
- Screenshot on failure
- Video of failed tests
- Metrics timeline

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
- Run unit tests (Vitest)
- Run integration tests (Vitest)
- Run E2E tests (Playwright)
  - Chrome
  - Firefox
  - Safari
- Generate coverage report
- Upload artifacts (videos, screenshots)
```

### Triggers
- On every PR
- On main branch push
- On schedule (nightly)

---

**Ready for Implementation**
These E2E tests provide comprehensive coverage of critical user flows and ensure the application remains stable and performant across all phases.
