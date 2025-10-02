/**
 * @file components.test.ts
 * @description Tests for chart components
 */

import type { TestResult, TestSuite } from './types';

export class ComponentTests {
  /**
   * Run all component tests
   */
  async runTests(): Promise<TestSuite> {
    const suite: TestSuite = {
      name: 'Component Tests',
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    
    const startTime = performance.now();
    
    suite.tests.push(await this.testChartComponent());
    suite.tests.push(await this.testControlsComponent());
    suite.tests.push(await this.testOverlaysComponent());
    suite.tests.push(await this.testIntegration());
    
    suite.duration = performance.now() - startTime;
    suite.passed = suite.tests.filter(t => t.passed).length;
    suite.failed = suite.tests.filter(t => !t.passed).length;
    
    return suite;
  }

  private async testChartComponent(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const chartComponent = this.createMockChartComponent();
      
      // Test initialization
      chartComponent.init();
      
      if (!chartComponent.isInitialized()) {
        throw new Error('Chart component initialization failed');
      }
      
      // Test data update
      const testData = [{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }];
      chartComponent.updateData(testData);
      
      if (chartComponent.getDataLength() !== 1) {
        throw new Error('Chart component data update failed');
      }
      
      // Test resize
      chartComponent.resize(800, 600);
      const size = chartComponent.getSize();
      
      if (size.width !== 800 || size.height !== 600) {
        throw new Error('Chart component resize failed');
      }
      
      return {
        testName: 'Chart Component',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Chart Component',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testControlsComponent(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const controlsComponent = this.createMockControlsComponent();
      
      // Test granularity change
      controlsComponent.setGranularity('5m');
      
      if (controlsComponent.getGranularity() !== '5m') {
        throw new Error('Controls granularity change failed');
      }
      
      // Test pair change
      controlsComponent.setPair('ETH-USD');
      
      if (controlsComponent.getPair() !== 'ETH-USD') {
        throw new Error('Controls pair change failed');
      }
      
      // Test event handling
      let eventFired = false;
      controlsComponent.onGranularityChange(() => {
        eventFired = true;
      });
      
      controlsComponent.setGranularity('1h');
      
      if (!eventFired) {
        throw new Error('Controls event handling failed');
      }
      
      return {
        testName: 'Controls Component',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Controls Component',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testOverlaysComponent(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      const overlaysComponent = this.createMockOverlaysComponent();
      
      // Test showing overlay
      overlaysComponent.showOverlay('loading');
      
      if (!overlaysComponent.isOverlayVisible('loading')) {
        throw new Error('Overlay show failed');
      }
      
      // Test hiding overlay
      overlaysComponent.hideOverlay('loading');
      
      if (overlaysComponent.isOverlayVisible('loading')) {
        throw new Error('Overlay hide failed');
      }
      
      // Test multiple overlays
      overlaysComponent.showOverlay('error');
      overlaysComponent.showOverlay('warning');
      
      if (overlaysComponent.getVisibleOverlays().length !== 2) {
        throw new Error('Multiple overlays failed');
      }
      
      return {
        testName: 'Overlays Component',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Overlays Component',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  private async testIntegration(): Promise<TestResult> {
    const startTime = performance.now();
    try {
      // Test component integration
      const chart = this.createMockChartComponent();
      const controls = this.createMockControlsComponent();
      
      chart.init();
      
      // Test controls affecting chart
      controls.onGranularityChange((granularity) => {
        chart.setGranularity(granularity);
      });
      
      controls.setGranularity('1h');
      
      if (chart.getGranularity() !== '1h') {
        throw new Error('Component integration failed');
      }
      
      return {
        testName: 'Component Integration',
        passed: true,
        duration: performance.now() - startTime
      };
    } catch (error) {
      return {
        testName: 'Component Integration',
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  // Mock implementations
  private createMockChartComponent() {
    let initialized = false;
    let data: any[] = [];
    let size = { width: 400, height: 300 };
    let granularity = '1m';
    
    return {
      init: () => { initialized = true; },
      isInitialized: () => initialized,
      updateData: (newData: any[]) => { data = newData; },
      getDataLength: () => data.length,
      resize: (width: number, height: number) => { size = { width, height }; },
      getSize: () => size,
      setGranularity: (g: string) => { granularity = g; },
      getGranularity: () => granularity
    };
  }

  private createMockControlsComponent() {
    let granularity = '1m';
    let pair = 'BTC-USD';
    const listeners: Array<(g: string) => void> = [];
    
    return {
      setGranularity: (g: string) => {
        granularity = g;
        listeners.forEach(listener => listener(g));
      },
      getGranularity: () => granularity,
      setPair: (p: string) => { pair = p; },
      getPair: () => pair,
      onGranularityChange: (callback: (g: string) => void) => {
        listeners.push(callback);
      }
    };
  }

  private createMockOverlaysComponent() {
    const visibleOverlays = new Set<string>();
    
    return {
      showOverlay: (name: string) => {
        visibleOverlays.add(name);
      },
      hideOverlay: (name: string) => {
        visibleOverlays.delete(name);
      },
      isOverlayVisible: (name: string) => {
        return visibleOverlays.has(name);
      },
      getVisibleOverlays: () => {
        return Array.from(visibleOverlays);
      }
    };
  }
}