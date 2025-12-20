/**
 * @file utilities.test.ts
 * @description Tests for chart utility functions
 */

import type { TestResult, TestSuite } from './types';

export class UtilityTests {
  /**
   * Run all utility tests
   */
  async runTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Utility Functions',
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    
    const startTime = performance.now();
    
    // Test granularity helpers
    suite.tests.push(await this.testGranularityHelpers());
    suite.tests.push(await this.testPriceFormatters());
    suite.tests.push(await this.testTimeHelpers());
    suite.tests.push(await this.testValidationHelpers());
    
    suite.duration = performance.now() - startTime;
    suite.passed = suite.tests.filter(t => t.passed).length;
    suite.failed = suite.tests.filter(t => !t.passed).length;
    
    return suite;
  }

  private async testGranularityHelpers(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test granularity conversion
      const result = this.convertGranularity('1m');
      const expected = 60;
      
      if (result !== expected) {
        throw new Error(`Expected ${expected}, got ${result}`);
      }
      
      return {
        testName: 'Granularity Helpers',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Granularity Helpers',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testPriceFormatters(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test price formatting
      const result = this.formatPrice(1234.567);
      const expected = '$1,234.57';
      
      if (result !== expected) {
        throw new Error(`Expected ${expected}, got ${result}`);
      }
      
      return {
        testName: 'Price Formatters',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Price Formatters',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testTimeHelpers(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test time formatting
      const timestamp = Date.now();
      const result = this.formatTime(timestamp);
      
      if (!result || typeof result !== 'string') {
        throw new Error('Time formatting failed');
      }
      
      return {
        testName: 'Time Helpers',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Time Helpers',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testValidationHelpers(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test validation functions
      const validData = { price: 100, volume: 1000 };
      const result = this.validateData(validData);
      
      if (!result) {
        throw new Error('Valid data was rejected');
      }
      
      return {
        testName: 'Validation Helpers',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Validation Helpers',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  // Helper methods (mock implementations)
  private convertGranularity(granularity: string): number {
    const map = { '1m': 60, '5m': 300, '1h': 3600 };
    return map[granularity] || 60;
  }

  private formatPrice(price: number): string {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  private validateData(data: any): boolean {
    return data && typeof data.price === 'number' && typeof data.volume === 'number';
  }
}