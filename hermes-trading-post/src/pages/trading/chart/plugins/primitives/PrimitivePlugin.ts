import { Plugin, type PluginConfig } from '../base/Plugin';
import type { IPriceLine, CreatePriceLineOptions } from 'lightweight-charts';

export interface PrimitivePluginConfig extends PluginConfig {
  zIndex?: number;
}

export abstract class PrimitivePlugin extends Plugin {
  protected primitives: Map<string, any> = new Map();
  protected zIndex: number;

  constructor(config: PrimitivePluginConfig) {
    super(config);
    this.zIndex = config.zIndex || 0;
  }

  protected async onInitialize(): Promise<void> {
    await this.setupPrimitives();
    this.subscribeToUpdates();
  }

  protected async onDestroy(): Promise<void> {
    this.unsubscribeFromUpdates();
    this.removeAllPrimitives();
  }

  protected onEnable(): void {
    this.showAllPrimitives();
  }

  protected onDisable(): void {
    this.hideAllPrimitives();
  }

  protected onSettingsUpdate(oldSettings: Record<string, any>, newSettings: Record<string, any>): void {
    this.updatePrimitives();
  }

  // Primitive management
  protected createPriceLine(id: string, options: CreatePriceLineOptions): IPriceLine | null {
    const chart = this.getChart();
    const series = this.getChartStore().chartInstance?.series;
    
    if (!series) {
      return null;
    }

    const priceLine = series.createPriceLine(options);
    this.primitives.set(id, priceLine);
    
    return priceLine;
  }

  protected removePriceLine(id: string): void {
    const priceLine = this.primitives.get(id);
    const series = this.getChartStore().chartInstance?.series;
    
    if (priceLine && series) {
      series.removePriceLine(priceLine);
      this.primitives.delete(id);
    }
  }

  protected createMarker(id: string, marker: any): void {
    const series = this.getChartStore().chartInstance?.series;
    
    if (!series) {
      return;
    }

    // Store marker data
    this.primitives.set(id, marker);
    
    // Update series markers
    this.updateSeriesMarkers();
  }

  protected removeMarker(id: string): void {
    if (this.primitives.has(id)) {
      this.primitives.delete(id);
      this.updateSeriesMarkers();
    }
  }

  protected updateSeriesMarkers(): void {
    const series = this.getChartStore().chartInstance?.series;
    if (!series) return;

    const markers = Array.from(this.primitives.entries())
      .filter(([key, value]) => key.startsWith('marker-'))
      .map(([key, value]) => value)
      .sort((a, b) => (a.time as number) - (b.time as number));

    series.setMarkers(markers);
  }

  protected removeAllPrimitives(): void {
    // Remove price lines
    const series = this.getChartStore().chartInstance?.series;
    if (series) {
      this.primitives.forEach((primitive, id) => {
        if (id.startsWith('line-')) {
          series.removePriceLine(primitive);
        }
      });
    }

    // Clear all primitives
    this.primitives.clear();
    
    // Clear markers
    if (series) {
      series.setMarkers([]);
    }
  }

  protected showAllPrimitives(): void {
    // Re-create all primitives
    this.updatePrimitives();
  }

  protected hideAllPrimitives(): void {
    // Temporarily remove all primitives
    this.removeAllPrimitives();
  }

  // Abstract methods
  protected abstract setupPrimitives(): Promise<void>;
  protected abstract subscribeToUpdates(): void;
  protected abstract unsubscribeFromUpdates(): void;
  protected abstract updatePrimitives(): void;

  // Utility methods
  protected getPrimitiveById(id: string): any {
    return this.primitives.get(id);
  }

  protected getAllPrimitives(): Map<string, any> {
    return new Map(this.primitives);
  }

  protected getPrimitiveCount(): number {
    return this.primitives.size;
  }
}