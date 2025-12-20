// Basic testing infrastructure for modular components

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface TestSuite {
  name: string;
  tests: (() => Promise<void> | void)[];
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
}

export class TestRunner {
  private static instance: TestRunner;
  private testSuites: Map<string, TestSuite> = new Map();
  private results: TestResult[] = [];

  public static getInstance(): TestRunner {
    if (!TestRunner.instance) {
      TestRunner.instance = new TestRunner();
    }
    return TestRunner.instance;
  }

  public registerSuite(name: string, suite: TestSuite): void {
    this.testSuites.set(name, suite);
  }

  public async runTests(suiteNames?: string[]): Promise<TestResult[]> {
    const suitesToRun = suiteNames || Array.from(this.testSuites.keys());
    this.results = [];

    console.log('🧪 Starting test run...');

    for (const suiteName of suitesToRun) {
      const suite = this.testSuites.get(suiteName);
      if (!suite) {
        console.warn(`Test suite '${suiteName}' not found`);
        continue;
      }

      console.log(`📋 Running test suite: ${suiteName}`);
      await this.runSuite(suite);
    }

    this.printResults();
    return this.results;
  }

  private async runSuite(suite: TestSuite): Promise<void> {
    try {
      // Setup
      if (suite.setup) {
        await suite.setup();
      }

      // Run tests
      for (let i = 0; i < suite.tests.length; i++) {
        const test = suite.tests[i];
        const testName = `${suite.name} - Test ${i + 1}`;
        
        await this.runTest(testName, test);
      }

      // Teardown
      if (suite.teardown) {
        await suite.teardown();
      }

    } catch (error) {
      console.error(`Error in test suite '${suite.name}':`, error);
    }
  }

  private async runTest(name: string, test: () => Promise<void> | void): Promise<void> {
    const startTime = Date.now();
    
    try {
      await test();
      
      const result: TestResult = {
        name,
        passed: true,
        duration: Date.now() - startTime
      };
      
      this.results.push(result);
      console.log(`✅ ${name} (${result.duration}ms)`);
      
    } catch (error) {
      const result: TestResult = {
        name,
        passed: false,
        error: error.message,
        duration: Date.now() - startTime
      };
      
      this.results.push(result);
      console.log(`❌ ${name} (${result.duration}ms): ${error.message}`);
    }
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.length - passed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
  }
}

// Test utilities
export function assert(condition: boolean, message: string = 'Assertion failed'): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

export function assertThrows(fn: () => void, message?: string): void {
  try {
    fn();
    throw new Error(message || 'Expected function to throw');
  } catch (error) {
    // Expected
  }
}