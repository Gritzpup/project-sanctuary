interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

interface PerformanceStats {
  renderTime: number;
  dataLoadTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  fps: number;
  candleUpdateRate: number;
}

class PerformanceStore {
  private _stats = $state<PerformanceStats>({
    renderTime: 0,
    dataLoadTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    fps: 0,
    candleUpdateRate: 0
  });

  private _metrics = $state<PerformanceMetric[]>([]);
  private _isMonitoring = $state<boolean>(false);
  
  private fpsInterval: NodeJS.Timeout | null = null;
  private memoryInterval: NodeJS.Timeout | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private candleUpdates: number = 0;
  private lastCandleUpdateTime: number = Date.now();

  // Getters
  get stats() {
    return this._stats;
  }

  get metrics() {
    return this._metrics;
  }

  get isMonitoring() {
    return this._isMonitoring;
  }

  get summary() {
    return {
      performance: this.getPerformanceLevel(),
      issues: this.getPerformanceIssues()
    };
  }

  // Start/stop monitoring
  startMonitoring() {
    if (this._isMonitoring) return;
    
    this._isMonitoring = true;
    this.startFPSMonitoring();
    this.startMemoryMonitoring();
  }

  stopMonitoring() {
    this._isMonitoring = false;
    
    if (this.fpsInterval) {
      cancelAnimationFrame(this.fpsInterval as any);
      this.fpsInterval = null;
    }
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  // Metric recording
  recordRenderTime(ms: number) {
    this._stats.renderTime = ms;
    this.addMetric('render', ms);
  }

  recordDataLoadTime(ms: number) {
    this._stats.dataLoadTime = ms;
    this.addMetric('dataLoad', ms);
  }

  recordCacheHit() {
    this.cacheHits++;
    this.updateCacheHitRate();
  }

  recordCacheMiss() {
    this.cacheMisses++;
    this.updateCacheHitRate();
  }

  recordCandleUpdate() {
    this.candleUpdates++;
    const now = Date.now();
    const timeDiff = (now - this.lastCandleUpdateTime) / 1000; // seconds
    
    if (timeDiff >= 1) {
      this._stats.candleUpdateRate = this.candleUpdates / timeDiff;
      this.candleUpdates = 0;
      this.lastCandleUpdateTime = now;
    }
  }

  // Private methods
  private startFPSMonitoring() {
    const measureFPS = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        this.frameCount++;
        
        // Update FPS every second
        if (this.frameCount >= 60) {
          this._stats.fps = Math.round(1000 / (delta / this.frameCount));
          this.frameCount = 0;
        }
      }
      
      this.lastFrameTime = timestamp;
      
      if (this._isMonitoring) {
        this.fpsInterval = requestAnimationFrame(measureFPS) as any;
      }
    };
    
    this.fpsInterval = requestAnimationFrame(measureFPS) as any;
  }

  private startMemoryMonitoring() {
    if (!performance.memory) {
      console.warn('PerformanceStore: Memory monitoring not available');
      return;
    }

    this.memoryInterval = setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        this._stats.memoryUsage = Math.round(memory.usedJSHeapSize / 1048576); // MB
        this.addMetric('memory', this._stats.memoryUsage);
      }
    }, 5000); // Check every 5 seconds
  }

  private updateCacheHitRate() {
    const total = this.cacheHits + this.cacheMisses;
    if (total > 0) {
      this._stats.cacheHitRate = Math.round((this.cacheHits / total) * 100);
    }
  }

  private addMetric(name: string, value: number) {
    this._metrics.push({
      name,
      value,
      timestamp: Date.now()
    });

    // Keep only last 100 metrics
    if (this._metrics.length > 100) {
      this._metrics = this._metrics.slice(-100);
    }
  }

  private getPerformanceLevel(): 'excellent' | 'good' | 'fair' | 'poor' {
    const { fps, renderTime, dataLoadTime } = this._stats;
    
    if (fps >= 55 && renderTime < 16 && dataLoadTime < 500) {
      return 'excellent';
    } else if (fps >= 45 && renderTime < 33 && dataLoadTime < 1000) {
      return 'good';
    } else if (fps >= 30 && renderTime < 50 && dataLoadTime < 2000) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  private getPerformanceIssues(): string[] {
    const issues: string[] = [];
    const { fps, renderTime, dataLoadTime, memoryUsage, cacheHitRate } = this._stats;
    
    if (fps < 30 && fps > 0) {
      issues.push(`Low FPS: ${fps}`);
    }
    
    if (renderTime > 50) {
      issues.push(`Slow render: ${renderTime}ms`);
    }
    
    if (dataLoadTime > 2000) {
      issues.push(`Slow data load: ${dataLoadTime}ms`);
    }
    
    if (memoryUsage > 500) {
      issues.push(`High memory usage: ${memoryUsage}MB`);
    }
    
    if (cacheHitRate < 50 && (this.cacheHits + this.cacheMisses) > 10) {
      issues.push(`Low cache hit rate: ${cacheHitRate}%`);
    }
    
    return issues;
  }

  // Utility methods
  getAverageMetric(name: string, windowSize: number = 10): number {
    const relevantMetrics = this._metrics
      .filter(m => m.name === name)
      .slice(-windowSize);
    
    if (relevantMetrics.length === 0) return 0;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  }

  reset() {
    this._stats = {
      renderTime: 0,
      dataLoadTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      fps: 0,
      candleUpdateRate: 0
    };
    this._metrics = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.candleUpdates = 0;
    this.frameCount = 0;
  }

  destroy() {
    this.stopMonitoring();
  }
}

// Create and export singleton
export const performanceStore = new PerformanceStore();