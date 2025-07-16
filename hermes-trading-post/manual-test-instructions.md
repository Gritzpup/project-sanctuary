# Manual Testing Instructions for Hermes Trading Post

## 1. Open the Dashboard
- Go to http://localhost:5173
- Wait for the chart to load with BTC-USD data

## 2. Test Each Timeframe

### Short Timeframes (1m data):
- **1H**: Should show ~60 candles (1 minute each)
- **4H**: Should show ~240 candles (1 minute each)

### Medium Timeframes (1h data):
- **1D**: Should show ~24 candles (1 hour each)
- **1W**: Should show ~168 candles (1 hour each)

### Long Timeframes (1D data):
- **1M**: Should show ~30 candles (1 day each)
- **3M**: Should show ~90 candles (1 day each)
- **1Y**: Should show ~365 candles (1 day each)
- **5Y**: Should show as many candles as available (BTC data may only go back to ~2015)

## 3. Check for Issues

### ✅ Should Work:
- No 429 rate limiting errors in console
- No attempts to fetch future data
- Smooth transitions between timeframes
- Proper candle counts displayed
- Chart stays locked to selected timeframe (no zoom)

### ❌ Should NOT Happen:
- Console errors about rate limiting
- Requests for dates beyond today
- Empty charts
- Frozen UI

## 4. Zoom is DISABLED
- No scroll zoom
- No pinch zoom
- No drag to pan
- Chart view is fixed to selected timeframe only

## 5. Check Console Output
Open DevTools (F12) and look for:
- "Loading X days of daily data for long-term view" when selecting 1Y/5Y
- "Skipping future data request" messages (good - means protection is working)
- No 429 errors
- No excessive API calls

## Summary
Based on our fixes:
1. **Future data protection** - Working ✅
2. **Rate limiting** - Fixed with proper limiter ✅
3. **1Y/5Y views** - Auto-loading correct data ✅
4. **Zoom** - DISABLED per user request ✅