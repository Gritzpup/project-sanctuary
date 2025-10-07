/**
 * Structured logging system to replace raw console statements
 * Provides consistent formatting, filtering, and production safety
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: LogContext;
  error?: Error;
}

export class StructuredLogger {
  private static instance: StructuredLogger;
  private logLevel: LogLevel = LogLevel.INFO;
  private isProduction = false;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  private constructor() {
    // Detect environment
    this.isProduction = import.meta.env?.PROD || process.env?.NODE_ENV === 'production';
    
    // Set appropriate log level
    if (this.isProduction) {
      this.logLevel = LogLevel.WARN;
    } else {
      this.logLevel = LogLevel.DEBUG;
    }
  }

  public static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public debug(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  public info(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  public warn(category: string, message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  public error(category: string, message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, category, message, context, error);
  }

  public critical(category: string, message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.CRITICAL, category, message, context, error);
    
    // In production, you might want to send critical errors to monitoring service
    if (this.isProduction) {
      this.sendToMonitoring(LogLevel.CRITICAL, category, message, error, context);
    }
  }

  private log(
    level: LogLevel, 
    category: string, 
    message: string, 
    context?: LogContext, 
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
      error
    };

    // Add to buffer for retrieval
    this.addToBuffer(logEntry);

    // Format and output
    this.outputLog(logEntry);
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  private outputLog(entry: LogEntry): void {
    const formattedMessage = this.formatLogMessage(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        if (entry.error) {
          console.error(formattedMessage, entry.error);
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }

  private formatLogMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    
    let message = `[${timestamp}] [${levelName}] [${entry.category}] ${entry.message}`;
    
    if (entry.context) {
      const contextStr = this.formatContext(entry.context);
      if (contextStr) {
        message += ` ${contextStr}`;
      }
    }
    
    return message;
  }

  private formatContext(context: LogContext): string {
    const parts: string[] = [];
    
    if (context.component) {
      parts.push(`component=${context.component}`);
    }
    
    if (context.action) {
      parts.push(`action=${context.action}`);
    }
    
    if (context.duration !== undefined) {
      parts.push(`duration=${context.duration}ms`);
    }
    
    if (context.userId) {
      parts.push(`userId=${context.userId}`);
    }
    
    if (context.sessionId) {
      parts.push(`sessionId=${context.sessionId}`);
    }
    
    if (context.metadata) {
      try {
        parts.push(`metadata=${JSON.stringify(context.metadata)}`);
      } catch {
        parts.push('metadata=[unserializable]');
      }
    }
    
    return parts.length > 0 ? `{${parts.join(', ')}}` : '';
  }

  private sendToMonitoring(
    level: LogLevel,
    category: string,
    message: string,
    error?: Error,
    context?: LogContext
  ): void {
    // In a real application, this would send to external monitoring
    // Examples: Sentry, DataDog, New Relic, custom endpoint
    
    const monitoringData = {
      level: LogLevel[level],
      category,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };
    
    // For now, just store in local storage for debugging
    try {
      const existingLogs = JSON.parse(localStorage.getItem('hermes-error-logs') || '[]');
      existingLogs.push(monitoringData);
      
      // Keep only last 50 critical errors
      const limitedLogs = existingLogs.slice(-50);
      localStorage.setItem('hermes-error-logs', JSON.stringify(limitedLogs));
    } catch {
      // Fail silently if localStorage is not available
    }
  }

  // Utility methods for retrieving logs
  public getRecentLogs(count = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level === level);
  }

  public getLogsByCategory(category: string): LogEntry[] {
    return this.logBuffer.filter(entry => entry.category === category);
  }

  public clearLogs(): void {
    this.logBuffer = [];
  }

  // Helper methods for common logging patterns
  public performance = {
    start: (category: string, action: string, context?: LogContext) => {
      const startTime = performance.now();
      return {
        end: (message?: string) => {
          const duration = Math.round(performance.now() - startTime);
          this.info(category, message || `${action} completed`, {
            ...context,
            action,
            duration
          });
        }
      };
    }
  };

  public api = {
    request: (endpoint: string, method: string, context?: LogContext) => {
      this.debug('API', `${method} ${endpoint}`, { ...context, action: 'request' });
    },
    
    response: (endpoint: string, method: string, status: number, duration: number, context?: LogContext) => {
      const level = status >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
      this.log(level, 'API', `${method} ${endpoint} - ${status}`, {
        ...context,
        action: 'response',
        duration,
        metadata: { status }
      });
    },
    
    error: (endpoint: string, method: string, error: Error, context?: LogContext) => {
      this.error('API', `${method} ${endpoint} failed`, error, { ...context, action: 'error' });
    }
  };

  public trading = {
    action: (action: string, details?: Record<string, unknown>, context?: LogContext) => {
      this.info('TRADING', `Trading action: ${action}`, {
        ...context,
        action,
        metadata: details
      });
    },
    
    error: (action: string, error: Error, context?: LogContext) => {
      this.error('TRADING', `Trading error in ${action}`, error, { ...context, action });
    }
  };

  public strategy = {
    info: (strategyName: string, message: string, context?: LogContext) => {
      this.info('STRATEGY', `[${strategyName}] ${message}`, { ...context, component: strategyName });
    },
    
    warn: (strategyName: string, message: string, context?: LogContext) => {
      this.warn('STRATEGY', `[${strategyName}] ${message}`, { ...context, component: strategyName });
    },
    
    error: (strategyName: string, message: string, error?: Error, context?: LogContext) => {
      this.error('STRATEGY', `[${strategyName}] ${message}`, error, { ...context, component: strategyName });
    }
  };

  public chart = {
    info: (message: string, context?: LogContext) => {
      this.info('CHART', message, context);
    },
    
    warn: (message: string, context?: LogContext) => {
      this.warn('CHART', message, context);
    },
    
    error: (message: string, error?: Error, context?: LogContext) => {
      this.error('CHART', message, error, context);
    }
  };
}

// Export singleton instance
export const structuredLogger = StructuredLogger.getInstance();

// Legacy compatibility - can be used to gradually replace console statements
export const logger = {
  debug: (category: string, message: string, context?: LogContext) => 
    structuredLogger.debug(category, message, context),
  
  info: (category: string, message: string, context?: LogContext) => 
    structuredLogger.info(category, message, context),
  
  warn: (category: string, message: string, context?: LogContext) => 
    structuredLogger.warn(category, message, context),
  
  error: (category: string, message: string, error?: Error, context?: LogContext) => 
    structuredLogger.error(category, message, error, context),
  
  critical: (category: string, message: string, error?: Error, context?: LogContext) => 
    structuredLogger.critical(category, message, error, context)
};