/**
 * ✅ L2 CONSOLIDATION - Week 3
 * Realistic L2-based trade execution simulator
 *
 * Replaces: Single-price execution in paper trading
 *
 * Key improvements over old ticker-based execution:
 * - Simulates fills walking through orderbook
 * - Realistic slippage based on order size
 * - Liquidity constraints (can't fill at non-existent prices)
 * - Spread costs included
 * - Execution metrics tracked
 *
 * Used by: Paper trading, backtesting, strategy analysis
 */

import { l2PriceProvider } from './L2PriceProvider';
import type { ExecutionMetrics, ExecutionEstimate } from '../../types/market/L2Types';

export interface SimulatedTrade {
  orderId: string;
  side: 'buy' | 'sell';
  requestedSize: number;
  filledSize: number;
  requestedPrice: number;
  averagePrice: number;
  worstPrice: number;
  executionTime: number;
  spread: number;  // Spread at execution
  slippageBps: number;
  executionMetrics: ExecutionMetrics;
  timestamp: number;
  status: 'filled' | 'partially_filled' | 'unfilled';
  reason?: string;  // Why partially filled or unfilled
}

export class L2ExecutionSimulator {
  private executionHistory: SimulatedTrade[] = [];

  /**
   * Simulate market buy order
   * Fills at market price from orderbook
   */
  simulateBuy(size: number, orderId: string = this.generateOrderId()): SimulatedTrade {
    return this.simulateExecution('buy', size, orderId);
  }

  /**
   * Simulate market sell order
   */
  simulateSell(size: number, orderId: string = this.generateOrderId()): SimulatedTrade {
    return this.simulateExecution('sell', size, orderId);
  }

  /**
   * Internal execution simulation
   */
  private simulateExecution(side: 'buy' | 'sell', size: number, orderId: string): SimulatedTrade {
    const timestamp = Date.now();

    // Get execution estimate from L2 provider
    const estimate = l2PriceProvider.estimateExecutionPrice(side, size);
    const marketContext = l2PriceProvider.getMarketContext();

    // Build execution metrics
    const executionMetrics: ExecutionMetrics = {
      midPriceAtExecution: l2PriceProvider.getMidPrice(),
      spreadAtExecution: l2PriceProvider.getSpread(),
      slippageBps: estimate.slippageBps,
      worstPriceAtExecution: estimate.worstPrice,
      levelsConsumed: estimate.levelsConsumed,
      timestamp,
    };

    let trade: SimulatedTrade;

    if (estimate.canFill) {
      // Full fill
      trade = {
        orderId,
        side,
        requestedSize: size,
        filledSize: size,
        requestedPrice: l2PriceProvider.getMidPrice(),
        averagePrice: estimate.avgPrice,
        worstPrice: estimate.worstPrice,
        executionTime: 0,  // Instant fill
        spread: l2PriceProvider.getSpread().percent,
        slippageBps: estimate.slippageBps,
        executionMetrics,
        timestamp,
        status: 'filled',
      };
    } else {
      // Partial fill - extract the filled amount from the reason string
      const reason = estimate.reason || 'Insufficient liquidity';
      const partialMatch = reason.match(/Only (\d+(?:\.\d+)?)/);
      const filledSize = partialMatch ? parseFloat(partialMatch[1]) : 0;

      // Recalculate for partial fill
      const partialEstimate = l2PriceProvider.estimateExecutionPrice(side, filledSize);

      trade = {
        orderId,
        side,
        requestedSize: size,
        filledSize: filledSize,
        requestedPrice: l2PriceProvider.getMidPrice(),
        averagePrice: partialEstimate.canFill ? partialEstimate.avgPrice : 0,
        worstPrice: partialEstimate.worstPrice,
        executionTime: 0,
        spread: l2PriceProvider.getSpread().percent,
        slippageBps: partialEstimate.slippageBps,
        executionMetrics: {
          ...executionMetrics,
          slippageBps: partialEstimate.slippageBps,
        },
        timestamp,
        status: 'partially_filled',
        reason: reason,
      };
    }

    // Store in history
    this.executionHistory.push(trade);

    return trade;
  }

  /**
   * Simulate limit buy order
   * Only fills if price hits limit
   */
  simulateLimitBuy(
    size: number,
    limitPrice: number,
    orderId: string = this.generateOrderId()
  ): SimulatedTrade {
    const { ask } = l2PriceProvider.getBestPrices();

    // Order only fills if best ask <= limit price
    if (ask > limitPrice) {
      return {
        orderId,
        side: 'buy',
        requestedSize: size,
        filledSize: 0,
        requestedPrice: limitPrice,
        averagePrice: 0,
        worstPrice: 0,
        executionTime: 0,
        spread: 0,
        slippageBps: 0,
        executionMetrics: {
          midPriceAtExecution: l2PriceProvider.getMidPrice(),
          spreadAtExecution: l2PriceProvider.getSpread(),
          slippageBps: 0,
          worstPriceAtExecution: 0,
          levelsConsumed: 0,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        status: 'unfilled',
        reason: `Best ask ${ask} > limit price ${limitPrice}`,
      };
    }

    // Order fills at limit price or better
    return this.simulateBuy(size, orderId);
  }

  /**
   * Simulate limit sell order
   */
  simulateLimitSell(
    size: number,
    limitPrice: number,
    orderId: string = this.generateOrderId()
  ): SimulatedTrade {
    const { bid } = l2PriceProvider.getBestPrices();

    // Order only fills if best bid >= limit price
    if (bid < limitPrice) {
      return {
        orderId,
        side: 'sell',
        requestedSize: size,
        filledSize: 0,
        requestedPrice: limitPrice,
        averagePrice: 0,
        worstPrice: 0,
        executionTime: 0,
        spread: 0,
        slippageBps: 0,
        executionMetrics: {
          midPriceAtExecution: l2PriceProvider.getMidPrice(),
          spreadAtExecution: l2PriceProvider.getSpread(),
          slippageBps: 0,
          worstPriceAtExecution: 0,
          levelsConsumed: 0,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        status: 'unfilled',
        reason: `Best bid ${bid} < limit price ${limitPrice}`,
      };
    }

    // Order fills at limit price or better
    return this.simulateSell(size, orderId);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): SimulatedTrade[] {
    return [...this.executionHistory];
  }

  /**
   * Get fill statistics
   */
  getStatistics() {
    const totalTrades = this.executionHistory.length;
    const filledTrades = this.executionHistory.filter((t) => t.status === 'filled');
    const partialFills = this.executionHistory.filter((t) => t.status === 'partially_filled');

    const avgSlippage =
      this.executionHistory.length > 0
        ? this.executionHistory.reduce((sum, t) => sum + t.slippageBps, 0) /
          this.executionHistory.length
        : 0;

    const totalSlippage = this.executionHistory.reduce((sum, t) => {
      const slippageDollars = (t.filledSize * t.slippageBps) / 10000;
      return sum + slippageDollars;
    }, 0);

    return {
      totalTrades,
      filledCount: filledTrades.length,
      fillRate: totalTrades > 0 ? (filledTrades.length / totalTrades) * 100 : 0,
      partialFillCount: partialFills.length,
      averageSlippageBps: avgSlippage,
      totalSlippageUsd: totalSlippage,
    };
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.executionHistory = [];
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Simulate multiple orders (for batch analysis)
   */
  simulateOrders(orders: Array<{ side: 'buy' | 'sell'; size: number }>): SimulatedTrade[] {
    return orders.map((order, index) => {
      if (order.side === 'buy') {
        return this.simulateBuy(order.size, `batch-order-${index}`);
      } else {
        return this.simulateSell(order.size, `batch-order-${index}`);
      }
    });
  }
}

// Export singleton
export const l2ExecutionSimulator = new L2ExecutionSimulator();
