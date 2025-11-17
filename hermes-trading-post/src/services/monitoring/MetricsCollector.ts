/**
 * @file MetricsCollector.ts
 * @description Application performance metrics collection and aggregation
 * Part of Phase 21: Monitoring & Observability
 * 🚀 Collects, batches, and reports performance metrics
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface MetricsSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
  sessionId: string;
}

/**
 * Metrics collector for application performance monitoring
 */
export class MetricsCollector {
  private static instance: MetricsCollector | null = null;
  private buffer: PerformanceMetric[] = [];
  private sessionId: string;
  private bufferSize: number = 100;
  private flushInterval: number = 10000; // 10 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private debug: boolean = false;
  private isEnabled: boolean = true;

  private metrics = {
    fps: 0,
    memory: 0,
    apiResponseTime: 0,
    chartRenderTime: 0,
    websocketLatency: 0
  };

  private listeners: {
    onFlush?: (snapshot: MetricsSnapshot) => void | Promise<void>;
  } = {};

  private constructor(debug = false) {
    this.debug = debug;
    this.sessionId = this.generateSessionId();
    this.startFPSMonitoring();
    this.startMemoryMonitoring();

    if (this.debug) {
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(debug = false): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector(debug);
    }
    return MetricsCollector.instance;
  }

  /**
   * Enable/disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (this.debug) {
    }
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags?: Record<string, string>
  ): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    };

    this.buffer.push(metric);

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Record API response time
   */
  recordAPICall(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number
  ): void {
    this.recordMetric('api_call', duration, 'ms', {
      endpoint,
      method,
      status: statusCode.toString()
    });

    this.metrics.apiResponseTime = duration;
  }

  /**
   * Record chart render time
   */
  recordChartRender(duration: number, candleCount: number): void {
    this.recordMetric('chart_render', duration, 'ms', {
      candles: candleCount.toString()
    });

    this.metrics.chartRenderTime = duration;
  }

  /**
   * Record WebSocket latency
   */
  recordWebSocketLatency(latency: number): void {
    this.recordMetric('websocket_latency', latency, 'ms');
    this.metrics.websocketLatency = latency;
  }

  /**
   * Record custom event
   */
  recordEvent(
    event: string,
    data?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name: `event_${event}`,
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: Object.entries(data || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: String(value)
        }),
        {}
      )
    };

    this.buffer.push(metric);

    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Flush metrics buffer
   */
  flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return Promise.resolve();
    }

    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      metrics: [...this.buffer],
      sessionId: this.sessionId
    };

    this.buffer = [];

    if (this.debug) {
    }

    return Promise.resolve()
      .then(() => this.listeners.onFlush?.(snapshot))
      .catch((error) => {
        if (this.debug) {
        }
      });
  }

  /**
   * Register flush listener
   */
  onFlush(
    callback: (snapshot: MetricsSnapshot) => void | Promise<void>
  ): void {
    this.listeners.onFlush = callback;
  }

  /**
   * Start automatic flushing
   */
  startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);

    if (this.debug) {
    }
  }

  /**
   * Stop automatic flushing
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.debug) {
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get buffer statistics
   */
  getBufferStats(): {
    size: number;
    capacity: number;
    usage: number;
  } {
    return {
      size: this.buffer.length,
      capacity: this.bufferSize,
      usage: (this.buffer.length / this.bufferSize) * 100
    };
  }

  /**
   * Start FPS monitoring
   */
  private startFPSMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();

    const updateFPS = () => {
      const now = performance.now();
      const elapsed = now - lastTime;

      if (elapsed >= 1000) {
        this.metrics.fps = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastTime = now;
      }

      frameCount++;
      requestAnimationFrame(updateFPS);
    };

    requestAnimationFrame(updateFPS);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (!('memory' in performance)) {
      if (this.debug) {
      }
      return;
    }

    const perfMemory = (performance as any).memory;

    setInterval(() => {
      // Convert bytes to MB
      this.metrics.memory = perfMemory.usedJSHeapSize / (1024 * 1024);

      // Record large memory jumps
      if (this.metrics.memory > 150) {
        this.recordEvent('memory_spike', {
          memory_mb: Math.round(this.metrics.memory)
        });
      }
    }, 5000);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Reset collector
   */
  reset(): void {
    this.buffer = [];
    this.sessionId = this.generateSessionId();

    if (this.debug) {
    }
  }
}

/**
 * Global metrics collector singleton
 */
export const metricsCollector = MetricsCollector.getInstance();

/**
 * Record a metric
 * @example
 * recordMetric('chart_load', 150, 'ms');
 */
export function recordMetric(
  name: string,
  value: number,
  unit?: string
): void {
  metricsCollector.recordMetric(name, value, unit);
}

/**
 * Record API call metrics
 * @example
 * recordAPICall('/api/chart', 'GET', 245, 200);
 */
export function recordAPICall(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number
): void {
  metricsCollector.recordAPICall(endpoint, method, duration, statusCode);
}

/**
 * Record custom event
 * @example
 * recordEvent('user_action', { action: 'chart_zoom' });
 */
export function recordEvent(
  event: string,
  data?: Record<string, any>
): void {
  metricsCollector.recordEvent(event, data);
}

/**
 * Start automatic metrics flushing
 */
export function startMetricsCollection(): void {
  metricsCollector.startAutoFlush();
}

/**
 * Stop metrics collection
 */
export function stopMetricsCollection(): void {
  metricsCollector.stopAutoFlush();
}
