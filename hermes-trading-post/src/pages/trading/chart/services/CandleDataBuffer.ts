/**
 * @file CandleDataBuffer.ts
 * @description Efficient TypedArray-based storage for OHLCV candle data
 * Part of Phase 2: Memory Optimization through TypedArrays
 *
 * Problem: Each candle object takes ~200-250 bytes in memory
 * Solution: Use TypedArrays to pack data efficiently (~80 bytes per candle)
 * Expected Impact: 60-70% memory reduction for large candle datasets
 *
 * Memory Comparison (1000 candles):
 * - Object-based: ~250KB (250 bytes × 1000)
 * - TypedArray: ~85KB (85 bytes × 1000) ✨
 *
 * Storage Layout:
 * - timeBuffer: BigInt64Array (8 bytes each, Unix timestamps)
 * - openBuffer: Float64Array (8 bytes each, price in USD)
 * - highBuffer: Float64Array (8 bytes each, price in USD)
 * - lowBuffer: Float64Array (8 bytes each, price in USD)
 * - closeBuffer: Float64Array (8 bytes each, price in USD)
 * - volumeBuffer: Float64Array (8 bytes each, volume in BTC/ETH)
 *
 * Total per candle: 8 + 8 + 8 + 8 + 8 + 8 = 48 bytes base data
 * + JavaScript object overhead: ~40 bytes per array
 * = ~88 bytes per candle (vs 250 bytes object-based)
 */

import type { CandlestickDataWithVolume } from '../stores/services/DataTransformations';

// Re-export for backwards compatibility
export type { CandlestickDataWithVolume };

export class CandleDataBuffer {
  // Internal TypedArrays for efficient storage (initialized in allocateBuffers)
  private timeBuffer!: BigInt64Array;
  private openBuffer!: Float64Array;
  private highBuffer!: Float64Array;
  private lowBuffer!: Float64Array;
  private closeBuffer!: Float64Array;
  private volumeBuffer!: Float64Array;

  // Current size tracking
  private size: number = 0;
  private capacity: number;

  // Growth factor for dynamic allocation
  private readonly GROWTH_FACTOR = 1.5;
  private readonly INITIAL_CAPACITY = 1024; // Start with 1024 candles (~88KB)

  constructor(initialCapacity?: number) {
    this.capacity = initialCapacity || this.INITIAL_CAPACITY;
    this.allocateBuffers(this.capacity);
  }

  /**
   * Allocate TypedArray buffers
   */
  private allocateBuffers(capacity: number): void {
    this.timeBuffer = new BigInt64Array(capacity);
    this.openBuffer = new Float64Array(capacity);
    this.highBuffer = new Float64Array(capacity);
    this.lowBuffer = new Float64Array(capacity);
    this.closeBuffer = new Float64Array(capacity);
    this.volumeBuffer = new Float64Array(capacity);
  }

  /**
   * Grow buffers when capacity is exceeded
   */
  private growBuffers(): void {
    const newCapacity = Math.ceil(this.capacity * this.GROWTH_FACTOR);
    const oldTime = this.timeBuffer;
    const oldOpen = this.openBuffer;
    const oldHigh = this.highBuffer;
    const oldLow = this.lowBuffer;
    const oldClose = this.closeBuffer;
    const oldVolume = this.volumeBuffer;

    this.capacity = newCapacity;
    this.allocateBuffers(newCapacity);

    // Copy old data to new buffers
    this.timeBuffer.set(oldTime);
    this.openBuffer.set(oldOpen);
    this.highBuffer.set(oldHigh);
    this.lowBuffer.set(oldLow);
    this.closeBuffer.set(oldClose);
    this.volumeBuffer.set(oldVolume);
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    const buffersSize =
      this.timeBuffer.byteLength +
      this.openBuffer.byteLength +
      this.highBuffer.byteLength +
      this.lowBuffer.byteLength +
      this.closeBuffer.byteLength +
      this.volumeBuffer.byteLength;

    // Add overhead for object and arrays (rough estimate)
    return buffersSize + 200;
  }

  /**
   * Add a candle to the buffer
   */
  push(candle: CandlestickDataWithVolume): void {
    if (this.size >= this.capacity) {
      this.growBuffers();
    }

    const index = this.size;
    this.timeBuffer[index] = BigInt(
      typeof candle.time === 'number' ? candle.time : parseInt(candle.time as string)
    );
    this.openBuffer[index] = candle.open || 0;
    this.highBuffer[index] = candle.high || 0;
    this.lowBuffer[index] = candle.low || 0;
    this.closeBuffer[index] = candle.close || 0;
    this.volumeBuffer[index] = candle.volume || 0;

    this.size++;
  }

  /**
   * Add multiple candles at once (more efficient)
   */
  pushBatch(candles: CandlestickDataWithVolume[]): void {
    // Ensure we have enough capacity
    while (this.size + candles.length > this.capacity) {
      this.growBuffers();
    }

    // Add all candles
    for (const candle of candles) {
      const index = this.size;
      this.timeBuffer[index] = BigInt(
        typeof candle.time === 'number' ? candle.time : parseInt(candle.time as string)
      );
      this.openBuffer[index] = candle.open || 0;
      this.highBuffer[index] = candle.high || 0;
      this.lowBuffer[index] = candle.low || 0;
      this.closeBuffer[index] = candle.close || 0;
      this.volumeBuffer[index] = candle.volume || 0;
      this.size++;
    }
  }

  /**
   * Get candle at index
   */
  get(index: number): CandlestickDataWithVolume | null {
    if (index < 0 || index >= this.size) {
      return null;
    }

    return {
      time: Number(this.timeBuffer[index]) as any,
      open: this.openBuffer[index],
      high: this.highBuffer[index],
      low: this.lowBuffer[index],
      close: this.closeBuffer[index],
      volume: this.volumeBuffer[index]
    };
  }

  /**
   * Get multiple candles as CandlestickData array (for chart library)
   */
  getRangeAsArray(startIndex: number = 0, endIndex?: number): CandlestickDataWithVolume[] {
    const end = endIndex ?? this.size;
    const result: CandlestickDataWithVolume[] = [];

    for (let i = startIndex; i < end && i < this.size; i++) {
      result.push({
        time: Number(this.timeBuffer[i]) as any,
        open: this.openBuffer[i],
        high: this.highBuffer[i],
        low: this.lowBuffer[i],
        close: this.closeBuffer[i],
        volume: this.volumeBuffer[i]
      });
    }

    return result;
  }

  /**
   * Get all candles as array
   */
  toArray(): CandlestickDataWithVolume[] {
    return this.getRangeAsArray(0, this.size);
  }

  /**
   * Update a specific candle (useful for live updates)
   */
  update(index: number, candle: Partial<CandlestickDataWithVolume>): void {
    if (index < 0 || index >= this.size) {
      return;
    }

    if (candle.time !== undefined) {
      this.timeBuffer[index] = BigInt(
        typeof candle.time === 'number' ? candle.time : parseInt(candle.time as string)
      );
    }
    if (candle.open !== undefined) this.openBuffer[index] = candle.open;
    if (candle.high !== undefined) this.highBuffer[index] = candle.high;
    if (candle.low !== undefined) this.lowBuffer[index] = candle.low;
    if (candle.close !== undefined) this.closeBuffer[index] = candle.close;
    if (candle.volume !== undefined) this.volumeBuffer[index] = candle.volume;
  }

  /**
   * Get last candle
   */
  getLast(): CandlestickDataWithVolume | null {
    if (this.size === 0) return null;
    return this.get(this.size - 1);
  }

  /**
   * Get first candle
   */
  getFirst(): CandlestickDataWithVolume | null {
    if (this.size === 0) return null;
    return this.get(0);
  }

  /**
   * Get close prices array (useful for calculating indicators)
   */
  getClosesPrices(): Float64Array {
    return this.closeBuffer.slice(0, this.size);
  }

  /**
   * Get opens prices array
   */
  getOpenPrices(): Float64Array {
    return this.openBuffer.slice(0, this.size);
  }

  /**
   * Get high prices array
   */
  getHighPrices(): Float64Array {
    return this.highBuffer.slice(0, this.size);
  }

  /**
   * Get low prices array
   */
  getLowPrices(): Float64Array {
    return this.lowBuffer.slice(0, this.size);
  }

  /**
   * Get volume array
   */
  getVolumes(): Float64Array {
    return this.volumeBuffer.slice(0, this.size);
  }

  /**
   * Get timestamps array
   */
  getTimestamps(): BigInt64Array {
    return this.timeBuffer.slice(0, this.size);
  }

  /**
   * Find candle by timestamp using binary search
   */
  findByTime(timestamp: number | bigint): number {
    const target = typeof timestamp === 'bigint' ? timestamp : BigInt(timestamp);
    let left = 0;
    let right = this.size;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midValue = this.timeBuffer[mid];

      if (midValue < target) {
        left = mid + 1;
      } else if (midValue > target) {
        right = mid;
      } else {
        return mid; // Found exact match
      }
    }

    return -1; // Not found
  }

  /**
   * Get number of candles
   */
  getLength(): number {
    return this.size;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.size = 0;
    // Optionally reset buffers to free memory
    // this.allocateBuffers(this.INITIAL_CAPACITY);
    // this.capacity = this.INITIAL_CAPACITY;
  }

  /**
   * Get time range
   */
  getTimeRange(): { start: number; end: number } | null {
    if (this.size === 0) {
      return null;
    }

    return {
      start: Number(this.timeBuffer[0]),
      end: Number(this.timeBuffer[this.size - 1])
    };
  }

  /**
   * Check if buffer contains time
   */
  hasTime(timestamp: number): boolean {
    return this.findByTime(timestamp) >= 0;
  }

  /**
   * Get statistics about buffer usage
   */
  getStats() {
    return {
      candleCount: this.size,
      capacity: this.capacity,
      memoryUsage: this.getMemoryUsage(),
      utilizationPercent: ((this.size / this.capacity) * 100).toFixed(2)
    };
  }

  /**
   * Export to JSON (useful for debugging/testing)
   */
  toJSON(): CandlestickDataWithVolume[] {
    return this.toArray();
  }

  /**
   * Import from JSON array
   */
  fromArray(candles: CandlestickDataWithVolume[]): void {
    this.clear();
    this.pushBatch(candles);
  }
}

/**
 * Export a pool of reusable buffers to avoid repeated allocations
 */
export class CandleBufferPool {
  private buffers: CandleDataBuffer[] = [];
  private available: CandleDataBuffer[] = [];

  /**
   * Get a buffer from the pool
   */
  acquire(): CandleDataBuffer {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }

    const buffer = new CandleDataBuffer();
    this.buffers.push(buffer);
    return buffer;
  }

  /**
   * Return buffer to pool
   */
  release(buffer: CandleDataBuffer): void {
    buffer.clear();
    this.available.push(buffer);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalBuffers: this.buffers.length,
      availableBuffers: this.available.length,
      inUseBuffers: this.buffers.length - this.available.length,
      totalMemory: this.buffers.reduce((sum, b) => sum + b.getMemoryUsage(), 0)
    };
  }
}

export const candleBufferPool = new CandleBufferPool();
