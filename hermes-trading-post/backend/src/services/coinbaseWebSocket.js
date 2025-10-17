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
      console.log(`⚠️ Already ${this.isConnecting ? 'connecting' : 'connected'} to Coinbase WebSocket`);
      return;
    }

    this.isConnecting = true;
    console.log('🔌 Connecting to Coinbase Advanced Trade WebSocket...');

    return new Promise((resolve, reject) => {
      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        console.error('🔴 Coinbase WebSocket connection timeout (10s)');
        if (this.ws) {
          this.ws.terminate();
        }
        this.isConnecting = false;
        reject(new Error('Connection timeout'));
      }, 10000);

      try {
        // Use Coinbase Advanced Trade WebSocket endpoint with CDP API key support
        // This endpoint supports Level2 channel with JWT authentication using CDP keys
        this.ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          console.log('✅✅✅ Connected to Coinbase Advanced Trade WebSocket ✅✅✅');
          console.log(`📊 Connection State: isConnected=true, subscriptions=${this.subscriptions.size}, aggregators=${this.candleAggregators.size}`);
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('connected');

          // Resubscribe to any existing subscriptions
          console.log(`📡 WebSocket connection established - resubscribing to ${this.subscriptions.size} channels`);
          if (this.subscriptions.size > 0) {
            this.resubscribe();
          } else {
            console.log('⚠️ No subscriptions to resubscribe - waiting for subscription requests');
          }

          // Resolve the promise
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing Coinbase WebSocket message:', error);
          }
        });

      this.ws.on('close', (code, reason) => {
        console.log('🔴 Coinbase WebSocket connection closed:', { code, reason: reason.toString() });
        console.log(`📊 Close State: isConnected=false, subscriptions=${this.subscriptions.size}, will reconnect`);
        this.isConnected = false;
        this.isConnecting = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          console.error('🔴 Coinbase WebSocket error:', error.message || error);
          console.log(`📊 Error State: isConnected=${this.isConnected}, isConnecting=${this.isConnecting}`);
          this.isConnected = false;
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        });

      } catch (error) {
        console.error('Error creating Coinbase WebSocket:', error);
        this.isConnecting = false;
        this.emit('error', error);
        reject(error);
      }
    });
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

    // ✅ FIXED: Advanced Trade API uses 'channel' (string), not 'channels' (array)
    const subscription = {
      type: 'subscribe',
      product_ids: [productId],
      channel: 'ticker'  // Changed from channels: ['ticker']
    };

    this.subscriptions.set(subscriptionKey, subscription);

    if (this.isConnected) {
      console.log(`📡 Subscribing to ticker for ${productId}`, JSON.stringify(subscription));
      this.ws.send(JSON.stringify(subscription));
    }
  }

  /**
   * Subscribe to level2 orderbook updates for depth chart visualization
   * Uses Advanced Trade WebSocket with CDP JWT authentication for REAL-TIME PUSH updates
   */
  subscribeLevel2(productId) {
    const subscriptionKey = `level2:${productId}`;

    console.log(`🔵 subscribeLevel2 called: productId=${productId}, isConnected=${this.isConnected}, existing=${this.subscriptions.has(subscriptionKey)}`);

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Already subscribed to level2 for ${productId}`);
      return;
    }

    // Generate JWT authentication for Advanced Trade WebSocket
    // getWebSocketAuth() returns the complete subscription message with auth fields
    const subscription = cdpAuth.getWebSocketAuth();

    if (!subscription) {
      console.error('❌ Failed to generate JWT auth for Level2 subscription');
      console.error('⚠️ Falling back to polling - WebSocket push requires CDP API keys');
      return;
    }

    // Update product_ids to use the requested productId (not hardcoded BTC-USD)
    subscription.product_ids = [productId];

    console.log(`🚀 Subscribing to AUTHENTICATED Level2 channel for ${productId} with CDP JWT`);
    console.log(`📡 This will provide REAL-TIME PUSH updates (no polling!)`);

    this.subscriptions.set(subscriptionKey, subscription);

    if (this.isConnected) {
      console.log(`📊 Sending authenticated Level2 subscription for ${productId}`);
      this.ws.send(JSON.stringify(subscription));
    } else {
      console.log(`⏳ WebSocket not connected yet, subscription will be sent on connection`);
    }
  }

  /**
   * Subscribe to market_trades (trades) for real-time multi-granularity aggregation
   * Note: Advanced Trade API uses 'market_trades' channel (not 'matches' from old Exchange API)
   */
  subscribeMatches(productId, granularity = '60') {
    const subscriptionKey = `matches:${productId}`;

    console.log(`🔵 subscribeMatches called: productId=${productId}, isConnected=${this.isConnected}, existing=${this.subscriptions.has(subscriptionKey)}`);

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Already subscribed to market_trades for ${productId}`);
      return;
    }

    // ✅ FIXED: Advanced Trade API uses 'channel' (string) and 'market_trades' (not 'matches')
    const subscription = {
      type: 'subscribe',
      product_ids: [productId],
      channel: 'market_trades'  // Changed from channels: ['matches']
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
      console.log(`📡 Subscribing to market_trades for ${productId}`, JSON.stringify(subscription));
      this.ws.send(JSON.stringify(subscription));
    } else {
      console.log(`⚠️ [CoinbaseWS] Cannot subscribe to market_trades - NOT CONNECTED! isConnected=${this.isConnected}, will subscribe on connection`);
      // Subscription is already added to this.subscriptions map, will be sent on connection via resubscribe()
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

    // ✅ FIXED: Advanced Trade API uses 'channel' (string), not 'channels' (array)
    const unsubscription = {
      type: 'unsubscribe',
      product_ids: [productId],
      channel: channel  // Changed from channels: [channel]
    };

    this.subscriptions.delete(subscriptionKey);

    if (this.isConnected) {
      console.log(`📡 Unsubscribing from ${channel} for ${productId}`);
      this.ws.send(JSON.stringify(unsubscription));
    }

    // Clean up aggregator if it was matches
    if (channel === 'matches' || channel === 'market_trades') {
      // Multi-granularity aggregators are keyed by productId only
      this.candleAggregators.delete(productId);
    }
  }

  /**
   * Handle incoming WebSocket messages
   * Advanced Trade API uses 'channel' field, not 'type' field
   */
  handleMessage(message) {
    // Advanced Trade API uses 'channel' field for routing
    if (message.channel) {
      switch (message.channel) {
        case 'market_trades':
          this.handleMarketTrades(message);
          break;

        case 'ticker':
          this.handleTicker(message);
          break;

        case 'l2_data':
          // Advanced Trade API uses 'l2_data' channel (not 'level2')
          // 🔇 Removed verbose logging - fires 100+ times/sec
          this.handleLevel2(message);
          break;

        case 'level2':
          console.log(`📊 [L2] Received level2 update for ${message.product_id}`);
          this.handleLevel2(message);
          break;

        case 'subscriptions':
          console.log('📡 Coinbase subscription confirmed:', JSON.stringify(message, null, 2));
          break;

        default:
          console.log(`❓ Unknown channel: ${message.channel}`, message);
          break;
      }
    }
    // Fallback for old Exchange API format (if any)
    else if (message.type) {
      switch (message.type) {
        case 'subscriptions':
          console.log('📡 Coinbase subscription confirmed:', JSON.stringify(message, null, 2));
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
          console.log(`📊 [L2] Received ${message.type} for ${message.product_id}`);
          this.handleLevel2(message);
          break;

        case 'error':
          console.error('🔴 Coinbase WebSocket error:', JSON.stringify(message, null, 2));
          break;

        default:
          console.log(`❓ Unknown message type: ${message.type}`, message);
          break;
      }
    } else {
      console.log(`❓ Unknown message format:`, message);
    }
  }

  /**
   * Handle ticker messages
   * Supports both Advanced Trade API (with events array) and legacy Exchange API
   */
  handleTicker(message) {
    // Advanced Trade API format: { channel: "ticker", events: [{ tickers: [...] }] }
    if (message.events && Array.isArray(message.events)) {
      message.events.forEach(event => {
        if (!event.tickers || !Array.isArray(event.tickers)) {
          return;
        }

        event.tickers.forEach(ticker => {
          this.emit('ticker', {
            product_id: ticker.product_id,
            price: parseFloat(ticker.price),
            best_bid: parseFloat(ticker.best_bid || 0),
            best_ask: parseFloat(ticker.best_ask || 0),
            time: message.timestamp || ticker.time,
            volume_24h: parseFloat(ticker.volume_24_h || ticker.volume_24h || 0)
          });
        });
      });
    }
    // Legacy Exchange API format: { type: "ticker", product_id, price, ... }
    else if (message.product_id) {
      this.emit('ticker', {
        product_id: message.product_id,
        price: parseFloat(message.price),
        best_bid: parseFloat(message.best_bid || 0),
        best_ask: parseFloat(message.best_ask || 0),
        time: message.time,
        volume_24h: parseFloat(message.volume_24h || 0)
      });
    }
  }

  /**
   * Process individual l2_data event from Advanced Trade API
   */
  processLevel2Event(event) {
    const productId = event.product_id;

    if (event.type === 'snapshot') {
      // Full orderbook snapshot
      const orderbook = {
        type: 'snapshot',
        product_id: productId,
        bids: [],
        asks: []
      };

      if (event.updates) {
        event.updates.forEach(update => {
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

      // Sort bids descending, asks ascending
      orderbook.bids.sort((a, b) => b.price - a.price);
      orderbook.asks.sort((a, b) => a.price - b.price);

      console.log(`📊 [L2] Emitting snapshot: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
      this.emit('level2', orderbook);

    } else if (event.type === 'update') {
      // Incremental update
      const updates = {
        type: 'update',
        product_id: productId,
        changes: []
      };

      if (event.updates) {
        event.updates.forEach(update => {
          updates.changes.push({
            side: update.side === 'bid' ? 'buy' : 'sell',
            price: parseFloat(update.price_level),
            size: parseFloat(update.new_quantity)
          });
        });
      }

      this.emit('level2', updates);
    }
  }

  /**
   * Handle level2 orderbook messages (snapshot and updates)
   */
  handleLevel2(message) {
    // Advanced Trade API l2_data messages have events array
    if (message.channel === 'l2_data' && message.events) {
      message.events.forEach(event => {
        this.processLevel2Event(event);
      });
      return;
    }

    // Legacy format handling below
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
   * Handle market_trades channel messages from Advanced Trade API
   * Format: { channel: "market_trades", events: [{ type: "update", trades: [...] }] }
   */
  handleMarketTrades(message) {
    if (!message.events || !Array.isArray(message.events)) {
      console.warn('⚠️ market_trades message missing events array');
      return;
    }

    // Process all events in the message
    message.events.forEach(event => {
      if (!event.trades || !Array.isArray(event.trades)) {
        return;
      }

      // Process each trade in the event
      event.trades.forEach(trade => {

        const tradeData = {
          product_id: trade.product_id,
          price: parseFloat(trade.price),
          size: parseFloat(trade.size),
          time: new Date(trade.time).getTime() / 1000, // Convert to seconds
          side: trade.side.toLowerCase() // Advanced Trade uses uppercase, normalize to lowercase
        };

        // Update multi-granularity aggregator
        const aggregator = this.candleAggregators.get(trade.product_id);
        if (aggregator) {
          // MultiGranularityAggregator.addTrade() returns array of candles for ALL granularities
          const candles = aggregator.addTrade(tradeData);

          // Process each granularity's candle
          candles.forEach(async (candleData) => {
            const { granularity, granularitySeconds, type, ...candle } = candleData;

            // Store completed candles in Redis
            if (type === 'complete') {
              await this.storeCandle(trade.product_id, granularitySeconds, candle);
            }

            // Emit completed or updated candle for each granularity
            this.emit('candle', {
              ...candle,
              product_id: trade.product_id,
              granularity: granularitySeconds,
              granularityKey: granularity,
              type
            });
          });
        }

        // Also emit raw trade for immediate updates
        this.emit('trade', tradeData);
      });
    });
  }

  /**
   * Handle match (trade) messages for multi-granularity aggregation
   * (Legacy Exchange API format - kept for backwards compatibility)
   */
  handleMatch(match) {
    console.log('🔥 [CoinbaseWS] Received match:', match.product_id, match.price, 'aggregators:', this.candleAggregators.size);
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
    console.log(`📡 Resubscribing to ${this.subscriptions.size} subscriptions...`);
    this.subscriptions.forEach((subscription, key) => {
      console.log(`📤 Sending subscription for ${key}:`, JSON.stringify(subscription, null, 2));
      this.ws.send(JSON.stringify(subscription));
    });
    console.log('✅ All subscriptions sent');
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