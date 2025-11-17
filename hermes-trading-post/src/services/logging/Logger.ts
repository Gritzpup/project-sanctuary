/**
 * @file Logger.ts
 * @description Structured logging service with environment-based filtering
 *
 * Usage:
 *   import { logger } from '@/services/logging';
 *   logger.info('User logged in', { userId: 123 });
 *   logger.error('Failed to fetch data', { error });
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  source?: string;
}

class Logger {
  private minLevel: LogLevel;
  private enableColors: boolean;
  private enableTimestamps: boolean;
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    // Set log level based on environment
    const env = import.meta.env.MODE || 'development';
    this.minLevel = env === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.enableColors = env === 'development';
    this.enableTimestamps = true;

    // Allow override via environment variable
    const envLogLevel = import.meta.env.VITE_LOG_LEVEL;
    if (envLogLevel) {
      this.minLevel = LogLevel[envLogLevel as keyof typeof LogLevel] ?? this.minLevel;
    }
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Enable/disable colored output
   */
  setColors(enabled: boolean): void {
    this.enableColors = enabled;
  }

  /**
   * Enable/disable timestamps
   */
  setTimestamps(enabled: boolean): void {
    this.enableTimestamps = enabled;
  }

  /**
   * Debug level - detailed diagnostic information
   */
  debug(message: string, context?: LogContext, source?: string): void {
    this.log(LogLevel.DEBUG, message, context, source);
  }

  /**
   * Info level - general informational messages
   */
  info(message: string, context?: LogContext, source?: string): void {
    this.log(LogLevel.INFO, message, context, source);
  }

  /**
   * Warning level - potentially harmful situations
   */
  warn(message: string, context?: LogContext, source?: string): void {
    this.log(LogLevel.WARN, message, context, source);
  }

  /**
   * Error level - error events
   */
  error(message: string, context?: LogContext, source?: string): void {
    this.log(LogLevel.ERROR, message, context, source);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, source?: string): void {
    // Filter by minimum level
    if (level < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    // Create log entry
    const entry: LogEntry = {
      timestamp,
      level: levelName,
      message,
      context,
      source,
    };

    // Add to history
    this.addToHistory(entry);

    // Format and output
    const formattedMessage = this.format(entry);
    this.output(level, formattedMessage, context);
  }

  /**
   * Format log entry for display
   */
  private format(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.enableTimestamps) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      parts.push(`[${time}]`);
    }

    // Level
    parts.push(`[${entry.level}]`);

    // Source
    if (entry.source) {
      parts.push(`[${entry.source}]`);
    }

    // Message
    parts.push(entry.message);

    return parts.join(' ');
  }

  /**
   * Output log entry to console
   */
  private output(level: LogLevel, message: string, context?: LogContext): void {
    const style = this.getStyle(level);

    if (this.enableColors && style) {
    } else {
      switch (level) {
        case LogLevel.DEBUG:
          break;
        case LogLevel.INFO:
          break;
        case LogLevel.WARN:
          break;
        case LogLevel.ERROR:
          break;
      }
    }
  }

  /**
   * Get console style for log level
   */
  private getStyle(level: LogLevel): string | null {
    if (!this.enableColors) return null;

    switch (level) {
      case LogLevel.DEBUG:
        return 'color: #888; font-weight: normal;';
      case LogLevel.INFO:
        return 'color: #2196F3; font-weight: normal;';
      case LogLevel.WARN:
        return 'color: #FF9800; font-weight: bold;';
      case LogLevel.ERROR:
        return 'color: #F44336; font-weight: bold;';
      default:
        return null;
    }
  }

  /**
   * Add entry to history
   */
  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);

    // Trim history if too large
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  /**
   * Get log history
   */
  getHistory(count?: number): LogEntry[] {
    if (count) {
      return this.logHistory.slice(-count);
    }
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Get statistics about logging
   */
  getStats(): {
    total: number;
    byLevel: Record<string, number>;
  } {
    const byLevel: Record<string, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    };

    this.logHistory.forEach((entry) => {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
    });

    return {
      total: this.logHistory.length,
      byLevel,
    };
  }
}

// Create singleton instance
export const logger = new Logger();

// Expose to window for debugging (development only)
if (typeof window !== 'undefined' && import.meta.env.MODE === 'development') {
  (window as any).logger = logger;
}
