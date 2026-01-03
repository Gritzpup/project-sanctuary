/**
 * @file CircuitBreaker.ts
 * @description Circuit breaker pattern for WebSocket connection resilience
 * Part of Phase 20: Real-time Data Pipeline
 * 🚀 Prevents cascade failures and implements graceful degradation
 */

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

interface CircuitBreakerConfig {
  failureThreshold?: number; // Failures before opening (default: 5)
  successThreshold?: number; // Successes in half-open before closing (default: 2)
  timeout?: number; // Milliseconds before retry from open (default: 30000)
  halfOpenTimeout?: number; // Milliseconds for half-open test (default: 10000)
  debug?: boolean;
}

interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastStateChange: number;
  totalRequests: number;
  totalFailures: number;
}

/**
 * Circuit breaker for managing connection resilience
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private stateChangeTime: number = Date.now();
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  private failureThreshold: number;
  private successThreshold: number;
  private timeout: number;
  private halfOpenTimeout: number;
  private debug: boolean;

  private recoveryTimer: NodeJS.Timeout | null = null;
  private halfOpenTimer: NodeJS.Timeout | null = null;

  private onStateChange?: (newState: CircuitState, oldState: CircuitState) => void;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.successThreshold = config.successThreshold ?? 2;
    this.timeout = config.timeout ?? 30000;
    this.halfOpenTimeout = config.halfOpenTimeout ?? 10000;
    this.debug = config.debug ?? false;

    if (this.debug) {
      console.log(
        `[CircuitBreaker] Initialized: ` +
        `failureThreshold=${this.failureThreshold}, ` +
        `timeout=${this.timeout}ms`
      );
    }
  }

  /**
   * Register state change callback
   */
  onStateChanged(callback: (newState: CircuitState, oldState: CircuitState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Execute request through circuit breaker
   */
  async execute<T>(request: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      throw new Error(
        `Circuit breaker is OPEN. Retry after ${this.timeout}ms`
      );
    }

    try {
      const result = await this.executeWithTimeout(request);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
      }
    }

    if (this.debug) {
      console.log('[CircuitBreaker] ✅ Success');
    }
  }

  /**
   * Record failed operation
   */
  private onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.debug) {
      console.log(
        `[CircuitBreaker] ❌ Failure (${this.failureCount}/${this.failureThreshold})`
      );
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state, go back to open
      this.transitionTo(CircuitState.OPEN);
      this.scheduleRecovery();
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
      this.scheduleRecovery();
    }
  }

  /**
   * Schedule recovery attempt
   */
  private scheduleRecovery(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    if (this.debug) {
      console.log(
        `[CircuitBreaker] ⏰ Scheduling recovery in ${this.timeout}ms`
      );
    }

    this.recoveryTimer = setTimeout(() => {
      this.transitionTo(CircuitState.HALF_OPEN);
      this.successCount = 0;

      // Schedule timeout for half-open state
      this.halfOpenTimer = setTimeout(() => {
        if (this.state === CircuitState.HALF_OPEN) {
          if (this.debug) {
            console.log('[CircuitBreaker] ⏱️ Half-open timeout, reopening');
          }
          this.transitionTo(CircuitState.OPEN);
          this.scheduleRecovery();
        }
      }, this.halfOpenTimeout);
    }, this.timeout);
  }

  /**
   * Execute request with timeout
   */
  private async executeWithTimeout<T>(
    request: () => Promise<T>,
    timeoutMs: number = 5000
  ): Promise<T> {
    return Promise.race([
      request(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timeout')),
          timeoutMs
        )
      )
    ]);
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    if (newState === this.state) return;

    const oldState = this.state;
    this.state = newState;
    this.stateChangeTime = Date.now();

    if (this.debug) {
      console.log(
        `[CircuitBreaker] 🔄 State transition: ${oldState} → ${newState}`
      );
    }

    this.onStateChange?.(newState, oldState);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is closed (operational)
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is open (failing)
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is half-open (testing)
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }

    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;

    if (this.debug) {
      console.log('[CircuitBreaker] 🔁 Reset');
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.stateChangeTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures
    };
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    if (this.totalRequests === 0) return 0;
    return this.totalFailures / this.totalRequests;
  }
}

/**
 * Create circuit breaker with sensible defaults for WebSocket
 */
export function createWebSocketCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 3,
    successThreshold: 1,
    timeout: 5000,
    halfOpenTimeout: 3000,
    debug: false
  });
}

/**
 * Create circuit breaker with sensible defaults for API calls
 */
export function createAPICircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenTimeout: 10000,
    debug: false
  });
}
