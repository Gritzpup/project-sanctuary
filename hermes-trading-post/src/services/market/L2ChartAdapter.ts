/**
 * ✅ L2 CONSOLIDATION - Chart Adapter
 *
 * Bridges L2 services to chart display components
 * Handles: price updates, candle data, spread display, liquidity info
 */

import { l2PriceProvider } from './L2PriceProvider';
import { l2CandleFactory } from './L2CandleAggregator';
import { liquidityAnalyzer } from './LiquidityAnalyzer';
import type { PriceUpdate, Candle, LiquidityCondition } from '../../types/market/L2Types';

export interface ChartData {
  price: PriceUpdate;
  candles: Candle[];
  currentCandle: Candle | null;
  liquidity: LiquidityCondition | null;
}

export class L2ChartAdapter {
  private granularitySeconds: number;
  private candleHistory: Candle[] = [];
  private subscribers: Set<(data: ChartData) => void> = new Set();
  private priceUnsubscribe: (() => void) | null = null;
  private candleUnsubscribe: (() => void) | null = null;

  // ✅ PHASE 8 FIX: Destroyed flag for lifecycle safety
  // Prevents callbacks from executing after adapter is destroyed
  private destroyed = false;

  constructor(granularitySeconds: number = 60) {
    this.granularitySeconds = granularitySeconds;
    this.setupSubscriptions();
  }

  /**
   * Setup subscriptions to L2 services
   */
  private setupSubscriptions(): void {
    // Subscribe to price updates
    this.priceUnsubscribe = l2PriceProvider.subscribeToPrice((priceUpdate) => {
      this.onPriceUpdate(priceUpdate);
    });

    // Subscribe to candle completions
    const aggregator = l2CandleFactory.getAggregator(this.granularitySeconds);
    this.candleUnsubscribe = aggregator.subscribeToCandles((candle) => {
      this.onCandleComplete(candle);
    });
  }

  /**
   * Handle price update
   */
  private onPriceUpdate(priceUpdate: PriceUpdate): void {
    // ✅ PHASE 8 FIX: Check destroyed flag before processing
    if (this.destroyed) return;
    this.notifySubscribers();
  }

  /**
   * Handle candle completion
   */
  private onCandleComplete(candle: Candle): void {
    // ✅ PHASE 8 FIX: Check destroyed flag before processing
    if (this.destroyed) return;

    this.candleHistory.push(candle);

    // Keep only last 300 candles in memory
    if (this.candleHistory.length > 300) {
      this.candleHistory = this.candleHistory.slice(-300);
    }

    this.notifySubscribers();
  }

  /**
   * Get current chart data
   */
  getChartData(): ChartData | null {
    const priceUpdate = l2PriceProvider.subscribeToPrice((p) => {});
    const aggregator = l2CandleFactory.getAggregator(this.granularitySeconds);
    const currentCandle = aggregator.getCurrentCandle();
    const liquidity = liquidityAnalyzer.getCurrentCondition();

    // Create price update manually (since we need current data)
    const { bid, ask } = l2PriceProvider.getBestPrices();
    const midPrice = l2PriceProvider.getMidPrice();
    const spread = l2PriceProvider.getSpread();

    if (midPrice === 0) {
      return null;
    }

    const priceData: PriceUpdate = {
      productId: 'BTC-USD',
      timestamp: Date.now(),
      midPrice,
      bestBid: bid,
      bestAsk: ask,
      spread,
      source: 'L2',
    };

    return {
      price: priceData,
      candles: [...this.candleHistory],
      currentCandle,
      liquidity,
    };
  }

  /**
   * Get formatted price for display
   */
  getFormattedPrice(): { price: string; spread: string; quality: string } {
    const midPrice = l2PriceProvider.getMidPrice();
    const spread = l2PriceProvider.getSpread();
    const quality = liquidityAnalyzer.getMarketQuality();

    return {
      price: midPrice.toFixed(2),
      spread: `${spread.bps.toFixed(1)} bps`,
      quality: `${quality.toFixed(0)}/100`,
    };
  }

  /**
   * Get candle data for chart
   */
  getCandleData(): Candle[] {
    const aggregator = l2CandleFactory.getAggregator(this.granularitySeconds);
    const current = aggregator.getCurrentCandle();

    // Return completed candles + current incomplete candle
    const candles = [...this.candleHistory];
    if (current) {
      candles.push(current);
    }

    return candles;
  }

  /**
   * Get liquidity info for display
   */
  getLiquidityInfo(): {
    spread: string;
    liquidity: string;
    imbalance: string;
    quality: string;
    isHealthy: boolean;
  } | null {
    const condition = liquidityAnalyzer.getCurrentCondition();

    if (!condition) {
      return null;
    }

    return {
      spread: `${condition.spread.toFixed(3)}%`,
      liquidity: `${condition.liquidity.near.toFixed(2)} BTC`,
      imbalance: `${condition.imbalance > 0 ? '↑' : '↓'} ${Math.abs(condition.imbalance).toFixed(1)}%`,
      quality: liquidityAnalyzer.getMarketQuality().toFixed(0),
      isHealthy: condition.isHealthy,
    };
  }

  /**
   * Subscribe to chart data updates
   */
  subscribe(callback: (data: ChartData) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(): void {
    const data = this.getChartData();
    if (data) {
      this.subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
        }
      });
    }
  }

  /**
   * Change granularity
   */
  setGranularity(granularitySeconds: number): void {
    if (this.granularitySeconds === granularitySeconds) {
      return;
    }

    // Cleanup old subscriptions
    if (this.candleUnsubscribe) {
      this.candleUnsubscribe();
    }

    // Reset state
    this.granularitySeconds = granularitySeconds;
    this.candleHistory = [];

    // Setup new subscriptions
    const aggregator = l2CandleFactory.getAggregator(granularitySeconds);
    this.candleUnsubscribe = aggregator.subscribeToCandles((candle) => {
      this.onCandleComplete(candle);
    });

    this.notifySubscribers();
  }

  /**
   * Get market health status
   */
  getHealthStatus(): 'good' | 'warning' | 'critical' {
    const quality = liquidityAnalyzer.getMarketQuality();

    if (quality >= 80) return 'good';
    if (quality >= 50) return 'warning';
    return 'critical';
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // ✅ PHASE 8 FIX: Set destroyed flag to prevent callbacks
    this.destroyed = true;

    if (this.priceUnsubscribe) {
      this.priceUnsubscribe();
    }
    if (this.candleUnsubscribe) {
      this.candleUnsubscribe();
    }
    this.subscribers.clear();
    this.candleHistory = [];
  }
}

/**
 * Create adapter for chart display
 * Usage in Svelte component:
 *
 * let adapter = new L2ChartAdapter(60); // 1-minute candles
 *
 * onMount(() => {
 *   const unsubscribe = adapter.subscribe((data) => {
 *     updateChart(data.candles);
 *     updatePrice(data.price);
 *   });
 *   return () => unsubscribe();
 * });
 *
 * onDestroy(() => adapter.destroy());
 */
export function createChartAdapter(granularitySeconds: number = 60): L2ChartAdapter {
  return new L2ChartAdapter(granularitySeconds);
}
