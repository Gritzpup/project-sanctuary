/**
 * ✅ L2 CONSOLIDATION - Week 5
 * Real-time liquidity analysis from L2 orderbook
 *
 * Provides market health monitoring:
 * - Spread metrics
 * - Liquidity at different distances
 * - Buy/sell imbalance
 * - Market conditions alerts
 *
 * Used by: Dashboard, strategy decisions, risk management
 */

import { l2PriceProvider } from './L2PriceProvider';
import type { MarketContext } from '../../types/market/L2Types';

export interface LiquidityAlert {
  type: 'spread_wide' | 'illiquid' | 'imbalanced' | 'recovery';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
}

export interface LiquidityCondition {
  isHealthy: boolean;
  spread: number;  // %
  liquidity: {
    near: number;
    medium: number;
    far: number;
  };
  imbalance: number;  // -100 to +100
  alerts: LiquidityAlert[];
  timestamp: number;
}

export class LiquidityAnalyzer {
  private alertSubscribers: Set<(alert: LiquidityAlert) => void> = new Set();
  private lastCondition: LiquidityCondition | null = null;
  private spreadThresholds = {
    warning: 0.1,      // 0.1%
    critical: 0.25,    // 0.25%
  };
  private liquidityThresholds = {
    healthy: 0.5,      // 0.5 BTC near liquidity
    warning: 0.2,      // 0.2 BTC
    critical: 0.05,    // 0.05 BTC
  };
  private imbalanceThreshold = 30;  // +/- 30% considered imbalanced

  constructor() {
    this.setupListener();
  }

  /**
   * Setup listener on price provider
   */
  private setupListener() {
    l2PriceProvider.subscribeToMarketContext((context) => {
      this.analyzeConditions(context);
    });
  }

  /**
   * Analyze market conditions and generate alerts
   */
  private analyzeConditions(context: MarketContext) {
    const alerts: LiquidityAlert[] = [];
    const timestamp = Date.now();

    // Check spread
    if (context.spread.percent > this.spreadThresholds.critical) {
      alerts.push({
        type: 'spread_wide',
        severity: 'critical',
        message: `Critical: Spread ${context.spread.percent.toFixed(3)}% exceeds ${this.spreadThresholds.critical}% threshold`,
        timestamp,
      });
    } else if (context.spread.percent > this.spreadThresholds.warning) {
      alerts.push({
        type: 'spread_wide',
        severity: 'warning',
        message: `Warning: Spread ${context.spread.percent.toFixed(3)}% exceeds ${this.spreadThresholds.warning}% threshold`,
        timestamp,
      });
    }

    // Check liquidity
    if (context.liquidity.near < this.liquidityThresholds.critical) {
      alerts.push({
        type: 'illiquid',
        severity: 'critical',
        message: `Critical: Near liquidity ${context.liquidity.near.toFixed(2)} BTC below ${this.liquidityThresholds.critical} BTC`,
        timestamp,
      });
    } else if (context.liquidity.near < this.liquidityThresholds.warning) {
      alerts.push({
        type: 'illiquid',
        severity: 'warning',
        message: `Warning: Near liquidity ${context.liquidity.near.toFixed(2)} BTC below ${this.liquidityThresholds.warning} BTC`,
        timestamp,
      });
    }

    // Check imbalance
    const absImbalance = Math.abs(context.imbalance);
    if (absImbalance > this.imbalanceThreshold) {
      const direction = context.imbalance > 0 ? 'bullish' : 'bearish';
      alerts.push({
        type: 'imbalanced',
        severity: 'warning',
        message: `Market imbalance: ${absImbalance.toFixed(1)}% ${direction}`,
        timestamp,
      });
    }

    // Determine overall health
    const isHealthy =
      context.spread.percent < this.spreadThresholds.warning &&
      context.liquidity.near > this.liquidityThresholds.healthy &&
      absImbalance < this.imbalanceThreshold;

    const condition: LiquidityCondition = {
      isHealthy,
      spread: context.spread.percent,
      liquidity: {
        near: context.liquidity.near,
        medium: context.liquidity.medium,
        far: context.liquidity.far,
      },
      imbalance: context.imbalance,
      alerts,
      timestamp,
    };

    this.lastCondition = condition;

    // Notify subscribers of new alerts
    for (const alert of alerts) {
      this.notifyAlertSubscribers(alert);
    }
  }

  /**
   * Get current liquidity condition
   */
  getCurrentCondition(): LiquidityCondition | null {
    return this.lastCondition ? { ...this.lastCondition } : null;
  }

  /**
   * Check if market is liquid enough for a trade
   */
  canExecute(size: number): { canExecute: boolean; reason?: string } {
    const context = l2PriceProvider.getMarketContext();

    if (!context) {
      return { canExecute: false, reason: 'No market context available' };
    }

    // Check spread
    if (context.spread.percent > this.spreadThresholds.critical) {
      return { canExecute: false, reason: 'Spread too wide' };
    }

    // Check liquidity for this size
    if (size > context.liquidity.far) {
      return { canExecute: false, reason: 'Insufficient liquidity for order size' };
    }

    // Check execution quality
    const estimate =
      size <= 0.01
        ? context.executionCosts.small
        : size <= 0.1
          ? context.executionCosts.medium
          : context.executionCosts.large;

    if (!estimate.canFill) {
      return { canExecute: false, reason: estimate.reason };
    }

    if (estimate.slippageBps > 100) {
      return { canExecute: false, reason: 'Slippage too high' };
    }

    return { canExecute: true };
  }

  /**
   * Get quality score for trading (0-100)
   */
  getMarketQuality(): number {
    const context = l2PriceProvider.getMarketContext();

    if (!context) {
      return 0;
    }

    let score = 100;

    // Penalize wide spreads (can go down to 0)
    if (context.spread.percent > 0.01) {
      score -= Math.min(50, (context.spread.percent - 0.01) * 5000);
    }

    // Penalize low liquidity (can go down to 0)
    if (context.liquidity.near < 1.0) {
      score -= Math.min(30, (1.0 - context.liquidity.near) * 30);
    }

    // Penalize imbalance (can go down to 0)
    const absImbalance = Math.abs(context.imbalance);
    if (absImbalance > 20) {
      score -= Math.min(20, (absImbalance - 20) * 0.5);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Subscribe to liquidity alerts
   */
  subscribeToAlerts(callback: (alert: LiquidityAlert) => void): () => void {
    this.alertSubscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.alertSubscribers.delete(callback);
    };
  }

  /**
   * Notify alert subscribers
   */
  private notifyAlertSubscribers(alert: LiquidityAlert) {
    this.alertSubscribers.forEach((callback) => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert subscriber:', error);
      }
    });
  }

  /**
   * Get liquidity summary for UI display
   */
  getSummary(): string {
    const condition = this.getCurrentCondition();

    if (!condition) {
      return 'No data';
    }

    let summary = '';

    // Spread
    summary += `Spread: ${condition.spread.toFixed(3)}% | `;

    // Liquidity
    summary += `Near: ${condition.liquidity.near.toFixed(2)} BTC | `;

    // Imbalance
    const direction = condition.imbalance > 0 ? '↑' : '↓';
    summary += `Imbalance: ${direction} ${Math.abs(condition.imbalance).toFixed(1)}%`;

    // Health
    summary += condition.isHealthy ? ' | ✓ Healthy' : ' | ⚠ Poor';

    return summary;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.alertSubscribers.clear();
  }
}

// Export singleton
export const liquidityAnalyzer = new LiquidityAnalyzer();
