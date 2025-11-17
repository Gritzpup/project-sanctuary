import type { ChartConfig, ChartStatus, ChartRange, ChartEvent } from '../types/chart.types';
import { ChartDebug } from '../utils/debug';

type StateChangeCallback = (state: ChartState) => void;
type EventCallback = (event: ChartEvent) => void;

export interface ChartState {
  config: ChartConfig;
  status: ChartStatus;
  range: ChartRange | null;
  pair: string;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

export class ChartStateService {
  private state: ChartState = {
    config: {
      theme: 'dark',
      timeframe: '1H',
      granularity: '1m',
      indicators: [],
      showVolume: true,
      showGrid: true,
      showCrosshair: true
    },
    status: {
      status: 'initializing',
      timestamp: Date.now()
    },
    range: null,
    pair: 'BTC-USD',
    isInitialized: false,
    isLoading: false,
    error: null
  };

  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private eventCallbacks: Set<EventCallback> = new Set();

  getState(): Readonly<ChartState> {
    return { ...this.state };
  }

  updateConfig(updates: Partial<ChartConfig>): void {
    const oldConfig = { ...this.state.config };
    this.state.config = { ...this.state.config, ...updates };

    this.notifyStateChange();

    // Emit specific events for important changes
    if (oldConfig.timeframe !== this.state.config.timeframe) {
      this.emitEvent({
        type: 'period-change',
        data: {
          oldValue: oldConfig.timeframe,
          newValue: this.state.config.timeframe
        },
        timestamp: Date.now()
      });
    }
    
    if (oldConfig.granularity !== this.state.config.granularity) {
      this.emitEvent({
        type: 'granularity-change',
        data: { 
          oldValue: oldConfig.granularity, 
          newValue: this.state.config.granularity 
        },
        timestamp: Date.now()
      });
    }
  }

  updateStatus(status: ChartStatus['status'], message?: string): void {
    this.state.status = {
      status,
      message,
      timestamp: Date.now()
    };
    
    this.notifyStateChange();
    
    this.emitEvent({
      type: 'status-change',
      data: this.state.status,
      timestamp: Date.now()
    });
  }

  updateRange(range: ChartRange): void {
    this.state.range = range;
    this.notifyStateChange();
    
    this.emitEvent({
      type: 'range-change',
      data: range,
      timestamp: Date.now()
    });
  }

  setPair(pair: string): void {
    if (this.state.pair !== pair) {
      this.state.pair = pair;
      this.notifyStateChange();
    }
  }

  setInitialized(initialized: boolean): void {
    this.state.isInitialized = initialized;
    this.notifyStateChange();
  }

  setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    if (loading) {
      this.updateStatus('loading');
    }
    this.notifyStateChange();
  }

  setError(error: string | null): void {
    this.state.error = error;
    if (error) {
      this.updateStatus('error', error);
    }
    this.notifyStateChange();
    
    if (error) {
      this.emitEvent({
        type: 'error',
        data: { message: error },
        timestamp: Date.now()
      });
    }
  }

  subscribeToState(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    // Immediately call with current state
    callback(this.getState());
    
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  subscribeToEvents(callback: EventCallback): () => void {
    this.eventCallbacks.add(callback);
    
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  private notifyStateChange(): void {
    const currentState = this.getState();
    this.stateCallbacks.forEach(callback => {
      try {
        callback(currentState);
      } catch (error) {
        ChartDebug.error('Error in state callback:', error);
      }
    });
  }

  private emitEvent(event: ChartEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        ChartDebug.error('Error in event callback:', error);
      }
    });
  }

  reset(): void {
    this.state = {
      config: { ...this.state.config },
      status: {
        status: 'initializing',
        timestamp: Date.now()
      },
      range: null,
      pair: this.state.pair,
      isInitialized: false,
      isLoading: false,
      error: null
    };
    
    this.notifyStateChange();
  }

  destroy(): void {
    this.stateCallbacks.clear();
    this.eventCallbacks.clear();
  }
}