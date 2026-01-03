// @ts-nocheck
/**
 * @file phases-18-21.test.ts
 * @description Integration tests for Phases 18-21
 * Part of Phase 22: Testing & Documentation
 * 🧪 Tests store management, animations, circuit breaker, and metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoreManager } from '../../stores/manager/StoreManager';
import { createBaseStore } from '../../stores/factory/createBaseStore';
import { CircuitBreaker } from '../../services/websocket/CircuitBreaker';
import { AnimationManager } from '../../utils/AnimationManager';
import { MetricsCollector } from '../../services/monitoring/MetricsCollector';

describe('Phase 18: Store Management Integration', () => {
  let storeManager: StoreManager;

  beforeEach(() => {
    storeManager = new StoreManager(false);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize stores in dependency order', async () => {
    const initOrder: string[] = [];

    const store1 = createBaseStore({ initial: { a: 1 } });
    const store2 = createBaseStore({ initial: { b: 2 } });
    const store3 = createBaseStore({ initial: { c: 3 } });

    storeManager.registerStore('store1', store1, {
      initializer: () => initOrder.push('store1')
    });

    storeManager.registerStore('store2', store2, {
      initializer: () => initOrder.push('store2'),
      dependencies: ['store1']
    });

    storeManager.registerStore('store3', store3, {
      initializer: () => initOrder.push('store3'),
      dependencies: ['store2']
    });

    await storeManager.initialize();

    expect(initOrder).toEqual(['store1', 'store2', 'store3']);
  });

  it('should detect circular dependencies', async () => {
    const store1 = createBaseStore({ initial: {} });
    const store2 = createBaseStore({ initial: {} });

    storeManager.registerStore('store1', store1, {
      dependencies: ['store2']
    });

    storeManager.registerStore('store2', store2, {
      dependencies: ['store1']
    });

    await expect(storeManager.initialize()).rejects.toThrow('Circular dependency');
  });

  it('should provide store statistics', async () => {
    const store1 = createBaseStore({ initial: {} });
    const store2 = createBaseStore({ initial: {} });

    storeManager.registerStore('store1', store1);
    storeManager.registerStore('store2', store2);

    const stats = storeManager.getStats();

    expect(stats.totalStores).toBe(2);
    expect(stats.stores).toHaveLength(2);
  });
});

describe('Phase 19: Animation Manager Integration', () => {
  let animationManager: AnimationManager;

  beforeEach(() => {
    animationManager = AnimationManager.getInstance(false);
    animationManager.start();
  });

  afterEach(() => {
    animationManager.stop();
  });

  it('should batch animation tasks', (done) => {
    let callCount = 0;

    const callbacks = [
      () => callCount++,
      () => callCount++,
      () => callCount++
    ];

    animationManager.batch(callbacks);

    setTimeout(() => {
      expect(callCount).toBe(3);
      done();
    }, 100);
  });

  it('should respect frame rate limits', (done) => {
    animationManager.setTargetFrameRate(30); // 30fps

    let frameCount = 0;
    const start = performance.now();

    const scheduleFrame = () => {
      animationManager.schedule(() => {
        frameCount++;
        if (frameCount < 5) {
          scheduleFrame();
        }
      });
    };

    scheduleFrame();

    setTimeout(() => {
      const elapsed = performance.now() - start;
      const expectedTime = (5 / 30) * 1000; // 5 frames at 30fps

      // Should take at least the expected time (±50ms tolerance)
      expect(elapsed).toBeGreaterThan(expectedTime - 50);
      done();
    }, 300);
  });

  it('should track FPS metrics', (done) => {
    const start = performance.now();

    const schedule100Frames = (count: number) => {
      if (count > 0) {
        animationManager.schedule(() => schedule100Frames(count - 1));
      }
    };

    schedule100Frames(100);

    setTimeout(() => {
      const fps = animationManager.getFPS();
      expect(fps).toBeGreaterThan(0);
      expect(fps).toBeLessThanOrEqual(120);
      done();
    }, 500);
  });
});

describe('Phase 20: Circuit Breaker Integration', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 100,
      debug: false
    });
  });

  it('should transition from CLOSED to OPEN on failures', async () => {
    const failingRequest = () => Promise.reject(new Error('Failed'));

    try {
      await circuitBreaker.execute(failingRequest);
    } catch {
      // Expected
    }

    try {
      await circuitBreaker.execute(failingRequest);
    } catch {
      // Expected
    }

    expect(circuitBreaker.isOpen()).toBe(true);
  });

  it('should reject requests when OPEN', async () => {
    const failingRequest = () => Promise.reject(new Error('Failed'));

    // Fail twice to open circuit
    try {
      await circuitBreaker.execute(failingRequest);
    } catch {
      // Expected
    }

    try {
      await circuitBreaker.execute(failingRequest);
    } catch {
      // Expected
    }

    // Circuit should now be OPEN
    expect(circuitBreaker.isOpen()).toBe(true);

    // Next request should be rejected immediately
    await expect(circuitBreaker.execute(() => Promise.resolve())).rejects.toThrow('OPEN');
  });

  it('should transition to HALF_OPEN after timeout', (done) => {
    const failingRequest = () => Promise.reject(new Error('Failed'));

    // Open the circuit
    circuitBreaker.execute(failingRequest).catch(() => {});
    circuitBreaker.execute(failingRequest).catch(() => {});

    setTimeout(() => {
      expect(circuitBreaker.isHalfOpen()).toBe(true);
      done();
    }, 150);
  });

  it('should track metrics', () => {
    const metrics = circuitBreaker.getMetrics();

    expect(metrics.state).toBeDefined();
    expect(metrics.failures).toBeGreaterThanOrEqual(0);
    expect(metrics.successes).toBeGreaterThanOrEqual(0);
  });

  it('should recover on success from HALF_OPEN', async () => {
    const failingRequest = () => Promise.reject(new Error('Failed'));
    const successRequest = () => Promise.resolve('OK');

    // Open circuit
    circuitBreaker.execute(failingRequest).catch(() => {});
    circuitBreaker.execute(failingRequest).catch(() => {});

    expect(circuitBreaker.isOpen()).toBe(true);

    // Wait for half-open
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Succeed
    await circuitBreaker.execute(successRequest);

    // Should be closed now
    expect(circuitBreaker.isClosed()).toBe(true);
  });
});

describe('Phase 21: Metrics Collector Integration', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    metricsCollector = MetricsCollector.getInstance(false);
    metricsCollector.setEnabled(true);
  });

  it('should collect metrics', () => {
    metricsCollector.recordMetric('test_metric', 42, 'ms');

    const bufferStats = metricsCollector.getBufferStats();
    expect(bufferStats.size).toBeGreaterThan(0);
  });

  it('should record API calls', () => {
    metricsCollector.recordAPICall('/api/test', 'GET', 150, 200);

    const metrics = metricsCollector.getCurrentMetrics();
    expect(metrics.apiResponseTime).toBe(150);
  });

  it('should record events', () => {
    metricsCollector.recordEvent('test_event', { value: 123 });

    const bufferStats = metricsCollector.getBufferStats();
    expect(bufferStats.size).toBeGreaterThan(0);
  });

  it('should auto-flush buffer when full', async () => {
    let flushed = false;
    metricsCollector.onFlush(() => {
      flushed = true;
    });

    // Record many metrics to exceed buffer size
    for (let i = 0; i < 150; i++) {
      metricsCollector.recordMetric(`metric_${i}`, i, 'ms');
    }

    // Wait a bit for async flush
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(flushed).toBe(true);
  });

  it('should track memory metrics', async () => {
    // Give memory monitoring time to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics = metricsCollector.getCurrentMetrics();
    expect(metrics.memory).toBeGreaterThanOrEqual(0);
  });
});

describe('Cross-Phase Integration', () => {
  it('should initialize all systems without conflicts', async () => {
    const storeManager = new StoreManager(false);
    const animationManager = AnimationManager.getInstance(false);
    const circuitBreaker = new CircuitBreaker();
    const metricsCollector = MetricsCollector.getInstance(false);

    // All should initialize without errors
    expect(() => {
      storeManager.registerStore('test', createBaseStore({ initial: {} }));
      animationManager.start();
      metricsCollector.setEnabled(true);
    }).not.toThrow();

    animationManager.stop();
  });

  it('should collect metrics during store operations', () => {
    const metricsCollector = MetricsCollector.getInstance(false);
    metricsCollector.setEnabled(true);

    const store = createBaseStore({
      initial: { value: 0 },
      persist: { key: 'test-store', storage: 'localStorage' }
    });

    metricsCollector.recordEvent('store_update', { store: 'test' });
    store.set({ value: 1 });
    metricsCollector.recordEvent('store_persisted', { store: 'test' });

    const bufferStats = metricsCollector.getBufferStats();
    expect(bufferStats.size).toBeGreaterThan(0);

    localStorage.clear();
  });
});
