# 1Y and 5Y Timeframe Fix

## What Was Wrong

1. **Insufficient initial data**: Only loaded 30 days of daily data on startup
2. **No automatic loading**: When switching to 1Y/5Y, it didn't fetch the needed data
3. **No handling for missing historical data**: Coinbase may not have 5 full years of BTC data

## What I Fixed

### 1. Increased Initial Load
- Changed from 30 days to 90 days of daily data
- Covers 1M and 3M views without additional loading

### 2. Auto-Load for Long Timeframes
```typescript
if (rangeInDays > 180 && this.activeGranularity === '1D') {
  console.log(`Loading ${rangeInDays} days of daily data for long-term view`);
  await this.loadHistoricalData('1D', Math.ceil(rangeInDays));
}
```
- Automatically loads data when you select 1Y or 5Y

### 3. Better Error Handling
- Detects when historical data doesn't exist
- Stops trying to fetch data older than what's available
- Shows warnings in console about data limits

## Testing

1. **Test Data Availability**: Open http://localhost:5173/test-1y-5y.html
   - Click "Test 1 Year" - should work
   - Click "Test 5 Years" - may show limited data
   - Click "Test Max Range" - finds oldest available data

2. **In the Trading Dashboard**:
   - Select 1Y - should load after a moment
   - Select 5Y - will load available data (may be less than 5 years)
   - Watch console for messages about data availability

## Known Limitations

- **BTC on Coinbase**: Bitcoin trading on Coinbase started around 2015
- **5Y View**: May only show 3-4 years of actual data
- **API Limits**: Maximum 300 candles per request (handled automatically)

## Console Messages to Watch For

- `Loading X days of daily data for long-term view`
- `Got X candles but expected ~Y. Data may not exist before...`
- `Returning X candles for display`

The chart will now show whatever historical data is available, even if it's less than the requested timeframe.