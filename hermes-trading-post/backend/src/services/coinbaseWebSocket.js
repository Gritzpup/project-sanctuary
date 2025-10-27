import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { redisCandleStorage } from './redis/RedisCandleStorage.js';
import { redisOrderbookCache } from './redis/RedisOrderbookCache.js';
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

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('connected');

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
          reject(error);
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
      return;
    }

    this.exchangeIsConnecting = true;

    return new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        if (this.exchangeWs) {
          this.exchangeWs.terminate();
        }
        this.exchangeIsConnecting = false;
        reject(new Error('Exchange API connection timeout'));
      }, 10000);

      try {
        // Connect to Coinbase Exchange API WebSocket (legacy but functional)
        // This endpoint supports the 'level2' channel for orderbook data
        this.exchangeWs = new WebSocket('wss://ws-feed.exchange.coinbase.com');

        this.exchangeWs.on('open', () => {
          clearTimeout(connectionTimeout);
          this.exchangeIsConnected = true;
          this.exchangeIsConnecting = false;
          this.exchangeReconnectAttempts = 0;
          console.log('✅ [ExchangeAPI] Connected to Coinbase Exchange API WebSocket');

          // 🔧 FIX: Send authentication before subscribing to level2
          // Exchange API requires API key authentication for level2 channel
          this.authenticateExchangeAPI();

          // Resubscribe to any existing subscriptions (will be sent after auth)
          if (this.exchangeSubscriptions.size > 0) {
            // Schedule resubscription after short delay to ensure auth completes
            setTimeout(() => this.exchangeResubscribe(), 100);
          }

          resolve();
        });

        this.exchangeWs.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleExchangeMessage(message);
          } catch (error) {
            console.error('Failed to parse Exchange API message:', error);
          }
        });

        this.exchangeWs.on('close', (code, reason) => {
          this.exchangeIsConnected = false;
          this.exchangeIsConnecting = false;
          console.log('❌ [ExchangeAPI] Disconnected from Coinbase Exchange API');
          this.scheduleExchangeReconnect();
        });

        this.exchangeWs.on('error', (error) => {
          clearTimeout(connectionTimeout);
          this.exchangeIsConnected = false;
          this.exchangeIsConnecting = false;
          console.error('❌ [ExchangeAPI] WebSocket error:', error.message);
          reject(error);
        });

      } catch (error) {
        this.exchangeIsConnecting = false;
        console.error('❌ [ExchangeAPI] Failed to create WebSocket:', error);
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
      console.warn('⚠️ [ExchangeAPI] Cannot authenticate - not connected');
      return;
    }

    // Get CDP API key from environment
    const apiKeyName = process.env.CDP_API_KEY_NAME;
    const privateKey = process.env.CDP_API_KEY_PRIVATE;

    if (!apiKeyName || !privateKey) {
      console.error('❌ [ExchangeAPI] Missing CDP API credentials for Exchange WebSocket authentication');
      console.error('   Set CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE environment variables');
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

      console.log('🔐 [ExchangeAPI] Authenticating with CDP API key (ECDSA signature)...');
      this.exchangeWs.send(JSON.stringify(authMessage));
    } catch (error) {
      console.error('❌ [ExchangeAPI] Failed to generate ECDSA signature:', error.message);
    }
  }

  /**
   * Handle messages from Exchange API WebSocket
   */
  async handleExchangeMessage(message) {
    // Log ALL message types to understand what's being sent
    if (!this.exchangeMessageSampleLogged) {
      console.log('📨 [ExchangeAPI] FIRST MESSAGE:', JSON.stringify(message).substring(0, 800));
      this.exchangeMessageSampleLogged = true;
    }

    // Route based on type (Exchange API uses 'type' field, not 'channel')
    if (message.type === 'snapshot' || message.type === 'l2update') {
      await this.processExchangeLevel2(message);
    } else if (message.type === 'subscriptions') {
      console.log('✅ [ExchangeAPI] Subscription confirmed - channels:', JSON.stringify(message.channels));
    } else if (message.type === 'error') {
      console.error('❌ [ExchangeAPI] Error from Coinbase:', JSON.stringify(message));
    } else {
      console.log(`📨 [ExchangeAPI] Received message type: ${message.type}`);
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

      console.log(`📊 [ExchangeAPI] Level2 snapshot for ${productId}: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);

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
    console.log(`🔄 [ExchangeAPI] Resubscribing to ${this.exchangeSubscriptions.size} subscriptions`);
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
      console.error('❌ [ExchangeAPI] Max reconnection attempts reached');
      return;
    }

    this.exchangeReconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.exchangeReconnectAttempts - 1);

    setTimeout(() => {
      console.log(`🔄 [ExchangeAPI] Reconnection attempt ${this.exchangeReconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connectExchangeAPI().catch(error => {
        console.error(`❌ [ExchangeAPI] Reconnection failed:`, error.message);
      });
    }, delay);
  }

  /**
   * Subscribe to ticker updates for a product
   * 🔧 FIX: Advanced Trade API requires JWT authentication for ALL channels including ticker
   */
  subscribeTicker(productId) {
    console.log(`📡 [Ticker] Subscribe request for ${productId}`);
    const subscriptionKey = `ticker:${productId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`⚠️ [Ticker] Already subscribed to ticker:${productId}`);
      return;
    }

    // ✅ CRITICAL FIX: Use Advanced Trade API with JWT authentication
    // Advanced Trade API requires JWT for ALL subscriptions (ticker, level2, market_trades, etc.)
    // Get subscription with JWT from CDPAuth
    const subscription = cdpAuth.getWebSocketAuth();

    if (!subscription) {
      console.error('❌ [Ticker] Failed to generate JWT - cannot subscribe to ticker');
      return;
    }

    // Update channel and product_ids to the requested values
    subscription.channel = 'ticker';  // Advanced Trade API uses 'channel' (string), not 'channels' (array)
    subscription.product_ids = [productId];

    console.log(`✅ [Ticker] Subscription for ${productId} using Advanced Trade API with JWT`);
    console.log(`📡 This will provide REAL-TIME ticker updates (price, bid, ask, volume) via CDP`);

    this.subscriptions.set(subscriptionKey, subscription);

    // Send immediately if already connected
    if (this.isConnected && this.ws) {
      console.log(`📤 [Ticker] Sending ticker subscription to Advanced Trade API`);
      this.ws.send(JSON.stringify(subscription));
    } else {
      console.log(`⏳ [Ticker] Advanced Trade API not connected yet - subscription will be sent on connection`);
    }
  }

  /**
   * 🔧 FIX: Subscribe to level2 orderbook updates using Exchange API
   * Coinbase Advanced Trade API sends empty snapshots for level2 data
   * Need to use Exchange API (wss://ws-feed.exchange.coinbase.com) with 'level2' channel
   */
  subscribeLevel2(productId) {
    console.log(`📡 [Level2] Subscribe request for ${productId}`);
    const subscriptionKey = `level2:${productId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`⚠️ [Level2] Already subscribed to level2:${productId}`);
      return;
    }

    // Connect to Exchange API if not already connected
    if (!this.exchangeIsConnected && !this.exchangeIsConnecting) {
      console.log(`🔄 [Level2] Connecting to Exchange API for level2 data...`);
      this.connectExchangeAPI().then(() => {
        console.log(`✅ [Level2] Exchange API connected, subscribing to level2`);
        this.subscribeLevel2Exchange(productId);
      }).catch(error => {
        console.error(`❌ [Level2] Failed to connect to Exchange API:`, error);
      });
      return;
    }

    // If Exchange API is already connected, subscribe directly
    if (this.exchangeIsConnected) {
      this.subscribeLevel2Exchange(productId);
    } else {
      console.log(`⏳ [Level2] Exchange API is connecting, subscription will be sent once connected`);
      // Store subscription to be sent after connection
      this.subscriptions.set(subscriptionKey, { productId, type: 'level2' });
    }
  }

  /**
   * Subscribe to level2 on Exchange API
   */
  async subscribeLevel2Exchange(productId) {
    const fetchOrderbook = async () => {
      try {
        const response = await fetch(`https://api.exchange.coinbase.com/products/${productId}/book?level=2`);
        const orderbookData = await response.json();

        if (orderbookData.bids && orderbookData.asks) {
          // Limit to top 1000 levels to prevent memory issues
          const bids = orderbookData.bids.slice(0, 1000).map(([price, size]) => ({
            price: parseFloat(price),
            size: parseFloat(size)
          }));

          const asks = orderbookData.asks.slice(0, 1000).map(([price, size]) => ({
            price: parseFloat(price),
            size: parseFloat(size)
          }));

          // Convert to our format
          const orderbook = {
            type: 'snapshot',
            product_id: productId,
            bids,
            asks
          };

          // Already sorted from API
          // PERF: Disabled console.log(`📊 [Level2] REST API snapshot for ${productId}: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);

          // Cache in Redis
          if (this.orderbookCacheEnabled) {
            await redisOrderbookCache.storeOrderbookSnapshot(productId, orderbook.bids, orderbook.asks);
          }

          // Emit to listeners
          this.emit('level2', orderbook);
        }
      } catch (error) {
        console.error(`❌ [Level2] Failed to fetch orderbook from REST API:`, error.message);
      }
    };

    // Fetch initial orderbook
    await fetchOrderbook();

    // Set up periodic refresh (every 5 seconds to reduce memory pressure)
    if (!this.orderbookRefreshIntervals) {
      this.orderbookRefreshIntervals = new Map();
    }

    // Clear any existing interval for this product
    if (this.orderbookRefreshIntervals.has(productId)) {
      clearInterval(this.orderbookRefreshIntervals.get(productId));
    }

    // Set new interval for periodic updates
    const intervalId = setInterval(() => {
      fetchOrderbook();
    }, 1000); // Refresh every 1 second for faster orderbook updates

    this.orderbookRefreshIntervals.set(productId, intervalId);
    console.log(`🔄 [Level2] Set up periodic orderbook refresh for ${productId} every 5 seconds`);

    // Still try WebSocket for potential future updates if auth is fixed
    const subscription = {
      type: 'subscribe',
      product_ids: [productId],
      channels: ['level2_batch']  // Use level2_batch which might not require auth
    };

    if (this.exchangeWs && this.exchangeWs.readyState === WebSocket.OPEN) {
      this.exchangeWs.send(JSON.stringify(subscription));
      this.exchangeSubscriptions.set(`level2:${productId}`, subscription);
    }
  }

  /**
   * Subscribe to market_trades (trades) for real-time multi-granularity aggregation
   * Note: Advanced Trade API uses 'market_trades' channel (not 'matches' from old Exchange API)
   * 🔧 FIX: Advanced Trade API requires JWT authentication for ALL channels including market_trades
   */
  subscribeMatches(productId, granularity = '60') {
    console.log(`📡 [MarketTrades] Subscribe request for ${productId}`);
    const subscriptionKey = `matches:${productId}`;


    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`⚠️ [MarketTrades] Already subscribed to matches:${productId}`);
      return;
    }

    // ✅ CRITICAL FIX: Use Advanced Trade API with JWT authentication
    // Advanced Trade API requires JWT for ALL subscriptions (ticker, level2, market_trades, etc.)
    // Get subscription with JWT from CDPAuth
    const subscription = cdpAuth.getWebSocketAuth();

    if (!subscription) {
      console.error('❌ [MarketTrades] Failed to generate JWT - cannot subscribe to market_trades');
      return;
    }

    // Update channel and product_ids to the requested values
    subscription.channel = 'market_trades';  // Advanced Trade API uses 'channel' (string), not 'channels' (array)
    subscription.product_ids = [productId];

    console.log(`✅ [MarketTrades] Subscription for ${productId} using Advanced Trade API with JWT`);
    console.log(`📡 This will provide REAL-TIME trade data for candle aggregation via CDP`);

    this.subscriptions.set(subscriptionKey, subscription);

    // Initialize MULTI-GRANULARITY aggregator for this product (all timeframes at once)
    const aggregatorKey = productId; // Key by product only, since it handles all granularities
    if (!this.candleAggregators.has(aggregatorKey)) {
      const aggregator = new MultiGranularityAggregator(productId);
      console.log(`📊 [MarketTrades] Created MultiGranularityAggregator for ${productId}`);

      // Listen for gap detection events from the aggregator
      aggregator.on('gap_detected', async (gapInfo) => {
        await this.handleGapDetection(gapInfo);
      });

      this.candleAggregators.set(aggregatorKey, aggregator);
    }

    // Send immediately if already connected
    if (this.isConnected && this.ws) {
      console.log(`📤 [MarketTrades] Sending market_trades subscription to Advanced Trade API`);
      this.ws.send(JSON.stringify(subscription));
    } else {
      console.log(`⏳ [MarketTrades] Advanced Trade API not connected yet - subscription will be sent on connection`);
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
      this.candleAggregators.delete(productId);
    }
  }

  /**
   * Handle incoming WebSocket messages
   * Advanced Trade API uses 'channel' field, not 'type' field
   */
  async handleMessage(message) {
    // Log first message with level2-like data to understand structure
    if (!this.messageSampleLogged && (message.product_id === 'BTC-USD' || message.channel)) {
      console.log(`📨 [CoinbaseWS] SAMPLE MESSAGE STRUCTURE:`, JSON.stringify(message).substring(0, 500));
      this.messageSampleLogged = true;
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
   * Process individual l2_data event from Advanced Trade API
   */
  async processLevel2Event(event) {
    const productId = event.product_id;

    // Log the event structure once every 100 events to avoid log spam but still understand it
    if (!this.eventSampleLogged) {
      console.log(`📊 [CoinbaseWS] SAMPLE EVENT STRUCTURE:`, JSON.stringify(event).substring(0, 2000));
      this.eventSampleLogged = true;
    }

    console.log(`📊 [CoinbaseWS] Event for ${productId}: type=${event.type}, has updates=${!!event.updates}, has bids=${!!event.bids}, has asks=${!!event.asks}`);

    if (event.type === 'snapshot') {
      // Full orderbook snapshot

      const orderbook = {
        type: 'snapshot',
        product_id: productId,
        bids: [],
        asks: []
      };

      if (event.updates) {
        console.log(`  Updates array length: ${event.updates.length}`);
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
        console.log(`  Parsed: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
      } else {
        console.warn(`  ⚠️ No updates array in snapshot event!`);
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

      console.log(`📊 [CoinbaseWS] Emitting level2 snapshot: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
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
      console.log(`📊 [CoinbaseWS] Fallback: Processing snapshot for ${productId}, has updates=${!!message.updates}`);

      const orderbook = {
        type: 'snapshot',
        product_id: productId,
        bids: [],
        asks: []
      };

      // Parse updates array
      if (message.updates) {
        console.log(`📊 [CoinbaseWS] Parsing ${message.updates.length} updates from fallback snapshot`);
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

      console.log(`📊 [CoinbaseWS] Emitting level2 snapshot: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
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
      console.log(`📊 [CoinbaseWS] Emitting level2 snapshot: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);
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
      this.ws.send(JSON.stringify(subscription));
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