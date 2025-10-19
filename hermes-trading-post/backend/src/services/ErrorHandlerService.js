/**
 * ErrorHandlerService - Centralized error handling and recovery
 *
 * Phase 5C: Backend Monolith Split
 * Extracted to standardize error handling across services
 * Provides error categorization, recovery strategies, and reporting
 */

export class ErrorHandlerService {
  constructor(logger) {
    this.logger = logger;
    this.errorCounts = new Map();
    this.errorThresholds = {
      WebSocketConnectionError: 5,
      DatabaseError: 3,
      APIError: 10,
      ValidationError: 20
    };
  }

  /**
   * Categorize error type
   */
  categorizeError(error) {
    if (error.message?.includes('WebSocket')) {
      return 'WebSocketConnectionError';
    }
    if (error.message?.includes('database') || error.message?.includes('redis')) {
      return 'DatabaseError';
    }
    if (error.message?.includes('API') || error.message?.includes('timeout')) {
      return 'APIError';
    }
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return 'ValidationError';
    }
    return 'UnknownError';
  }

  /**
   * Handle error with recovery strategy
   */
  handleError(error, context = 'Unknown', recoveryStrategy = null) {
    const errorType = this.categorizeError(error);

    // Track error count
    const count = (this.errorCounts.get(errorType) || 0) + 1;
    this.errorCounts.set(errorType, count);

    // Log error
    this.logger?.error(context, `Error (${errorType}, #${count})`, error);

    // Check if threshold exceeded
    const threshold = this.errorThresholds[errorType] || 10;
    if (count > threshold) {
      this.logger?.warn(context, `Error threshold exceeded for ${errorType}: ${count}/${threshold}`);
      // Could trigger recovery or alerting here
    }

    // Execute recovery strategy if provided
    if (recoveryStrategy && typeof recoveryStrategy === 'function') {
      try {
        recoveryStrategy(error);
      } catch (recoveryError) {
        this.logger?.error(context, 'Recovery strategy failed', recoveryError);
      }
    }

    return {
      type: errorType,
      count,
      threshold,
      exceedsThreshold: count > threshold
    };
  }

  /**
   * Handle async operation with error recovery
   */
  async handleAsync(operation, context, fallback = null) {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context);

      if (fallback) {
        try {
          return fallback();
        } catch (fallbackError) {
          this.logger?.error(context, 'Fallback operation failed', fallbackError);
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Reset error count for type
   */
  resetErrorCount(errorType) {
    this.errorCounts.delete(errorType);
  }

  /**
   * Reset all error counts
   */
  resetAllCounts() {
    this.errorCounts.clear();
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      errorsByType: Object.fromEntries(this.errorCounts)
    };
  }

  /**
   * Set error threshold for type
   */
  setThreshold(errorType, threshold) {
    this.errorThresholds[errorType] = threshold;
  }

  /**
   * Get error count for type
   */
  getErrorCount(errorType) {
    return this.errorCounts.get(errorType) || 0;
  }
}
