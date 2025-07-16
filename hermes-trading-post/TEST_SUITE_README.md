# Trading System Test Suite

## Overview

This comprehensive test suite verifies:
- ✅ Cache updates properly when new candles are drawn
- ✅ API data aligns perfectly with cached data  
- ✅ Candles display at correct timestamps for their timescales
- ✅ Real-time WebSocket updates integrate smoothly
- ✅ Multi-timeframe data consistency

## Quick Start

```bash
# Run the interactive test dashboard
npm test

# Or run directly
./run-cache-api-tests.sh
```

## Test Components

### 1. Interactive Test Dashboard (`test-cache-api-candles.html`)
- Real-time WebSocket monitoring
- Visual chart display with lightweight-charts
- Live data inspector showing candle values
- Test result panel with pass/fail indicators
- Debug console for detailed logging

### 2. Automated Test Script (`test-cache-api-candles.js`)
**Cache Tests:**
- Write/Read verification
- Update on new candle arrival
- TTL management (1hr recent, 24hr old)
- Multi-granularity consistency

**API Tests:**
- Connectivity verification
- Cache vs API alignment
- Real-time data consistency
- Historical data accuracy

**Display Tests:**
- Candle rendering accuracy
- Time axis alignment
- Real-time update visualization
- Multi-timeframe display

### 3. Screenshot Capture (`test-screenshot-capture.js`)
- Automated visual regression testing
- Captures test progression
- Multi-timeframe chart states
- Real-time update sequences

## Running Tests

### Option 1: Interactive Dashboard
1. Open `test-cache-api-candles.html` in your browser
2. Click "Run All Tests" or individual test buttons
3. Monitor results in real-time
4. Export test report when complete

### Option 2: Automated Screenshots
```bash
npm install puppeteer  # First time only
node test-screenshot-capture.js
```

### Option 3: Full Suite
```bash
npm test  # Runs both interactive and automated tests
```

## Test Results

- **Test Results Panel**: Shows pass/fail status with timing
- **Debug Console**: Detailed logs of all operations
- **Screenshot Report**: Visual documentation at `test-screenshots/screenshot-report.html`
- **JSON Export**: Full test report with all metrics

## Key Verification Points

1. **Cache Verification**
   - New candles update existing cache entries
   - No duplicate entries created
   - Proper TTL management
   - Consistent key generation

2. **API Alignment**
   - Cached data matches fresh API data
   - Timestamp accuracy (UTC handling)
   - OHLCV values exact match
   - Proper granularity aggregation

3. **Display Accuracy**
   - Candle x-position matches timestamp
   - Candle height represents price range
   - Volume bars align correctly
   - Smooth real-time updates

## Troubleshooting

- **WebSocket Connection Issues**: Check network/firewall
- **Cache Errors**: Clear cache with the button and retry
- **Screenshot Failures**: Ensure Puppeteer is installed
- **API Rate Limits**: Tests include delays to avoid limits

## Development

To extend the test suite:
1. Add new test methods to `TestRunner` class
2. Include in appropriate test category
3. Update screenshot sequences if needed
4. Document expected behavior

## Files Created

- `test-cache-api-candles.html` - Interactive dashboard
- `test-cache-api-candles.js` - Test logic and automation
- `test-screenshot-capture.js` - Visual testing utility
- `run-cache-api-tests.sh` - Convenient test runner
- `test-screenshots/` - Screenshot output directory
- `TEST_SUITE_README.md` - This documentation