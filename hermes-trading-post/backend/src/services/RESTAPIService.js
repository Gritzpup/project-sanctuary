/**
 * RESTAPIService - Consolidated REST API endpoint handlers
 *
 * Phase 5C: Backend Monolith Split
 * Extracted from index.js to centralize all REST API routes
 * Handles orderbook, candles, time, and health check endpoints
 */

export class RESTAPIService {
  constructor(dependencies) {
    this.redisOrderbookCache = dependencies.redisOrderbookCache;
    this.redisCandleStorage = dependencies.redisCandleStorage;
    // Bot Manager now runs on separate hermes-bots service (port 4829)
    this.coinbaseWebSocket = dependencies.coinbaseWebSocket;
    this.continuousCandleUpdater = dependencies.continuousCandleUpdater;
    this.chartSubscriptions = dependencies.chartSubscriptions;
    this.activeSubscriptions = dependencies.activeSubscriptions;
    this.granularityMappings = dependencies.granularityMappings;
    this.memoryMonitor = dependencies.memoryMonitor;
  }

  /**
   * Register all REST API routes with Express app
   */
  registerRoutes(app) {
    // Orderbook endpoints
    app.get('/api/orderbook/:productId', (req, res) => this.getOrderbook(req, res));
    app.get('/api/orderbook/:productId/range', (req, res) => this.getOrderbookRange(req, res));
    app.get('/api/orderbook/:productId/top', (req, res) => this.getTopOrders(req, res));

    // Candles endpoint
    app.get('/api/candles/:pair/:granularity', (req, res) => this.getCandles(req, res));

    // Server info endpoints
    app.get('/api/time', (req, res) => this.getServerTime(req, res));
    app.get('/health', (req, res) => this.getHealthStatus(req, res));

    console.log('✅ RESTAPIService registered - 6 endpoints ready');
  }

  /**
   * Get full cached orderbook with 2-second timeout
   */
  async getOrderbook(req, res) {
    const { productId } = req.params;

    try {
      console.log(`📥 [API] Received orderbook request for ${productId}`);

      // Get full cached orderbook for immediate frontend hydration with 2-second timeout
      let orderbook = null;
      let timedOut = false;

      try {
        const orderBookPromise = this.redisOrderbookCache.getFullOrderbook(productId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2000)
        );

        orderbook = await Promise.race([orderBookPromise, timeoutPromise]);
      } catch (error) {
        if (error.message === 'timeout') {
          console.warn(`⏱️ [API] Redis query timeout for ${productId}, returning empty orderbook`);
          timedOut = true;
        } else {
          throw error;
        }
      }

      if (!orderbook || timedOut) {
        console.log(`⏭️ [API] No cached orderbook for ${productId} (${timedOut ? 'timed out' : 'empty'})`);
        return res.json({
          success: false,
          message: 'Orderbook data not yet available. Waiting for real-time updates...',
          data: { bids: [], asks: [] },
          cached: false
        });
      }

      console.log(`✅ [API] Returning cached orderbook for ${productId}: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);

      res.json({
        success: true,
        data: orderbook,
        cached: true
      });
    } catch (error) {
      console.error(`❌ Failed to get orderbook for ${productId}:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        data: { bids: [], asks: [] }
      });
    }
  }

  /**
   * Get orderbook filtered to specific range
   */
  async getOrderbookRange(req, res) {
    const { productId } = req.params;
    const depthRange = parseInt(req.query.depth) || 25000;

    try {
      const orderbook = await this.redisOrderbookCache.getOrderbookForAPI(productId, depthRange);

      res.json({
        success: true,
        depth_range: depthRange,
        data: orderbook
      });
    } catch (error) {
      console.error(`❌ Failed to get orderbook range for ${productId}:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get top N orders for orderbook list display
   */
  async getTopOrders(req, res) {
    const { productId } = req.params;
    const count = Math.min(parseInt(req.query.count) || 12, 50); // Limit to max 50 rows

    try {
      // Get just the top N bids and asks from Redis (sorted sets)
      // This is extremely fast - O(log N) + O(K) where K is the number of results
      const orderbook = await this.redisOrderbookCache.getTopOrders(productId, count);

      if (!orderbook) {
        return res.json({
          success: false,
          message: 'No orderbook data available',
          data: { bids: [], asks: [] }
        });
      }

      res.json({
        success: true,
        count: count,
        data: orderbook
      });
    } catch (error) {
      console.error(`❌ Failed to get top orders for ${productId}:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        data: { bids: [], asks: [] }
      });
    }
  }

  /**
   * Get recent candles from Redis for frontend hydration
   * Falls back to Coinbase API if Redis cache is empty
   */
  async getCandles(req, res) {
    const { pair, granularity } = req.params;
    const hours = parseInt(req.query.hours) || 24; // Default last 24 hours

    try {
      // Calculate time range for fetching candles
      const now = Date.now();
      const endTime = Math.floor(now / 1000); // Convert to seconds
      const startTime = endTime - (hours * 60 * 60); // Subtract hours in seconds

      // Get candles from Redis cache
      let candles = await this.redisCandleStorage.getCandles(pair, granularity, startTime, endTime);

      // 🚀 FALLBACK: If Redis cache is empty, fetch from Coinbase API
      if (!candles || candles.length === 0) {
        console.log(`⚠️ [API] Redis cache empty for ${pair}:${granularity}, fetching from Coinbase...`);

        try {
          // Convert granularity string to seconds
          const granularityMap = {
            '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '6h': 21600, '1d': 86400
          };
          const granularitySeconds = granularityMap[granularity] || 60;

          // Fetch from Coinbase
          const url = `https://api.exchange.coinbase.com/products/${pair}/candles?start=${startTime}&end=${endTime}&granularity=${granularitySeconds}`;
          const response = await fetch(url);
          const coinbaseData = await response.json();

          if (Array.isArray(coinbaseData) && coinbaseData.length > 0) {
            // Convert Coinbase format [time, low, high, open, close, volume] to our format
            candles = coinbaseData.map(([time, low, high, open, close, volume]) => ({
              time: Math.floor(time),
              open: parseFloat(open),
              high: parseFloat(high),
              low: parseFloat(low),
              close: parseFloat(close),
              volume: parseFloat(volume)
            })).sort((a, b) => a.time - b.time);

            console.log(`✅ [API] Fetched ${candles.length} candles from Coinbase for ${pair}:${granularity}`);

            // Store in Redis for future requests
            await this.redisCandleStorage.storeCandles(pair, granularity, candles).catch(err => {
              console.warn(`⚠️ Failed to cache candles in Redis: ${err.message}`);
            });
          } else {
            console.log(`⚠️ [API] Coinbase returned no data for ${pair}:${granularity}`);
            return res.json({
              success: false,
              message: `No candles available for ${pair} at ${granularity}`,
              data: []
            });
          }
        } catch (coinbaseError) {
          console.error(`❌ Failed to fetch from Coinbase: ${coinbaseError.message}`);
          return res.json({
            success: false,
            message: `No cached candles and Coinbase fetch failed for ${pair} at ${granularity}`,
            data: []
          });
        }
      }

      console.log(`📊 [API] Returning ${candles.length} candles for ${pair}:${granularity}`);

      // Get total available candles in database for this granularity
      const dbMetadata = await this.redisCandleStorage.getMetadata(pair, granularity).catch(() => null);
      const totalDatabaseCandles = dbMetadata?.totalCandles || candles.length;

      res.json({
        success: true,
        pair,
        granularity,
        count: candles.length,
        timeRange: {
          startTime,
          endTime,
          hours
        },
        metadata: {
          totalDatabaseCandles,
          storageMetadata: {
            totalCandles: totalDatabaseCandles
          }
        },
        data: candles
      });
    } catch (error) {
      console.error(`❌ Failed to get candles for ${pair}:${granularity}:`, error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        data: []
      });
    }
  }

  /**
   * Get server time for synchronized timers
   */
  getServerTime(req, res) {
    const now = Date.now();
    const seconds = Math.floor(now / 1000);

    res.json({
      success: true,
      timestamp: now,           // milliseconds
      unixTime: seconds,        // seconds (for granularity calculations)
      iso: new Date(now).toISOString(),
      serverTime: now
    });
  }

  /**
   * Get health status and system information
   */
  getHealthStatus(req, res) {
    const memUsage = process.memoryUsage();
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      },
      coinbaseWebSocket: this.coinbaseWebSocket.getStatus(),
      subscriptions: {
        chartSubscriptions: this.chartSubscriptions.size,
        activeSubscriptions: this.activeSubscriptions.size,
        granularityMappings: this.granularityMappings.size
      },
      botsService: {
        note: 'Bot management now runs on separate hermes-bots service',
        url: 'http://localhost:4829/health'
      }
    });
  }
}
