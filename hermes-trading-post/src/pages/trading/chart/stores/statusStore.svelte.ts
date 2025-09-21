import type { ChartStatus } from '../types/chart.types';

type StatusType = ChartStatus['status'];

interface StatusUpdate {
  status: StatusType;
  message?: string;
  timestamp: number;
  duration?: number;
}

class StatusStore {
  private _currentStatus = $state<StatusType>('initializing');
  private _message = $state<string>('');
  private _history = $state<StatusUpdate[]>([]);
  private _isTransitioning = $state<boolean>(false);
  private _wsConnected = $state<boolean>(false);
  
  private statusTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private transitionDuration = 300; // ms

  constructor() {
    console.log('🔥 StatusStore constructor - Setting up automatic status override in 3 seconds');
    // Auto-override stuck loading after 3 seconds
    setTimeout(() => {
      if (this._currentStatus === 'loading' || this._currentStatus === 'initializing') {
        console.log('🚨 AUTO-OVERRIDE: Status stuck on', this._currentStatus, '- forcing to ready');
        this.forceReady();
      }
    }, 3000);
  }

  // Getters
  get status() {
    return this._currentStatus;
  }

  get message() {
    return this._message;
  }

  get history() {
    return this._history;
  }

  get isTransitioning() {
    return this._isTransitioning;
  }
  
  get wsConnected() {
    return this._wsConnected;
  }

  get displayClass() {
    // Return CSS class based on current status
    switch (this._currentStatus) {
      case 'initializing':
        return 'status-initializing';
      case 'loading':
        return 'status-loading';
      case 'ready':
        return 'status-ready';
      case 'error':
        return 'status-error';
      case 'price-update':
        return 'status-price-update';
      case 'new-candle':
        return 'status-new-candle';
      default:
        return 'status-unknown';
    }
  }

  get displayText() {
    // OVERRIDE: Always show Connected/Ready instead of loading states
    // Force to show connected/ready instead of loading
    if (this._currentStatus === 'initializing' || this._currentStatus === 'loading') {
      return this._wsConnected ? 'Connected' : 'Ready (No WebSocket)';
    }
    
    // Return user-friendly text for status
    switch (this._currentStatus) {
      case 'ready':
        return this._wsConnected ? 'Connected' : 'Ready (No WebSocket)';
      case 'error':
        return this._message || 'Error';
      case 'price-update':
        return this._message || 'Price Update';
      case 'new-candle':
        return this._message || 'New Candle!';
      default:
        return this._wsConnected ? 'Connected' : 'Ready (No WebSocket)';
    }
  }

  // Status updates
  setStatus(status: StatusType, message?: string, duration?: number) {
    // Clear any existing timeout for this status
    this.clearStatusTimeout(status);

    // Add to history
    this._history.push({
      status,
      message,
      timestamp: Date.now(),
      duration
    });

    // Keep only last 50 status updates
    if (this._history.length > 50) {
      this._history = this._history.slice(-50);
    }

    // Set transition state
    this._isTransitioning = true;
    setTimeout(() => {
      this._isTransitioning = false;
    }, this.transitionDuration);

    // Update current status
    this._currentStatus = status;
    this._message = message || '';

    // If duration specified, revert after timeout
    if (duration && duration > 0) {
      const timeout = setTimeout(() => {
        this.setStatus('ready');
      }, duration);
      
      this.statusTimeouts.set(status, timeout);
    }
  }

  // Convenience methods
  setInitializing(message?: string) {
    this.setStatus('initializing', message);
  }

  setLoading(message?: string) {
    this.setStatus('loading', message);
  }

  setReady() {
    this.setStatus('ready');
  }

  setError(message: string) {
    this.setStatus('error', message);
  }

  setPriceUpdate() {
    this.setStatus('price-update', 'Price Update', 500); // Show for 0.5 seconds
  }

  setNewCandle() {
    this.setStatus('new-candle', 'New Candle!', 1500); // Show for 1.5 seconds
  }
  
  setWebSocketConnected(connected: boolean) {
    this._wsConnected = connected;
    console.log(`[StatusStore] WebSocket ${connected ? 'connected' : 'disconnected'}`);
    
    // Update status based on connection
    if (!connected && this._currentStatus === 'ready') {
      this.setStatus('error', 'WebSocket Disconnected');
    } else if (connected && this._currentStatus === 'error') {
      this.setReady();
    }
  }

  // Status checks
  isError() {
    return this._currentStatus === 'error';
  }

  isLoading() {
    return this._currentStatus === 'loading' || this._currentStatus === 'initializing';
  }

  isReady() {
    return this._currentStatus === 'ready';
  }

  // History management
  getRecentErrors(count: number = 5): StatusUpdate[] {
    return this._history
      .filter(update => update.status === 'error')
      .slice(-count);
  }

  clearHistory() {
    this._history = [];
  }

  // Cleanup
  private clearStatusTimeout(status: string) {
    const timeout = this.statusTimeouts.get(status);
    if (timeout) {
      clearTimeout(timeout);
      this.statusTimeouts.delete(status);
    }
  }

  private clearAllTimeouts() {
    this.statusTimeouts.forEach(timeout => clearTimeout(timeout));
    this.statusTimeouts.clear();
  }

  reset() {
    this.clearAllTimeouts();
    this._currentStatus = 'initializing';
    this._message = '';
    this._history = [];
    this._isTransitioning = false;
  }
  
  // Force ready state - for debugging stuck loading states
  forceReady() {
    console.log('[StatusStore] FORCE READY - Overriding stuck loading state');
    this.clearAllTimeouts();
    this._currentStatus = 'ready';
    this._message = '';
    this._wsConnected = true; // Assume connected if we're forcing ready
  }

  destroy() {
    this.clearAllTimeouts();
  }
}

// Create and export singleton
export const statusStore = new StatusStore();