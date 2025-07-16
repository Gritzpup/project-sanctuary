# Timescale/Timeframe Alignment Fix

## What Was Wrong

1. **Auto-granularity override**: When you selected a granularity (like 1m, 5m), the ChartDataFeed was ignoring it and using its own auto-granularity logic
2. **Manual mode timeout**: Manual granularity selection only lasted 2 seconds before reverting to auto mode
3. **Case mismatch**: Dashboard used '1D' but ChartDataFeed expected '1d'

## What I Fixed

1. **Persistent manual mode**: When you select a granularity, it now stays selected until you change it
2. **Force manual granularity**: Both `loadInitialData` and `reloadData` now explicitly set manual mode before loading data
3. **Case consistency**: Updated all references to use '1D' (uppercase) consistently

## How Timescales Work Now

When you select a period and granularity:
- **1H period + 1m granularity** = 60 one-minute candles
- **4H period + 5m granularity** = 48 five-minute candles  
- **5D period + 15m granularity** = 480 fifteen-minute candles
- **1M period + 1h granularity** = 720 one-hour candles
- **1Y period + 1D granularity** = 365 daily candles

The Dashboard enforces valid combinations (e.g., you can't select 1m for a 1Y view - too many candles).

## Testing

1. Select different period/granularity combinations
2. Check the console for messages like:
   - "Manual granularity set to: 5m"
   - "Loaded X candles (expected Y)"
3. Verify the candle count matches expectations

## If Auto-Granularity Is Still Interfering

The ChartDataFeed still has auto-granularity logic for zooming. If you want to completely disable it, let me know and I can remove that feature entirely.