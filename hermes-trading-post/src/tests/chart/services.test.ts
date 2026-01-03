/**
 * @file services.test.ts
 * @description Tests for chart services
 */

import type { TestResult, TestSuite } from './types';

export class ServiceTests {
  /**
   * Run all service tests
   */
  async runTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Service Tests',
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    
    const startTime = performance.now();
    
    suite.tests.push(await this.testWebSocketService());
    suite.tests.push(await this.testDataService());
    suite.tests.push(await this.testCacheService());
    suite.tests.push(await this.testErrorHandling());
    
    suite.duration = performance.now() - startTime;
    suite.passed = suite.tests.filter(t => t.passed).length;
    suite.failed = suite.tests.filter(t => !t.passed).length;
    
    return suite;
  }

  private async testWebSocketService(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const wsService = this.createMockWebSocketService();
      
      // Test connection
      await wsService.connect();
      
      if (!wsService.isConnected()) {
        throw new Error('WebSocket connection failed');
      }
      
      // Test subscription
      wsService.subscribe('BTC-USD', '1m');
      
      if (!wsService.isSubscribed('BTC-USD', '1m')) {
        throw new Error('WebSocket subscription failed');
      }
      
      // Test disconnect
      wsService.disconnect();
      
      if (wsService.isConnected()) {
        throw new Error('WebSocket disconnect failed');
      }
      
      return {
        testName: 'WebSocket Service',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'WebSocket Service',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testDataService(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const dataService = this.createMockDataService();
      
      // Test data fetching
      const data = await dataService.fetchData('BTC-USD', '1m', 100);
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data service fetch failed');
      }
      
      // Test data validation
      const isValid = dataService.validateData(data);
      
      if (!isValid) {
        throw new Error('Data validation failed');
      }
      
      return {
        testName: 'Data Service',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Data Service',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testCacheService(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const cacheService = this.createMockCacheService();
      
      // Test cache set
      const testData = [{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }];
      await cacheService.set('test-key', testData);
      
      // Test cache get
      const cachedData = await cacheService.get('test-key');
      
      if (!cachedData || cachedData.length !== testData.length) {
        throw new Error('Cache service failed');
      }
      
      // Test cache clear
      await cacheService.clear('test-key');
      const clearedData = await cacheService.get('test-key');
      
      if (clearedData !== null) {
        throw new Error('Cache clear failed');
      }
      
      return {
        testName: 'Cache Service',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Cache Service',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testErrorHandling(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const errorService = this.createMockErrorService();
      
      // Test error handling
      let errorCaught = false;
      try {
        await errorService.simulateError();
      } catch (error) {
        errorCaught = true;
      }
      
      if (!errorCaught) {
        throw new Error('Error handling not working');
      }
      
      // Test error recovery
      const recovered = await errorService.recover();
      
      if (!recovered) {
        throw new Error('Error recovery failed');
      }
      
      return {
        testName: 'Error Handling',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Error Handling',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  // Mock implementations
  private createMockWebSocketService() {
    let connected = false;
    const subscriptions = new Set<string>();
    
    return {
      connect: async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
        connected = true;
      },
      disconnect: () => {
        connected = false;
        subscriptions.clear();
      },
      isConnected: () => connected,
      subscribe: (pair: string, granularity: string) => {
        if (connected) {
          subscriptions.add(`${pair}:${granularity}`);
        }
      },
      isSubscribed: (pair: string, granularity: string) => {
        return subscriptions.has(`${pair}:${granularity}`);
      }
    };
  }

  private createMockDataService() {
    return {
      fetchData: async (pair: string, granularity: string, count: number) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
        
        const data = [];
        let time = Date.now() / 1000 - count * 60;
        
        for (let i = 0; i < count; i++) {
          data.push({
            time: time + i * 60,
            open: 100 + Math.random() * 10,
            high: 110 + Math.random() * 10,
            low: 90 + Math.random() * 10,
            close: 100 + Math.random() * 10,
            volume: Math.random() * 1000
          });
        }
        
        return data;
      },
      validateData: (data: any[]) => {
        return Array.isArray(data) && data.every(item => 
          typeof item.time === 'number' &&
          typeof item.open === 'number' &&
          typeof item.high === 'number' &&
          typeof item.low === 'number' &&
          typeof item.close === 'number'
        );
      }
    };
  }

  private createMockCacheService() {
    const cache = new Map<string, any>();
    
    return {
      set: async (key: string, value: any) => {
        await new Promise(resolve => setTimeout(resolve, 5)); // Simulate async
        cache.set(key, value);
      },
      get: async (key: string) => {
        await new Promise(resolve => setTimeout(resolve, 5)); // Simulate async
        return cache.get(key) || null;
      },
      clear: async (key: string) => {
        await new Promise(resolve => setTimeout(resolve, 5)); // Simulate async
        cache.delete(key);
      }
    };
  }

  private createMockErrorService() {
    return {
      simulateError: async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
        throw new Error('Simulated error');
      },
      recover: async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
        return true;
      }
    };
  }
}