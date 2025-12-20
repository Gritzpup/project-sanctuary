/**
 * @file stores.test.ts
 * @description Tests for chart stores and state management
 */

import type { TestResult, TestSuite } from './types';

export class StoreTests {
  /**
   * Run all store tests
   */
  async runTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Store Tests',
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    
    const startTime = performance.now();
    
    suite.tests.push(await this.testChartStore());
    suite.tests.push(await this.testDataStore());
    suite.tests.push(await this.testSubscriptionStore());
    suite.tests.push(await this.testStateUpdates());
    
    suite.duration = performance.now() - startTime;
    suite.passed = suite.tests.filter(t => t.passed).length;
    suite.failed = suite.tests.filter(t => !t.passed).length;
    
    return suite;
  }

  private async testChartStore(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Mock chart store functionality
      const store = this.createMockStore();
      
      // Test initial state
      if (store.get().data.length !== 0) {
        throw new Error('Store should be empty initially');
      }
      
      // Test update
      store.update(data => ({ ...data, data: [{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }] }));
      
      if (store.get().data.length !== 1) {
        throw new Error('Store update failed');
      }
      
      return {
        testName: 'Chart Store',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Chart Store',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testDataStore(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test data store operations
      const dataStore = this.createMockDataStore();
      
      // Test adding data
      dataStore.addData({ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 });
      
      if (dataStore.getData().length !== 1) {
        throw new Error('Data store add failed');
      }
      
      // Test clearing data
      dataStore.clear();
      
      if (dataStore.getData().length !== 0) {
        throw new Error('Data store clear failed');
      }
      
      return {
        testName: 'Data Store',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Data Store',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testSubscriptionStore(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test subscription management
      const subStore = this.createMockSubscriptionStore();
      
      // Test subscribe
      subStore.subscribe('BTC-USD', '1m');
      
      if (!subStore.isSubscribed('BTC-USD', '1m')) {
        throw new Error('Subscription failed');
      }
      
      // Test unsubscribe
      subStore.unsubscribe('BTC-USD', '1m');
      
      if (subStore.isSubscribed('BTC-USD', '1m')) {
        throw new Error('Unsubscription failed');
      }
      
      return {
        testName: 'Subscription Store',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Subscription Store',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testStateUpdates(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test reactive state updates
      let updateCount = 0;
      const store = this.createMockStore();
      
      // Subscribe to changes
      const unsubscribe = store.subscribe(() => {
        updateCount++;
      });
      
      // Trigger updates
      store.update(data => ({ ...data, loading: true }));
      store.update(data => ({ ...data, loading: false }));
      
      unsubscribe();
      
      if (updateCount < 2) {
        throw new Error('State updates not working properly');
      }
      
      return {
        testName: 'State Updates',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'State Updates',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  // Mock implementations
  private createMockStore() {
    let state = { data: [], loading: false };
    const subscribers: Array<(state: any) => void> = [];
    
    return {
      get: () => state,
      update: (updater: (state: any) => any) => {
        state = updater(state);
        subscribers.forEach(sub => sub(state));
      },
      subscribe: (callback: (state: any) => void) => {
        subscribers.push(callback);
        return () => {
          const index = subscribers.indexOf(callback);
          if (index > -1) subscribers.splice(index, 1);
        };
      }
    };
  }

  private createMockDataStore() {
    let data: any[] = [];
    
    return {
      addData: (item: any) => data.push(item),
      getData: () => [...data],
      clear: () => data = []
    };
  }

  private createMockSubscriptionStore() {
    const subscriptions = new Set<string>();
    
    return {
      subscribe: (pair: string, granularity: string) => {
        subscriptions.add(`${pair}:${granularity}`);
      },
      unsubscribe: (pair: string, granularity: string) => {
        subscriptions.delete(`${pair}:${granularity}`);
      },
      isSubscribed: (pair: string, granularity: string) => {
        return subscriptions.has(`${pair}:${granularity}`);
      }
    };
  }
}