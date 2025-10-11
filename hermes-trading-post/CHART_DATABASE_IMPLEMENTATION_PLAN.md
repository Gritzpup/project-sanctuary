# Chart & Database Implementation Plan

## 📊 Current Issues Found

### 1. ❌ Granularity Button Issues
- **Problem**: Default granularities include '30m' and '4h' which are NOT supported by Coinbase API
- **Supported Granularities**: `1m`, `5m`, `15m`, `1h`, `6h`, `1d` ONLY
- **Location**: `/src/pages/trading/chart/components/controls/components/GranularityControls.svelte`
- **Fix Required**: Remove unsupported granularities from default arrays

### 2. ✅ Network Access Status
- **Backend**: Already listening on `0.0.0.0:4828` (accessible from network)
- **CORS**: Enabled with `app.use(cors())` - accepts all origins
- **WebSocket**: Available at `ws://[IP]:4828`
- **REST API**: Available at `http://[IP]:4828/api/trading/`

### 3. ✅ Database Updates
- **ContinuousCandleUpdater**: Fetching all granularities properly
  - 1m: Every 5 seconds
  - 5m: Every 15 seconds
  - 15m: Every 30 seconds
  - 1h: Every 60 seconds
  - 6h: Every 5 minutes
  - 1d: Every 10 minutes

### 4. 📐 Candle Count Per Timeframe Combination

| Granularity | 1H | 4H | 1D | 5D | 1M | 3M | 6M | 1Y | Status |
|------------|----|----|----|----|----|----|----|----|--------|
| 1m | 60 | 240 | 1440 | 7200 | 43200 | ❌ | ❌ | ❌ | Optimal: 4-200 |
| 5m | 12 | 48 | 288 | 1440 | 8640 | ❌ | ❌ | ❌ | Optimal: 4-200 |
| 15m | 4 | 16 | 96 | 480 | 2880 | 8640 | ❌ | ❌ | Optimal: 4-200 |
| 1h | 1 | 4 | 24 | 120 | 720 | 2160 | 4320 | 8760 | Optimal: 4-200 |
| 6h | ❌ | ❌ | 4 | 20 | 120 | 360 | 720 | 1460 | Optimal: 4-200 |
| 1d | ❌ | ❌ | 1 | 5 | 30 | 90 | 180 | 365 | Optimal: 4-200 |

## 🔄 Duplicate/Unused Code Found

### Services Duplication
1. **Redis Services** (Multiple implementations doing similar things):
   - `/src/services/redis/RedisChartDataProvider.ts`
   - `/src/services/redis/RedisCandleStorage.ts`
   - `/src/pages/trading/chart/services/RedisChartService.ts`

2. **Candle Aggregation Logic** (Duplicated):
   - `/backend/src/services/MultiGranularityAggregator.js`
   - `/backend/src/services/coinbaseWebSocket.js` (CandleAggregator class)
   - `/src/services/redis/CandleAggregator.ts`

3. **Unused Cache Services**:
   - `/src/services/cache/ChunkManager.ts`
   - `/src/services/cache/indexeddb/` - entire folder unused

## 🎯 Implementation Tasks

### Phase 1: Fix Immediate Issues (Quick Fixes)

```typescript
// 1. Fix GranularityControls.svelte
export let availableGranularities: string[] = ['1m', '5m', '15m', '1h', '6h', '1d'];
// Remove: '30m', '4h' - NOT SUPPORTED BY API
```

```typescript
// 2. Update ChartControls to use correct granularities
const SUPPORTED_GRANULARITIES = ['1m', '5m', '15m', '1h', '6h', '1d'];
```

### Phase 2: Implement Smart Zoom with Auto-Granularity Switching

```typescript
interface ZoomLevel {
  visibleRange: { from: number; to: number };
  recommendedGranularity: string;
  candleCountTarget: number;
}

const ZOOM_GRANULARITY_MAP = [
  { maxHours: 2,     granularity: '1m',  targetCandles: 60 },   // < 2 hours: 1m
  { maxHours: 12,    granularity: '5m',  targetCandles: 60 },   // < 12 hours: 5m
  { maxHours: 48,    granularity: '15m', targetCandles: 60 },   // < 2 days: 15m
  { maxHours: 240,   granularity: '1h',  targetCandles: 60 },   // < 10 days: 1h
  { maxHours: 1440,  granularity: '6h',  targetCandles: 60 },   // < 60 days: 6h
  { maxHours: 99999, granularity: '1d',  targetCandles: 60 },   // > 60 days: 1d
];

// Add to ChartCanvas.svelte
function handleZoomChange(visibleLogicalRange: any) {
  const timeRange = getVisibleTimeRange();
  const hoursVisible = (timeRange.to - timeRange.from) / 3600;

  // Find appropriate granularity
  const newGranularity = ZOOM_GRANULARITY_MAP
    .find(z => hoursVisible <= z.maxHours)?.granularity || '1d';

  if (newGranularity !== currentGranularity) {
    // Switch granularity and reload data
    switchGranularity(newGranularity);
  }
}
```

### Phase 3: Implement 5-Year Data Support with Splicing

```typescript
class CandleSplicer {
  // Splice strategy for large datasets
  static spliceCandles(candles: Candle[], targetCount: number = 5000): Candle[] {
    if (candles.length <= targetCount) return candles;

    const ratio = Math.ceil(candles.length / targetCount);

    // Keep every Nth candle for uniform distribution
    return candles.filter((_, index) => index % ratio === 0);
  }

  // Aggregate strategy for downsampling
  static aggregateCandles(
    candles: Candle[],
    fromGranularity: string,
    toGranularity: string
  ): Candle[] {
    const fromSeconds = GRANULARITY_TO_SECONDS[fromGranularity];
    const toSeconds = GRANULARITY_TO_SECONDS[toGranularity];
    const ratio = toSeconds / fromSeconds;

    const aggregated: Candle[] = [];

    for (let i = 0; i < candles.length; i += ratio) {
      const chunk = candles.slice(i, i + ratio);
      if (chunk.length > 0) {
        aggregated.push({
          time: chunk[0].time,
          open: chunk[0].open,
          high: Math.max(...chunk.map(c => c.high)),
          low: Math.min(...chunk.map(c => c.low)),
          close: chunk[chunk.length - 1].close,
          volume: chunk.reduce((sum, c) => sum + c.volume, 0)
        });
      }
    }

    return aggregated;
  }
}
```

### Phase 4: Historical Data Management for 5 Years

```javascript
// Extend HistoricalDataService.js
async fetchExtendedHistory(pair, targetYears = 5) {
  const strategies = [
    { days: 7,   granularity: '1m',  priority: 1 },  // Recent: high detail
    { days: 30,  granularity: '5m',  priority: 2 },  // Month: medium detail
    { days: 90,  granularity: '15m', priority: 3 },  // Quarter: medium detail
    { days: 365, granularity: '1h',  priority: 4 },  // Year: low detail
    { days: 1825, granularity: '1d', priority: 5 },  // 5 years: daily only
  ];

  for (const strategy of strategies) {
    await this.fetchHistoricalData(pair, strategy.granularity, strategy.days);
    // Store with metadata about data density
  }
}
```

### Phase 5: Clean Up Duplicate Code

1. **Consolidate Redis Services**:
   - Keep: `/src/pages/trading/chart/services/RedisChartService.ts` (primary)
   - Remove/Deprecate:
     - `/src/services/redis/RedisChartDataProvider.ts`
     - Merge useful functions into primary service

2. **Remove Unused Cache**:
   ```bash
   rm -rf src/services/cache/
   ```

3. **Consolidate Aggregation Logic**:
   - Keep: `/backend/src/services/MultiGranularityAggregator.js`
   - Remove duplicate aggregator classes

## 🚀 API Endpoints for Network Access

### Chart Data Endpoint
```
GET http://[SERVER_IP]:4828/api/trading/chart-data
  ?pair=BTC-USD
  &granularity=1m
  &startTime=1234567890
  &endTime=1234567890
  &maxCandles=10000
```

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://[SERVER_IP]:4828');
ws.send(JSON.stringify({
  type: 'subscribe',
  pair: 'BTC-USD',
  granularity: '1m'
}));
```

### Health Check
```
GET http://[SERVER_IP]:4828/health
```

## 📋 Priority Implementation Order

1. **IMMEDIATE** (Do Now):
   - Fix granularity buttons to only show supported values
   - Remove '30m' and '4h' from all components
   - Test all button combinations

2. **HIGH** (Today):
   - Implement zoom-based granularity switching
   - Add candle splicing for large datasets
   - Clean up duplicate code

3. **MEDIUM** (This Week):
   - Implement 5-year historical data fetch
   - Add data aggregation for downsampling
   - Optimize memory usage for large datasets

4. **LOW** (Future):
   - Add data compression for network transfer
   - Implement client-side caching strategy
   - Add predictive pre-fetching

## ⚠️ Critical Notes

1. **NEVER use these granularities** (not supported by Coinbase):
   - 30m, 2h, 4h, 12h

2. **Memory Limits**:
   - Browser: ~500MB for chart data
   - Max candles in view: 10,000
   - Use splicing/aggregation for larger datasets

3. **Network Optimization**:
   - Compress large responses with gzip
   - Use WebSocket for real-time updates only
   - Batch historical requests

## 🧪 Testing Checklist

- [ ] All granularity buttons show correct candles
- [ ] Network machines can access API
- [ ] Zoom automatically switches granularity
- [ ] Can zoom out to 5 years of data
- [ ] Memory usage stays under 500MB
- [ ] No duplicate API calls
- [ ] WebSocket reconnects properly
- [ ] Database traffic light shows activity