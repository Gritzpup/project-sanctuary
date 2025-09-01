/**
 * @file OpportunityDetector.ts
 * @description Identifies high-probability trading opportunities
 */

import type { CandleData, Signal, OpportunityDetectionConfig } from '../strategies/base/StrategyTypes';
import { Strategy } from '../strategies/base/Strategy';

export interface OpportunitySignal extends Signal {
  timeframe: string;
  confidence: number;
  triggerPrice?: number;
  stopLoss?: number;
  preEmptive?: boolean;
}

export interface TimeframeAnalysis {
  period: string;
  signal: Signal;
  strength: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export class OpportunityDetector {
  private config: OpportunityDetectionConfig;
  private strategy: Strategy;
  private historicalSignals: Map<string, OpportunitySignal[]> = new Map();
  
  constructor(strategy: Strategy, config: OpportunityDetectionConfig) {
    this.strategy = strategy;
    this.config = config;
    
    // Initialize historical signal storage for each timeframe
    config.timeframes.forEach(tf => {
      this.historicalSignals.set(tf.period, []);
    });
  }
  
  /**
   * Analyze multiple timeframes to detect opportunities
   */
  analyzeOpportunities(
    candlesByTimeframe: Map<string, CandleData[]>, 
    currentPrice: number
  ): OpportunitySignal[] {
    const analyses: TimeframeAnalysis[] = [];
    const opportunities: OpportunitySignal[] = [];
    
    // Analyze each timeframe
    for (const tf of this.config.timeframes) {
      const candles = candlesByTimeframe.get(tf.period);
      if (!candles || candles.length < this.strategy.getRequiredHistoricalData()) {
        continue;
      }
      
      // Get signal from strategy for this timeframe
      const signal = this.strategy.analyze(candles, currentPrice);
      const trend = this.detectTrend(candles);
      
      analyses.push({
        period: tf.period,
        signal,
        strength: signal.strength * tf.weight,
        trend
      });
      
      // Store historical signal
      const historicalSignals = this.historicalSignals.get(tf.period) || [];
      historicalSignals.push({
        ...signal,
        timeframe: tf.period,
        confidence: signal.strength * tf.weight
      });
      
      // Keep only recent signals (last 100)
      if (historicalSignals.length > 100) {
        historicalSignals.shift();
      }
    }
    
    // Check for multi-timeframe confirmation
    const buySignals = analyses.filter(a => a.signal.type === 'buy');
    const sellSignals = analyses.filter(a => a.signal.type === 'sell');
    
    // Detect buy opportunities
    if (buySignals.length >= this.config.confirmationRequired) {
      const avgStrength = buySignals.reduce((sum, a) => sum + a.strength, 0) / buySignals.length;
      
      if (avgStrength >= this.config.minSignalStrength) {
        // Look for pre-emptive entry points
        const preEmptiveOrders = this.generatePreEmptiveOrders(
          currentPrice, 
          'buy', 
          avgStrength,
          analyses
        );
        
        opportunities.push(...preEmptiveOrders);
        
        // Add immediate opportunity
        opportunities.push({
          type: 'buy',
          strength: avgStrength,
          price: currentPrice,
          reason: `Multi-timeframe buy signal (${buySignals.length} confirmations)`,
          timeframe: 'multi',
          confidence: avgStrength,
          preEmptive: false
        });
      }
    }
    
    // Detect sell opportunities
    if (sellSignals.length >= this.config.confirmationRequired) {
      const avgStrength = sellSignals.reduce((sum, a) => sum + a.strength, 0) / sellSignals.length;
      
      if (avgStrength >= this.config.minSignalStrength) {
        opportunities.push({
          type: 'sell',
          strength: avgStrength,
          price: currentPrice,
          reason: `Multi-timeframe sell signal (${sellSignals.length} confirmations)`,
          timeframe: 'multi',
          confidence: avgStrength,
          preEmptive: false
        });
      }
    }
    
    // Detect divergences and early signals
    const divergences = this.detectDivergences(analyses, candles);
    opportunities.push(...divergences);
    
    return opportunities;
  }
  
  /**
   * Generate pre-emptive orders below current price for catching dips
   */
  private generatePreEmptiveOrders(
    currentPrice: number,
    type: 'buy' | 'sell',
    strength: number,
    analyses: TimeframeAnalysis[]
  ): OpportunitySignal[] {
    if (!this.config.enablePreEmptive) return [];
    
    const orders: OpportunitySignal[] = [];
    const spread = this.config.preEmptiveSpread / 100;
    
    // For buys, place orders below current price
    if (type === 'buy') {
      for (let i = 1; i <= Math.min(3, this.config.maxPreEmptiveOrders); i++) {
        const triggerPrice = currentPrice * (1 - spread * i);
        
        orders.push({
          type: 'buy',
          strength: strength * (1 - i * 0.1), // Slightly reduce confidence for farther orders
          price: currentPrice,
          triggerPrice,
          reason: `Pre-emptive buy order ${i} at ${(spread * i * 100).toFixed(2)}% below`,
          timeframe: 'multi',
          confidence: strength * (1 - i * 0.1),
          preEmptive: true,
          stopLoss: triggerPrice * 0.98 // 2% stop loss
        });
      }
    }
    
    return orders;
  }
  
  /**
   * Detect trend from candle data
   */
  private detectTrend(candles: CandleData[]): 'bullish' | 'bearish' | 'neutral' {
    if (candles.length < 20) return 'neutral';
    
    const recent = candles.slice(-20);
    const sma = recent.reduce((sum, c) => sum + c.close, 0) / recent.length;
    const currentPrice = candles[candles.length - 1].close;
    
    if (currentPrice > sma * 1.02) return 'bullish';
    if (currentPrice < sma * 0.98) return 'bearish';
    return 'neutral';
  }
  
  /**
   * Detect divergences between price and indicators
   */
  private detectDivergences(
    analyses: TimeframeAnalysis[],
    currentCandles: CandleData[]
  ): OpportunitySignal[] {
    const opportunities: OpportunitySignal[] = [];
    
    // Look for bullish divergence (price making lower lows but indicators showing strength)
    const bearishTrends = analyses.filter(a => a.trend === 'bearish');
    const buySignals = analyses.filter(a => a.signal.type === 'buy');
    
    if (bearishTrends.length > 0 && buySignals.length >= 2) {
      opportunities.push({
        type: 'buy',
        strength: 0.8,
        price: currentCandles[currentCandles.length - 1].close,
        reason: 'Bullish divergence detected',
        timeframe: 'multi',
        confidence: 0.8,
        preEmptive: false
      });
    }
    
    return opportunities;
  }
  
  /**
   * Get historical performance for optimization
   */
  getHistoricalPerformance(timeframe: string): {
    totalSignals: number;
    accuracy: number;
    avgProfit: number;
  } {
    const signals = this.historicalSignals.get(timeframe) || [];
    
    // TODO: Implement performance tracking
    return {
      totalSignals: signals.length,
      accuracy: 0,
      avgProfit: 0
    };
  }
}