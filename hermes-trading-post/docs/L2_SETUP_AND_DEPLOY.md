# L2 Consolidation - Setup & Deployment Guide

## Quick Start (5 minutes)

### Step 1: Initialize Services at App Startup

In your main app file (e.g., `src/App.svelte` or `src/main.ts`):

```typescript
import { l2ServiceInitializer } from '@/services/market/L2ServiceInitializer';
import { onMount } from 'svelte';

onMount(async () => {
  try {
    // Initialize all L2 services (price, candles, execution, liquidity)
    await l2ServiceInitializer.initialize();
    console.log('✅ L2 services ready');

    // Get status
    const status = l2ServiceInitializer.getStatus();
    console.log('Status:', status);
  } catch (error) {
    console.error('Failed to initialize L2 services:', error);
  }
});
```

### Step 2: Use L2 in Chart Component

```typescript
import { createChartAdapter } from '@/services/market/L2ChartAdapter';
import { onMount, onDestroy } from 'svelte';

let adapter: L2ChartAdapter;
let candles = [];
let price = 0;
let liquidity = null;

onMount(() => {
  // Create adapter for 1-minute candles
  adapter = createChartAdapter(60);

  // Subscribe to updates
  const unsubscribe = adapter.subscribe((data) => {
    candles = data.candles;
    price = data.price.midPrice;
    liquidity = data.liquidity;
  });

  return unsubscribe;
});

onDestroy(() => {
  adapter.destroy();
});
```

### Step 3: Use L2 in Strategy

```typescript
import { l2PriceProvider } from '@/services/market/L2PriceProvider';

export class MyStrategy {
  analyze(candles) {
    // Get market context from L2
    const context = l2PriceProvider.getMarketContext();

    if (!context?.isHealthy) {
      return { type: 'hold', reason: 'Market not healthy' };
    }

    // Use context in decision
    if (context.spread.bps > 10) {
      return { type: 'hold', reason: 'Spread too wide' };
    }

    // Normal strategy logic
    return { type: 'buy' };
  }
}
```

### Step 4: Use L2 in Paper Trading

```typescript
import { l2ExecutionSimulator } from '@/services/market/L2ExecutionSimulator';

async function executeOrder(side, size) {
  if (side === 'buy') {
    const trade = l2ExecutionSimulator.simulateBuy(size);
    console.log(`Filled: ${trade.filledSize} at ${trade.averagePrice}`);
    console.log(`Slippage: ${trade.slippageBps} bps`);
    return trade;
  }
}
```

---

## Complete Setup (30 minutes)

### Phase 1: Initialize (5 min)

**File**: `src/App.svelte` or `src/main.ts`

```typescript
import { l2ServiceInitializer } from '@/services/market/L2ServiceInitializer';

// At app startup
await l2ServiceInitializer.initialize();
```

### Phase 2: Chart Integration (10 min)

**Files to update**:
- `src/pages/trading/chart/ChartContainer.svelte`
- `src/pages/trading/chart/components/canvas/ChartCanvas.svelte`

**Replace old price source**:

```typescript
// OLD: import ticker or candle stream
// NEW:
import { createChartAdapter } from '@/services/market/L2ChartAdapter';

let adapter = createChartAdapter(60);

adapter.subscribe((data) => {
  // Update with L2 data
  updateChart(data.candles);
  updatePrice(data.price);
  updateLiquidity(data.liquidity);
});
```

### Phase 3: Strategy Integration (10 min)

**Files to update**: All strategy implementations

```typescript
// Add to analyze() method:
const context = l2PriceProvider.getMarketContext();

// Use context to improve decisions:
if (!context?.isHealthy) return { type: 'hold' };
if (context.spread.bps > threshold) return { type: 'hold' };
```

### Phase 4: Paper Trading Integration (5 min)

**Files to update**: `src/features/paper-trading/execution.ts`

```typescript
// Replace:
// const fill = ticker.getPrice(); // OLD

// With:
const trade = l2ExecutionSimulator.simulateBuy(size);  // NEW
console.log(`Slippage: ${trade.slippageBps} bps`);
```

---

## Testing (45 minutes)

### Unit Tests

Create `src/services/market/__tests__/L2PriceProvider.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { L2PriceProvider } from '../L2PriceProvider';
import { TEST_ORDERBOOKS } from './L2MockOrderbook';

describe('L2PriceProvider', () => {
  it('calculates correct mid-price', () => {
    // Mock orderbook
    const ob = TEST_ORDERBOOKS.normal;

    // Test calculation
    const expected = (ob.bids[0].price + ob.asks[0].price) / 2;
    // assert(actual === expected);
  });

  it('estimates execution correctly', () => {
    // Test slippage calculation
  });

  it('detects market health', () => {
    // Test health score
  });
});
```

### Integration Tests

Create `src/services/market/__tests__/L2Integration.test.ts`:

```typescript
import { describe, it } from 'vitest';
import { L2ServiceInitializer } from '../L2ServiceInitializer';

describe('L2 Integration', () => {
  it('initializes all services', async () => {
    const init = L2ServiceInitializer.getInstance();
    await init.initialize();
    // Verify all services are ready
  });

  it('chart receives real-time updates', () => {
    // Test chart adapter subscription
  });

  it('strategies get market context', () => {
    // Test strategy integration
  });
});
```

### Manual Testing Checklist

- [ ] Open app, see initialization message
- [ ] Price updates in real-time (10-30 Hz)
- [ ] Candles complete every minute
- [ ] Spread displays correctly
- [ ] Strategy decisions use market context
- [ ] Paper trades show realistic slippage
- [ ] Liquidity alerts appear in critical conditions

---

## Deployment Steps

### Pre-Deployment Checks

```bash
# 1. Compile without errors
npm run build

# 2. Run tests
npm run test

# 3. Check no console errors
npm run dev

# 4. Verify initialization
# Should see: "✅ All services initialized successfully"
```

### Deployment Process

1. **Feature Flag** (Optional - if paranoid)
   ```typescript
   const USE_L2 = import.meta.env.VITE_USE_L2 === 'true';
   if (USE_L2) await l2ServiceInitializer.initialize();
   ```

2. **Gradual Rollout** (Recommended)
   - Deploy to staging first
   - Test for 24 hours
   - Deploy to production

3. **Monitoring**
   ```typescript
   // Add to dashboard
   const status = l2ServiceInitializer.getStatus();
   console.log('L2 Status:', status);

   // Check every 10 seconds
   setInterval(() => {
     const status = l2ServiceInitializer.getStatus();
     if (!status.initialized) {
       alert('⚠️ L2 services not initialized!');
     }
   }, 10000);
   ```

---

## Troubleshooting

### Problem: Services not initializing

**Check**:
1. Is `orderbookStore` receiving L2 data?
   ```typescript
   console.log(orderbookStore);
   // Should show: { bids: [...], asks: [...], sequence: ... }
   ```

2. Are there TypeScript errors?
   ```bash
   npm run build
   # Check output for errors
   ```

3. Check browser console for errors

**Solution**:
- Ensure WebSocket is connected
- Check `orderbookStore` subscription
- Verify L2 data is flowing

### Problem: Prices not updating

**Check**:
1. Is orderbook updating?
   ```typescript
   l2PriceProvider.subscribeToPrice((update) => {
     console.log('Price update:', update);
   });
   ```

2. Check L2 bid/ask:
   ```typescript
   console.log(l2PriceProvider.getBestPrices());
   // Should show: { bid: 45000.50, ask: 45001.50 }
   ```

**Solution**:
- Restart WebSocket connection
- Check network tab for L2 data
- Verify orderbook has depth

### Problem: Chart not updating

**Check**:
1. Is adapter subscribed?
   ```typescript
   const data = adapter.getChartData();
   console.log('Chart data:', data);
   ```

2. Are candles being generated?
   ```typescript
   const aggregator = l2CandleFactory.getAggregator(60);
   console.log(aggregator.getMetrics());
   ```

**Solution**:
- Check L2PriceProvider is updating
- Verify candle aggregator subscription
- Review chart component subscription

### Problem: Strategies not using context

**Check**:
1. Does strategy receive context?
   ```typescript
   const context = l2PriceProvider.getMarketContext();
   console.log('Market context:', context);
   ```

2. Is strategy checking context?
   ```typescript
   if (!context?.isHealthy) {
     console.log('Strategy: Market not healthy, holding');
   }
   ```

**Solution**:
- Update strategy to request context
- Verify strategy.analyze() includes context logic
- Test with real orderbook data

---

## Performance Monitoring

### Add Debug Dashboard

```typescript
setInterval(() => {
  const price = l2PriceProvider.getMidPrice();
  const quality = liquidityAnalyzer.getMarketQuality();
  const stats = l2ExecutionSimulator.getStatistics();

  console.log(`
    Price: $${price}
    Quality: ${quality}/100
    Trades: ${stats.totalTrades}
    Avg Slippage: ${stats.averageSlippageBps} bps
  `);
}, 10000);
```

### Monitor Update Frequency

```typescript
let updates = 0;
l2PriceProvider.subscribeToPrice(() => {
  updates++;
});

setInterval(() => {
  console.log(`Price updates/sec: ${updates / 10}`);
  updates = 0;
}, 10000);
```

Expected: ~1-3 updates per second (10-30 Hz per second = ~1-3/sec average)

---

## Rollback Plan

If issues occur:

1. **Disable L2 services**:
   ```typescript
   // Comment out initialization
   // await l2ServiceInitializer.initialize();
   ```

2. **Fall back to old sources**:
   ```typescript
   // Revert to ticker/candle aggregators
   // Old code still available
   ```

3. **Restart services**:
   ```bash
   npm run dev
   # Or redeploy
   ```

---

## Success Criteria

✅ **Phase 1**: Services initialize without errors
✅ **Phase 2**: Chart displays real-time prices (10-30 Hz)
✅ **Phase 3**: Strategies make better decisions
✅ **Phase 4**: Paper trades show realistic slippage
✅ **Phase 5**: Dashboard shows market metrics

---

## Support

### Quick Reference

| Issue | Solution |
|-------|----------|
| No initialization | Check `orderbookStore` has L2 data |
| Prices not updating | Check WebSocket connection |
| Chart blank | Verify `L2ChartAdapter` subscription |
| Strategy issues | Add `MarketContext` parameter |
| Paper trading wrong | Use `L2ExecutionSimulator` |

### Getting Help

1. Check browser console for errors
2. Review `L2_SERVICES_INDEX.md` for API reference
3. Check `L2MockOrderbook.ts` for test data
4. Run manual tests from checklist above

---

## Next Steps After Deployment

1. **Monitor for 24 hours**
   - Check console for warnings/errors
   - Monitor performance metrics
   - Verify strategy performance improved

2. **Gather Metrics**
   - Price update frequency
   - Execution slippage
   - Strategy win rate
   - System resources

3. **Optimize**
   - Adjust thresholds if needed
   - Fine-tune liquidity alerts
   - Improve strategy context usage

4. **Document Improvements**
   - Record before/after metrics
   - Document best practices
   - Update team knowledge base

