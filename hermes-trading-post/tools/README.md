# Development Tools

This directory contains utility scripts and debugging tools for Hermes Trading Post development and testing.

## Quick Reference

| Tool | Type | Purpose | Usage |
|------|------|---------|-------|
| `clean-logging.sh` | Bash Script | Remove verbose console logs | `bash tools/clean-logging.sh` |
| `download-all-granularities.sh` | Bash Script | Populate Redis cache with historical data | `bash tools/download-all-granularities.sh` |
| `granularity-test.js` | JavaScript | Test granularity button logic | Run in browser console |
| `clear-frontend-cache.html` | HTML Tool | Reset localStorage and paper trading state | Open in browser |
| `clear-presets.html` | HTML Tool | Clear strategy presets from storage | Open in browser |
| `coinbase-granularity-test.html` | HTML Tool | Test Coinbase API granularity support | Open in browser |
| `debug-granularity.html` | HTML Tool | Debug granularity button state | Open in browser |
| `volume-test.html` | HTML Tool | Test and debug volume candle data | Open in browser |
| `volume-debug.html` | HTML Tool | Additional volume debugging | Open in browser |
| `remove-element.html` | HTML Tool | Remove unwanted DOM elements | Open in browser |
| `hide-element.css` | CSS | Hide elements via CSS selector | Include in page |

## Tools by Category

### Data & Cache Management

#### `download-all-granularities.sh`
**Purpose:** Download and cache historical OHLCV data across all granularities (1m, 5m, 15m, 1h, 6h, 1d) into Redis.

**How it works:**
1. Queries the backend API for current cache status
2. Starts background historical data fetch for each granularity
3. Polls progress and waits for completion before moving to next granularity
4. Displays final cache statistics

**Configuration:**
- **Granularities:** 1m (30d), 5m (90d), 15m (180d), 1h (365d), 6h (720d), 1d (1825d)
- **API Endpoint:** `http://localhost:4828/api/trading/populate-historical`
- **Pair:** BTC-USD (hardcoded, can be modified)

**Usage:**
```bash
bash tools/download-all-granularities.sh
```

**Output example:**
```
🚀 Starting sequential download of all granularities...
📊 Starting download: 1m (30 days)...
✅ Started 1m download
⏳ Waiting for 1m download to complete...
📈 1m: 43200 candles
✅ 1m download complete: 43200 candles
...
🎉 All granularity downloads completed!
```

### Code Cleanup & Maintenance

#### `clean-logging.sh`
**Purpose:** Remove verbose console logging while preserving errors and essential chart logs.

**What it removes:**
- Verbose verbose data store logs (🔄, 🔔, 📊 prefixed messages)
- Strategy analysis logs
- Position checking logs
- Trading operation logs
- [PERF] tagged performance logs

**What it preserves:**
- console.error() calls
- console.warn() calls
- Essential chart rendering logs

**Usage:**
```bash
bash tools/clean-logging.sh
```

**Output example:**
```
🧹 Cleaning excessive console logging...
Cleaning src/pages/trading/chart/stores/dataStore.svelte.ts (45 console statements)
  Removed 32 console statements from dataStore.svelte.ts
✅ Cleanup complete. 13 console statements remaining (errors and essential chart logs preserved)
```

### Frontend Cache & State

#### `clear-frontend-cache.html`
**Purpose:** Reset browser localStorage and reinitialize paper trading strategy state.

**What it clears:**
- All localStorage entries
- Paper trading state
- Active strategy
- Bot manager state

**What it sets:**
- Default strategy: `reverse-ratio`
- Default parameters with specific grid configuration

**Usage:**
1. Open in browser: `file:///path/to/tools/clear-frontend-cache.html`
2. Page will auto-run and display success message
3. Click link to navigate to paper trading page

#### `clear-presets.html`
**Purpose:** Clear all strategy presets from localStorage.

**Usage:**
1. Open in browser
2. Page clears localStorage entries related to presets
3. Refresh paper trading page to verify clean state

### Testing & Debugging Tools

#### `granularity-test.js`
**Purpose:** Test the granularity button enable/disable logic in the chart controls.

**Tests:**
- Button state based on selected period (1H, 6H, 1D, 1W, 1M, 3M, 1Y)
- Valid vs. recommended granularity mapping
- DOM button state validation

**Usage:**
```javascript
// Copy entire file content to browser console and run:
window.testGranularityLogic()
```

**Output:**
```
🧪 TESTING GRANULARITY BUTTON LOGIC
=====================================
Testing with timeframe: 1H, current granularity: 1m

Valid granularities for 1H: ['1m', '5m', '15m']
Recommended granularities for 1H: ['1m', '5m', '15m']

📊 Button States:
1m: 🔵 ACTIVE (valid: true, recommended: true, active: true)
5m: ✅ ENABLED (valid: true, recommended: true, active: false)
...
```

#### `volume-test.html`
**Purpose:** Test volume data integrity in historical and real-time candles.

**Features:**
- **Historical Volume Test:** Fetches last 50 candles from Coinbase API, analyzes volume data
- **Real-time Monitoring:** Polls ticker data every 2 seconds to check volume updates
- **Statistics:** Shows count of candles with volume, missing volume, zero volume

**Usage:**
1. Open in browser: `file:///path/to/tools/volume-test.html`
2. Click "Test Historical Volume" to check historical data
3. Click "Test Real-time Volume" to monitor live ticker data
4. Results show green border for complete data, red for missing, yellow for zero

#### `volume-debug.html`
**Purpose:** Specialized debugging tool for volume candle synchronization issues.

**Use case:** When volume candles don't match price candles in the chart.

#### `coinbase-granularity-test.html`
**Purpose:** Verify Coinbase API supports all required granularities.

**Tests:**
- HTTP connectivity to Coinbase API
- Granularity endpoint response times
- Data format validation

#### `debug-granularity.html`
**Purpose:** Debug granularity button states and period switching logic.

**Diagnostics:**
- Button enable/disable state
- Valid granularities per period
- Recommended granularities
- DOM element analysis

### CSS & DOM Tools

#### `hide-element.css`
**Purpose:** CSS-based element hiding utility using selector targeting.

**Use case:** Hide specific UI elements via CSS without modifying HTML.

**Pattern:**
```css
/* Deep CSS selector to target specific element */
body > div > main > div > main > div > div > div:first-child > ... {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
}
```

#### `remove-element.html`
**Purpose:** Programmatically find and remove unwanted DOM elements.

**Usage:**
1. Open in browser
2. Inspect element to find selector
3. Modify script with correct selector
4. Elements removed from DOM

## Setup & Configuration

### Prerequisites
- Node.js 18+ (for script execution)
- curl & jq (for bash scripts)
- Redis running on localhost:6379
- Backend API running on localhost:4828
- Browser for HTML tools

### Environment Variables
```bash
# For download scripts
REDIS_HOST=localhost      # Redis connection
REDIS_PORT=6379
API_BASE_URL=http://localhost:4828/api/trading
```

## Troubleshooting

### `download-all-granularities.sh` hangs
**Solution:** Check backend API is running:
```bash
curl http://localhost:4828/api/trading/status
```

### `clean-logging.sh` removes too much
**Solution:** Edit the script to preserve additional patterns:
```bash
# Add before running
sed -i '/console\.log.*YOUR_PATTERN/d' "$file"
```

### volume-test.html shows CORS errors
**Solution:** Cross-origin restrictions with Coinbase API
- Use browser with disabled CORS (dev mode only)
- Set up local proxy to Coinbase API

## Adding New Tools

1. Place tool in `/tools/` directory
2. Add header comment explaining purpose
3. Document in this README with category and usage
4. Add to quick reference table above
5. Test tool in both local and CI environments

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [Backtesting Guide](../docs/backtesting.md) - Strategy backtesting
- [Debugging Guide](../docs/debugging.md) - General debugging approach
