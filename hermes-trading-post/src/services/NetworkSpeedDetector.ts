/**
 * Network Speed Detector
 *
 * Detects network connection speed and adapts data loading strategy:
 * - Fast networks: Prefetch more data, aggressive caching
 * - Normal networks: Standard batch sizes
 * - Slow networks: Smaller batches, essential data only
 *
 * 🚀 PHASE 17: Adaptive data loading based on network quality
 */

export type NetworkSpeed = 'fast' | 'normal' | 'slow';

export interface NetworkSpeedConfig {
  measurements?: number; // Number of measurements to average (default: 5)
  fastThreshold?: number; // Max ms for fast (default: 200)
  slowThreshold?: number; // Min ms for slow (default: 1000)
}

export interface NetworkSpeedStats {
  speed: NetworkSpeed;
  avgLatency: number;
  measurements: number;
  lastUpdate: number;
}

/**
 * Detects network connection speed via API latency measurements
 */
export class NetworkSpeedDetector {
  private measurementHistory: number[] = [];
  private readonly MEASUREMENTS: number;
  private readonly FAST_THRESHOLD_MS: number;
  private readonly SLOW_THRESHOLD_MS: number;
  private stats: NetworkSpeedStats | null = null;

  constructor(config: NetworkSpeedConfig = {}) {
    this.MEASUREMENTS = config.measurements ?? 5;
    this.FAST_THRESHOLD_MS = config.fastThreshold ?? 200;
    this.SLOW_THRESHOLD_MS = config.slowThreshold ?? 1000;
  }

  /**
   * Measure network speed by making a small API request
   * Returns detected speed: 'fast' | 'normal' | 'slow'
   */
  async measureSpeed(testUrl?: string): Promise<NetworkSpeed> {
    const url = testUrl || '/api/time'; // Simple endpoint that responds quickly
    const startTime = performance.now();

    try {
      const response = await Promise.race([
        fetch(url),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]) as Response;

      const loadTime = performance.now() - startTime;

      // Record measurement
      this.measurementHistory.push(loadTime);
      if (this.measurementHistory.length > this.MEASUREMENTS) {
        this.measurementHistory.shift();
      }

      const speed = this.classifySpeed();
      this.stats = {
        speed,
        avgLatency: this.getAverageLatency(),
        measurements: this.measurementHistory.length,
        lastUpdate: Date.now()
      };

      return speed;
    } catch (error) {
      // On error, assume slow connection
      this.stats = {
        speed: 'slow',
        avgLatency: this.SLOW_THRESHOLD_MS,
        measurements: 0,
        lastUpdate: Date.now()
      };
      return 'slow';
    }
  }

  /**
   * Classify current speed based on average latency
   */
  private classifySpeed(): NetworkSpeed {
    const avgLatency = this.getAverageLatency();

    if (avgLatency < this.FAST_THRESHOLD_MS) {
      return 'fast';
    }

    if (avgLatency > this.SLOW_THRESHOLD_MS) {
      return 'slow';
    }

    return 'normal';
  }

  /**
   * Get average latency from measurements
   */
  private getAverageLatency(): number {
    if (this.measurementHistory.length === 0) {
      return this.SLOW_THRESHOLD_MS; // Default to slow if no measurements
    }

    const sum = this.measurementHistory.reduce((a, b) => a + b, 0);
    return sum / this.measurementHistory.length;
  }

  /**
   * Get current estimated speed (based on last measurement or default)
   */
  getEstimatedSpeed(): NetworkSpeed {
    if (!this.stats) {
      return 'normal'; // Default to normal if not measured
    }
    return this.stats.speed;
  }

  /**
   * Get current statistics
   */
  getStats(): NetworkSpeedStats | null {
    return this.stats;
  }

  /**
   * Get data loading config based on network speed
   * Returns batch size and prefetch strategy
   */
  getLoadingConfig(speed?: NetworkSpeed): {
    batchSize: number;
    prefetchMode: boolean;
    maxConcurrentRequests: number;
    timeoutMs: number;
  } {
    const currentSpeed = speed ?? this.getEstimatedSpeed();

    switch (currentSpeed) {
      case 'fast':
        return {
          batchSize: 10000, // Request more data
          prefetchMode: true, // Aggressive prefetch
          maxConcurrentRequests: 4, // Can handle multiple requests
          timeoutMs: 10000 // Longer timeout is ok
        };

      case 'slow':
        return {
          batchSize: 1000, // Minimal data
          prefetchMode: false, // No aggressive prefetch
          maxConcurrentRequests: 1, // One at a time
          timeoutMs: 3000 // Strict timeout
        };

      default: // 'normal'
        return {
          batchSize: 5000, // Standard
          prefetchMode: false, // Standard
          maxConcurrentRequests: 2, // Moderate
          timeoutMs: 5000 // Normal timeout
        };
    }
  }

  /**
   * Reset measurement history
   */
  reset(): void {
    this.measurementHistory = [];
    this.stats = null;
  }

  /**
   * Get detailed latency info for debugging
   */
  getDetailedLatencyInfo(): {
    min: number;
    max: number;
    avg: number;
    median: number;
    measurements: number[];
  } {
    if (this.measurementHistory.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        measurements: []
      };
    }

    const sorted = [...this.measurementHistory].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      median,
      measurements: [...this.measurementHistory]
    };
  }
}

/**
 * Global instance for network speed detection
 */
export const networkSpeedDetector = new NetworkSpeedDetector({
  measurements: 5,
  fastThreshold: 200, // < 200ms = fast
  slowThreshold: 1000 // > 1000ms = slow
});

/**
 * Helper to initialize network detection on app load
 */
export async function initializeNetworkDetection(): Promise<NetworkSpeed> {
  const speed = await networkSpeedDetector.measureSpeed();
    `[NetworkSpeedDetector] Detected network speed: ${speed} (avg: ${
      networkSpeedDetector.getStats()?.avgLatency.toFixed(0)
    }ms)`
  );
  return speed;
}

/**
 * Example usage:
 *
 * // Initialize on app load
 * const speed = await initializeNetworkDetection();
 *
 * // Get loading config
 * const config = networkSpeedDetector.getLoadingConfig(speed);
 *
 * // Adapt data loading
 * async function fetchChartData(pair: string, granularity: string) {
 *   const config = networkSpeedDetector.getLoadingConfig();
 *   return fetch(`/api/candles?pair=${pair}&limit=${config.batchSize}`);
 * }
 */
