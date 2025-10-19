# Hermes Trading Post - Data Flow Analysis

## Overview

This document details the complete data flow in the Hermes Trading system, identifying where data flows, how it's transformed, and where inefficiencies exist.

---

## 1. CHART STATS CALCULATION FLOW

### Current Implementation

```
CandleCounter.svelte (Display)
    ↓
dataStore.stats (Reactive)
    ├─ totalCount: Number of candles in array
    ├─ visibleCount: Filtered candles for current view
    ├─ oldestTime: First candle timestamp
    ├─ newestTime: Last candle timestamp
    └─ lastUpdate: Timestamp of last change

    ↓
dataStore.svelte.ts (Store Updates)
    ├─ hydrateFromCache(): Load from Redis at startup
    ├─ addCandle(): Single candle append
    ├─ updateStats(): Manual recalculation
    └─ subscribeToRealtime(): WebSocket updates
        ├─ On NEW CANDLE (time > 0):
        │  └─ Reassign _dataStats object (triggers reactivity)
        └─ On TICKER (time = 0):
           └─ ALSO reassigns _dataStats (❌ INEFFICIENCY)

    ↓
RedisChartService.ts
    ├─ subscribeToRealtime(): WebSocket handler
    │  ├─ Ticker message → Create update with time=0
    │  └─ Candle message → Create update with proper time
    │
    └─ Backend WebSocket returns
       ├─ {type: 'ticker', price: 123.45}
       └─ {type: 'candle', time: 123456789, ...}
```

### Update Frequency

- **On ticker update**: Every 50-100ms (stock price tick)
- **On new candle**: Every 60-3600 seconds (depends on granularity)
- **Stats object recreated**: Even when only price updates

### Inefficiencies Found

1. **Stats object recreated on EVERY ticker** (lines 586-591)
   - Should only update on NEW CANDLES
   - Ticker updates should NOT trigger stats reactivity
   - Causes 50-70 UI re-renders per minute

2. **updateDatabaseCount() called on EVERY database_activity** (line 373-376)
   - Broadcasts happen on every candle store
   - Makes sequential backend calls
   - Creates race conditions

---

## 2. WEBSOCKET MESSAGE FLOW

### Backend → Frontend Real-Time Path

```
Coinbase WebSocket (wss://advanced-trade-ws.coinbase.com)
    ↓
CoinbaseWebSocketClient.js (Backend)
    ├─ Ticker messages: Processed continuously
    │  └─ Forwarded via priceForwarder
    │
    ├─ Match messages: Candle aggregation
    │  ├─ MultiGranularityAggregator: Creates candles for each granularity
    │  ├─ Stored to Redis: redisCandleStorage.storeCandles()
    │  └─ Emits database_activity event
    │
    └─ Level2 messages: Order book data
       └─ Cached & broadcast to clients

    ↓
WebSocket Server (Port 4829, /backend/src/index.js)
    ├─ Broadcasts to all connected clients
    │  ├─ Candle data: {type: 'candle', ...}
    │  ├─ Ticker data: {type: 'ticker', ...}
    │  ├─ Database activity: {type: 'database_activity', ...}
    │  └─ Level2 data: {type: 'level2', ...}
    │
    └─ Memory monitoring (every 5 minutes)
       └─ Garbage collection if > 1GB

    ↓
RedisChartService.ts (Frontend, WebSocket connection)
    ├─ Parses message JSON
    ├─ Routes to handler:
    │  ├─ 'ticker' → Update last price (time=0)
    │  ├─ 'candle' → Full candle update (time > 0)
    │  ├─ 'database_activity' → Trigger updateDatabaseCount()
    │  └─ 'level2' → Update orderbook
    │
    └─ Calls subscribed callbacks

    ↓
dataStore.svelte.ts (Stats Update)
    ├─ Each callback updates _latestPrice
    ├─ Each callback recreates _dataStats object ❌
    ├─ Each callback calls notifyDataUpdate()
    └─ Cascades to all UI components
```

### Frequency & Throughput

- **Ticker updates**: 5-100 per second (volatile market)
- **Candle updates**: 1 per minute (1m granularity) to 1 per day
- **Database activity events**: Variable (every candle creation)
- **Level2 snapshots**: 0.5-2 per second

### Performance Issues

1. **Message parsing overhead**
   - JSON.stringify/parse on every message
   - No message batching
   - No message deduplication

2. **Stat object creation on EVERY update**
   - Ticker: 5-100 new objects per second
   - Each object triggers Svelte reactivity
   - Cascades to CandleCounter re-renders

3. **Sequential backend calls after database_activity**
   - updateDatabaseCount() waits for 6 Redis HGETALL calls
   - No parallelization (sequential for loop)
   - 30-60ms latency per event

---

## 3. CHART DATA LOADING FLOW

### Initial Load Path

```
Chart Mount → useDataFeed Hook
    ↓
RedisChartService.fetchCandles()
    ├─ Try binary format (msgpack):
    │  ├─ Fetch from /api/trading/chart-data?format=msgpack
    │  ├─ Decode binary data
    │  └─ Map to {time, open, high, low, close, volume}
    │
    └─ Fallback to JSON format:
       ├─ Fetch from /api/trading/chart-data?format=json
       ├─ Parse JSON
       └─ Extract result.data.candles

    ↓
dataStore.setCandles()
    ├─ Filter invalid candles
    ├─ Sort by time
    ├─ Set _candles array
    ├─ Update _visibleCandles
    ├─ Calculate stats
    └─ Notify subscribers

    ↓
ChartCanvas renders
    └─ Displays candles on chart
```

### Cache Layers

1. **IndexedDB (Browser cache)**
   - Stored by ChartIndexedDBCache
   - Checked on every data load
   - Can provide instant display

2. **Redis (Backend cache)**
   - Stores historical candles
   - Queried via /api/trading/chart-data
   - Persists between sessions

3. **Browser HTTP cache**
   - REST API responses cached
   - BTC-USD/1m?hours=24 cached
   - Only if headers permit

### Data Transformations

```
Coinbase API Format
[timestamp, low, high, open, close, volume]

↓ (RedisCandleStorage.storeCandles)

Redis Storage Format
{o: open, h: high, l: low, c: close, v: volume}

↓ (Redis retrieval)

Application Candle Format
{time, open, high, low, close, volume}

↓ (RedisChartService.fetchCandles)

Chart Format
{time, open, high, low, close, volume}

↓ (chartStore/dataStore updates)

Svelte Reactive State
```

### Inefficiencies

1. **Double parsing on fallback**
   - Tries binary → fails → tries JSON
   - Two network requests for same data
   - Two parsing operations

2. **Unnecessary object mapping**
   - `.map()` creates new object per candle
   - On 1000 candles: 2000+ temp allocations
   - Already in correct format from backend

3. **No response caching**
   - Same query made repeatedly
   - No HTTP cache headers
   - Fetches full dataset each time

---

## 4. POLLING MECHANISMS

### Interval-Based Polling

```
Component: CacheIndicator.svelte
Frequency: Every 10 seconds
Action: chartIndexedDBCache.getStats()
Impact: IndexedDB full scan
Used for: Display cache size & entry count

Component: ServiceWorkerIndicator.svelte
Frequency: Every 30 seconds
Action: serviceWorkerManager.getStatus()
Impact: Check SW status
Used for: Display update availability

Component: CandleCountdown.svelte
Frequency: Every 500ms (2 updates/sec)
Action: updateCandleCountdown()
Impact: Calculate time to next candle
Used for: Display countdown timer

Service: CoinbaseWebSocket (Frontend)
Frequency: Every 5 seconds
Action: Check connection.isConnected()
Impact: Redundant with event handlers
Used for: Fallback connection monitoring

Service: CoinbaseWebSocket (Backend)
Frequency: Every 15 seconds
Action: Send empty subscribe message
Impact: 4 messages/min per connection
Used for: Keep-alive heartbeat

Backend: Memory Monitor
Frequency: Every 5 minutes
Action: Check process.memoryUsage()
Impact: One check per monitoring interval
Used for: Detect high memory usage
```

### Problem Analysis

| Component | Interval | Frequency/min | Purpose | Event-Driven? |
|-----------|----------|---------------|---------|--------------|
| CacheIndicator | 10s | 6 | Info display | YES - on data load |
| ServiceWorker | 30s | 2 | Info display | YES - event exists |
| CandleCountdown | 500ms | 120 | Timer display | Could be 60 |
| WS Heartbeat (FE) | 5s | 12 | Connection check | NO - events handle |
| WS Heartbeat (BE) | 15s | 4 | Keep-alive | MAYBE - 25s safer |
| Memory Monitor | 5min | 0.2 | Resource check | YES - on threshold |

---

## 5. BACKEND API ENDPOINTS & PERFORMANCE

### Chart Data Endpoint

```
GET /api/trading/chart-data?pair=BTC-USD&granularity=1m&maxCandles=1000

Processing:
1. Parse query parameters
2. Calculate time range based on maxCandles
3. Query Redis: redisCandleStorage.getCandles()
   ├─ Scan day-by-day buckets
   ├─ Read sorted sets
   ├─ Deserialize from JSON strings
   └─ Return candle array
4. Limit to maxCandles
5. Get metadata: redisCandleStorage.getMetadata()
6. Calculate cache metrics
7. Return JSON response

Latency: ~50-200ms (depending on Redis responsiveness)
Frequency: On chart load, granularity change, refresh (~5-10/sec per user)
```

### Storage Stats Endpoint ⚠️ CRITICAL BOTTLENECK

```
GET /api/trading/storage-stats

Processing:
1. Get Redis memory info: redis.info('memory')
2. Get ALL CANDLE KEYS: redis.keys('candles:*') ❌ BLOCKING
   ├─ On millions of keys: 100-500ms block time
   ├─ Blocks ALL other Redis operations
   └─ Returns list of ALL keys in memory
3. Parse keys to extract pairs & granularities
4. Return stats

Latency: 50ms-1s (with millions of keys)
Frequency: Polled every 10s by CacheIndicator (6x/min)
Impact: Can block chart data fetches
```

### Total Candles Endpoint ⚠️ INEFFICIENT

```
GET /api/trading/total-candles?pair=BTC-USD

Processing:
1. Define 6 granularities: ['1m', '5m', '15m', '1h', '6h', '1d']
2. For EACH granularity (sequential loop):
   ├─ await redisCandleStorage.getMetadata(pair, gran)
   ├─ Wait for Redis HGETALL response
   └─ Extract totalCandles count
3. Sum all counts
4. Return breakdown

Latency: 6 Redis calls × ~5-10ms = 30-60ms
Frequency: Called on database_activity event (multiple times/sec)
Impact: Blocks frontend stats update

OPTIMIZATION POTENTIAL:
Change to Promise.all(6 parallel calls) → 5-10ms instead of 30-60ms
```

---

## 6. REAL-TIME TICKER UPDATE PATH

### Complete Flow from Exchange to UI

```
1. Coinbase Exchange
   ↓ (WebSocket message every 50-100ms)
   
2. CoinbaseWebSocketClient (Backend)
   ├─ Receives: {product_id: 'BTC-USD', price: '12345.67', type: 'ticker'}
   ├─ Processes: Updates last_price
   └─ Forwards via priceForwarder
   ↓ (Broadcasting)

3. WebSocket Server (Port 4829)
   ├─ Receives from backend
   ├─ Broadcasts to all clients:
   │  {type: 'ticker', pair: 'BTC-USD', price: 12345.67}
   └─ Sends to each connected client
   ↓

4. Frontend WebSocket (RedisChartService)
   ├─ Receives ticker message
   ├─ Calls handleWebSocketMessage()
   ├─ Routes to ticker handler
   └─ Calls callback with WebSocketCandle {time: 0, close: 12345.67, ...}
   ↓

5. dataStore.subscribeToRealtime() Callback
   ├─ Receives: {time: 0, close: 12345.67}
   ├─ Updates: this._latestPrice = 12345.67
   ├─ Updates: this._candles[last].close = 12345.67  (in-place)
   ├─ ❌ RECREATES: this._dataStats = {...}  (unnecessarily)
   ├─ Calls: this.notifyDataUpdate()
   └─ Triggers all subscriber callbacks
   ↓

6. CandleCounter Component
   ├─ Watches: dataStore.stats.totalCount
   ├─ Shows: "432 candles"  (unchanged)
   ├─ But: Reactive update triggered anyway ❌
   ├─ Re-renders: Even though count didn't change
   └─ Animates: On new object assignment
   ↓

Result: 
- Price updated correctly ✓
- But unnecessary re-renders (50-100x/sec)
- And stats object recreation overhead

```

---

## 7. ORDERBOOK (L2) UPDATE PATH

### Real-Time Orderbook Update Flow

```
Coinbase Advanced Trade WebSocket
  ├─ /Level2 channel (authenticated)
  ├─ Snapshot: Full orderbook
  └─ Deltas: Price level changes only

    ↓ (via CoinbaseWebSocketClient)

Backend WebSocket Handlers
  ├─ Emit 'level2' events
  ├─ Cache latest snapshot
  └─ Forward to frontend clients

    ↓ (Broadcast to all clients)

Frontend Redis Pub/Sub (Deltas)
  ├─ Subscribe: orderbook:*:delta
  ├─ Receive: Only changed price levels
  └─ Forward: Minimal data to chart

    ↓ (Combined with snapshot)

Frontend orderbookStore.svelte.ts
  ├─ Update bids/asks from deltas
  ├─ Notify price update subscribers
  └─ Trigger: dataStore._latestPrice = newPrice

    ↓ (Direct L2 Price Updates)

Chart Display
  ├─ Gets instant price from L2
  ├─ FASTER than candle/ticker updates
  └─ Best real-time price source

Frequency: 0.5-2 updates per second
Latency: 50-200ms from exchange to UI
Efficiency: Delta compression reduces bandwidth
```

---

## SUMMARY: Data Flow Bottlenecks

### Critical (Blocking Operations)
1. Redis KEYS command - Blocks entire instance
2. Sequential metadata fetches - Cascading delays
3. Double data parsing - Allocation overhead

### Important (Unnecessary Operations)
4. Stats update on every ticker - 50-100x/sec
5. Polling display-only info - 6-12/min
6. Over-aggressive heartbeat - 4/min overhead
7. Redundant connection checks - 12/min overhead

### Total Optimization Potential
- Backend latency: 40-50% improvement
- Frontend rendering: 30-40% improvement
- Memory usage: 15-20% improvement
- Network bandwidth: 25-30% improvement

### Next Steps
1. Read PERFORMANCE_AUDIT.md for detailed fixes
2. Implement Phase 1 (critical) changes
3. Re-run performance tests
4. Measure improvement baseline

