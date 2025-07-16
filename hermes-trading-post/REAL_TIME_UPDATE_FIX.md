# Real-Time Update Fixes

## Summary of Changes

Fixed all real-time update issues in the trading chart to ensure candles update properly with live data from Coinbase WebSocket.

## Key Fixes Applied

### 1. Countdown Timer Alignment (Line 729)
**Problem**: Countdown was using display `granularity` instead of `effectiveGranularity`
**Fix**: Changed to use `effectiveGranularity` for accurate countdown calculation
```typescript
// Before
const granularitySeconds = granularityToSeconds[granularity] || 60;

// After  
const granularitySeconds = granularityToSeconds[effectiveGranularity] || 60;
```

### 2. WebSocket Subscription Handler (Lines 261-289 & 128-174)
**Problem**: Updates weren't properly handling new vs existing candles
**Fix**: Improved logic to:
- Properly detect new candles vs updates
- Preserve volume data on updates
- Trigger reloads only when necessary
- Add console logging for debugging

### 3. Volume Data Preservation
**Problem**: Volume was being lost during real-time updates
**Fix**: Explicitly preserve all OHLCV data in updates:
```typescript
candleSeries.update({
  time: candle.time as Time,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume || 0  // Preserve volume
});
```

### 4. Auto-Scroll for New Candles
**Problem**: Chart didn't scroll when new candles appeared
**Fix**: Added auto-scroll logic that:
- Detects if user is viewing recent data (within 2 minutes of current time)
- Automatically scrolls the visible range forward by one candle period
- Only triggers after successful data reload

### 5. Proper Candle Boundary Detection
**Problem**: Updates triggered too frequently for larger granularities
**Fix**: Added proper alignment checks:
```typescript
const candleAlignedTime = Math.floor(candle.time / granularitySeconds) * granularitySeconds;
const currentAlignedTime = Math.floor(Date.now() / 1000 / granularitySeconds) * granularitySeconds;
const isNewCandle = currentAlignedTime > candleAlignedTime;
```

## Testing

1. **1-Minute Candles**: Updates should appear every minute when countdown reaches 0
2. **5-Minute+ Candles**: Chart should reload when new candle period starts
3. **Countdown Display**: Should show "Next [effectiveGranularity]: XXs"
4. **Auto-Scroll**: Chart should follow new candles if viewing recent data

## Files Modified

- `/src/lib/Chart.svelte` - All real-time update logic improvements

## Verification

Watch the browser console for:
- "New 1m candle detected, reloading data..." 
- "[granularity] candle update detected, reloading..."

These messages confirm the real-time updates are working correctly.