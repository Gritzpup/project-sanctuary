import { writable } from 'svelte/store';
import { coinbaseWebSocket } from '../../../services/api/coinbaseWebSocket';

export interface BackendState {
  connected: boolean;
  currentPrice: number;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading';
}

export class BackendConnector {
  private state = writable<BackendState>({
    connected: false,
    currentPrice: 0,
    connectionStatus: 'loading'
  });

  private priceUpdateCallback: ((price: number) => void) | null = null;

  constructor() {
    this.initializeWebSocket();
  }

  getState() {
    return this.state;
  }

  onPriceUpdate(callback: (price: number) => void) {
    this.priceUpdateCallback = callback;
  }

  private async initializeWebSocket() {
    try {
      // Connect to WebSocket
      coinbaseWebSocket.connect();
      
      // Subscribe to BTC-USD ticker
      coinbaseWebSocket.subscribeTicker('BTC-USD');
      
      // Subscribe to price updates
      coinbaseWebSocket.onPrice((price: number) => {
        this.state.update(current => ({ ...current, currentPrice: price }));
        this.priceUpdateCallback?.(price);
      });
      
      // Subscribe to status updates
      coinbaseWebSocket.onStatus((status: 'connected' | 'disconnected' | 'error' | 'loading') => {
        this.state.update(current => ({ 
          ...current, 
          connectionStatus: status,
          connected: status === 'connected'
        }));
      });
      
      // Initial connection status
      const initialStatus = coinbaseWebSocket.isConnected() ? 'connected' : 'loading';
      this.state.update(current => ({ 
        ...current, 
        connectionStatus: initialStatus,
        connected: initialStatus === 'connected'
      }));
      
    } catch (error) {
      console.error('Failed to setup WebSocket connection:', error);
      this.state.update(current => ({ 
        ...current, 
        connectionStatus: 'error',
        connected: false
      }));
    }
  }

  destroy() {
    // Don't cleanup singleton instances
    // coinbaseWebSocket.disconnect();
  }
}