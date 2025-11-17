#!/usr/bin/env node

/**
 * Test Runner for Chart Components
 * Run with: npx ts-node src/pages/trading/chart/tests/runTests.ts
 */

import { ChartTestRunner } from './chartTestSuite';

async function main() {
  
  const testRunner = new ChartTestRunner();
  
  try {
    await testRunner.runAllTests();
  } catch (error) {
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}