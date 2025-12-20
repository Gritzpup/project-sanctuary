/**
 * DebugLoggingService - Centralized logging and debugging
 *
 * Phase 5C: Backend Monolith Split
 * Extracted to centralize all logging operations with consistent formatting
 * Provides structured logging with timestamps and context
 */

export class DebugLoggingService {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error
    this.enableTimestamps = true;
    this.enableContexts = true;
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(level, context, message) {
    const timestamp = this.enableTimestamps ? `[${new Date().toISOString()}]` : '';
    const contextStr = this.enableContexts && context ? `[${context}]` : '';
    return `${timestamp} ${contextStr} ${message}`.trim();
  }

  /**
   * Debug level logging (verbose)
   */
  debug(context, message, data = null) {
    if (this.logLevel === 'debug') {
      const formatted = this.formatMessage('DEBUG', context, message);
      if (data) {
        console.log(`🔍 ${formatted}`, data);
      } else {
        console.log(`🔍 ${formatted}`);
      }
    }
  }

  /**
   * Info level logging
   */
  info(context, message, data = null) {
    if (['debug', 'info'].includes(this.logLevel)) {
      const formatted = this.formatMessage('INFO', context, message);
      if (data) {
        console.log(`ℹ️ ${formatted}`, data);
      } else {
        console.log(`ℹ️ ${formatted}`);
      }
    }
  }

  /**
   * Warning level logging
   */
  warn(context, message, data = null) {
    const formatted = this.formatMessage('WARN', context, message);
    if (data) {
      console.warn(`⚠️ ${formatted}`, data);
    } else {
      console.warn(`⚠️ ${formatted}`);
    }
  }

  /**
   * Error level logging
   */
  error(context, message, error = null) {
    const formatted = this.formatMessage('ERROR', context, message);
    if (error instanceof Error) {
      console.error(`❌ ${formatted}`, {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
    } else if (error) {
      console.error(`❌ ${formatted}`, error);
    } else {
      console.error(`❌ ${formatted}`);
    }
  }

  /**
   * Success logging (special case)
   */
  success(context, message) {
    const formatted = this.formatMessage('SUCCESS', context, message);
    console.log(`✅ ${formatted}`);
  }

  /**
   * Startup logging
   */
  startup(message) {
    console.log(`🚀 ${message}`);
  }

  /**
   * Get current log level
   */
  getLogLevel() {
    return this.logLevel;
  }

  /**
   * Set log level
   */
  setLogLevel(level) {
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      this.logLevel = level;
    }
  }

  /**
   * Toggle timestamps
   */
  setTimestamps(enabled) {
    this.enableTimestamps = enabled;
  }

  /**
   * Toggle context
   */
  setContexts(enabled) {
    this.enableContexts = enabled;
  }
}

export const debugLogger = new DebugLoggingService();
