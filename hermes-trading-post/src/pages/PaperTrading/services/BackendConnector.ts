import { writable } from 'svelte/store';
import { coinbaseWebSocket } from '../../../services/api/coinbaseWebSocket';
import { CoinbaseAPI } from '../../../services/api/coinbaseApi';

export interface BackendState {
  connected: boolean;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading';
}

export class BackendConnector {
  private state = writable<BackendState>({
    connected: false,
    currentPrice: 0,
    priceChange24h: 0,
    priceChangePercent24h: 0,
    connectionStatus: 'loading'
  });

  private priceUpdateCallback: ((price: number) => void) | null = null;
  private coinbaseAPI = new CoinbaseAPI();
  private statsUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeWebSocket();
    this.start24hStatsUpdates();
  }

  getState() {
    return this.state;
  }

  onPriceUpdate(callback: (price: number) => void) {
    this.priceUpdateCallback = callback;
  }
  
  // Method to update price from external sources (like trading backend)
  updatePrice(price: number) {
    this.state.update(current => ({ ...current, currentPrice: price }));
    this.priceUpdateCallback?.(price);
  }

  private async initializeWebSocket() {
    try {
      // Connect to WebSocket
      coinbaseWebSocket.connect();
      
      // Subscribe to BTC-USD ticker
      coinbaseWebSocket.subscribeTicker('BTC-USD');
      
      // Subscribe to ticker data - now only for current price updates
      coinbaseWebSocket.subscribe((tickerData: any) => {
        if (tickerData.type === 'ticker' && tickerData.product_id === 'BTC-USD') {
          const currentPrice = parseFloat(tickerData.price);
          
          if (currentPrice) {
            this.state.update(current => ({ 
              ...current, 
              currentPrice
            }));
            
            this.priceUpdateCallback?.(currentPrice);
          }
        }
      });
      
      // Subscribe to price updates (fallback)
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

  private start24hStatsUpdates() {
    // Fetch 24h stats immediately
    this.fetch24hStats();
    
    // Update 24h stats every 30 seconds (much more frequent than manual calculation)
    this.statsUpdateInterval = setInterval(() => {
      this.fetch24hStats();
    }, 30000);
  }

  private async fetch24hStats() {
    try {
      const stats = await this.coinbaseAPI.get24hStats('BTC-USD');
      
      this.state.update(current => ({
        ...current,
        priceChange24h: stats.priceChange24h,
        priceChangePercent24h: stats.priceChangePercent24h
      }));
      
    } catch (error) {
      console.error('Failed to fetch 24h stats:', error);
    }
  }

  destroy() {
    // Clean up 24h stats interval
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
    
    // Don't cleanup singleton instances
    // coinbaseWebSocket.disconnect();
  }
}