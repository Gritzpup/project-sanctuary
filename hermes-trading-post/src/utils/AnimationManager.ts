/**
 * @file AnimationManager.ts
 * @description Frame rate limiting and batch animation coordination
 * Part of Phase 19: UI/UX Performance
 * 🚀 Optimizes animations and updates for smooth 60fps performance
 */

interface AnimationTask {
  id: string;
  callback: () => void;
  priority?: number;
}

interface PerformanceMetrics {
  frameRate: number;
  frameTimes: number[];
  averageFrameTime: number;
  lastUpdate: number;
}

/**
 * Animation manager for coordinated frame rate limiting and batching
 */
export class AnimationManager {
  private static instance: AnimationManager | null = null;
  private rafId: number | null = null;
  private taskQueue: AnimationTask[] = [];
  private frameTimeBudget: number = 16.67; // 60fps = 16.67ms per frame
  private lastFrameTime: number = performance.now();
  private metrics: PerformanceMetrics = {
    frameRate: 60,
    frameTimes: [],
    averageFrameTime: 16.67,
    lastUpdate: 0
  };
  private maxFrameTimeSamples: number = 60;
  private isRunning: boolean = false;
  private debug: boolean = false;
  private reduceMotion: boolean = false;
  private targetFrameRate: number = 60;

  private constructor(debug = false) {
    this.debug = debug;
    this.detectReducedMotion();
    this.checkLowEndDevice();
  }

  /**
   * Get singleton instance
   */
  static getInstance(debug = false): AnimationManager {
    if (!AnimationManager.instance) {
      AnimationManager.instance = new AnimationManager(debug);
    }
    return AnimationManager.instance;
  }

  /**
   * Start the animation loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    if (this.debug) {
    }

    this.scheduleFrame();
  }

  /**
   * Stop the animation loop
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.debug) {
    }
  }

  /**
   * Schedule animation task for next frame
   */
  schedule(callback: () => void, priority: number = 0): string {
    const id = `task-${Date.now()}-${Math.random()}`;

    this.taskQueue.push({ id, callback, priority });

    // Sort by priority (higher first)
    this.taskQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (!this.isRunning) {
      this.start();
    }

    return id;
  }

  /**
   * Cancel scheduled task
   */
  cancel(taskId: string): void {
    const index = this.taskQueue.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      this.taskQueue.splice(index, 1);
    }
  }

  /**
   * Batch multiple tasks
   */
  batch(callbacks: (() => void)[], priority: number = 0): string[] {
    return callbacks.map((cb) => this.schedule(cb, priority));
  }

  /**
   * Set target frame rate
   */
  setTargetFrameRate(fps: number): void {
    this.targetFrameRate = Math.max(1, Math.min(120, fps));
    this.frameTimeBudget = 1000 / this.targetFrameRate;

    if (this.debug) {
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.metrics.frameRate;
  }

  /**
   * Enable/disable reduced motion
   */
  setReducedMotion(enabled: boolean): void {
    this.reduceMotion = enabled;
    if (enabled) {
      this.setTargetFrameRate(30);
    }

    if (this.debug) {
    }
  }

  /**
   * Check for reduced motion preference
   */
  private detectReducedMotion(): void {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.reduceMotion = true;
      this.setTargetFrameRate(30);
    }
  }

  /**
   * Check for low-end device
   */
  private checkLowEndDevice(): void {
    // Check available memory (if API available)
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory && deviceMemory <= 2) {
      this.setTargetFrameRate(30);
      if (this.debug) {
      }
    }

    // Check CPU cores
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    if (hardwareConcurrency <= 2) {
      this.setTargetFrameRate(30);
    }
  }

  /**
   * Main animation frame loop
   */
  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame((now) => {
      const deltaTime = now - this.lastFrameTime;

      // Check if enough time has passed for next frame
      if (deltaTime >= this.frameTimeBudget) {
        this.processFrame(deltaTime);
        this.lastFrameTime = now;
      }

      // Always schedule next frame
      this.scheduleFrame();
    });
  }

  /**
   * Process frame and execute tasks
   */
  private processFrame(deltaTime: number): void {
    // Update frame time metrics
    this.metrics.frameTimes.push(deltaTime);
    if (this.metrics.frameTimes.length > this.maxFrameTimeSamples) {
      this.metrics.frameTimes.shift();
    }

    const avgFrameTime =
      this.metrics.frameTimes.reduce((a, b) => a + b, 0) /
      this.metrics.frameTimes.length;
    this.metrics.averageFrameTime = avgFrameTime;
    this.metrics.frameRate = Math.round(1000 / avgFrameTime);

    // Execute queued tasks within frame budget
    const frameDeadline = performance.now() + this.frameTimeBudget;

    while (this.taskQueue.length > 0 && performance.now() < frameDeadline) {
      const task = this.taskQueue.shift();
      if (task) {
        try {
          task.callback();
        } catch (error) {
        }
      }
    }

    // Debug logging
    if (this.debug && this.metrics.frameRate < 30) {
    }
  }
}

/**
 * Global animation manager singleton
 */
export const animationManager = AnimationManager.getInstance();

/**
 * Schedule animation task
 * @example
 * scheduleAnimation(() => {
 *   element.style.transform = "translateX(" + x + "px)";
 * });
 */
export function scheduleAnimation(callback: () => void, priority?: number): string {
  return animationManager.schedule(callback, priority);
}

/**
 * Batch animation tasks
 * @example
 * batchAnimations([
 *   () => { // update 1
 *   },
 *   () => { // update 2
 *   }
 * ]);
 */
export function batchAnimations(callbacks: (() => void)[], priority?: number): string[] {
  return animationManager.batch(callbacks, priority);
}

/**
 * Get current FPS
 * @example
 * const fps = getCurrentFPS();
 */
export function getCurrentFPS(): number {
  return animationManager.getFPS();
}

/**
 * Initialize animation manager on app start
 */
export function initializeAnimationManager(): void {
  animationManager.start();
}
