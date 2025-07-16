# Candle Display Fix - Only Showing 2 Candles

## Problem
When viewing 1H period with 1m granularity, only 2 candles are showing instead of the expected 60.

## Debugging Steps Added

1. **Enhanced Console Logging**:
   - Added detailed logging in Chart.svelte to track visible range calculations
   - Logs now show expected vs actual visible range in minutes

2. **Period Mapping Fix**:
   - Added missing period mappings (1D, 1W) to periodToDays object
   - Ensures all periods calculate correctly

3. **Chart Configuration**:
   - Set fixLeftEdge and fixRightEdge to true (locks edges since zoom is disabled)
   - Reduced barSpacing from 6 to 3 pixels
   - Reduced minBarSpacing from 3 to 1 pixel
   - This allows more candles to fit in the view

4. **Visible Range Setting**:
   - Now calls fitContent() first to ensure all data is considered
   - Then sets specific visible range for the period
   - Logs the actual range after setting to verify

## How to Debug

1. Open http://localhost:5173
2. Open browser DevTools (F12) and watch Console
3. Click on 1H button
4. Look for these logs:
   ```
   Initial load for 1H with 1m:
   - expectedCandles: 60
   - rangeInSeconds: 3600
   
   Setting visible range: X to Y (60 minutes)
   Actual visible range after setting: X to Y (should be ~60 minutes)
   ```

## Possible Causes

1. **Chart Width**: If the chart container is too narrow, it might not fit 60 candles even with min spacing
2. **Data Issue**: If only 2 candles are loaded from the API
3. **Time Range Issue**: If the visible range is being overridden after setting

## Next Steps

Check the console logs to see:
- How many candles are actually loaded from the API
- What the visible range is after setting
- Any errors during range setting