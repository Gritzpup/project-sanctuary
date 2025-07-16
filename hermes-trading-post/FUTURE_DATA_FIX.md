# Future Data Protection Fix

## Problem
When zooming out on the chart (especially to 1Y or 5Y views), the system was:
1. Trying to fetch data for dates in the future (e.g., Feb-July 2025)
2. Making hundreds of API requests for non-existent data
3. Getting rate limited (429 errors) from Coinbase
4. Wasting resources trying to fill "gaps" that were actually future dates

## Root Cause
The chart's visible range could extend into the future when zooming out, and the system didn't have protection against requesting future data.

## Solution
Added future data protection in three key places:

### 1. chartDataFeed.ts - `fetchGapData()`
```typescript
// Don't try to fetch future data
if (gap.start > now) {
  console.log(`Skipping future gap: ${new Date(gap.start * 1000).toISOString()}`);
  return;
}
// Cap the end time to now to prevent fetching future data
const gapEnd = Math.min(gap.end, now);
```

### 2. indexedDBCache.ts - `findGaps()`
```typescript
// Don't identify gaps in the future
const now = Math.floor(Date.now() / 1000);
endTime = Math.min(endTime, now);

// If the entire range is in the future, return no gaps
if (startTime > now) {
  return [];
}
```

### 3. chartDataFeed.ts - `getCurrentDataForRange()`
```typescript
// Don't try to get future data
const now = Math.floor(Date.now() / 1000);
endTime = Math.min(endTime, now);

// If the entire range is in the future, return empty
if (startTime > now) {
  console.log(`Requested range is entirely in the future: ${new Date(startTime * 1000).toISOString()}`);
  return [];
}
```

## Benefits
- No more 429 rate limiting errors
- No more wasted API requests for future data
- Chart loads faster when zooming out
- System only requests data that actually exists

## Testing
1. Zoom out to 1Y or 5Y view
2. Watch the console - you should NOT see:
   - Requests for dates beyond today
   - 429 errors
   - "No candles returned for range 2025-XX-XX" messages
3. The chart should display historical data up to the current date only