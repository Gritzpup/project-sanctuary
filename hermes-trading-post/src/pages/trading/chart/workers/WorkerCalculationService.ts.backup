/**
 * @file WorkerCalculationService.ts
 * @description Service wrapper for Web Worker calculations with fallback to main thread
 * Phase 3: Provides unified API for calculations with optional worker offloading
 *
 * Features:
 * - Automatic fallback if worker unavailable
 * - Performance tracking
 * - Result caching
 * - Graceful degradation
 */

import { webWorkerManager } from './CalculationWorker';

export interface CalculationStats {
  workerCalculations: number;
  mainThreadCalculations: number;
  totalTime: number;
  avgWorkerTime: number;
  avgMainThreadTime: number;
}

/**
 * Worker Calculation Service - unified API with fallback
 */
export class WorkerCalculationService {
  private workerStats = {
    calculations: 0,
    totalTime: 0
  };

  private mainThreadStats = {
    calculations: 0,
    totalTime: 0
  };

  private enableWorkerLogging = false;

  constructor() {
    this.logWorkerStatus();
  }

  /**
   * Log worker availability status
   */
  private logWorkerStatus(): void {
    if (webWorkerManager.isAvailable()) {
      console.log('✅ Web Worker available - calculations will be offloaded');
    } else {
      console.warn('⚠️ Web Worker not available - calculations will run on main thread');
    }
  }

  /**
   * Calculate RSI with optional worker offloading
   */
  public async calculateRSI(candles: any[], period: number): Promise<any[]> {
    if (webWorkerManager.isAvailable()) {
      try {
        const startTime = performance.now();
        const result = await webWorkerManager.calculateRSI(candles, period);
        const duration = performance.now() - startTime;

        this.workerStats.calculations++;
        this.workerStats.totalTime += duration;

        if (this.enableWorkerLogging) {
          console.log(`⚡ RSI (worker) completed in ${duration.toFixed(2)}ms`);
        }

        return result;
      } catch (error) {
        console.warn('Worker calculation failed, falling back to main thread:', error);
        return this.calculateRSIMainThread(candles, period);
      }
    } else {
      return this.calculateRSIMainThread(candles, period);
    }
  }

  /**
   * Calculate RSI on main thread (fallback)
   */
  private calculateRSIMainThread(candles: any[], period: number): any[] {
    const startTime = performance.now();

    if (candles.length < period + 1) {
      return [];
    }

    const rsiValues: any[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // First RSI value
    if (avgLoss === 0) {
      rsiValues.push({
        time: candles[period].time,
        value: 100
      });
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push({
        time: candles[period].time,
        value: rsi
      });
    }

    // Calculate subsequent RSI values using Wilder's smoothing
    for (let i = period + 1; i < candles.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;

      if (avgLoss === 0) {
        rsiValues.push({
          time: candles[i].time,
          value: 100
        });
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiValues.push({
          time: candles[i].time,
          value: rsi
        });
      }
    }

    const duration = performance.now() - startTime;
    this.mainThreadStats.calculations++;
    this.mainThreadStats.totalTime += duration;

    if (this.enableWorkerLogging) {
      console.log(`⚠️ RSI (main thread) took ${duration.toFixed(2)}ms`);
    }

    return rsiValues;
  }

  /**
   * Calculate SMA with optional worker offloading
   */
  public async calculateSMA(candles: any[], period: number): Promise<any[]> {
    if (webWorkerManager.isAvailable()) {
      try {
        const startTime = performance.now();
        const result = await webWorkerManager.calculateSMA(candles, period);
        const duration = performance.now() - startTime;

        this.workerStats.calculations++;
        this.workerStats.totalTime += duration;

        if (this.enableWorkerLogging) {
          console.log(`⚡ SMA (worker) completed in ${duration.toFixed(2)}ms`);
        }

        return result;
      } catch (error) {
        console.warn('Worker calculation failed, falling back to main thread:', error);
        return this.calculateSMAMainThread(candles, period);
      }
    } else {
      return this.calculateSMAMainThread(candles, period);
    }
  }

  /**
   * Calculate SMA on main thread (fallback)
   */
  private calculateSMAMainThread(candles: any[], period: number): any[] {
    const startTime = performance.now();
    const smaValues: any[] = [];

    for (let i = period - 1; i < candles.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      const sma = sum / period;
      smaValues.push({
        time: candles[i].time,
        value: sma
      });
    }

    const duration = performance.now() - startTime;
    this.mainThreadStats.calculations++;
    this.mainThreadStats.totalTime += duration;

    if (this.enableWorkerLogging) {
      console.log(`⚠️ SMA (main thread) took ${duration.toFixed(2)}ms`);
    }

    return smaValues;
  }

  /**
   * Calculate EMA with optional worker offloading
   */
  public async calculateEMA(
    candles: any[],
    period: number,
    source: string = 'close'
  ): Promise<any[]> {
    if (webWorkerManager.isAvailable()) {
      try {
        const startTime = performance.now();
        const result = await webWorkerManager.calculateEMA(candles, period, source);
        const duration = performance.now() - startTime;

        this.workerStats.calculations++;
        this.workerStats.totalTime += duration;

        if (this.enableWorkerLogging) {
          console.log(`⚡ EMA (worker) completed in ${duration.toFixed(2)}ms`);
        }

        return result;
      } catch (error) {
        console.warn('Worker calculation failed, falling back to main thread:', error);
        return this.calculateEMAMainThread(candles, period, source);
      }
    } else {
      return this.calculateEMAMainThread(candles, period, source);
    }
  }

  /**
   * Calculate EMA on main thread (fallback)
   */
  private calculateEMAMainThread(candles: any[], period: number, source: string): any[] {
    const startTime = performance.now();
    const emaValues: any[] = [];
    const multiplier = 2 / (period + 1);

    // Extract source values
    const values = candles.map(c => {
      switch (source) {
        case 'open':
          return c.open;
        case 'high':
          return c.high;
        case 'low':
          return c.low;
        case 'hl2':
          return (c.high + c.low) / 2;
        case 'hlc3':
          return (c.high + c.low + c.close) / 3;
        case 'ohlc4':
          return (c.open + c.high + c.low + c.close) / 4;
        default:
          return c.close;
      }
    });

    // Calculate initial SMA as first EMA
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaValues.push({
      time: candles[period - 1].time,
      value: ema
    });

    // Calculate subsequent EMA values
    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
      emaValues.push({
        time: candles[i].time,
        value: ema
      });
    }

    const duration = performance.now() - startTime;
    this.mainThreadStats.calculations++;
    this.mainThreadStats.totalTime += duration;

    if (this.enableWorkerLogging) {
      console.log(`⚠️ EMA (main thread) took ${duration.toFixed(2)}ms`);
    }

    return emaValues;
  }

  /**
   * Calculate cumulative bids
   */
  public async calculateCumulativeBids(bids: any[]): Promise<any[]> {
    if (webWorkerManager.isAvailable()) {
      try {
        const startTime = performance.now();
        const result = await webWorkerManager.calculateCumulativeBids(bids);
        const duration = performance.now() - startTime;

        this.workerStats.calculations++;
        this.workerStats.totalTime += duration;

        return result;
      } catch (error) {
        console.warn('Worker calculation failed, falling back to main thread:', error);
        return this.calculateCumulativeBidsMainThread(bids);
      }
    } else {
      return this.calculateCumulativeBidsMainThread(bids);
    }
  }

  /**
   * Calculate cumulative bids on main thread (fallback)
   */
  private calculateCumulativeBidsMainThread(bids: any[]): any[] {
    const startTime = performance.now();
    let cumulative = 0;

    const result = bids.map((bid, index) => {
      cumulative += bid.size;
      return {
        price: bid.price,
        size: bid.size,
        cumulative,
        key: `bid-${index}`
      };
    });

    this.mainThreadStats.calculations++;
    this.mainThreadStats.totalTime += performance.now() - startTime;

    return result;
  }

  /**
   * Calculate cumulative asks
   */
  public async calculateCumulativeAsks(asks: any[]): Promise<any[]> {
    if (webWorkerManager.isAvailable()) {
      try {
        const startTime = performance.now();
        const result = await webWorkerManager.calculateCumulativeAsks(asks);
        const duration = performance.now() - startTime;

        this.workerStats.calculations++;
        this.workerStats.totalTime += duration;

        return result;
      } catch (error) {
        console.warn('Worker calculation failed, falling back to main thread:', error);
        return this.calculateCumulativeAsksMainThread(asks);
      }
    } else {
      return this.calculateCumulativeAsksMainThread(asks);
    }
  }

  /**
   * Calculate cumulative asks on main thread (fallback)
   */
  private calculateCumulativeAsksMainThread(asks: any[]): any[] {
    const startTime = performance.now();
    let cumulative = 0;

    const result = asks.map((ask, index) => {
      cumulative += ask.size;
      return {
        price: ask.price,
        size: ask.size,
        cumulative,
        key: `ask-${index}`
      };
    });

    this.mainThreadStats.calculations++;
    this.mainThreadStats.totalTime += performance.now() - startTime;

    return result;
  }

  /**
   * Get statistics
   */
  public getStats(): CalculationStats {
    return {
      workerCalculations: this.workerStats.calculations,
      mainThreadCalculations: this.mainThreadStats.calculations,
      totalTime:
        this.workerStats.totalTime + this.mainThreadStats.totalTime,
      avgWorkerTime:
        this.workerStats.calculations > 0
          ? this.workerStats.totalTime / this.workerStats.calculations
          : 0,
      avgMainThreadTime:
        this.mainThreadStats.calculations > 0
          ? this.mainThreadStats.totalTime / this.mainThreadStats.calculations
          : 0
    };
  }

  /**
   * Enable/disable worker logging
   */
  public setLogging(enabled: boolean): void {
    this.enableWorkerLogging = enabled;
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.workerStats = { calculations: 0, totalTime: 0 };
    this.mainThreadStats = { calculations: 0, totalTime: 0 };
  }

  /**
   * Print statistics
   */
  public printStats(): void {
    const stats = this.getStats();
    console.log('📊 Worker Calculation Statistics:');
    console.log(`  Worker Calculations: ${stats.workerCalculations}`);
    console.log(`  Main Thread Calculations: ${stats.mainThreadCalculations}`);
    console.log(`  Average Worker Time: ${stats.avgWorkerTime.toFixed(2)}ms`);
    console.log(`  Average Main Thread Time: ${stats.avgMainThreadTime.toFixed(2)}ms`);
    console.log(`  Total Time: ${stats.totalTime.toFixed(2)}ms`);
  }

  /**
   * Shutdown
   */
  public shutdown(): void {
    webWorkerManager.terminate();
  }
}

// Export singleton instance
export const workerCalculationService = new WorkerCalculationService();
