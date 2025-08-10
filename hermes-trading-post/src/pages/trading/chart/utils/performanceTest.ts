// Performance test utility to measure chart loading times
export class PerformanceTest {
  private markers: Map<string, number> = new Map();
  private measurements: Array<{ name: string; duration: number }> = [];

  mark(name: string) {
    this.markers.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string) {
    const start = this.markers.get(startMark);
    const end = endMark ? this.markers.get(endMark) : performance.now();
    
    if (start && end) {
      const duration = end - start;
      this.measurements.push({ name, duration });
      console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  }

  getReport() {
    const total = this.measurements.reduce((sum, m) => sum + m.duration, 0);
    console.log('\n=== Performance Report ===');
    this.measurements.forEach(m => {
      console.log(`${m.name}: ${m.duration.toFixed(2)}ms (${((m.duration / total) * 100).toFixed(1)}%)`);
    });
    console.log(`Total: ${total.toFixed(2)}ms`);
    console.log('========================\n');
    return { measurements: this.measurements, total };
  }

  reset() {
    this.markers.clear();
    this.measurements = [];
  }
}

export const perfTest = new PerformanceTest();