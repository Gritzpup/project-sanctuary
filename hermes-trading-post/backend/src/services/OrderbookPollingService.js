import { EventEmitter } from 'events';
import https from 'https';

/**
 * Orderbook Polling Service
 * Polls Coinbase Advanced Trade API for orderbook data since WebSocket level2 requires auth
 */
export class OrderbookPollingService extends EventEmitter {
  constructor() {
    super();
    this.pollInterval = 100; // Poll every 100ms (10x per second) for ultra-smooth real-time updates
    this.intervalId = null;
    this.isPolling = false;
    this.productId = null;
    this.limit = 150; // Number of bids/asks to fetch (more depth = smoother walls)
  }

  /**
   * Start polling for orderbook data
   */
  startPolling(productId = 'BTC-USD', limit = 50) {
    if (this.isPolling) {
      console.log('⚠️ Orderbook polling already running');
      return;
    }

    this.productId = productId;
    this.limit = limit;
    this.isPolling = true;

    console.log(`📊 Starting orderbook polling for ${productId} (${limit} levels) every ${this.pollInterval}ms`);

    // Initial fetch
    this.fetchOrderbook();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.fetchOrderbook();
    }, this.pollInterval);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
    console.log('⏹️ Stopped orderbook polling');
  }

  /**
   * Fetch orderbook data from Coinbase Advanced Trade API
   */
  async fetchOrderbook() {
    try {
      const url = `https://api.coinbase.com/api/v3/brokerage/market/product_book?product_id=${this.productId}&limit=${this.limit}`;

      return new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';

          // Collect response data
          res.on('data', (chunk) => {
            data += chunk;
          });

          // Parse and emit data when complete
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);

              if (!parsed.pricebook) {
                console.error('❌ Invalid orderbook response:', parsed);
                return resolve();
              }

              // Transform to match our expected format
              const orderbook = {
                type: 'snapshot',
                product_id: this.productId,
                bids: parsed.pricebook.bids.map(bid => ({
                  price: parseFloat(bid.price),
                  size: parseFloat(bid.size)
                })),
                asks: parsed.pricebook.asks.map(ask => ({
                  price: parseFloat(ask.price),
                  size: parseFloat(ask.size)
                })),
                time: parsed.pricebook.time
              };

              // Emit the orderbook data
              this.emit('orderbook', orderbook);
              resolve();

            } catch (error) {
              console.error('❌ Error parsing orderbook response:', error.message);
              resolve();
            }
          });

        }).on('error', (error) => {
          console.error('❌ Error fetching orderbook:', error.message);
          resolve();
        });
      });

    } catch (error) {
      console.error('❌ Error in fetchOrderbook:', error.message);
    }
  }

  /**
   * Change poll interval (ms)
   */
  setPollInterval(interval) {
    this.pollInterval = interval;

    // Restart polling with new interval if currently polling
    if (this.isPolling) {
      this.stopPolling();
      this.startPolling(this.productId, this.limit);
    }
  }
}

// Create singleton instance
export const orderbookPollingService = new OrderbookPollingService();
