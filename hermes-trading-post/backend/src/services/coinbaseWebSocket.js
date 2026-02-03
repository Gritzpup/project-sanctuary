import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { redisCandleStorage } from './redis/RedisCandleStorage.js';
import { redisOrderbookCache } from './redis/RedisOrderbookCache.js';
import { coinbaseAPI } from './CoinbaseAPIService.js';
import { MultiGranularityAggregator } from './MultiGranularityAggregator.js';
import { cdpAuth } from './CDPAuth.js';
import { config } from './ConfigurationService.js';

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
    this.hasConnectedOnce = false; // 🔧 FIX: Track if we've ever connected successfully

    // 🔧 FIX: Separate WebSocket for Exchange API level2 data
    // Coinbase Advanced Trade API doesn't support level2 orderbook data
    // So we need a separate connection to the Exchange API
    this.exchangeWs = null;
    this.exchangeSubscriptions = new Map();
    this.exchangeReconnectAttempts = 0;
    this.exchangeIsConnecting = false;
    this.exchangeIsConnected = false;

    // Candle aggregation
    this.candleAggregators = new Map(); // key: "pair:granularity", value: aggregator

    // 🔧 FIX: Track last trade time to detect silent failures
    this.lastTradeTime = 0;
    this.tradeHeartbeatInterval = null;
    this.TRADE_TIMEOUT_MS = 60000; // 60 seconds without trades = problem
    this.HEARTBEAT_CHECK_MS = 30000; // Check every 30 seconds

    // 🔥 MEMORY LEAK FIX: Track all timeouts/intervals for cleanup
    this.reconnectTimeout = null; // For Advanced Trade API reconnection
    this.exchangeReconnectTimeout = null; // For Exchange API reconnection
    this.orderbookRefreshIntervals = new Map(); // Map<productId, intervalId>

    // Redis storage integration
    this.redisStorageEnabled = true;
    this.orderbookCacheEnabled = true;
    this.initializeRedisStorage();
    this.initializeOrderbookCache();
  }

  /**
   * Initialize Redis storage for candle data
   */
  async initializeRedisStorage() {
    if (!this.redisStorageEnabled) return;

    try {
      await redisCandleStorage.connect();
    } catch (error) {
      this.redisStorageEnabled = false;
    }
  }

  /**
   * Initialize Redis orderbook cache for Level2 data
   */
  async initializeOrderbookCache() {
    if (!this.orderbookCacheEnabled) return;

    try {
      await redisOrderbookCache.connect();
    } catch (error) {
      this.orderbookCacheEnabled = false;
    }
  }

  /**
   * Handle gap detection by fetching missing data from API
   */
  async handleGapDetection(gapInfo) {
    const { productId, granularity, lastCandleTime, newCandleTime, missedCandles, gapSeconds } = gapInfo;
    
    if (missedCandles < 1) return; // No significant gap
    
    
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
      
      
      const missingCandles = await coinbaseAPI.getCandles(
        productId,
        granularity,
        startTime,
        endTime
      );
      
      if (missingCandles && missingCandles.length > 0) {
        // Store the fetched candles in Redis
        await redisCandleStorage.storeCandles(productId, granularityStr, missingCandles);
        
        
        // Emit event for frontend to refresh data
        this.emit('gap_filled', {
          productId,
          granularity: granularityStr,
          candlesFilled: missingCandles.length,
          timeRange: { start: startTime, end: endTime }
        });
      } else {
      }
      
    } catch (error) {
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
      //   time: new Date(candle.time * 1000).toISOString(),
      //   price: candle.close,
      //   volume: candle.volume
      // });
    } catch (error) {
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

    return new Promise((resolve, reject) => {
      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
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

        // 🔥 MEMORY LEAK FIX: Remove old listeners before adding new ones
        // This prevents listener accumulation during reconnection cycles
        this.ws.removeAllListeners();

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.hasConnectedOnce = true; // 🔧 FIX: Mark that we've successfully connected
          this.emit('connected');

          // 🔧 FIX: Start heartbeat monitor to detect trade flow issues
          this.startTradeHeartbeatMonitor();

          // 🔧 FIX: Start JWT auto-renewal to prevent token expiration
          // Renews every 90s and triggers WebSocket reconnection with fresh token
          cdpAuth.startAutoRenewal((newToken) => {
            // Close current connection to trigger reconnect with new JWT
            if (this.ws) {
              this.ws.close();
            }
          });

          // Resubscribe to any existing subscriptions
          if (this.subscriptions.size > 0) {
            this.resubscribe();
          } else {
          }

          // Resolve the promise
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
          }
        });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.isConnecting = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          this.isConnecting = false;

          this.emit('error', error);

          // 🔧 FIX: Only reject promise for initial connection failures
          // Don't reject for reconnection errors (they're handled by scheduleReconnect)
          // This prevents unhandled promise rejection crashes
          if (!this.hasConnectedOnce) {
            reject(error);
          }
        });

      } catch (error) {
        this.isConnecting = false;
        this.emit('error', error);
        reject(error);
      }
    });
  }

  /**
   * 🔧 FIX: Connect to Coinbase Exchange API WebSocket for Level2 orderbook data
   * The Advanced Trade API doesn't support level2 orderbook data streaming
   * So we use the Exchange API (wss://ws-feed.exchange.coinbase.com) for level2
   */
  async connectExchangeAPI() {
    if (this.exchangeIsConnecting || this.exchangeIsConnected) {
      console.log(`[ExchangeAPI] Already connected or connecting`);
      return;
    }

    console.log(`[ExchangeAPI] Connecting to wss://ws-feed.exchange.coinbase.com`);
    this.exchangeIsConnecting = true;

    return new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        console.error(`[ExchangeAPI] Connection timeout after 10s`);
        if (this.exchangeWs) {
          this.exchangeWs.terminate();
        }
        this.exchangeIsConnecting = false;
        reject(new Error('Exchange API connection timeout'));
      }, 10000);

      try {
        // Connect to Coinbase Exchange API WebSocket (public API for level2)
        this.exchangeWs = new WebSocket('wss://ws-feed.exchange.coinbase.com');

        // 🔥 MEMORY LEAK FIX: Remove old listeners before adding new ones
        // This prevents listener accumulation during reconnection cycles
        this.exchangeWs.removeAllListeners();

        this.exchangeWs.on('open', () => {
          clearTimeout(connectionTimeout);
          this.exchangeIsConnected = true;
          this.exchangeIsConnecting = false;
          this.exchangeReconnectAttempts = 0;
          console.log(`[ExchangeAPI] Connected successfully`);

          // Resubscribe to any existing subscriptions
          if (this.exchangeSubscriptions.size > 0) {
            setTimeout(() => this.exchangeResubscribe(), 100);
          }

          resolve();
        });

        this.exchangeWs.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleExchangeMessage(message);
          } catch (error) {
            console.error(`[ExchangeAPI] Message parse error:`, error.message);
          }
        });

        this.exchangeWs.on('close', (code, reason) => {
          console.log(`[ExchangeAPI] Connection closed, code: ${code}, reason: ${reason}`);
          this.exchangeIsConnected = false;
          this.exchangeIsConnecting = false;
          this.scheduleExchangeReconnect();
        });

        this.exchangeWs.on('error', (error) => {
          console.error(`[ExchangeAPI] WebSocket error:`, error.message);
          clearTimeout(connectionTimeout);
          this.exchangeIsConnected = false;
          this.exchangeIsConnecting = false;
          reject(error);
        });

      } catch (error) {
        console.error(`[ExchangeAPI] Failed to create WebSocket:`, error.message);
        this.exchangeIsConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 🔧 FIX: Authenticate with Coinbase Exchange API for level2 access
   * Uses CDP API keys (ECDSA) with proper ECDSA signature generation
   */
  authenticateExchangeAPI() {
    if (!this.exchangeIsConnected || !this.exchangeWs) {
      return;
    }

    // Get CDP API key from configuration
    const apiKeyName = config.get('CDP_API_KEY_NAME');
    const privateKey = config.get('CDP_API_KEY_PRIVATE');

    if (!apiKeyName || !privateKey) {
      return;
    }

    // Generate ECDSA signature for Exchange API
    // Message format: {timestamp}GET/users/self/verify
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}GET/users/self/verify`;

    try {
      const sign = crypto.createSign('SHA256');
      sign.update(message);
      sign.end();
      const signature = sign.sign(privateKey, 'base64');

      // Exchange API WebSocket authentication with ECDSA signature
      const authMessage = {
        type: 'subscribe',
        product_ids: ['BTC-USD'],
        channels: ['level2'],
        signature: signature,  // ECDSA signature
        key: apiKeyName,
        timestamp: timestamp.toString()
      };

      this.exchangeWs.send(JSON.stringify(authMessage));
    } catch (error) {
    }
  }

  /**
   * Handle messages from Exchange API WebSocket
   */
  async handleExchangeMessage(message) {
    // Route based on type (Exchange API uses 'type' field, not 'channel')
    if (message.type === 'snapshot') {
      console.log(`[ExchangeAPI] Received snapshot for ${message.product_id}: ${message.bids?.length || 0} bids, ${message.asks?.length || 0} asks`);
      await this.processExchangeLevel2(message);
    } else if (message.type === 'l2update') {
      await this.processExchangeLevel2(message);
    } else if (message.type === 'subscriptions') {
      console.log(`[ExchangeAPI] Subscription confirmed:`, JSON.stringify(message.channels));
    } else if (message.type === 'error') {
      console.error(`[ExchangeAPI] Error from server:`, message.message || JSON.stringify(message));
    } else {
      console.log(`[ExchangeAPI] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Process level2 data from Exchange API
   */
  async processExchangeLevel2(message) {
    const productId = message.product_id;

    if (message.type === 'snapshot') {
      // Full orderbook snapshot
      const orderbook = {
        type: 'snapshot',
        product_id: productId,
        bids: [],
        asks: []
      };

      // Parse bids (Exchange API format: [price_string, size_string])
      if (message.bids && Array.isArray(message.bids)) {
        message.bids.forEach(([price, size]) => {
          orderbook.bids.push({
            price: parseFloat(price),
            size: parseFloat(size)
          });
        });
      }

      // Parse asks
      if (message.asks && Array.isArray(message.asks)) {
        message.asks.forEach(([price, size]) => {
          orderbook.asks.push({
            price: parseFloat(price),
            size: parseFloat(size)
          });
        });
      }

      // Sort bids descending, asks ascending
      orderbook.bids.sort((a, b) => b.price - a.price);
      orderbook.asks.sort((a, b) => a.price - b.price);


      // Cache in Redis
      if (this.orderbookCacheEnabled) {
        await redisOrderbookCache.storeOrderbookSnapshot(productId, orderbook.bids, orderbook.asks);
      }

      // Emit to listeners
      this.emit('level2', orderbook);

    } else if (message.type === 'l2update') {
      // Incremental update
      const changes = [];

      if (message.changes && Array.isArray(message.changes)) {
        message.changes.forEach(([side, price, size]) => {
          changes.push({
            side: side === 'buy' ? 'buy' : 'sell',
            price: parseFloat(price),
            size: parseFloat(size)
          });
        });
      }

      const updates = {
        type: 'update',
        product_id: productId,
        changes: changes
      };

      // Apply to cache
      if (this.orderbookCacheEnabled) {
        await redisOrderbookCache.applyUpdate(productId, changes);
      }

      // Emit update
      this.emit('level2', updates);
    }
  }

  /**
   * Resubscribe to Exchange API subscriptions after reconnection
   */
  exchangeResubscribe() {
    this.exchangeSubscriptions.forEach((subscription) => {
      if (this.exchangeIsConnected) {
        this.exchangeWs.send(JSON.stringify(subscription));
      }
    });
  }

  /**
   * Schedule Exchange API reconnection with exponential backoff
   */
  scheduleExchangeReconnect() {
    if (this.exchangeReconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.exchangeReconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.exchangeReconnectAttempts - 1);

    // 🔥 MEMORY LEAK FIX: Clear any existing reconnect timeout
    if (this.exchangeReconnectTimeout) {
      clearTimeout(this.exchangeReconnectTimeout);
    }

    // 🔥 MEMORY LEAK FIX: Store timeout ID for cleanup
    this.exchangeReconnectTimeout = setTimeout(() => {
      this.connectExchangeAPI().catch(error => {
      });
    }, delay);
  }

  /**
   * Subscribe to ticker updates for a product
   * 🔧 FIX: Advanced Trade API requires JWT authentication for ALL channels including ticker
   */
  subscribeTicker(productId) {
    const subscriptionKey = `ticker:${productId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return;
    }

    // ✅ CRITICAL FIX: Use Advanced Trade API with JWT authentication
    // Advanced Trade API requires JWT for ALL subscriptions (ticker, level2, market_trades, etc.)
    // Get subscription with JWT from CDPAuth
    const subscription = cdpAuth.getWebSocketAuth();

    if (!subscription) {
      return;
    }

    // Update channel and product_ids to the requested values
    subscription.channel = 'ticker';  // Advanced Trade API uses 'channel' (string), not 'channels' (array)
    subscription.product_ids = [productId];


    this.subscriptions.set(subscriptionKey, subscription);

    // Send immediately if already connected
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(subscription));
    } else {
    }
  }

  /**
   * Subscribe to candles (OHLCV) updates using Advanced Trade API
   * Candles channel provides candle data updates every second grouped into 5-minute buckets
   * This is the PROPER way to get candle data - better than aggregating from trades
   */
  subscribeCandles(productId) {
    const subscriptionKey = `candles:${productId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return;
    }

    // Advanced Trade API requires JWT for ALL subscriptions
    const subscription = cdpAuth.getWebSocketAuth();

    if (!subscription) {
      return;
    }

    // Update channel and product_ids to the requested values
    subscription.channel = 'candles';
    subscription.product_ids = [productId];


    this.subscriptions.set(subscriptionKey, subscription);

    // Send immediately if already connected
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(subscription));
    } else {
    }
  }

  /**
   * 🔧 FIX: Subscribe to level2 orderbook updates using Exchange API
   * Coinbase Advanced Trade API sends empty snapshots for level2 data
   * Need to use Exchange API (wss://ws-feed.exchange.coinbase.com) with 'level2' channel
   */
  subscribeLevel2(productId) {
    const subscriptionKey = `level2:${productId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`[Level2] Already subscribed to ${productId}`);
      return;
    }

    // Track subscription immediately for visibility in health check
    this.subscriptions.set(subscriptionKey, { productId, type: 'level2', pending: true });
    console.log(`[Level2] Subscribing to ${productId} via Exchange WebSocket`);

    // Connect to Exchange API if not already connected
    if (!this.exchangeIsConnected && !this.exchangeIsConnecting) {
      this.connectExchangeAPI().then(() => {
        console.log(`[Level2] Exchange API connected, subscribing to level2 channel`);
        this.subscribeLevel2Exchange(productId);
        this.subscriptions.set(subscriptionKey, { productId, type: 'level2', connected: true });
      }).catch(error => {
        console.error(`[Level2] Exchange API connection failed:`, error.message);
        // No REST fallback - WebSocket only
        this.subscriptions.set(subscriptionKey, { productId, type: 'level2', failed: true });
      });
      return;
    }

    // If Exchange API is already connected, subscribe directly
    if (this.exchangeIsConnected) {
      console.log(`[Level2] Exchange API already connected, subscribing directly`);
      this.subscribeLevel2Exchange(productId);
      this.subscriptions.set(subscriptionKey, { productId, type: 'level2', connected: true });
    }
  }

  /**
   * Subscribe to level2 on Exchange API via WebSocket (no REST polling)
   * Uses level2_batch channel which doesn't require authentication
   * level2_batch delivers data in 50ms batches
   */
  subscribeLevel2Exchange(productId) {
    console.log(`[Level2] Subscribing to ${productId} on Exchange WebSocket (level2_batch channel)`);

    // Subscribe via WebSocket - level2_batch channel (no auth needed, 50ms batches)
    const subscription = {
      type: 'subscribe',
      product_ids: [productId],
      channels: ['level2_batch']
    };

    if (this.exchangeWs && this.exchangeWs.readyState === WebSocket.OPEN) {
      this.exchangeWs.send(JSON.stringify(subscription));
      this.exchangeSubscriptions.set(`level2:${productId}`, subscription);
      console.log(`[Level2] Subscription message sent for ${productId} (level2_batch)`);
    } else {
      console.error(`[Level2] Exchange WebSocket not ready, state: ${this.exchangeWs?.readyState}`);
    }
  }

  /**
   * Subscribe to market_trades (trades) for real-time multi-granularity aggregation
   * Note: Advanced Trade API uses 'market_trades' channel (not 'matches' from old Exchange API)
   * 🔧 FIX: Advanced Trade API requires JWT authentication for ALL channels including market_trades
   */
  subscribeMatches(productId, granularity = '60') {
    const subscriptionKey = `matches:${productId}`;


    if (this.subscriptions.has(subscriptionKey)) {
      return;
    }

    // ✅ CRITICAL FIX: Use Advanced Trade API with JWT authentication
    // Advanced Trade API requires JWT for ALL subscriptions (ticker, level2, market_trades, etc.)
    // Get subscription with JWT from CDPAuth
    const subscription = cdpAuth.getWebSocketAuth();

    if (!subscription) {
      return;
    }

    // Update channel and product_ids to the requested values
    subscription.channel = 'market_trades';  // Advanced Trade API uses 'channel' (string), not 'channels' (array)
    subscription.product_ids = [productId];


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
    }

    // Send immediately if already connected
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(subscription));
    } else {
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
      this.ws.send(JSON.stringify(unsubscription));
    }

    // Clean up aggregator if it was matches
    if (channel === 'matches' || channel === 'market_trades') {
      // Multi-granularity aggregators are keyed by productId only
      const aggregator = this.candleAggregators.get(productId);
      if (aggregator) {
        // 🔥 MEMORY LEAK FIX: Call destroy() to clean up listeners and clear data
        aggregator.destroy();
      }
      this.candleAggregators.delete(productId);
    }
  }

  /**
   * Handle incoming WebSocket messages
   * Advanced Trade API uses 'channel' field, not 'type' field
   */
  async handleMessage(message) {
    // 🔧 DEBUG: Log ALL message channels to diagnose why candles aren't flowing
    if (message.channel) {
      // Track message counts per channel
      if (!this.messageChannelCounts) {
        this.messageChannelCounts = {};
        this.lastChannelLogTime = 0;
      }
      this.messageChannelCounts[message.channel] = (this.messageChannelCounts[message.channel] || 0) + 1;

      // Log channel summary every 30 seconds
      const now = Date.now();
      if (now - this.lastChannelLogTime > 30000) {
        this.messageChannelCounts = {}; // Reset
        this.lastChannelLogTime = now;
      }

      // Always log candles messages since they're critical and rare
      if (message.channel === 'candles') {
      }
    }

    // Advanced Trade API uses 'channel' field for routing
    if (message.channel) {
      switch (message.channel) {
        case 'market_trades':
          this.handleMarketTrades(message);
          break;

        case 'ticker':
          this.handleTicker(message);
          break;

        case 'candles':
          this.handleCandles(message);
          break;

        case 'l2_data':
          // Advanced Trade API uses 'l2_data' channel (not 'level2')
          await this.handleLevel2(message);
          break;

        case 'level2':
          await this.handleLevel2(message);
          break;

        case 'subscriptions':
          break;

        default:
          break;
      }
    }
    // Fallback for old Exchange API format (if any)
    else if (message.type) {
      switch (message.type) {
        case 'subscriptions':
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
          await this.handleLevel2(message);
          break;

        case 'error':
          break;

        default:
          break;
      }
    } else {
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
   * Handle candles channel messages from Advanced Trade API
   * Format: { channel: "candles", events: [{ type: "snapshot", candles: [...] }] }
   * Candles are 5-minute OHLCV data updated every second
   */
  async handleCandles(message) {
    if (!message.events || !Array.isArray(message.events)) {
      return;
    }


    // Process all events in the message
    message.events.forEach(event => {
      if (!event.candles || !Array.isArray(event.candles)) {
        return;
      }


      // Process each candle
      event.candles.forEach(async (candleData) => {
        const productId = candleData.product_id;

        // Convert Coinbase candle format to our internal format
        const candle = {
          time: parseInt(candleData.start), // UNIX timestamp
          open: parseFloat(candleData.open),
          high: parseFloat(candleData.high),
          low: parseFloat(candleData.low),
          close: parseFloat(candleData.close),
          volume: parseFloat(candleData.volume || 0)
        };


        // Store in Redis (5m = 300 seconds)
        await this.storeCandle(productId, 300, candle);

        // Emit candle event for broadcasting
        // Frontend expects: {product_id, granularity (seconds), time, open, high, low, close, volume, granularityKey, type}
        this.emit('candle', {
          ...candle,
          product_id: productId,
          granularity: 300, // 5 minutes in seconds
          granularityKey: '5m',
          type: event.type === 'snapshot' ? 'complete' : 'update'
        });
      });
    });
  }

  /**
   * Process individual l2_data event from Advanced Trade API
   */
  async processLevel2Event(event) {
    const productId = event.product_id;

    // Log the event structure once every 100 events to avoid log spam but still understand it
    if (!this.eventSampleLogged) {
      this.eventSampleLogged = true;
    }


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
      } else {
      }

      // Sort bids descending, asks ascending
      orderbook.bids.sort((a, b) => b.price - a.price);
      orderbook.asks.sort((a, b) => a.price - b.price);

      // ✅ CRITICAL: Always emit snapshots - clients need them for initial orderbook state
      // Don't filter snapshots based on cache changes - they're needed for state sync
      // Only store in cache for tracking, but always forward to clients
      if (this.orderbookCacheEnabled) {
        await redisOrderbookCache.storeOrderbookSnapshot(productId, orderbook.bids, orderbook.asks);
      }

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
   * Integrates Redis caching and smart update forwarding
   */
  async handleLevel2(message) {
    // Advanced Trade API level2 messages have events array
    // Both 'level2' and 'l2_data' channels can contain events array
    if ((message.channel === 'level2' || message.channel === 'l2_data') && message.events) {
      await Promise.all(message.events.map(event => this.processLevel2Event(event)));
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

      // 🚀 PERFORMANCE: Cache snapshot in Redis and check if it has changed
      if (this.orderbookCacheEnabled) {
        await redisOrderbookCache.storeOrderbookSnapshot(productId, orderbook.bids, orderbook.asks);

        // Only emit if data has actually changed
        if (!redisOrderbookCache.hasOrderbookChanged(productId)) {
          return;
        }
      }

      // Check throttling - only forward max 10 updates/sec per product
      if (redisOrderbookCache.shouldThrottle(productId, 10)) {
        return;
      }

      // 🚀 PERF: Publish orderbook deltas via Redis Pub/Sub (only changed levels)
      const changedLevels = await redisOrderbookCache.getChangedLevels(productId);
      if (changedLevels.bids.length > 0 || changedLevels.asks.length > 0) {
        redisOrderbookCache.publishOrderbookDelta(productId, changedLevels.bids, changedLevels.asks);
      }

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

      // ⚡ PHASE 13: Check throttling FIRST to avoid expensive operations
      // Throttle to 10 updates/sec BEFORE applying to cache or parsing
      if (this.orderbookCacheEnabled && redisOrderbookCache.shouldThrottle(productId, 10)) {
        return; // Skip this update without expensive operations
      }

      // 🚀 PERFORMANCE: Apply update to cache only if not throttled
      if (this.orderbookCacheEnabled) {
        await redisOrderbookCache.applyUpdate(productId, updates.changes);

        // 🚀 PERF: Publish orderbook deltas via Redis Pub/Sub (only changed levels)
        const changedLevels = await redisOrderbookCache.getChangedLevels(productId);
        if (changedLevels.bids.length > 0 || changedLevels.asks.length > 0) {
          redisOrderbookCache.publishOrderbookDelta(productId, changedLevels.bids, changedLevels.asks);
        }
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

      // 🚀 PERFORMANCE: Cache snapshot in Redis
      if (this.orderbookCacheEnabled) {
        await redisOrderbookCache.storeOrderbookSnapshot(productId, orderbook.bids, orderbook.asks);

        // Only emit if data has actually changed
        if (!redisOrderbookCache.hasOrderbookChanged(productId)) {
          return;
        }

        // Check throttling - only forward max 10 updates/sec per product
        if (redisOrderbookCache.shouldThrottle(productId, 10)) {
          return;
        }

        // 🚀 PERF: Publish orderbook deltas via Redis Pub/Sub (only changed levels)
        const changedLevels = await redisOrderbookCache.getChangedLevels(productId);
        if (changedLevels.bids.length > 0 || changedLevels.asks.length > 0) {
          redisOrderbookCache.publishOrderbookDelta(productId, changedLevels.bids, changedLevels.asks);
        }
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
      return;
    }

    // 🔧 FIX: Update last trade time to monitor trade flow health
    this.lastTradeTime = Date.now();

    // Process all events in the message
    message.events.forEach(event => {
      if (!event.trades || !Array.isArray(event.trades)) {
        return;
      }

      // PERF: Disabled - excessive logging causes browser lag

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

    this.subscriptions.forEach((subscription, key) => {
      // 🔧 FIX: Regenerate JWT token for each subscription
      // Stored subscriptions have STALE JWT tokens (expired after 120s)
      // Must generate fresh JWT before resubscribing
      const freshAuth = cdpAuth.getWebSocketAuth();

      if (freshAuth) {
        // Preserve the channel and product_ids from the original subscription
        freshAuth.channel = subscription.channel;
        freshAuth.product_ids = subscription.product_ids;

        // Update stored subscription with fresh JWT
        this.subscriptions.set(key, freshAuth);

        // Send with fresh JWT
        this.ws.send(JSON.stringify(freshAuth));
      } else {
      }
    });
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    // 🔥 MEMORY LEAK FIX: Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // 🔥 MEMORY LEAK FIX: Store timeout ID for cleanup
    this.reconnectTimeout = setTimeout(() => {
      // 🔧 FIX: Add catch handler to prevent unhandled promise rejection
      // This prevents the server from crashing when reconnection fails
      this.connect().catch(error => {
        // Don't crash - the scheduleReconnect will be called again from the close handler
      });
    }, delay);
  }

  /**
   * Disconnect and cleanup
   */
  /**
   * 🔧 FIX: Start heartbeat monitor to detect when trades stop flowing
   * Coinbase market_trades channel can silently stop sending data
   */
  startTradeHeartbeatMonitor() {
    // Clear any existing interval
    if (this.tradeHeartbeatInterval) {
      clearInterval(this.tradeHeartbeatInterval);
    }


    // Track when the monitor started to detect if we NEVER receive trades
    const monitorStartTime = Date.now();

    this.tradeHeartbeatInterval = setInterval(() => {
      const now = Date.now();

      // 🔧 CRITICAL FIX: Check TWO conditions:
      // 1. If lastTradeTime = 0 (never received trades) AND monitor running for 60s+ = STUCK
      // 2. If lastTradeTime > 0 (received trades before) AND no trades for 60s+ = STALE

      if (this.lastTradeTime === 0) {
        // Never received any trades - check if we've been waiting too long
        const timeSinceMonitorStart = now - monitorStartTime;
        if (timeSinceMonitorStart > this.TRADE_TIMEOUT_MS) {

          if (this.ws) {
            this.ws.close();
          }
        }
        return; // Don't check lastTradeTime if it's 0
      }

      const timeSinceLastTrade = now - this.lastTradeTime;

      // If we haven't received trades in TRADE_TIMEOUT_MS, something is wrong
      if (timeSinceLastTrade > this.TRADE_TIMEOUT_MS) {

        // 🔧 CRITICAL FIX: Coinbase WebSocket goes stale - resubscribing doesn't work
        // We need to close and reconnect the entire WebSocket connection

        // Close current WebSocket and trigger reconnection
        if (this.ws) {
          this.ws.close();
          // The 'close' event handler will trigger scheduleReconnect()
        }

        // 🔧 FIX: Reset to 0 so we wait for first trade after reconnection
        // Don't set to 'now' - that defeats the purpose of the heartbeat
        this.lastTradeTime = 0;
      }
    }, this.HEARTBEAT_CHECK_MS);
  }

  /**
   * Stop heartbeat monitor
   */
  stopTradeHeartbeatMonitor() {
    if (this.tradeHeartbeatInterval) {
      clearInterval(this.tradeHeartbeatInterval);
      this.tradeHeartbeatInterval = null;
    }
  }

  disconnect() {
    // Stop heartbeat monitor
    this.stopTradeHeartbeatMonitor();

    // 🔥 MEMORY LEAK FIX: Clear all reconnect timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.exchangeReconnectTimeout) {
      clearTimeout(this.exchangeReconnectTimeout);
      this.exchangeReconnectTimeout = null;
    }

    // 🔥 MEMORY LEAK FIX: Clear all orderbook refresh intervals
    for (const [productId, intervalId] of this.orderbookRefreshIntervals.entries()) {
      clearInterval(intervalId);
    }
    this.orderbookRefreshIntervals.clear();

    // 🔧 FIX: Stop JWT auto-renewal
    cdpAuth.stopAutoRenewal();

    if (this.ws) {
      // 🔥 MEMORY LEAK FIX: Remove all event listeners before closing
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    if (this.exchangeWs) {
      // 🔥 MEMORY LEAK FIX: Remove all event listeners from Exchange WebSocket
      this.exchangeWs.removeAllListeners();
      this.exchangeWs.close();
      this.exchangeWs = null;
    }

    // 🔥 MEMORY LEAK FIX: Clear all data structures
    this.subscriptions.clear();
    this.exchangeSubscriptions.clear();
    // Clean up all candle aggregators before clearing the map
    for (const aggregator of this.candleAggregators.values()) {
      aggregator.destroy();
    }
    this.candleAggregators.clear();

    // 🔥 MEMORY LEAK FIX: Remove all EventEmitter listeners
    this.removeAllListeners();

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.exchangeIsConnected = false;
    this.exchangeIsConnecting = false;
    this.exchangeReconnectAttempts = 0;

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