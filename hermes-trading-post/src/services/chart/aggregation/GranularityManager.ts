export class GranularityManager {
  private currentGranularity = '1m';
  private changeCallbacks: ((granularity: string) => void)[] = [];

  public setCurrentGranularity(granularity: string): void {
    if (this.currentGranularity !== granularity) {
      this.currentGranularity = granularity;
      this.notifyChange(granularity);
    }
  }

  public getCurrentGranularity(): string {
    return this.currentGranularity;
  }

  public onGranularityChange(callback: (granularity: string) => void): void {
    this.changeCallbacks.push(callback);
  }

  private notifyChange(granularity: string): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(granularity);
      } catch (error) {
        console.error('Error in granularity change callback:', error);
      }
    });
  }

  public getSupportedGranularities(): string[] {
    return ['1m', '5m', '15m', '1h', '6h', '1d'];
  }

  public isValidGranularity(granularity: string): boolean {
    return this.getSupportedGranularities().includes(granularity);
  }
}