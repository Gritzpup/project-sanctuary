import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { redisCandleStorage } from './redis/RedisCandleStorage.js';
import { coinbaseAPI } from './CoinbaseAPIService.js';

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
    
    // Redis storage integration
    this.redisStorageEnabled = true;
    this.initializeRedisStorage();
  }

  /**
   * Initialize Redis storage for candle data
   */
  async initializeRedisStorage() {
    if (!this.redisStorageEnabled) return;
    
    try {
      await redisCandleStorage.connect();
      console.log('✅ Redis storage initialized for WebSocket candle data');
    } catch (error) {
      console.error('❌ Failed to initialize Redis storage:', error.message);
      this.redisStorageEnabled = false;
    }
  }

  /**
   * Handle gap detection by fetching missing data from API
   */
  async handleGapDetection(gapInfo) {
    const { productId, granularity, lastCandleTime, newCandleTime, missedCandles, gapSeconds } = gapInfo;
    
    if (missedCandles < 1) return; // No significant gap
    
    console.log(`🔄 Attempting to backfill ${missedCandles} missing candles for ${productId}`);
    
    try {
      // Convert granularity to string format for API
      const granularityMap = {
        60: '1m',
        300: '5m', 
        900: '15m',
        1800: '30m',
        3600: '1h',
        14400: '4h',
        21600: '6h',
        43200: '12h',
        86400: '1d'
      };
      
      const granularityStr = granularityMap[granularity] || `${granularity}s`;
      
      // Fetch missing candles from Coinbase API
      const startTime = new Date((lastCandleTime + granularity) * 1000).toISOString();
      const endTime = new Date(newCandleTime * 1000).toISOString();
      
      console.log(`📥 Fetching gap data from ${startTime} to ${endTime}`);
      
      const missingCandles = await coinbaseAPI.getCandles(
        productId,
        granularity,
        startTime,
        endTime
      );
      
      if (missingCandles && missingCandles.length > 0) {
        // Store the fetched candles in Redis
        await redisCandleStorage.storeCandles(productId, granularityStr, missingCandles);
        
        console.log(`✅ Backfilled ${missingCandles.length} missing candles for ${productId}`);
        
        // Emit event for frontend to refresh data
        this.emit('gap_filled', {
          productId,
          granularity: granularityStr,
          candlesFilled: missingCandles.length,
          timeRange: { start: startTime, end: endTime }
        });
      } else {
        console.log(`⚠️ No data available from API for gap in ${productId}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to backfill gap for ${productId}:`, error.message);
    }
  }

  /**
   * Store completed candle in Redis
   */
  async storeCandle(productId, granularitySeconds, candle) {
    if (!this.redisStorageEnabled) return;
    
    try {
      // Convert granularity seconds to string format
      const granularityMap = {
        60: '1m',
        300: '5m',
        900: '15m',
        1800: '30m',
        3600: '1h',
        14400: '4h',
        21600: '6h',
        43200: '12h',
        86400: '1d'
      };
      
      const granularityStr = granularityMap[granularitySeconds] || `${granularitySeconds}s`;
      
      await redisCandleStorage.storeCandles(productId, granularityStr, [candle]);
      console.log(`💾 Stored ${productId} ${granularityStr} candle in Redis:`, {
        time: new Date(candle.time * 1000).toISOString(),
        price: candle.close,
        volume: candle.volume
      });
    } catch (error) {
      console.error('❌ Failed to store candle in Redis:', error.message);
    }
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
      const aggregator = new CandleAggregator(productId, parseInt(granularity));
      
      // Listen for gap detection events from the aggregator
      aggregator.on('gap_detected', async (gapInfo) => {
        await this.handleGapDetection(gapInfo);
      });
      
      this.candleAggregators.set(aggregatorKey, aggregator);
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
    this.candleAggregators.forEach(async (aggregator, key) => {
      if (key.startsWith(match.product_id + ':')) {
        const candle = aggregator.addTrade(trade);
        if (candle) {
          // Store completed candles in Redis
          if (candle.type === 'complete') {
            await this.storeCandle(match.product_id, aggregator.granularity, candle);
          }
          
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
      // 🔥 MEMORY LEAK FIX: Remove all event listeners before closing
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    
    // 🔥 MEMORY LEAK FIX: Clear all data structures
    this.subscriptions.clear();
    this.candleAggregators.clear();
    
    // 🔥 MEMORY LEAK FIX: Remove all EventEmitter listeners
    this.removeAllListeners();
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    console.log('🧹 Coinbase WebSocket fully disconnected and cleaned up');
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
class CandleAggregator extends EventEmitter {
  constructor(productId, granularitySeconds) {
    super();
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
      
      // Check for gaps when creating a new candle
      if (completedCandle) {
        const expectedNextCandleTime = completedCandle.time + this.granularity;
        const gapSize = candleTime - expectedNextCandleTime;
        
        if (gapSize > 0) {
          const missedCandles = Math.floor(gapSize / this.granularity);
          console.log(`🔍 Gap detected: ${missedCandles} missing candles between ${new Date(completedCandle.time * 1000).toISOString()} and ${new Date(candleTime * 1000).toISOString()}`);
          
          // Emit gap detection event
          this.emit('gap_detected', {
            productId: this.productId,
            granularity: this.granularity,
            lastCandleTime: completedCandle.time,
            newCandleTime: candleTime,
            missedCandles: missedCandles,
            gapSeconds: gapSize
          });
        }
      }
      
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