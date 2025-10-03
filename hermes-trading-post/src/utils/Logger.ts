/**
 * @file Logger.ts
 * @description Centralized logging service with configurable levels
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  data?: any;
}

class LoggerService {
  private currentLevel: LogLevel = LogLevel.INFO;
  private isDevelopment: boolean = import.meta.env.DEV || false;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel;
  }

  private formatMessage(source: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] [${source}] ${message}${dataStr}`;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest entry
    }
  }

  error(source: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      source,
      message,
      data
    };
    
    this.addToBuffer(entry);
    
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(source, message, data));
    }
  }

  warn(source: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.WARN,
      source,
      message,
      data
    };
    
    this.addToBuffer(entry);
    
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(source, message, data));
    }
  }

  info(source: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      source,
      message,
      data
    };
    
    this.addToBuffer(entry);
    
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(source, message, data));
    }
  }

  debug(source: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      source,
      message,
      data
    };
    
    this.addToBuffer(entry);
    
    if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(source, message, data));
    }
  }

  // Performance logging
  performance(source: string, operation: string, timeMs: number, data?: any): void {
    const message = `${operation} completed in ${timeMs}ms`;
    if (timeMs > 1000) {
      this.warn(source, `SLOW: ${message}`, data);
    } else {
      this.debug(source, message, data);
    }
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Clear log buffer
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs for analysis
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create singleton instance
export const Logger = new LoggerService();

// Set log level based on environment
if (import.meta.env.DEV) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}