import { ServiceBase } from '../core/ServiceBase';

/**
 * Abstract base class for state management services
 * Provides reactive state management with event emission
 */
export abstract class StateService<TState = any> extends ServiceBase {
  protected state: TState;
  protected previousState: TState;
  protected stateHistory: TState[] = [];
  protected maxHistorySize: number = 50;
  protected subscribers: Set<(state: TState, previousState?: TState) => void> = new Set();

  constructor(initialState: TState) {
    super();
    this.state = initialState;
    this.previousState = initialState;
  }

  /**
   * Get current state (readonly)
   */
  public getState(): Readonly<TState> {
    this.assertInitialized();
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(callback: (state: TState, previousState?: TState) => void): () => void {
    this.assertInitialized();
    this.subscribers.add(callback);
    
    // Immediately call with current state
    callback(this.getState(), this.previousState);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Update state with validation and event emission
   */
  protected setState(newState: Partial<TState> | ((current: TState) => Partial<TState>)): void {
    this.assertInitialized();
    this.assertNotDisposed();

    const updates = typeof newState === 'function' ? newState(this.state) : newState;
    const nextState = { ...this.state, ...updates };

    // Validate state before applying
    const validation = this.validateState(nextState);
    if (!validation.valid) {
      const error = new Error(`Invalid state update: ${validation.errors.join(', ')}`);
      this.emit('state:error', { error, attemptedState: nextState });
      throw error;
    }

    // Store previous state
    this.previousState = { ...this.state };
    
    // Add to history
    this.stateHistory.push(this.previousState);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    // Apply new state
    this.state = nextState;

    // Emit state change events
    this.emit('state:changed', { 
      current: this.getState(), 
      previous: this.previousState,
      changes: updates
    });

    // Notify subscribers
    this.notifySubscribers();

    // Call state change hook
    this.onStateChanged(this.state, this.previousState);
  }

  /**
   * Reset state to initial value
   */
  public resetState(): void {
    const initialState = this.getInitialState();
    this.setState(() => initialState);
    this.emit('state:reset', { state: this.getState() });
  }

  /**
   * Get state history
   */
  public getStateHistory(): Readonly<TState[]> {
    return [...this.stateHistory];
  }

  /**
   * Undo last state change
   */
  public undo(): boolean {
    if (this.stateHistory.length === 0) {
      return false;
    }

    const previousState = this.stateHistory.pop()!;
    this.state = previousState;
    this.notifySubscribers();
    this.emit('state:undo', { state: this.getState() });
    return true;
  }

  /**
   * Create a computed state selector
   */
  public createSelector<TSelected>(
    selector: (state: TState) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ): (callback: (selected: TSelected) => void) => () => void {
    let currentSelected = selector(this.state);
    const defaultEqualityFn = (a: TSelected, b: TSelected) => a === b;
    const isEqual = equalityFn || defaultEqualityFn;

    return (callback: (selected: TSelected) => void) => {
      // Call immediately with current value
      callback(currentSelected);

      // Subscribe to state changes
      return this.subscribe((newState) => {
        const newSelected = selector(newState);
        if (!isEqual(currentSelected, newSelected)) {
          currentSelected = newSelected;
          callback(newSelected);
        }
      });
    };
  }

  /**
   * Batch multiple state updates
   */
  protected batchUpdate(updates: () => void): void {
    const originalNotify = this.notifySubscribers;
    const originalEmit = this.emit;
    
    let batchedChanges: any[] = [];
    
    // Temporarily disable notifications
    this.notifySubscribers = () => {};
    this.emit = (eventName: string, data: any) => {
      if (eventName === 'state:changed') {
        batchedChanges.push(data);
      } else {
        originalEmit.call(this, eventName, data);
      }
    };

    try {
      updates();
    } finally {
      // Restore original functions
      this.notifySubscribers = originalNotify;
      this.emit = originalEmit;

      // Emit batched changes
      if (batchedChanges.length > 0) {
        this.emit('state:batchChanged', { changes: batchedChanges });
        this.notifySubscribers();
      }
    }
  }

  protected async onInitialize(): Promise<void> {
    // Initialize state from persistence if needed
    await this.loadPersistedState();
  }

  protected async onDispose(): Promise<void> {
    // Save state if needed
    await this.persistState();
    
    // Clear subscribers
    this.subscribers.clear();
    this.stateHistory = [];
  }

  /**
   * Abstract methods for subclasses to implement
   */
  protected abstract getInitialState(): TState;
  
  protected abstract validateState(state: TState): { valid: boolean; errors: string[] };

  /**
   * Optional hooks for subclasses
   */
  protected onStateChanged(current: TState, previous: TState): void {
    // Override in subclasses if needed
  }

  protected async loadPersistedState(): Promise<void> {
    // Override in subclasses if persistence is needed
  }

  protected async persistState(): Promise<void> {
    // Override in subclasses if persistence is needed
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    const currentState = this.getState();
    for (const callback of this.subscribers) {
      try {
        callback(currentState, this.previousState);
      } catch (error) {
        this.emit('subscriber:error', { error, state: currentState });
      }
    }
  }
}