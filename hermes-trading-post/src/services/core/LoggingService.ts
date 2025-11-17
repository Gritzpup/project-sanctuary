/**
 * Centralized logging service for the Hermes Trading Post
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  error?: Error;
}

export class LoggingService {
  private static instance: LoggingService;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private constructor() {
    // Set log level based on environment
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      this.logLevel = LogLevel.DEBUG;
    }
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      error
    };
  }

  private log(entry: LogEntry): void {
    // Add to internal log store
    this.logs.push(entry);
    
    // Trim logs if we exceed max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console with proper formatting
    const logMessage = `[${entry.timestamp}] [${LogLevel[entry.level]}] [${entry.category}] ${entry.message}`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        break;
      case LogLevel.INFO:
        break;
      case LogLevel.WARN:
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        break;
    }
  }

  // Public logging methods
  debug(category: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(this.createLogEntry(LogLevel.DEBUG, category, message, data));
    }
  }

  info(category: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(this.createLogEntry(LogLevel.INFO, category, message, data));
    }
  }

  warn(category: string, message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(this.createLogEntry(LogLevel.WARN, category, message, data));
    }
  }

  error(category: string, message: string, error?: Error, data?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(this.createLogEntry(LogLevel.ERROR, category, message, data, error));
    }
  }

  critical(category: string, message: string, error?: Error, data?: unknown): void {
    if (this.shouldLog(LogLevel.CRITICAL)) {
      this.log(this.createLogEntry(LogLevel.CRITICAL, category, message, data, error));
    }
  }

  // Utility methods
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs(): void {
    this.logs = [];
  }

  // Strategy-specific logging helpers
  strategy = {
    info: (strategyName: string, message: string, data?: unknown) => 
      this.info('STRATEGY', `[${strategyName}] ${message}`, data),
    
    warn: (strategyName: string, message: string, data?: unknown) => 
      this.warn('STRATEGY', `[${strategyName}] ${message}`, data),
    
    error: (strategyName: string, message: string, error?: Error, data?: unknown) => 
      this.error('STRATEGY', `[${strategyName}] ${message}`, error, data)
  };

  // Trading-specific logging helpers
  trading = {
    info: (message: string, data?: unknown) => 
      this.info('TRADING', message, data),
    
    warn: (message: string, data?: unknown) => 
      this.warn('TRADING', message, data),
    
    error: (message: string, error?: Error, data?: unknown) => 
      this.error('TRADING', message, error, data)
  };

  // API-specific logging helpers
  api = {
    info: (endpoint: string, message: string, data?: unknown) => 
      this.info('API', `[${endpoint}] ${message}`, data),
    
    warn: (endpoint: string, message: string, data?: unknown) => 
      this.warn('API', `[${endpoint}] ${message}`, data),
    
    error: (endpoint: string, message: string, error?: Error, data?: unknown) => 
      this.error('API', `[${endpoint}] ${message}`, error, data)
  };
}

// Export singleton instance
export const logger = LoggingService.getInstance();