/**
 * Centralized error handling service for the Hermes Trading Post
 * Provides standardized error handling, recovery, and reporting
 */

import { logger } from './LoggingService';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  API = 'api',
  TRADING = 'trading',
  CHART = 'chart',
  STRATEGY = 'strategy',
  WEBSOCKET = 'websocket',
  PERSISTENCE = 'persistence',
  VALIDATION = 'validation',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  data?: unknown;
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  error: Error;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  recovered: boolean;
  retryable: boolean;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorReports: Map<string, ErrorReport> = new Map();
  private errorHandlers: Map<ErrorCategory, ((error: Error, context: ErrorContext) => boolean)[]> = new Map();

  private constructor() {
    this.setupDefaultHandlers();
  }

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Register a custom error handler for a specific category
   */
  registerHandler(
    category: ErrorCategory,
    handler: (error: Error, context: ErrorContext) => boolean
  ): void {
    if (!this.errorHandlers.has(category)) {
      this.errorHandlers.set(category, []);
    }
    this.errorHandlers.get(category)!.push(handler);
  }

  /**
   * Handle an error with automatic categorization and recovery
   */
  handleError(
    error: Error,
    context: ErrorContext = {},
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.UNKNOWN
  ): ErrorReport {
    const errorId = this.generateErrorId();
    const report: ErrorReport = {
      id: errorId,
      timestamp: Date.now(),
      error,
      severity,
      category,
      context,
      recovered: false,
      retryable: this.isRetryableError(error, category)
    };

    // Log the error
    this.logError(report);

    // Try to recover using registered handlers
    const handlers = this.errorHandlers.get(category) || [];
    for (const handler of handlers) {
      try {
        if (handler(error, context)) {
          report.recovered = true;
          break;
        }
      } catch (handlerError) {
        logger.error('ERROR_SERVICE', 'Error handler failed', handlerError as Error);
      }
    }

    // Store the report
    this.errorReports.set(errorId, report);

    // Trigger notifications for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.notifyCriticalError(report);
    }

    return report;
  }

  /**
   * Helper methods for specific error types
   */
  api = {
    handleError: (error: Error, endpoint: string, context: ErrorContext = {}) =>
      this.handleError(error, { ...context, component: 'API', action: endpoint }, ErrorSeverity.MEDIUM, ErrorCategory.API),

    handleCritical: (error: Error, endpoint: string, context: ErrorContext = {}) =>
      this.handleError(error, { ...context, component: 'API', action: endpoint }, ErrorSeverity.CRITICAL, ErrorCategory.API)
  };

  trading = {
    handleError: (error: Error, action: string, context: ErrorContext = {}) =>
      this.handleError(error, { ...context, component: 'TRADING', action }, ErrorSeverity.HIGH, ErrorCategory.TRADING),

    handleCritical: (error: Error, action: string, context: ErrorContext = {}) =>
      this.handleError(error, { ...context, component: 'TRADING', action }, ErrorSeverity.CRITICAL, ErrorCategory.TRADING)
  };

  strategy = {
    handleError: (error: Error, strategyName: string, context: ErrorContext = {}) =>
      this.handleError(error, { ...context, component: 'STRATEGY', action: strategyName }, ErrorSeverity.MEDIUM, ErrorCategory.STRATEGY)
  };

  websocket = {
    handleError: (error: Error, action: string, context: ErrorContext = {}) =>
      this.handleError(error, { ...context, component: 'WEBSOCKET', action }, ErrorSeverity.MEDIUM, ErrorCategory.WEBSOCKET),

    handleDisconnection: (error: Error, context: ErrorContext = {}) =>
      this.handleError(error, { ...context, component: 'WEBSOCKET', action: 'disconnect' }, ErrorSeverity.HIGH, ErrorCategory.WEBSOCKET)
  };

  /**
   * Get recent error reports
   */
  getRecentErrors(count: number = 50): ErrorReport[] {
    return Array.from(this.errorReports.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return Array.from(this.errorReports.values())
      .filter(report => report.severity === severity);
  }

  /**
   * Clear old error reports
   */
  clearOldErrors(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    for (const [id, report] of this.errorReports.entries()) {
      if (report.timestamp < cutoff) {
        this.errorReports.delete(id);
      }
    }
  }

  private setupDefaultHandlers(): void {
    // API error handler
    this.registerHandler(ErrorCategory.API, (error, context) => {
      if (error.message.includes('timeout') || error.message.includes('network')) {
        logger.api.warn(context.action || 'unknown', 'API timeout/network error, will retry', { error: error.message });
        return false; // Don't mark as recovered, allow retry
      }
      return false;
    });

    // WebSocket error handler
    this.registerHandler(ErrorCategory.WEBSOCKET, (error, context) => {
      if (error.message.includes('connection') || error.message.includes('WebSocket')) {
        logger.info('WEBSOCKET', 'WebSocket connection error, attempting reconnection', { error: error.message });
        // Trigger reconnection logic here
        return true; // Mark as recovered (reconnection will handle it)
      }
      return false;
    });

    // Strategy error handler
    this.registerHandler(ErrorCategory.STRATEGY, (error, context) => {
      logger.strategy.error(context.action || 'unknown', 'Strategy error occurred', error, context);
      // Strategy errors are usually not recoverable automatically
      return false;
    });
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isRetryableError(error: Error, category: ErrorCategory): boolean {
    const retryableMessages = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'rate limit',
      'service unavailable'
    ];

    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    ) || category === ErrorCategory.NETWORK;
  }

  private logError(report: ErrorReport): void {
    const logLevel = this.getLogLevel(report.severity);
    const message = `${report.category.toUpperCase()} Error: ${report.error.message}`;
    
    switch (logLevel) {
      case 'warn':
        logger.warn('ERROR_SERVICE', message, { report });
        break;
      case 'error':
        logger.error('ERROR_SERVICE', message, report.error, { report });
        break;
      case 'critical':
        logger.critical('ERROR_SERVICE', message, report.error, { report });
        break;
      default:
        logger.info('ERROR_SERVICE', message, { report });
    }
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'critical';
      default:
        return 'info';
    }
  }

  private notifyCriticalError(report: ErrorReport): void {
    // In a real application, this would send notifications to admin/monitoring systems
    logger.critical('ERROR_SERVICE', `CRITICAL ERROR DETECTED: ${report.error.message}`, report.error, { report });
    
    // Could integrate with external services like:
    // - Slack notifications
    // - Email alerts
    // - PagerDuty
    // - Sentry/Rollbar
  }
}

// Export singleton instance
export const errorHandler = ErrorHandlingService.getInstance();