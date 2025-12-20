/**
 * @file testRunner.ts
 * @description Main test runner for chart test suite
 */

import type { TestSuite } from './types';
import { UtilityTests } from './utilities.test';
import { DataValidationTests } from './dataValidation.test';
import { StoreTests } from './stores.test';
import { ServiceTests } from './services.test';
import { ComponentTests } from './components.test';
import { E2ETests } from './e2e.test';

export class ChartTestRunner {
  private results: TestSuite[] = [];
  
  /**
   * Run all chart tests
   */
  async runAllTests(): Promise<void> {
    // PERF: Disabled - console.log('🧪 Starting Chart Test Suite...\n');
    
    // Utility Tests
    const utilityTests = new UtilityTests();
    this.results.push(await utilityTests.runTests());
    
    // Data Validation Tests  
    const dataValidationTests = new DataValidationTests();
    this.results.push(await dataValidationTests.runTests());
    
    // Store Tests
    const storeTests = new StoreTests();
    this.results.push(await storeTests.runTests());
    
    // Service Tests
    const serviceTests = new ServiceTests();
    this.results.push(await serviceTests.runTests());
    
    // Component Integration Tests
    const componentTests = new ComponentTests();
    this.results.push(await componentTests.runTests());
    
    // End-to-End Tests
    const e2eTests = new E2ETests();
    this.results.push(await e2eTests.runTests());
    
    this.printResults();
  }
  
  /**
   * Run specific test suite
   */
  async runSpecificSuite(suiteName: string): Promise<void> {
    // PERF: Disabled - console.log(`🧪 Running ${suiteName} tests...\n`);
    
    let suite: TestSuite;
    
    switch (suiteName.toLowerCase()) {
      case 'utility':
        const utilityTests = new UtilityTests();
        suite = await utilityTests.runTests();
        break;
      case 'datavalidation':
        const dataValidationTests = new DataValidationTests();
        suite = await dataValidationTests.runTests();
        break;
      case 'store':
        const storeTests = new StoreTests();
        suite = await storeTests.runTests();
        break;
      case 'service':
        const serviceTests = new ServiceTests();
        suite = await serviceTests.runTests();
        break;
      case 'component':
        const componentTests = new ComponentTests();
        suite = await componentTests.runTests();
        break;
      case 'e2e':
        const e2eTests = new E2ETests();
        suite = await e2eTests.runTests();
        break;
      default:
        // PERF: Disabled - console.error(`Unknown test suite: ${suiteName}`);
        return;
    }
    
    this.results = [suite];
    this.printResults();
  }
  
  /**
   * Print test results
   */
  private printResults(): void {
    // PERF: Disabled - console.log('\n📊 TEST RESULTS\n');
    // PERF: Disabled - console.log('═'.repeat(80));
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    
    this.results.forEach(suite => {
      const passRate = ((suite.passed / (suite.passed + suite.failed)) * 100).toFixed(1);
      const status = suite.failed === 0 ? '✅' : '❌';
      
      // PERF: Disabled - console.log(`${status} ${suite.name}`);
      // PERF: Disabled - console.log(`   Passed: ${suite.passed} | Failed: ${suite.failed} | Pass Rate: ${passRate}%`);
      // PERF: Disabled - console.log(`   Duration: ${suite.duration.toFixed(2)}ms`);
      
      if (suite.failed > 0) {
        suite.tests.filter(t => !t.passed).forEach(test => {
          // PERF: Disabled - console.log(`   ❌ ${test.testName}: ${test.error}`);
        });
      }
      
      // PERF: Disabled - console.log('');
      
      totalTests += suite.passed + suite.failed;
      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalDuration += suite.duration;
    });
    
    // PERF: Disabled - console.log('═'.repeat(80));
    const overallPassRate = ((totalPassed / totalTests) * 100).toFixed(1);
    const overallStatus = totalFailed === 0 ? '✅' : '❌';
    
    // PERF: Disabled - console.log(`${overallStatus} OVERALL RESULTS`);
    // PERF: Disabled - console.log(`Total Tests: ${totalTests}`);
    // PERF: Disabled - console.log(`Passed: ${totalPassed}`);
    // PERF: Disabled - console.log(`Failed: ${totalFailed}`);
    // PERF: Disabled - console.log(`Pass Rate: ${overallPassRate}%`);
    // PERF: Disabled - console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
    // PERF: Disabled - console.log('═'.repeat(80));
    
    if (totalFailed === 0) {
      // PERF: Disabled - console.log('🎉 All tests passed! Chart system is working correctly.');
    } else {
      // PERF: Disabled - console.log(`⚠️  ${totalFailed} test(s) failed. Please review and fix issues.`);
    }
  }
  
  /**
   * Get test results
   */
  getResults(): TestSuite[] {
    return this.results;
  }
  
  /**
   * Check if all tests passed
   */
  allTestsPassed(): boolean {
    return this.results.every(suite => suite.failed === 0);
  }
}

// Export singleton instance
export const chartTestRunner = new ChartTestRunner();