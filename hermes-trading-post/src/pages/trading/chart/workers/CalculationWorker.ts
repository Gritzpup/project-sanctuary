/**
 * @file CalculationWorker.ts
 * @description Web Worker for offloading heavy calculations to a separate thread
 * Phase 3: Creates Web Worker infrastructure for CPU-intensive operations
 *
 * Offloads the following to Web Worker:
 * - Indicator calculations (RSI, SMA, EMA) - Complex math
 * - OrderBook cumulative calculations - Heavy iteration
 * - Volume hotspot calculations - Complex logic
 */

/**
 * Message types for Web Worker communication
 * ⚡ PHASE 6C: Extended with trading metrics calculations
 */
export type CalculationTaskType =
  | 'calculateRSI'
  | 'calculateSMA'
  | 'calculateEMA'
  | 'calculateCumulativeBids'
  | 'calculateCumulativeAsks'
  | 'calculateVolumeHotspot'
  | 'calculateSharpeRatio'
  | 'calculateMaxDrawdown'
  | 'calculateTradeStats'
  | 'calculateDailyReturns';

/**
 * Request message format for Web Worker
 */
export interface CalculationRequest {
  taskId: string;
  type: CalculationTaskType;
  data: any;
  params?: any;
}

/**
 * Response message format from Web Worker
 */
export interface CalculationResponse {
  taskId: string;
  type: CalculationTaskType;
  result: any;
  error?: string;
  duration?: number;
}

/**
 * Web Worker Manager - handles communication with calculation worker
 */
export class WebWorkerManager {
  private worker: Worker | null = null;
  private pendingTasks = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private taskCounter = 0;
  private readonly TASK_TIMEOUT = 5000; // 5 second timeout

  constructor() {
    this.initializeWorker();
  }

  /**
   * Initialize Web Worker
   */
  private initializeWorker(): void {
    try {
      // Create worker from inline blob or external file
      const workerScript = this.getWorkerScript();
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (event: MessageEvent<CalculationResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error: ErrorEvent) => {
        // Reject all pending tasks
        this.pendingTasks.forEach(({ reject }) => {
          reject(new Error(`Worker error: ${error.message}`));
        });
        this.pendingTasks.clear();
      };
    } catch (error) {
      this.worker = null;
    }
  }

  /**
   * Get Worker script code
   */
  private getWorkerScript(): string {
    return `
      // ⚡ Web Worker for calculation offloading
      self.onmessage = function(event) {
        const { taskId, type, data, params } = event.data;
        const startTime = performance.now();

        try {
          let result;

          switch(type) {
            case 'calculateRSI':
              result = calculateRSI(data, params.period);
              break;
            case 'calculateSMA':
              result = calculateSMA(data, params.period);
              break;
            case 'calculateEMA':
              result = calculateEMA(data, params.period, params.source);
              break;
            case 'calculateCumulativeBids':
              result = calculateCumulativeBids(data);
              break;
            case 'calculateCumulativeAsks':
              result = calculateCumulativeAsks(data);
              break;
            case 'calculateVolumeHotspot':
              result = calculateVolumeHotspot(data, params.rangeOffset);
              break;
            default:
              throw new Error('Unknown task type: ' + type);
          }

          const duration = performance.now() - startTime;
          self.postMessage({ taskId, type, result, duration });
        } catch (error) {
          self.postMessage({
            taskId,
            type,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      };

      // ⚡ RSI Calculation (Wilder's Smoothing)
      function calculateRSI(candles, period) {
        if (candles.length < period + 1) return [];

        const rsiValues = [];
        const gains = [];
        const losses = [];

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
          rsiValues.push({ time: candles[period].time, value: 100 });
        } else {
          const rs = avgGain / avgLoss;
          const rsi = 100 - (100 / (1 + rs));
          rsiValues.push({ time: candles[period].time, value: rsi });
        }

        // Calculate subsequent RSI values
        for (let i = period + 1; i < candles.length; i++) {
          avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
          avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;

          if (avgLoss === 0) {
            rsiValues.push({ time: candles[i].time, value: 100 });
          } else {
            const rs = avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            rsiValues.push({ time: candles[i].time, value: rsi });
          }
        }

        return rsiValues;
      }

      // ⚡ SMA Calculation
      function calculateSMA(candles, period) {
        const smaValues = [];

        for (let i = period - 1; i < candles.length; i++) {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) {
            sum += candles[j].close;
          }
          const sma = sum / period;
          smaValues.push({ time: candles[i].time, value: sma });
        }

        return smaValues;
      }

      // ⚡ EMA Calculation
      function calculateEMA(candles, period, source) {
        const emaValues = [];
        const multiplier = 2 / (period + 1);

        // Extract source values
        const values = candles.map(c => {
          switch(source) {
            case 'open': return c.open;
            case 'high': return c.high;
            case 'low': return c.low;
            case 'hl2': return (c.high + c.low) / 2;
            case 'hlc3': return (c.high + c.low + c.close) / 3;
            case 'ohlc4': return (c.open + c.high + c.low + c.close) / 4;
            default: return c.close;
          }
        });

        // Calculate initial SMA as first EMA
        let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
        emaValues.push({ time: candles[period - 1].time, value: ema });

        // Calculate subsequent EMA values
        for (let i = period; i < values.length; i++) {
          ema = (values[i] - ema) * multiplier + ema;
          emaValues.push({ time: candles[i].time, value: ema });
        }

        return emaValues;
      }

      // ⚡ Cumulative Bids Calculation
      function calculateCumulativeBids(bids) {
        let cumulative = 0;
        return bids.map((bid, index) => {
          cumulative += bid.size;
          return {
            price: bid.price,
            size: bid.size,
            cumulative,
            key: 'bid-' + index
          };
        });
      }

      // ⚡ Cumulative Asks Calculation
      function calculateCumulativeAsks(asks) {
        let cumulative = 0;
        return asks.map((ask, index) => {
          cumulative += ask.size;
          return {
            price: ask.price,
            size: ask.size,
            cumulative,
            key: 'ask-' + index
          };
        });
      }

      // ⚡ Volume Hotspot Calculation
      function calculateVolumeHotspot(depthData, rangeOffset) {
        if (!depthData.bestBid || !depthData.bestAsk) {
          return {
            offset: 50,
            price: 0,
            side: 'neutral',
            volume: 0,
            type: 'Neutral'
          };
        }

        const midPrice = (depthData.bestBid + depthData.bestAsk) / 2;

        // Find which side has stronger volume
        let maxBidDepth = 0;
        let bestBidPrice = depthData.bestBid;

        if (depthData.bids && depthData.bids.length > 0) {
          maxBidDepth = depthData.bids[0].depth;
          bestBidPrice = depthData.bids[depthData.bids.length - 1].price;
        }

        let maxAskDepth = 0;
        let bestAskPrice = depthData.bestAsk;

        if (depthData.asks && depthData.asks.length > 0) {
          maxAskDepth = depthData.asks[depthData.asks.length - 1].depth;
          bestAskPrice = depthData.asks[0].price;
        }

        // Determine which side has stronger volume
        const strongerSide = maxBidDepth > maxAskDepth ? 'bid' : 'ask';
        const strongerVolume = Math.max(maxBidDepth, maxAskDepth);

        let indicatorPrice = midPrice;
        const depthDifference = Math.abs(maxAskDepth - maxBidDepth);
        const depthSum = maxAskDepth + maxBidDepth;
        const volumeRatio = depthSum > 0 ? depthDifference / depthSum : 0;

        if (strongerSide === 'bid') {
          const deepestBidPrice = depthData.bids && depthData.bids.length > 0
            ? depthData.bids[0].price
            : midPrice - rangeOffset;
          indicatorPrice = bestBidPrice - volumeRatio * Math.abs(bestBidPrice - deepestBidPrice);
        } else {
          const deepestAskPrice = depthData.asks && depthData.asks.length > 0
            ? depthData.asks[depthData.asks.length - 1].price
            : midPrice + rangeOffset;
          indicatorPrice = bestAskPrice + volumeRatio * Math.abs(deepestAskPrice - bestAskPrice);
        }

        // Calculate position on chart
        const rangeStart = midPrice - rangeOffset;
        const rangeEnd = midPrice + rangeOffset;
        const positionInRange = (indicatorPrice - rangeStart) / (rangeEnd - rangeStart);
        const offset = Math.max(0, Math.min(100, positionInRange * 100));

        const side = strongerSide === 'bid' ? 'bullish' : 'bearish';

        return {
          offset,
          price: indicatorPrice,
          side,
          volume: strongerVolume,
          type: strongerSide === 'bid' ? 'Support' : 'Resistance'
        };
      }
    `;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(response: CalculationResponse): void {
    const task = this.pendingTasks.get(response.taskId);

    if (!task) {
      return;
    }

    // Clear timeout
    clearTimeout(task.timeout);

    if (response.error) {
      task.reject(new Error(response.error));
    } else {
      task.resolve(response.result);
    }

    this.pendingTasks.delete(response.taskId);

    // Log performance metrics
    if (response.duration && response.duration > 50) {
    }
  }

  /**
   * Execute calculation in worker
   */
  public calculate(
    type: CalculationTaskType,
    data: any,
    params?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Web Worker not initialized'));
        return;
      }

      const taskId = `task-${++this.taskCounter}`;

      // Setup timeout
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Task ${taskId} timed out after ${this.TASK_TIMEOUT}ms`));
      }, this.TASK_TIMEOUT);

      // Store pending task
      this.pendingTasks.set(taskId, { resolve, reject, timeout });

      // Send message to worker
      this.worker.postMessage({ taskId, type, data, params });
    });
  }

  /**
   * Calculate RSI indicators
   */
  public calculateRSI(candles: any[], period: number): Promise<any[]> {
    return this.calculate('calculateRSI', candles, { period });
  }

  /**
   * Calculate SMA indicators
   */
  public calculateSMA(candles: any[], period: number): Promise<any[]> {
    return this.calculate('calculateSMA', candles, { period });
  }

  /**
   * Calculate EMA indicators
   */
  public calculateEMA(candles: any[], period: number, source: string): Promise<any[]> {
    return this.calculate('calculateEMA', candles, { period, source });
  }

  /**
   * Calculate cumulative bids
   */
  public calculateCumulativeBids(bids: any[]): Promise<any[]> {
    return this.calculate('calculateCumulativeBids', bids);
  }

  /**
   * Calculate cumulative asks
   */
  public calculateCumulativeAsks(asks: any[]): Promise<any[]> {
    return this.calculate('calculateCumulativeAsks', asks);
  }

  /**
   * Calculate volume hotspot
   */
  public calculateVolumeHotspot(depthData: any, rangeOffset: number): Promise<any> {
    return this.calculate('calculateVolumeHotspot', depthData, { rangeOffset });
  }

  /**
   * Check if worker is available
   */
  public isAvailable(): boolean {
    return this.worker !== null;
  }

  /**
   * Terminate worker
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Get pending task count
   */
  public getPendingTaskCount(): number {
    return this.pendingTasks.size;
  }

  /**
   * Get statistics
   */
  public getStats(): {
    isAvailable: boolean;
    pendingTasks: number;
  } {
    return {
      isAvailable: this.isAvailable(),
      pendingTasks: this.getPendingTaskCount()
    };
  }
}

// Export singleton instance
export const webWorkerManager = new WebWorkerManager();
