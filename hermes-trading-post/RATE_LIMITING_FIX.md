# Rate Limiting Fix

## What Was Wrong

We were hitting Coinbase's rate limits because:
1. Making too many API calls in parallel
2. No proper rate limiting or request queuing
3. Loading too much data on startup
4. Not using cache effectively

## What I Fixed

### 1. **Proper Rate Limiter** (`rateLimiter.ts`)
- Limits to 10 requests/second (Coinbase's limit)
- Max 3 concurrent requests
- Automatic exponential backoff on 429 errors
- Request queuing to prevent overwhelming the API

### 2. **Reduced Initial Load**
- 1m: Only 6 hours (was 1 day) = 360 candles
- 5m: Only 1 day (was 7 days) = 288 candles  
- 1h: Only 1 week (was 30 days) = 168 candles
- 1D: Only 1 month (was 90 days) = 30 candles

### 3. **Smarter Cache Usage**
- Only fetch data if >10% is missing from cache
- Shows cache coverage percentage in console
- Avoids redundant API calls

### 4. **Removed Progressive Loader**
- No longer loads years of historical data in background
- Only loads data on-demand when you view it

## Console Messages

You'll now see:
```
Rate limiter status: { queueLength: 0, inProgress: 2, hasRetryDelays: false }
Cache coverage: 95.3% (288 candles, 2 gaps)
```

## If You Still Get Rate Limited

The rate limiter will:
1. Automatically retry with exponential backoff
2. Show "Rate limited, waiting Xms before retry..."
3. Queue remaining requests
4. Eventually succeed

## Testing

1. Clear your cache: Open DevTools → Application → Storage → Clear site data
2. Reload the page
3. Watch console for rate limiter status
4. Should load without 429 errors