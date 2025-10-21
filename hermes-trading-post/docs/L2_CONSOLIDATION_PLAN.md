# L2 Data Consolidation - Master Implementation Plan

**Date**: October 21, 2025
**Status**: PLANNING
**Objective**: Consolidate entire system to use L2 (Level 2 orderbook) as primary data source

---

## Executive Summary

This plan consolidates the Hermes Trading Post system to use L2 orderbook data as the single source of truth for pricing, execution simulation, and liquidity analysis. This eliminates redundant data sources, improves execution accuracy, and provides real-time liquidity context throughout the system.

**Key Benefits**:
- Single source of truth for all price data (currently scattered across candles, tickers, L2)
- More accurate paper trading fills using real orderbook depth
- Real-time liquidity metrics for strategy decision-making
- Eliminate 3 separate candle aggregators (consolidate to 1 L2-based aggregator)
- Better execution analysis with bid-ask spread awareness

---

## Current State Analysis

### 1. Current L2 Implementation

**Location**: `/src/pages/trading/orderbook/stores/orderbookStore.svelte.ts`

**What it does**:
- Maintains real-time L2 orderbook state (bids/asks sorted by price)
- Uses SortedOrderbookLevels for O(log n) updates
- Provides price subscriptions for chart updates
- Already caches to Redis for fast hydration
- Updates at 10-30 Hz from Coinbase WebSocket

**Current consumers**:
- Depth chart visualization
- Price display in chart header (Phase 11 direct bridge)
- Chart candle updates (Phase 11 direct bridge)

**Not yet using L2**:
- Paper trading execution (uses candle close prices)
- Strategy analysis (uses candle OHLCV)
- Candle aggregation (3 separate aggregators exist)
- Liquidity analysis (not implemented)

### 2. Current Price Sources (Fragmented)

**Multiple sources causing confusion**:

1. **Candle Data** (`/src/services/chart/aggregation/CandleAggregator.ts`)
   - Used by: Chart display, strategies, backtesting
   - Latency: 1-60 seconds depending on granularity
   - Problem: Delayed, no bid-ask context

2. **Ticker/Trade Data** (WebSocket matches)
   - Used by: Real-time candle updates
   - Latency: ~100ms per trade
   - Problem: Only last trade price, no depth info

3. **L2 Orderbook** (`orderbookStore`)
   - Used by: Chart header, depth visualization
   - Latency: <1ms (Phase 11 direct bridge)
   - Problem: Underutilized - should be primary source!

### 3. Current Candle Aggregators (3 Duplicates!)

**Problem**: 3 different implementations doing the same thing

1. **Frontend**: `/src/services/chart/aggregation/CandleAggregator.ts`
   - Aggregates 1m → higher timeframes
   - Used by chart data orchestrator

2. **Backend**: `/backend/src/services/redis/CandleAggregator.ts`
   - Aggregates candles for Redis storage
   - Multi-step aggregation (1m → 5m → 15m → ...)

3. **Legacy**: `/src/services/data/candleAggregator.ts`
   - Old aggregator, partially deprecated
   - Still referenced in some places

**Goal**: Consolidate to 1 L2-based aggregator

### 4. Current Paper Trading Execution

**Location**: `/src/features/paper-trading/execution.ts`

**Current flow**:
```
Strategy signals → Current price from candle → Instant fill at candle close
```

**Problems**:
- No bid-ask spread consideration
- No slippage simulation
- No depth checking (what if order too large for liquidity?)
- Unrealistic fills (real market has slippage)

**Should be**:
```
Strategy signals → L2 orderbook → Simulate fill against real depth → Realistic execution price
```

---

## Implementation Plan

### Phase 1: Unified Price Provider (Week 1)

**Goal**: Create single L2-based price provider that all components use

#### 1.1 Create L2PriceProvider Service

**New File**: `/src/services/market/L2PriceProvider.ts`

```typescript
/**
 * Unified price provider using L2 orderbook as single source of truth
 * Replaces scattered price lookups across candles, tickers, and L2
 */
export class L2PriceProvider {
  private orderbookStore: OrderbookStore;

  /**
   * Get current mid-price (best bid + best ask) / 2
   * Most accurate real-time price available
   */
  getMidPrice(): number | null {
    const summary = this.orderbookStore.summary;
    if (summary.bestBid === 0 || summary.bestAsk === 0) return null;
    return (summary.bestBid + summary.bestAsk) / 2;
  }

  /**
   * Get bid-ask spread in dollars and percentage
   * Essential for execution cost analysis
   */
  getSpread(): { dollars: number; percent: number } | null {
    const summary = this.orderbookStore.summary;
    if (summary.spread === 0) return null;
    const mid = this.getMidPrice();
    return {
      dollars: summary.spread,
      percent: (summary.spread / mid!) * 100
    };
  }

  /**
   * Get liquidity available at specific price level
   * Returns total size available at or better than price
   */
  getLiquidityAtPrice(side: 'buy' | 'sell', price: number): number {
    const levels = side === 'buy'
      ? this.orderbookStore.summary.asks  // buying = taking asks
      : this.orderbookStore.summary.bids; // selling = taking bids

    return levels
      .filter(level => side === 'buy' ? level.price <= price : level.price >= price)
      .reduce((sum, level) => sum + level.size, 0);
  }

  /**
   * Estimate execution price for market order of given size
   * Walks through orderbook to simulate real execution
   */
  getExecutionPrice(side: 'buy' | 'sell', size: number): ExecutionEstimate {
    const levels = side === 'buy'
      ? this.orderbookStore.summary.asks
      : this.orderbookStore.summary.bids;

    let remaining = size;
    let totalCost = 0;
    let worstPrice = 0;

    for (const level of levels) {
      if (remaining <= 0) break;

      const fillSize = Math.min(remaining, level.size);
      totalCost += fillSize * level.price;
      remaining -= fillSize;
      worstPrice = level.price;
    }

    if (remaining > 0) {
      // Order too large for available liquidity
      return {
        canFill: false,
        avgPrice: 0,
        worstPrice: 0,
        slippageBps: 0,
        insufficientLiquidity: remaining
      };
    }

    const avgPrice = totalCost / size;
    const midPrice = this.getMidPrice()!;
    const slippageBps = Math.abs((avgPrice - midPrice) / midPrice) * 10000;

    return {
      canFill: true,
      avgPrice,
      worstPrice,
      slippageBps,
      totalCost
    };
  }

  /**
   * Subscribe to price updates from L2
   * Returns unsubscribe function
   */
  subscribeToPrice(callback: (price: number, spread: number) => void): () => void {
    return this.orderbookStore.subscribeToPriceUpdates((midPrice) => {
      const spread = this.getSpread();
      callback(midPrice, spread?.dollars || 0);
    });
  }
}
```

**Why this improves the system**:
- **Single source of truth**: All price lookups go through one service
- **Context-aware**: Every price comes with spread and liquidity info
- **Realistic**: Execution estimates match real market conditions
- **Real-time**: Updates at L2 speed (10-30 Hz), not candle speed (1-60s)

#### 1.2 Migration Path

**Step 1**: Create L2PriceProvider service
**Step 2**: Update paper trading to use L2PriceProvider.getExecutionPrice()
**Step 3**: Update strategies to use L2PriceProvider.getMidPrice()
**Step 4**: Update chart to use L2PriceProvider.subscribeToPrice()
**Step 5**: Deprecate direct candle price lookups

**Expected Benefits**:
- 30x faster price updates (10-30 Hz vs 1 Hz)
- Spread awareness in all pricing decisions
- Foundation for realistic execution simulation

---

### Phase 2: L2-Based Candle Aggregation (Week 2)

**Goal**: Replace 3 candle aggregators with 1 L2-based aggregator

#### 2.1 Current Aggregator Locations

**To Replace**:
1. `/src/services/chart/aggregation/CandleAggregator.ts` (frontend)
2. `/backend/src/services/redis/CandleAggregator.ts` (backend)
3. `/src/services/data/candleAggregator.ts` (legacy)

#### 2.2 New L2CandleAggregator

**New File**: `/src/services/market/L2CandleAggregator.ts`

```typescript
/**
 * Candle aggregator that builds OHLCV from L2 mid-price updates
 * Replaces 3 separate aggregators with single L2-based source
 */
export class L2CandleAggregator {
  private currentCandles: Map<string, CandleInProgress> = new Map();
  private priceProvider: L2PriceProvider;

  constructor(priceProvider: L2PriceProvider) {
    this.priceProvider = priceProvider;

    // Subscribe to L2 price updates
    this.priceProvider.subscribeToPrice((midPrice, spread) => {
      this.updateAllTimeframes(midPrice, spread);
    });
  }

  /**
   * Update candles for all active timeframes with new L2 price
   */
  private updateAllTimeframes(price: number, spread: number) {
    const timestamp = Date.now();

    // Update each active granularity
    for (const [granularity, candle] of this.currentCandles) {
      const periodStart = this.alignToPeriod(timestamp, granularity);
      const candleKey = `${granularity}-${periodStart}`;

      if (!candle || candle.time !== periodStart) {
        // New period - finalize old candle and start new one
        if (candle) {
          this.emitCandle(granularity, candle);
        }

        this.currentCandles.set(granularity, {
          time: periodStart,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,  // Volume from trades, not L2
          spread: spread
        });
      } else {
        // Update existing candle
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.spread = spread;
      }
    }
  }

  /**
   * Get current candle for a specific granularity
   */
  getCurrentCandle(granularity: string): CandleData | null {
    return this.currentCandles.get(granularity) || null;
  }

  /**
   * Subscribe to completed candles for a granularity
   */
  subscribe(
    granularity: string,
    callback: (candle: CandleData) => void
  ): () => void {
    // Implementation tracks subscribers and calls them when candles complete
  }
}
```

**Why this improves the system**:
- **Single aggregator**: Eliminates duplication across 3 implementations
- **Real-time**: Updates at L2 speed, not trade speed
- **Accurate**: Uses mid-price for true market price
- **Context**: Includes spread in every candle
- **Simpler**: One codebase to maintain instead of 3

#### 2.3 Migration Steps

**Week 2, Days 1-2**: Build L2CandleAggregator
- Create service with L2 price subscription
- Implement multi-timeframe aggregation
- Add subscriber pattern for candle completion

**Week 2, Days 3-4**: Migrate frontend
- Update ChartDataOrchestrator to use L2CandleAggregator
- Test with existing chart rendering
- Verify candle accuracy vs old aggregator

**Week 2, Day 5**: Migrate backend
- Update Redis storage to use L2CandleAggregator
- Ensure backward compatibility with existing APIs
- Deploy and monitor

**Expected Benefits**:
- Remove ~600 lines of duplicate code
- Faster candle updates (real-time vs 1s delay)
- Consistent aggregation logic everywhere

---

### Phase 3: L2-Aware Paper Trading (Week 3)

**Goal**: Simulate realistic execution with L2 orderbook depth

#### 3.1 Current Paper Trading Flow

**File**: `/src/features/paper-trading/execution.ts`

**Current**:
```typescript
executeBuy(state, price, amount, signal) {
  // Instant fill at current price
  const totalCost = amount * price + fee;
  state.balance.usd -= totalCost;
  state.balance.btcPositions += amount;
}
```

**Problems**:
- No slippage (unrealistic)
- No liquidity checking (could "fill" 1000 BTC instantly)
- No spread consideration (can buy at mid-price)

#### 3.2 New L2-Based Execution

**Updated File**: `/src/features/paper-trading/execution.ts`

```typescript
/**
 * Execute buy order against L2 orderbook (realistic simulation)
 */
executeBuy(
  state: PaperTradingState,
  amount: number,
  signal: Signal
): { success: boolean; trade?: Trade; error?: string } {
  // Get execution estimate from L2 orderbook
  const estimate = this.priceProvider.getExecutionPrice('buy', amount);

  if (!estimate.canFill) {
    return {
      success: false,
      error: `Insufficient liquidity: need ${amount} BTC, only ${estimate.availableLiquidity} available`
    };
  }

  // Simulate realistic execution
  const avgPrice = estimate.avgPrice;
  const fee = (amount * avgPrice) * (this.config.feePercent / 100);
  const totalCost = (amount * avgPrice) + fee;

  if (state.balance.usd < totalCost) {
    return {
      success: false,
      error: `Insufficient balance: need $${totalCost}, have $${state.balance.usd}`
    };
  }

  // Create trade with realistic execution data
  const trade: Trade = {
    id: this.generateTradeId(),
    timestamp: Date.now(),
    type: 'buy',
    price: avgPrice,  // Actual execution price (not mid!)
    amount,
    fee,
    total: amount * avgPrice,
    signal: signal.reason,
    strategyType: state.strategy?.constructor.name || 'Unknown',

    // NEW: L2 execution metadata
    executionMetrics: {
      midPrice: this.priceProvider.getMidPrice()!,
      spread: this.priceProvider.getSpread()!.dollars,
      slippageBps: estimate.slippageBps,
      worstPrice: estimate.worstPrice,
      levelsConsumed: estimate.levelsUsed
    }
  };

  // Update balances
  state.balance.usd -= totalCost;
  state.balance.btcPositions += amount;
  state.trades.push(trade);

  return { success: true, trade };
}
```

**Why this improves the system**:
- **Realistic fills**: Uses actual orderbook depth
- **Slippage tracking**: Records slippage on every trade
- **Liquidity constraints**: Can't "fill" orders larger than available liquidity
- **Better metrics**: Traders see real execution costs
- **Strategy improvement**: Strategies learn real trading costs

#### 3.3 Migration Steps

**Week 3, Days 1-2**: Update execution engine
- Add L2PriceProvider to execution.ts
- Implement L2-based fill simulation
- Add execution metrics to Trade type

**Week 3, Day 3**: Update UI to show execution metrics
- Display slippage on trade history
- Show spread awareness in order preview
- Add liquidity warnings for large orders

**Week 3, Days 4-5**: Testing and calibration
- Compare against real Coinbase fills
- Calibrate slippage models
- Validate execution accuracy

**Expected Benefits**:
- More accurate backtests (now include slippage)
- Better strategy tuning (aware of real costs)
- Educational value (users learn about liquidity)

---

### Phase 4: Strategy L2 Integration (Week 4)

**Goal**: Provide strategies with L2 context for better decision-making

#### 4.1 Current Strategy Interface

**File**: `/src/strategies/base/Strategy.ts`

**Current**:
```typescript
abstract class Strategy {
  abstract analyze(candles: CandleData[], currentPrice: number): Signal;
}
```

**Problems**:
- No spread awareness
- No liquidity visibility
- Only historical candles (delayed data)

#### 4.2 Enhanced Strategy Interface

**Updated File**: `/src/strategies/base/Strategy.ts`

```typescript
/**
 * Enhanced strategy interface with L2 market context
 */
abstract class Strategy {
  protected priceProvider: L2PriceProvider;

  /**
   * Analyze market with full L2 context
   */
  abstract analyze(
    candles: CandleData[],
    marketContext: MarketContext
  ): Signal;

  /**
   * Get current market context from L2
   */
  protected getMarketContext(): MarketContext {
    return {
      midPrice: this.priceProvider.getMidPrice()!,
      spread: this.priceProvider.getSpread()!,

      // Liquidity at different distances from mid
      liquidity: {
        near: this.priceProvider.getLiquidityAtPrice('buy', midPrice * 1.001),
        medium: this.priceProvider.getLiquidityAtPrice('buy', midPrice * 1.005),
        far: this.priceProvider.getLiquidityAtPrice('buy', midPrice * 1.01)
      },

      // Execution cost estimates for common sizes
      executionCost: {
        small: this.priceProvider.getExecutionPrice('buy', 0.01),
        medium: this.priceProvider.getExecutionPrice('buy', 0.1),
        large: this.priceProvider.getExecutionPrice('buy', 1.0)
      }
    };
  }
}
```

#### 4.3 Example Strategy Enhancement

**Updated File**: `/src/strategies/implementations/MicroScalpingStrategy.ts`

```typescript
/**
 * Micro scalping strategy enhanced with L2 awareness
 */
class MicroScalpingStrategy extends Strategy {
  analyze(candles: CandleData[], marketContext: MarketContext): Signal {
    // OLD: Just look at price movement
    // const signal = this.checkPriceMovement(candles);

    // NEW: Consider spread and liquidity
    const { spread, liquidity } = marketContext;

    // Don't trade if spread too wide (eats profit)
    if (spread.percent > 0.05) {  // 5 basis points
      return { type: 'hold', reason: 'Spread too wide for scalping' };
    }

    // Don't trade if liquidity too thin (can't exit)
    if (liquidity.near < this.minLiquidity) {
      return { type: 'hold', reason: 'Insufficient liquidity' };
    }

    // Now check price movement with context
    const signal = this.checkPriceMovement(candles);

    // Enhance signal with execution cost awareness
    if (signal.type === 'buy') {
      const executionCost = marketContext.executionCost.small;

      // Only buy if slippage is acceptable
      if (executionCost.slippageBps > 10) {  // 10 bps max
        return { type: 'hold', reason: 'Slippage too high' };
      }

      // Add execution price to signal
      signal.expectedPrice = executionCost.avgPrice;
      signal.expectedSlippage = executionCost.slippageBps;
    }

    return signal;
  }
}
```

**Why this improves the system**:
- **Better decisions**: Strategies avoid trading in poor conditions
- **Cost awareness**: Don't scalp when spread is too wide
- **Liquidity checking**: Don't enter positions you can't exit
- **More profitable**: Avoid hidden costs that kill returns

#### 4.4 Migration Steps

**Week 4, Days 1-2**: Enhance base Strategy class
- Add L2PriceProvider injection
- Add getMarketContext() helper
- Update analyze() signature with MarketContext

**Week 4, Day 3**: Update existing strategies
- Add L2 awareness to MicroScalpingStrategy
- Add L2 awareness to GridTradingStrategy
- Add L2 awareness to other strategies

**Week 4, Days 4-5**: Testing and tuning
- Backtest with new L2-aware logic
- Compare performance vs old versions
- Tune liquidity/spread thresholds

**Expected Benefits**:
- 10-20% better strategy performance (avoid bad trades)
- More realistic backtest results
- Strategies that work better in live conditions

---

### Phase 5: Real-Time Liquidity Metrics (Week 5)

**Goal**: Add live liquidity monitoring to trading dashboard

#### 5.1 New LiquidityAnalyzer Service

**New File**: `/src/services/market/LiquidityAnalyzer.ts`

```typescript
/**
 * Real-time liquidity analysis from L2 orderbook
 */
export class LiquidityAnalyzer {
  private priceProvider: L2PriceProvider;
  private orderbookStore: OrderbookStore;

  /**
   * Calculate orderbook imbalance
   * Positive = more buying pressure, Negative = more selling pressure
   */
  getImbalance(): number {
    const summary = this.orderbookStore.summary;
    const bidVolume = summary.bids.reduce((sum, level) => sum + level.size, 0);
    const askVolume = summary.asks.reduce((sum, level) => sum + level.size, 0);

    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }

  /**
   * Estimate market depth (how much size before 1% price impact)
   */
  getDepth(): { buyDepth: number; sellDepth: number } {
    const midPrice = this.priceProvider.getMidPrice()!;
    const buyThreshold = midPrice * 1.01;  // 1% above mid
    const sellThreshold = midPrice * 0.99;  // 1% below mid

    const buyDepth = this.priceProvider.getLiquidityAtPrice('buy', buyThreshold);
    const sellDepth = this.priceProvider.getLiquidityAtPrice('sell', sellThreshold);

    return { buyDepth, sellDepth };
  }

  /**
   * Detect if orderbook is becoming illiquid
   */
  isIlliquid(): boolean {
    const spread = this.priceProvider.getSpread()!;
    const depth = this.getDepth();

    // Illiquid if spread > 10 bps OR depth < 1 BTC
    return spread.percent > 0.10 ||
           depth.buyDepth < 1.0 ||
           depth.sellDepth < 1.0;
  }

  /**
   * Get liquidity metrics for display
   */
  getMetrics(): LiquidityMetrics {
    return {
      spread: this.priceProvider.getSpread()!,
      imbalance: this.getImbalance(),
      depth: this.getDepth(),
      isIlliquid: this.isIlliquid(),
      timestamp: Date.now()
    };
  }

  /**
   * Subscribe to liquidity updates
   */
  subscribe(callback: (metrics: LiquidityMetrics) => void): () => void {
    return this.priceProvider.subscribeToPrice(() => {
      callback(this.getMetrics());
    });
  }
}
```

#### 5.2 UI Integration

**New Component**: `/src/pages/trading/components/LiquidityWidget.svelte`

```svelte
<script lang="ts">
  import { liquidityAnalyzer } from '$services/market/LiquidityAnalyzer';

  let metrics = $state<LiquidityMetrics | null>(null);

  $effect(() => {
    const unsubscribe = liquidityAnalyzer.subscribe((m) => {
      metrics = m;
    });

    return () => unsubscribe();
  });
</script>

<div class="liquidity-widget">
  <div class="metric">
    <span class="label">Spread</span>
    <span class="value">{metrics?.spread.percent.toFixed(3)}%</span>
  </div>

  <div class="metric">
    <span class="label">Imbalance</span>
    <span class="value" class:positive={metrics?.imbalance > 0}>
      {(metrics?.imbalance * 100).toFixed(1)}%
    </span>
  </div>

  <div class="metric">
    <span class="label">Depth (1%)</span>
    <span class="value">
      {metrics?.depth.buyDepth.toFixed(2)} / {metrics?.depth.sellDepth.toFixed(2)} BTC
    </span>
  </div>

  {#if metrics?.isIlliquid}
    <div class="warning">⚠️ Low liquidity - wide spreads or thin orderbook</div>
  {/if}
</div>
```

**Why this improves the system**:
- **Transparency**: Users see real market conditions
- **Risk awareness**: Know when liquidity is poor
- **Better timing**: Trade when conditions are favorable
- **Educational**: Learn what liquidity means

#### 5.3 Migration Steps

**Week 5, Days 1-2**: Build LiquidityAnalyzer
- Implement imbalance calculation
- Implement depth calculation
- Add illiquidity detection

**Week 5, Day 3**: Create UI widget
- Build LiquidityWidget component
- Add to trading dashboard
- Style and polish

**Week 5, Days 4-5**: Integration and testing
- Add liquidity warnings to order entry
- Test with different market conditions
- Gather user feedback

**Expected Benefits**:
- Better trade timing (avoid illiquid periods)
- Risk reduction (see poor conditions)
- Educational value for users

---

## Migration Timeline

### Week 1: Foundation
- [ ] Create L2PriceProvider service
- [ ] Add ExecutionEstimate types
- [ ] Build unit tests
- [ ] Update paper trading to use L2PriceProvider
- **Deliverable**: Single price source replacing scattered lookups

### Week 2: Aggregation
- [ ] Create L2CandleAggregator
- [ ] Migrate frontend to new aggregator
- [ ] Migrate backend to new aggregator
- [ ] Remove 3 old aggregators
- **Deliverable**: 1 aggregator instead of 3, real-time candles

### Week 3: Execution
- [ ] Update paper trading execution with L2 fills
- [ ] Add execution metrics to Trade type
- [ ] Update UI to show slippage/spread
- [ ] Test execution accuracy
- **Deliverable**: Realistic execution simulation

### Week 4: Strategies
- [ ] Enhance Strategy base class with MarketContext
- [ ] Update MicroScalpingStrategy with L2 awareness
- [ ] Update GridTradingStrategy with L2 awareness
- [ ] Backtest and tune
- **Deliverable**: Smarter strategies with market awareness

### Week 5: Analytics
- [ ] Build LiquidityAnalyzer service
- [ ] Create LiquidityWidget component
- [ ] Add liquidity warnings
- [ ] Polish and deploy
- **Deliverable**: Real-time liquidity monitoring

---

## Expected System Improvements

### Performance
- **Price updates**: 30x faster (10-30 Hz vs 1 Hz)
- **Candle latency**: 1s → <100ms for real-time updates
- **Code reduction**: ~600 lines removed (3 aggregators → 1)

### Accuracy
- **Execution simulation**: Realistic slippage vs instant fills
- **Backtests**: Include real trading costs (spread + slippage)
- **Strategy performance**: 10-20% improvement from avoiding bad conditions

### Architecture
- **Single source of truth**: L2 for all prices
- **Better separation**: Price logic in dedicated service
- **Easier maintenance**: 1 aggregator to maintain vs 3
- **Testability**: Clear dependencies, easy to mock

### User Experience
- **Transparency**: See real spread and liquidity
- **Better decisions**: Know when NOT to trade
- **Education**: Learn market microstructure
- **Confidence**: Know fills are realistic

---

## Risk Mitigation

### Fallback Strategy
- Keep old candle aggregators for 1 month during migration
- Feature flag for L2-based execution (can disable if issues)
- Parallel run mode (compare L2 fills vs old fills)

### Testing Plan
- Unit tests for all new services
- Integration tests for execution flow
- Backtest comparison (old vs new strategies)
- Load testing (L2 updates at 30 Hz)

### Rollback Plan
- Each phase is independent (can roll back individually)
- Old code stays in place until new code proven
- Database changes are additive (new columns, not destructive)

---

## Success Metrics

### Technical
- [ ] All price lookups go through L2PriceProvider
- [ ] 3 aggregators reduced to 1
- [ ] Paper trading shows slippage on all fills
- [ ] Strategies use MarketContext
- [ ] Liquidity widget deployed

### Performance
- [ ] Price latency < 100ms (down from 1000ms)
- [ ] Candle updates < 100ms (down from 1000ms)
- [ ] Code reduction: 600+ lines

### Business
- [ ] Backtest accuracy improved (measured against real fills)
- [ ] Strategy performance improved (10-20%)
- [ ] User satisfaction (feedback on liquidity visibility)

---

## File Changes Summary

### New Files
- `/src/services/market/L2PriceProvider.ts` (~200 lines)
- `/src/services/market/L2CandleAggregator.ts` (~150 lines)
- `/src/services/market/LiquidityAnalyzer.ts` (~100 lines)
- `/src/pages/trading/components/LiquidityWidget.svelte` (~80 lines)
- `/src/types/market/L2Types.ts` (~50 lines)

### Modified Files
- `/src/features/paper-trading/execution.ts` (L2-based fills)
- `/src/strategies/base/Strategy.ts` (MarketContext parameter)
- `/src/strategies/implementations/*.ts` (L2 awareness)
- `/src/pages/trading/chart/hooks/useRealtimeSubscription.svelte.ts` (use L2CandleAggregator)

### Removed Files
- `/src/services/chart/aggregation/CandleAggregator.ts` (duplicate)
- `/backend/src/services/redis/CandleAggregator.ts` (duplicate)
- `/src/services/data/candleAggregator.ts` (legacy)

### Lines of Code
- **Added**: ~580 lines (new services + enhancements)
- **Removed**: ~600 lines (3 aggregators)
- **Net change**: -20 lines (cleaner codebase!)

---

## Conclusion

This L2 consolidation plan transforms Hermes Trading Post from a fragmented price system to a unified L2-based architecture. By making L2 the single source of truth, we gain:

1. **Better accuracy**: Realistic execution simulation
2. **Faster updates**: Real-time prices (10-30 Hz)
3. **Smarter strategies**: Market-aware decision-making
4. **Cleaner code**: 1 aggregator instead of 3
5. **More transparency**: Users see real market conditions

The migration is incremental (5 weeks), low-risk (rollback at any phase), and high-value (10-20% strategy improvement + better UX).

**Status**: Ready for implementation
**Next Step**: Begin Week 1 - L2PriceProvider service

---

## References

- **Phase 11**: Direct L2-to-dashboard bridge (`/docs/PHASE11_DIRECT_L2_BRIDGE.md`)
- **Orderbook Store**: `/src/pages/trading/orderbook/stores/orderbookStore.svelte.ts`
- **Current Aggregators**: See "Current State Analysis" section
- **Paper Trading**: `/src/features/paper-trading/execution.ts`
- **Strategies**: `/src/strategies/base/Strategy.ts`
