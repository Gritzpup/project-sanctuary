# Real-Time Updates Test Guide

## What Was Fixed

1. **WebSocket Candle Updates**: Fixed the subscription handler to properly update candles in real-time
2. **Countdown Timer**: Now uses `effectiveGranularity` instead of display granularity  
3. **Volume Preservation**: Candle updates now preserve volume data
4. **Auto-Scroll**: Chart auto-scrolls when new candles appear (if viewing recent data)
5. **New Candle Detection**: Properly detects and loads new candles when they appear

## Testing Steps

### 1. Test 1-Minute Updates (Most Frequent)

1. Open the chart with 1H period and 1m granularity
2. Wait for a new minute to start (watch the countdown)
3. **Expected**: 
   - Countdown should show "Next 1m: XXs"
   - When countdown reaches 0, a new candle should appear
   - Chart should auto-scroll if you're viewing the latest data
   - Existing candles should update with price changes

### 2. Test 5-Minute Updates

1. Switch to 5m granularity
2. Wait for countdown to complete
3. **Expected**:
   - Countdown shows "Next 5m: Xm XXs"
   - Chart reloads when new 5m candle starts
   - Previous 5 candles get aggregated into one

### 3. Test Granularity Changes

1. Switch between different granularities (1m, 5m, 15m)
2. **Expected**:
   - Countdown immediately updates to show correct next candle time
   - Chart reloads with proper candle aggregation
   - Visible candle count adjusts appropriately

### 4. Test Volume Preservation

1. Watch a 1m candle update in real-time
2. Note the volume before and after updates
3. **Expected**: Volume should accumulate, not reset

## Debugging Tips

Open browser console (F12) to see:
- "New 1m candle detected, reloading data..." messages
- "5m candle update detected, reloading..." for larger granularities
- Any errors in WebSocket updates

## What to Look For

✅ **Working Correctly**:
- Countdown aligns with actual candle creation
- New candles appear when countdown reaches 0
- Price updates reflect in current candle
- Auto-scroll keeps latest data visible

❌ **Issues to Report**:
- Countdown doesn't match candle creation
- Candles don't appear when expected
- Volume resets to 0 on updates
- Chart doesn't auto-scroll for new candles