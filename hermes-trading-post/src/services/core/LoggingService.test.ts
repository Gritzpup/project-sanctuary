import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggingService, LogLevel, logger } from './LoggingService';

describe('LoggingService', () => {
  let loggingService: LoggingService;

  beforeEach(() => {
    // Get fresh instance for each test
    loggingService = LoggingService.getInstance();
    loggingService.clearLogs();
  });

  it('should be a singleton', () => {
    const instance1 = LoggingService.getInstance();
    const instance2 = LoggingService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should export logger singleton', () => {
    expect(logger).toBeInstanceOf(LoggingService);
  });

  it('should log messages with proper structure', () => {
    const spy = vi.spyOn(console, 'info');
    
    loggingService.info('TEST', 'Test message', { data: 'test' });
    
    expect(spy).toHaveBeenCalled();
    const logs = loggingService.getRecentLogs(1);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: LogLevel.INFO,
      category: 'TEST',
      message: 'Test message',
      data: { data: 'test' }
    });
  });

  it('should respect log levels', () => {
    loggingService.setLogLevel(LogLevel.WARN);
    
    const debugSpy = vi.spyOn(console, 'debug');
    const warnSpy = vi.spyOn(console, 'warn');
    
    loggingService.debug('TEST', 'Debug message');
    loggingService.warn('TEST', 'Warn message');
    
    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should maintain log history', () => {
    loggingService.info('TEST', 'Message 1');
    loggingService.warn('TEST', 'Message 2');
    loggingService.error('TEST', 'Message 3');
    
    const logs = loggingService.getRecentLogs();
    expect(logs).toHaveLength(3);
    expect(logs[0].message).toBe('Message 1');
    expect(logs[1].message).toBe('Message 2');
    expect(logs[2].message).toBe('Message 3');
  });

  it('should clear logs', () => {
    loggingService.info('TEST', 'Message');
    expect(loggingService.getRecentLogs()).toHaveLength(1);
    
    loggingService.clearLogs();
    expect(loggingService.getRecentLogs()).toHaveLength(0);
  });

  describe('Helper methods', () => {
    it('should provide strategy logging helpers', () => {
      const spy = vi.spyOn(console, 'info');
      
      loggingService.strategy.info('TestStrategy', 'Strategy message');
      
      expect(spy).toHaveBeenCalled();
      const logs = loggingService.getRecentLogs(1);
      expect(logs[0].category).toBe('STRATEGY');
      expect(logs[0].message).toBe('[TestStrategy] Strategy message');
    });

    it('should provide trading logging helpers', () => {
      const spy = vi.spyOn(console, 'info');
      
      loggingService.trading.info('Trade executed');
      
      expect(spy).toHaveBeenCalled();
      const logs = loggingService.getRecentLogs(1);
      expect(logs[0].category).toBe('TRADING');
      expect(logs[0].message).toBe('Trade executed');
    });

    it('should provide API logging helpers', () => {
      const spy = vi.spyOn(console, 'warn');
      
      loggingService.api.warn('/api/test', 'API warning');
      
      expect(spy).toHaveBeenCalled();
      const logs = loggingService.getRecentLogs(1);
      expect(logs[0].category).toBe('API');
      expect(logs[0].message).toBe('[/api/test] API warning');
    });
  });
});