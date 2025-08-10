import type { WebSocketCandle, AggregatedCandle } from '../types/data.types';

export class RealtimeCandleAggregator {
  private currentCandle: AggregatedCandle | null = null;
  private lastUpdateTime: number = 0;
  private updateThrottleMs: number = 100; // Throttle updates to 100ms

  addUpdate(update: WebSocketCandle): AggregatedCandle | null {
    const now = Date.now();
    
    // If this is a new candle or first update
    if (!this.currentCandle || this.currentCandle.time !== update.time) {
      this.currentCandle = {
        time: update.time,
        open: update.open,
        high: update.high,
        low: update.low,
        close: update.close,
        volume: update.volume,
        updateCount: 1,
        isComplete: update.type === 'historical'
      };
      this.lastUpdateTime = now;
      return this.currentCandle;
    }

    // Update existing candle
    this.currentCandle.high = Math.max(this.currentCandle.high, update.high);
    this.currentCandle.low = Math.min(this.currentCandle.low, update.low);
    this.currentCandle.close = update.close;
    this.currentCandle.volume = update.volume;
    this.currentCandle.updateCount++;
    
    // Mark as complete if it's a historical candle
    if (update.type === 'historical') {
      this.currentCandle.isComplete = true;
    }

    // Throttle updates to prevent excessive re-renders
    if (now - this.lastUpdateTime >= this.updateThrottleMs) {
      this.lastUpdateTime = now;
      return { ...this.currentCandle };
    }

    return null;
  }

  getCurrentCandle(): AggregatedCandle | null {
    return this.currentCandle ? { ...this.currentCandle } : null;
  }

  reset(): void {
    this.currentCandle = null;
    this.lastUpdateTime = 0;
  }

  setThrottle(ms: number): void {
    this.updateThrottleMs = Math.max(0, ms);
  }
}