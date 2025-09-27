import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

/**
 * Coinbase WebSocket client for real-time market data
 */
export class CoinbaseWebSocketClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.subscriptions = new Map(); // Track active subscriptions
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.isConnected = false;
    
    // Candle aggregation
    this.candleAggregators = new Map(); // key: "pair:granularity", value: aggregator
  }

  /**
   * Connect to Coinbase WebSocket
   */
  async connect() {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;
    console.log('🔌 Connecting to Coinbase WebSocket...');

    try {
      this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      this.ws.on('open', () => {
        console.log('✅ Connected to Coinbase WebSocket');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // Resubscribe to any existing subscriptions
        this.resubscribe();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing Coinbase WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('🔴 Coinbase WebSocket connection closed');
        this.isConnected = false;
        this.isConnecting = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('🔴 Coinbase WebSocket error:', error);
        this.isConnected = false;
        this.isConnecting = false;
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Error creating Coinbase WebSocket:', error);
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  /**
   * Subscribe to ticker updates for a product
   */
  subscribeTicker(productId) {
    const subscriptionKey = `ticker:${productId}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Already subscribed to ticker for ${productId}`);
      return;
    }

    const subscription = {
      type: 'subscribe',
      product_ids: [productId],
      channels: ['ticker']
    };

    this.subscriptions.set(subscriptionKey, subscription);
    
    if (this.isConnected) {
      console.log(`📡 Subscribing to ticker for ${productId}`);
      this.ws.send(JSON.stringify(subscription));
    }
  }

  /**
   * Subscribe to matches (trades) for real-time volume aggregation
   */
  subscribeMatches(productId, granularity = '60') {
    const subscriptionKey = `matches:${productId}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Already subscribed to matches for ${productId}`);
      return;
    }

    const subscription = {
      type: 'subscribe',
      product_ids: [productId],
      channels: ['matches']
    };

    this.subscriptions.set(subscriptionKey, subscription);
    
    // Initialize candle aggregator for this product/granularity
    const aggregatorKey = `${productId}:${granularity}`;
    if (!this.candleAggregators.has(aggregatorKey)) {
      this.candleAggregators.set(aggregatorKey, new CandleAggregator(productId, parseInt(granularity)));
    }
    
    if (this.isConnected) {
      console.log(`📡 Subscribing to matches for ${productId}`);
      this.ws.send(JSON.stringify(subscription));
    }
  }

  /**
   * Unsubscribe from a product
   */
  unsubscribe(productId, channel = 'ticker') {
    const subscriptionKey = `${channel}:${productId}`;
    
    if (!this.subscriptions.has(subscriptionKey)) {
      return;
    }

    const unsubscription = {
      type: 'unsubscribe',
      product_ids: [productId],
      channels: [channel]
    };

    this.subscriptions.delete(subscriptionKey);
    
    if (this.isConnected) {
      console.log(`📡 Unsubscribing from ${channel} for ${productId}`);
      this.ws.send(JSON.stringify(unsubscription));
    }

    // Clean up aggregator if it was matches
    if (channel === 'matches') {
      const aggregatorKeys = Array.from(this.candleAggregators.keys()).filter(key => key.startsWith(productId + ':'));
      aggregatorKeys.forEach(key => this.candleAggregators.delete(key));
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'subscriptions':
        console.log('📡 Coinbase subscription confirmed:', message);
        break;
        
      case 'ticker':
        this.handleTicker(message);
        break;
        
      case 'match':
        this.handleMatch(message);
        break;
        
      case 'error':
        console.error('🔴 Coinbase WebSocket error:', message);
        break;
        
      default:
        // Ignore other message types
        break;
    }
  }

  /**
   * Handle ticker messages
   */
  handleTicker(ticker) {
    // Emit ticker update
    this.emit('ticker', {
      product_id: ticker.product_id,
      price: parseFloat(ticker.price),
      best_bid: parseFloat(ticker.best_bid),
      best_ask: parseFloat(ticker.best_ask),
      time: ticker.time,
      volume_24h: parseFloat(ticker.volume_24h)
    });
  }

  /**
   * Handle match (trade) messages for volume aggregation
   */
  handleMatch(match) {
    const trade = {
      product_id: match.product_id,
      price: parseFloat(match.price),
      size: parseFloat(match.size),
      time: new Date(match.time).getTime() / 1000, // Convert to seconds
      side: match.side
    };

    // Update all relevant candle aggregators
    this.candleAggregators.forEach((aggregator, key) => {
      if (key.startsWith(match.product_id + ':')) {
        const candle = aggregator.addTrade(trade);
        if (candle) {
          // Emit completed or updated candle
          this.emit('candle', {
            ...candle,
            product_id: match.product_id,
            granularity: aggregator.granularity
          });
        }
      }
    });

    // Also emit raw trade for immediate updates
    this.emit('trade', trade);
  }

  /**
   * Resubscribe to all active subscriptions
   */
  resubscribe() {
    console.log(`📡 Resubscribing to ${this.subscriptions.size} subscriptions`);
    this.subscriptions.forEach((subscription) => {
      this.ws.send(JSON.stringify(subscription));
    });
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🔴 Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.candleAggregators.clear();
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      subscriptions: Array.from(this.subscriptions.keys()),
      aggregators: Array.from(this.candleAggregators.keys())
    };
  }
}

/**
 * Aggregates trades into candles with volume
 */
class CandleAggregator {
  constructor(productId, granularitySeconds) {
    this.productId = productId;
    this.granularity = granularitySeconds;
    this.currentCandle = null;
    this.lastEmittedTime = null;
  }

  /**
   * Add a trade and return updated/new candle if ready
   */
  addTrade(trade) {
    const candleTime = this.getCandleTime(trade.time);
    
    // Initialize or update current candle
    if (!this.currentCandle || this.currentCandle.time !== candleTime) {
      // If we have a previous candle and it's complete, emit it
      const completedCandle = this.currentCandle && this.currentCandle.time < candleTime ? {...this.currentCandle} : null;
      
      // Start new candle
      this.currentCandle = {
        time: candleTime,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.size
      };

      // Return completed candle if we have one
      if (completedCandle && completedCandle.time !== this.lastEmittedTime) {
        this.lastEmittedTime = completedCandle.time;
        return {
          ...completedCandle,
          type: 'complete'
        };
      }
    } else {
      // Update existing candle
      this.currentCandle.high = Math.max(this.currentCandle.high, trade.price);
      this.currentCandle.low = Math.min(this.currentCandle.low, trade.price);
      this.currentCandle.close = trade.price;
      this.currentCandle.volume += trade.size;
    }

    // Return current candle as update
    return {
      ...this.currentCandle,
      type: 'update'
    };
  }

  /**
   * Calculate candle time based on granularity
   */
  getCandleTime(tradeTime) {
    return Math.floor(tradeTime / this.granularity) * this.granularity;
  }
}

// Create singleton instance
export const coinbaseWebSocket = new CoinbaseWebSocketClient();