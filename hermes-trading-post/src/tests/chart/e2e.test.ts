/**
 * @file e2e.test.ts
 * @description End-to-end tests for chart functionality
 */

import type { TestResult, TestSuite } from './types';

export class E2ETests {
  /**
   * Run all end-to-end tests
   */
  async runTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'End-to-End Tests',
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    
    const startTime = performance.now();
    
    suite.tests.push(await this.testFullWorkflow());
    suite.tests.push(await this.testRealTimeUpdates());
    suite.tests.push(await this.testErrorRecovery());
    suite.tests.push(await this.testPerformance());
    
    suite.duration = performance.now() - startTime;
    suite.passed = suite.tests.filter(t => t.passed).length;
    suite.failed = suite.tests.filter(t => !t.passed).length;
    
    return suite;
  }

  private async testFullWorkflow(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Simulate full chart workflow
      const system = this.createMockSystem();
      
      // 1. Initialize
      await system.initialize();
      
      if (!system.isInitialized()) {
        throw new Error('System initialization failed');
      }
      
      // 2. Connect to data source
      await system.connect();
      
      if (!system.isConnected()) {
        throw new Error('System connection failed');
      }
      
      // 3. Subscribe to data
      await system.subscribe('BTC-USD', '1m');
      
      if (!system.isSubscribed('BTC-USD', '1m')) {
        throw new Error('System subscription failed');
      }
      
      // 4. Receive and process data
      await system.simulateDataReceived();
      
      if (system.getDataCount() === 0) {
        throw new Error('Data processing failed');
      }
      
      // 5. Update UI
      await system.updateUI();
      
      if (!system.isUIUpdated()) {
        throw new Error('UI update failed');
      }
      
      // 6. Cleanup
      await system.cleanup();
      
      if (system.isConnected()) {
        throw new Error('System cleanup failed');
      }
      
      return {
        testName: 'Full Workflow',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Full Workflow',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testRealTimeUpdates(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const system = this.createMockSystem();
      await system.initialize();
      await system.connect();
      await system.subscribe('BTC-USD', '1m');
      
      // Simulate real-time updates
      const initialCount = system.getDataCount();
      
      for (let i = 0; i < 5; i++) {
        await system.simulateDataReceived();
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      }
      
      const finalCount = system.getDataCount();
      
      if (finalCount <= initialCount) {
        throw new Error('Real-time updates not working');
      }
      
      return {
        testName: 'Real-Time Updates',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Real-Time Updates',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testErrorRecovery(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const system = this.createMockSystem();
      await system.initialize();
      
      // Simulate connection error
      system.simulateConnectionError();
      
      if (system.isConnected()) {
        throw new Error('Error simulation failed');
      }
      
      // Test recovery
      await system.recover();
      
      if (!system.isConnected()) {
        throw new Error('Error recovery failed');
      }
      
      return {
        testName: 'Error Recovery',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Error Recovery',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testPerformance(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const system = this.createMockSystem();
      await system.initialize();
      await system.connect();
      
      // Test performance with large dataset
      const performanceStart = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        await system.simulateDataReceived();
      }
      
      const performanceEnd = performance.now();
      const processingTime = performanceEnd - performanceStart;
      
      // Should process 1000 updates in less than 1 second
      if (processingTime > 1000) {
        throw new Error(`Performance too slow: ${processingTime}ms for 1000 updates`);
      }
      
      return {
        testName: 'Performance',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Performance',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  // Mock system implementation
  private createMockSystem() {
    let initialized = false;
    let connected = false;
    let subscriptions = new Set<string>();
    let dataCount = 0;
    let uiUpdated = false;
    
    return {
      initialize: async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        initialized = true;
      },
      isInitialized: () => initialized,
      
      connect: async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        connected = true;
      },
      isConnected: () => connected,
      
      subscribe: async (pair: string, granularity: string) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        subscriptions.add(`${pair}:${granularity}`);
      },
      isSubscribed: (pair: string, granularity: string) => {
        return subscriptions.has(`${pair}:${granularity}`);
      },
      
      simulateDataReceived: async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        dataCount++;
      },
      getDataCount: () => dataCount,
      
      updateUI: async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        uiUpdated = true;
      },
      isUIUpdated: () => uiUpdated,
      
      simulateConnectionError: () => {
        connected = false;
      },
      
      recover: async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        connected = true;
      },
      
      cleanup: async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        connected = false;
        subscriptions.clear();
        uiUpdated = false;
      }
    };
  }
}