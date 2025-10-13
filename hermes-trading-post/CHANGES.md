# Recent Changes - October 13, 2025

## Depth Chart Overlay Fix

### Problem
After component refactoring, the depth chart overlays (hover circle and valley indicator) were rendering behind the chart lines instead of on top. This was caused by:
- LightweightCharts renders to a canvas element
- Canvas elements naturally render above HTML elements
- When split into separate components, Svelte created wrapper elements that broke the coordinate system and z-index stacking

### Solution
Restored to working baseline from commit `f20b434 "Fix hover overlay and remove console logging spam"`. This version has all overlay HTML elements as direct children of the chart container, allowing them to render correctly on top of the canvas.

### Changes Made
1. Restored `DepthChart.svelte` to working monolithic version
2. Added decimal formatting to price labels (e.g., `$115.5k` instead of `$115k`)
3. Created fresh commit marking the stable baseline

### Commit
```
a639bfb - Mark working baseline for depth chart with overlay fixes
```

## Browser Monitoring Updates

### Problem
Browser monitor had memory leaks from not cleaning up CDP connections properly, and was opening wrong URLs.

### Solution
1. **Fixed URLs**: Changed from notifier (6173) to Hermes Trading Post (5173)
2. **Added proper cleanup**: 
   - Close CDP client connection on exit
   - Handle SIGINT, SIGTERM, SIGHUP signals
   - Catch uncaught exceptions and unhandled promise rejections
3. **Enabled auto-launch in Tilt**:
   - Set `auto_init=True` 
   - Added resource dependency on `hermes-trading-post`
   - Browser opens automatically after frontend is ready

### Files Changed
- `/home/ubuntubox/browser-monitor/monitor.js` - Added cleanup handlers and fixed URLs
- `/home/ubuntubox/Documents/Github/Tiltfile` - Enabled browser-monitor auto-init

## CLAUDE.md Updates

### Changes
Updated to mandate Tilt as the PRIMARY logging method:
- Use `tilt logs [resource-name]` for all frontend, backend, and database logs
- Disabled browser-logs and terminal-logs directories to prevent memory leaks
- Added Tilt logging command examples
- Emphasized checking Tilt logs after every change

## Current State

✅ **Working Features:**
- Depth chart overlays render correctly on top of chart canvas
- Hover circle snaps to and follows chart line
- Valley indicator (support/resistance arrow) positioned correctly
- Real-time WebSocket connection to Coinbase orderbook
- Price labels show decimals (115.5k format)
- Browser monitor with proper cleanup
- All services managed through Tilt

✅ **No Issues:**
- No browser errors or console warnings
- No port conflicts
- WebSocket connected and streaming data
- Frontend and backend running smoothly

## Next Steps
Continue with regular development using Tilt for all logging and monitoring.

## Backend Network Exposure - October 13, 2025

### Problem
The trading backend was only accessible from localhost, preventing network machines from accessing trading stats, order history, and controls.

### Solution
Removed all hardcoded `localhost:4828` references and replaced with dynamic host detection via `backendConfig.ts`:

### Changes Made

1. **Updated backendConfig.ts** (`src/utils/backendConfig.ts`)
   - Changed port from 4829 to 4828 (actual backend port)
   - `getBackendHost()` automatically detects hostname from `window.location.hostname`
   - Falls back to localhost for local development
   - Works seamlessly on network when accessed via IP address

2. **Updated RealtimeDataSource.ts** (`src/services/chart/data-sources/RealtimeDataSource.ts`)
   - Replaced `ws://localhost:4828` with `getBackendWsUrl()`
   - WebSocket now connects to correct backend from any network machine

3. **Updated priceForwarder.ts** (`src/services/api/priceForwarder.ts`)
   - Replaced `ws://localhost:4828/ws` with `${getBackendWsUrl()}/ws`
   - Price forwarding now works from network machines

4. **Updated ChartAPIService.ts** (`src/pages/trading/chart/services/ChartAPIService.ts`)
   - Replaced hardcoded `ws://localhost:4828` with `getBackendWsUrl()`
   - Chart data sync works from network machines

### Result
✅ **Backend is now fully network-accessible:**
- Server IP: `192.168.1.6`
- Backend port: `4828`
- Frontend accessible at: `http://192.168.1.6:5173`
- Backend WebSocket: `ws://192.168.1.6:4828`
- Backend API: `http://192.168.1.6:4828/health`

✅ **Network machines can now:**
- View trading stats and balances
- See open positions
- View trading history
- Control bot (start/stop/pause)
- Access all real-time data

### Testing
Access from any network machine:
```
http://192.168.1.6:5173/paper-trading
```

The backend will automatically connect using the same hostname/IP.
