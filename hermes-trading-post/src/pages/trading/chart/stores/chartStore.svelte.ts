import { ChartStateService, type ChartState } from '../services/ChartStateService';
import type { ChartConfig, ChartInstance } from '../types/chart.types';

class ChartStore {
  private stateService = new ChartStateService();
  private _state = $state<ChartState>(this.stateService.getState());
  private _chartInstance = $state<ChartInstance | null>(null);
  private unsubscribe: (() => void) | null = null;

  constructor() {
    // Subscribe to state service changes
    this.unsubscribe = this.stateService.subscribeToState((newState) => {
      this._state = newState;
    });
  }

  // Getters for reactive state
  get state() {
    return this._state;
  }

  get config() {
    return this._state.config;
  }

  get status() {
    return this._state.status;
  }

  get isLoading() {
    return this._state.isLoading;
  }

  get error() {
    return this._state.error;
  }

  get chartInstance() {
    return this._chartInstance;
  }

  // Methods to update state
  updateConfig(updates: Partial<ChartConfig>) {
    this.stateService.updateConfig(updates);
  }

  setTimeframe(timeframe: string) {
    this.updateConfig({ timeframe });
  }

  setGranularity(granularity: string) {
    this.updateConfig({ granularity });
  }

  setTheme(theme: 'dark' | 'light') {
    this.updateConfig({ theme });
  }

  toggleIndicator(indicator: string) {
    const indicators = [...this.config.indicators];
    const index = indicators.indexOf(indicator);
    
    if (index === -1) {
      indicators.push(indicator);
    } else {
      indicators.splice(index, 1);
    }
    
    this.updateConfig({ indicators });
  }

  setChartInstance(instance: ChartInstance | null) {
    this._chartInstance = instance;
  }

  setLoading(loading: boolean) {
    this.stateService.setLoading(loading);
  }

  setError(error: string | null) {
    this.stateService.setError(error);
  }

  setPair(pair: string) {
    this.stateService.setPair(pair);
  }

  subscribeToEvents(callback: (event: any) => void) {
    return this.stateService.subscribeToEvents(callback);
  }

  reset() {
    this.stateService.reset();
    this._chartInstance = null;
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.stateService.destroy();
  }
}

// Create and export a singleton instance
export const chartStore = new ChartStore();