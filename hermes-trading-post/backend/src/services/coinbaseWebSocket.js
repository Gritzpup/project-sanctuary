import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { redisCandleStorage } from './redis/RedisCandleStorage.js';
import { coinbaseAPI } from './CoinbaseAPIService.js';
import { MultiGranularityAggregator } from './MultiGranularityAggregator.js';
import { cdpAuth } from './CDPAuth.js';

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
   * Subscribe to level2 orderbook updates for depth chart visualization
   */
  subscribeLevel2(productId) {
    const subscriptionKey = `level2:${productId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Already subscribed to level2 for ${productId}`);
      return;
    }

    // Try to get authentication for level2
    const auth = cdpAuth.getWebSocketAuth();

    let subscription;
    if (auth) {
      // Use authenticated subscription for level2
      console.log(`🔐 Using CDP authentication for level2 ${productId}`);
      subscription = auth; // Auth object already contains subscription info
      subscription.product_ids = [productId];
      subscription.channels = [
        {
          name: 'level2',
          product_ids: [productId]
        }
      ];
    } else {
      // Fallback to unauthenticated level2_batch (updates every 50ms)
      console.log(`📊 Using unauthenticated level2_batch for ${productId} (will get batched updates)`);
      subscription = {
        type: 'subscribe',
        product_ids: [productId],
        channels: ['level2_batch'] // Use level2_batch which doesn't require auth
      };
    }

    this.subscriptions.set(subscriptionKey, subscription);

    if (this.isConnected) {
      console.log(`📊 Subscribing to level2 orderbook for ${productId}`);
      this.ws.send(JSON.stringify(subscription));
    }
  }

  /**
   * Subscribe to matches (trades) for real-time multi-granularity aggregation
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

    // Initialize MULTI-GRANULARITY aggregator for this product (all timeframes at once)
    const aggregatorKey = productId; // Key by product only, since it handles all granularities
    if (!this.candleAggregators.has(aggregatorKey)) {
      const aggregator = new MultiGranularityAggregator(productId);

      // Listen for gap detection events from the aggregator
      aggregator.on('gap_detected', async (gapInfo) => {
        await this.handleGapDetection(gapInfo);
      });

      this.candleAggregators.set(aggregatorKey, aggregator);
      console.log(`📊 Initialized multi-granularity aggregator for ${productId}`);
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
      // Multi-granularity aggregators are keyed by productId only
      this.candleAggregators.delete(productId);
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

      case 'snapshot':
      case 'l2update':
      case 'level2':
        this.handleLevel2(message);
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
   * Handle level2 orderbook messages (snapshot and updates)
   */
  handleLevel2(message) {
    // Level2 messages come in multiple types:
    // 1. snapshot: Full orderbook state with "updates" array
    // 2. l2update: Incremental updates with "changes" array
    // 3. level2: Authenticated level2 format with bids/asks arrays

    const productId = message.product_id;

    if (message.type === 'snapshot') {
      // Full orderbook snapshot
      // Advanced Trade API format: updates array with {side, price_level, new_quantity, event_time}
      const orderbook = {
        type: 'snapshot',
        product_id: productId,
        bids: [],
        asks: []
      };

      // Parse updates array
      if (message.updates) {
        message.updates.forEach(update => {
          const priceLevel = {
            price: parseFloat(update.price_level),
            size: parseFloat(update.new_quantity)
          };

          if (update.side === 'bid') {
            orderbook.bids.push(priceLevel);
          } else if (update.side === 'offer') {
            orderbook.asks.push(priceLevel);
          }
        });
      }

      // Sort bids descending (highest first), asks ascending (lowest first)
      orderbook.bids.sort((a, b) => b.price - a.price);
      orderbook.asks.sort((a, b) => a.price - b.price);

      this.emit('level2', orderbook);

    } else if (message.type === 'l2update') {
      // Incremental update
      // Format: changes array with [side, price, size] tuples
      const updates = {
        type: 'update',
        product_id: productId,
        changes: []
      };

      if (message.changes) {
        message.changes.forEach(change => {
          updates.changes.push({
            side: change[0],  // 'buy' or 'sell'
            price: parseFloat(change[1]),
            size: parseFloat(change[2])  // 0 means remove this level
          });
        });
      }

      // Also handle Advanced Trade API format with updates array
      if (message.updates) {
        message.updates.forEach(update => {
          updates.changes.push({
            side: update.side === 'bid' ? 'buy' : 'sell',
            price: parseFloat(update.price_level),
            size: parseFloat(update.new_quantity)
          });
        });
      }

      this.emit('level2', updates);
    } else if (message.type === 'level2') {
      // Authenticated level2 format (direct bids/asks)
      const orderbook = {
        type: 'snapshot',
        product_id: productId,
        bids: [],
        asks: []
      };

      // Parse bids
      if (message.bids) {
        message.bids.forEach(bid => {
          orderbook.bids.push({
            price: parseFloat(bid[0]),
            size: parseFloat(bid[1])
          });
        });
      }

      // Parse asks
      if (message.asks) {
        message.asks.forEach(ask => {
          orderbook.asks.push({
            price: parseFloat(ask[0]),
            size: parseFloat(ask[1])
          });
        });
      }

      // Bids and asks are already sorted
      this.emit('level2', orderbook);
    }
  }

  /**
   * Handle match (trade) messages for multi-granularity aggregation
   */
  handleMatch(match) {
    const trade = {
      product_id: match.product_id,
      price: parseFloat(match.price),
      size: parseFloat(match.size),
      time: new Date(match.time).getTime() / 1000, // Convert to seconds
      side: match.side
    };

    // Update multi-granularity aggregator
    const aggregator = this.candleAggregators.get(match.product_id);
    if (aggregator) {
      // MultiGranularityAggregator.addTrade() returns array of candles for ALL granularities
      const candles = aggregator.addTrade(trade);

      // Process each granularity's candle
      candles.forEach(async (candleData) => {
        const { granularity, granularitySeconds, type, ...candle } = candleData;

        // Store completed candles in Redis
        if (type === 'complete') {
          await this.storeCandle(match.product_id, granularitySeconds, candle);
        }

        // Emit completed or updated candle for each granularity
        this.emit('candle', {
          ...candle,
          product_id: match.product_id,
          granularity: granularitySeconds,
          granularityKey: granularity,
          type
        });
      });
    }

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