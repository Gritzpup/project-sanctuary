/**
 * ✅ L2 CONSOLIDATION - Week 1
 * Core type definitions for L2 orderbook data
 * Single source of truth for all L2-related types across the system
 */

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface Orderbook {
  productId: string;
  bids: OrderbookLevel[];  // [price, size][] - highest price first
  asks: OrderbookLevel[];  // [price, size][] - lowest price first
  sequence: number;
  timestamp: number;
}

export interface SpreadMetrics {
  dollars: number;
  percent: number;
  bps: number;  // basis points
}

export interface LiquidityLevel {
  price: number;
  cumulativeSize: number;
  priceImpact: number;  // % price change to consume this level
}

export interface LiquidityMetrics {
  near: number;      // Size available within 0.1%
  medium: number;    // Size available within 0.5%
  far: number;       // Size available within 1.0%
  levels10Bps: number;  // Size available within 10 bps
  levels50Bps: number;  // Size available within 50 bps
  levels100Bps: number; // Size available within 100 bps
}

export interface ExecutionEstimate {
  avgPrice: number;
  worstPrice: number;
  slippageBps: number;
  levelsConsumed: number;
  canFill: boolean;
  reason?: string;  // Why it can't fill (if applicable)
}

export interface MarketContext {
  productId: string;
  timestamp: number;

  // Price information
  midPrice: number;
  lastPrice: number;
  bestBid: number;
  bestAsk: number;

  // Spread metrics
  spread: SpreadMetrics;

  // Liquidity
  liquidity: LiquidityMetrics;

  // Execution estimates for different sizes
  executionCosts: {
    small: ExecutionEstimate;      // 0.01 BTC
    medium: ExecutionEstimate;     // 0.1 BTC
    large: ExecutionEstimate;      // 1.0 BTC
  };

  // Market indicators
  imbalance: number;  // % more buyers (-100 = all sellers, +100 = all buyers)
  isHealthy: boolean; // True if liquidity is adequate
}

export interface PriceUpdate {
  productId: string;
  timestamp: number;
  midPrice: number;
  bestBid: number;
  bestAsk: number;
  spread: SpreadMetrics;
  volume?: number;  // 24h volume
  source: 'L2' | 'ticker' | 'trade';  // Data source
}

export interface ExecutionMetrics {
  midPriceAtExecution: number;
  spreadAtExecution: SpreadMetrics;
  slippageBps: number;
  worstPriceAtExecution: number;
  levelsConsumed: number;
  timestamp: number;
}
