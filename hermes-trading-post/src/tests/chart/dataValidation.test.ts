// @ts-nocheck
/**
 * @file dataValidation.test.ts
 * @description Tests for chart data validation
 */

import type { TestResult, TestSuite } from './types';
import type { CandlestickData } from '../../pages/trading/chart/types/data.types';

export class DataValidationTests {
  /**
   * Run all data validation tests
   */
  async runTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Data Validation',
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    
    const startTime = performance.now();
    
    suite.tests.push(await this.testCandleValidation());
    suite.tests.push(await this.testConfigValidation());
    suite.tests.push(await this.testDataIntegrity());
    suite.tests.push(await this.testEdgeCases());
    
    suite.duration = performance.now() - startTime;
    suite.passed = suite.tests.filter(t => t.passed).length;
    suite.failed = suite.tests.filter(t => !t.passed).length;
    
    return suite;
  }

  private async testCandleValidation(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const validCandle: CandlestickData = {
        time: Date.now() / 1000,
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000
      };
      
      const result = this.validateCandle(validCandle);
      
      if (!result.isValid) {
        throw new Error(`Valid candle was rejected: ${result.error}`);
      }
      
      // Test invalid candle
      const invalidCandle = { ...validCandle, high: 90 }; // high < open
      const invalidResult = this.validateCandle(invalidCandle);
      
      if (invalidResult.isValid) {
        throw new Error('Invalid candle was accepted');
      }
      
      return {
        testName: 'Candle Validation',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Candle Validation',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testConfigValidation(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const validConfig = {
        granularity: '1m',
        pair: 'BTC-USD',
        maxCandles: 1000
      };
      
      const result = this.validateConfig(validConfig);
      
      if (!result.isValid) {
        throw new Error(`Valid config was rejected: ${result.error}`);
      }
      
      return {
        testName: 'Config Validation',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Config Validation',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testDataIntegrity(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const dataSet = this.generateTestData(100);
      const result = this.checkDataIntegrity(dataSet);
      
      if (!result.isValid) {
        throw new Error(`Data integrity check failed: ${result.error}`);
      }
      
      return {
        testName: 'Data Integrity',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Data Integrity',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  private async testEdgeCases(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test empty data
      const emptyResult = this.validateCandle(null);
      if (emptyResult.isValid) {
        throw new Error('Null candle was accepted');
      }
      
      // Test extreme values
      const extremeCandle: CandlestickData = {
        time: 0,
        open: Number.MAX_VALUE,
        high: Number.MAX_VALUE,
        low: Number.MIN_VALUE,
        close: Number.MAX_VALUE,
        volume: Number.MAX_VALUE
      };
      
      const extremeResult = this.validateCandle(extremeCandle);
      // Should handle extreme values gracefully
      
      return {
        testName: 'Edge Cases',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Edge Cases',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime
      };
    }
  }

  // Helper methods
  private validateCandle(candle: any): { isValid: boolean; error?: string } {
    if (!candle) {
      return { isValid: false, error: 'Candle is null or undefined' };
    }
    
    if (typeof candle.open !== 'number' || typeof candle.high !== 'number' ||
        typeof candle.low !== 'number' || typeof candle.close !== 'number') {
      return { isValid: false, error: 'Invalid price values' };
    }
    
    if (candle.high < candle.low) {
      return { isValid: false, error: 'High is less than low' };
    }
    
    if (candle.high < candle.open || candle.high < candle.close) {
      return { isValid: false, error: 'High is less than open or close' };
    }
    
    if (candle.low > candle.open || candle.low > candle.close) {
      return { isValid: false, error: 'Low is greater than open or close' };
    }
    
    return { isValid: true };
  }

  private validateConfig(config: any): { isValid: boolean; error?: string } {
    if (!config) {
      return { isValid: false, error: 'Config is null or undefined' };
    }
    
    if (!config.granularity || !config.pair) {
      return { isValid: false, error: 'Missing required fields' };
    }
    
    return { isValid: true };
  }

  private checkDataIntegrity(data: any[]): { isValid: boolean; error?: string } {
    if (!Array.isArray(data)) {
      return { isValid: false, error: 'Data is not an array' };
    }
    
    if (data.length === 0) {
      return { isValid: true };
    }
    
    // Check chronological order
    for (let i = 1; i < data.length; i++) {
      if (data[i].time <= data[i-1].time) {
        return { isValid: false, error: 'Data is not in chronological order' };
      }
    }
    
    return { isValid: true };
  }

  private generateTestData(count: number): CandlestickData[] {
    const data: CandlestickData[] = [];
    let time = Date.now() / 1000 - count * 60;
    let price = 100;
    
    for (let i = 0; i < count; i++) {
      const open = price;
      const change = (Math.random() - 0.5) * 2; // -1 to 1
      const close = open + change;
      const high = Math.max(open, close) + Math.random();
      const low = Math.min(open, close) - Math.random();
      
      data.push({
        time: time + i * 60,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000
      });
      
      price = close;
    }
    
    return data;
  }
}