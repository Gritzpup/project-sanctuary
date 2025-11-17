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
      return duration;
    }
    return 0;
  }

  getReport() {
    const total = this.measurements.reduce((sum, m) => sum + m.duration, 0);
    this.measurements.forEach(m => {
    });
    return { measurements: this.measurements, total };
  }

  reset() {
    this.markers.clear();
    this.measurements = [];
  }
}

export const perfTest = new PerformanceTest();