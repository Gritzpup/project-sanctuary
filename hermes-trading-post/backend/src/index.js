import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import cors from 'cors';
import dotenv from 'dotenv';
import { TradingService } from './services/tradingService.js';
import { BotManager } from './services/botManager.js';
import { coinbaseWebSocket } from './services/coinbaseWebSocket.js';
import { historicalDataService } from './services/HistoricalDataService.js';
import { continuousCandleUpdater } from './services/ContinuousCandleUpdater.js';
import { redisOrderbookCache } from './services/redis/RedisOrderbookCache.js';
import { redisCandleStorage } from './services/redis/RedisCandleStorage.js';
import tradingRoutes from './routes/trading.js';
import { MemoryMonitor } from './services/MemoryMonitor.js';
import { SubscriptionManager } from './services/SubscriptionManager.js';
import { WebSocketHandler } from './services/WebSocketHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4829; // Main backend port for WebSocket bridge (changed from 4828 to avoid conflicts)
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const botManager = new BotManager();

// Phase 5C: Initialize subscription and memory monitoring services
const subscriptionManager = new SubscriptionManager();
const memoryMonitor = new MemoryMonitor(
  wss,
  subscriptionManager.getChartSubscriptions(),
  () => subscriptionManager.cleanupOldMappings()
);

// Start services
memoryMonitor.start();

// Helper function to convert granularity strings to seconds
function getGranularitySeconds(granularity) {
  const GRANULARITY_TO_SECONDS = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400
  };
  return GRANULARITY_TO_SECONDS[granularity] || 60; // Default to 1 minute
}

// Expose services for backward compatibility
const chartSubscriptions = subscriptionManager.getChartSubscriptions();
const activeSubscriptions = subscriptionManager.activeSubscriptions;
const granularityMappings = subscriptionManager.granularityMappings;
const granularityMappingTimes = subscriptionManager.getGranularityMappingTimes();
const lastEmissionTimes = subscriptionManager.getLastEmissionTimes();

// Cache the latest orderbook snapshot for new clients (module-level scope)
let cachedLevel2Snapshot = null;

// Phase 5C: Initialize WebSocket handler service
const wsHandler = new WebSocketHandler(wss, {
  botManager,
  coinbaseWebSocket,
  subscriptionManager,
  getGranularitySeconds,
  chartSubscriptions,
  activeSubscriptions: subscriptionManager.activeSubscriptions,
  granularityMappings: subscriptionManager.granularityMappings,
  granularityMappingTimes,
  lastEmissionTimes,
  cachedLevel2Snapshot: null
});

// Initialize WebSocket handlers
wsHandler.initialize();

// Initialize default bots on startup
// Use async IIFE to handle async initialization
(async () => {
  await botManager.initializeDefaultBots();
  
  // Initialize Historical Data Service (fetch historical candles)
  console.log('🚀 Initializing Historical Data Service...');
  await historicalDataService.initialize('BTC-USD', '1m');

  // Initialize Continuous Candle Updater for constant API updates
  console.log('🔄 Starting Continuous Candle Updater Service...');
  continuousCandleUpdater.startAllGranularities('BTC-USD');

  // Forward database activity events to WebSocket clients
  continuousCandleUpdater.on('database_activity', (activity) => {
    // Broadcast to all connected clients
    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'database_activity',
          data: activity
        }));
      }
    });
  });

  // Log database activity stats periodically
  setInterval(() => {
    const stats = continuousCandleUpdater.getStats();
    console.log(`📊 [CandleUpdater Stats] Fetches: ${stats.totalFetches}, Candles: ${stats.totalCandles}, Errors: ${stats.errors}, Active: ${stats.activePairs.length}`);
  }, 60000); // Every minute

  // Initialize Coinbase WebSocket
  console.log('🔌 Attempting to connect to Coinbase WebSocket...');
  try {
    await coinbaseWebSocket.connect();
    console.log('✅ Coinbase WebSocket connection initiated successfully');
  } catch (error) {
    console.error('❌ Failed to connect to Coinbase WebSocket:', error);
  }
  
  // Auto-subscribe to all granularities for continuous candle updates
  console.log('🔄 Setting up continuous candle aggregation for all granularities...');
  const granularities = ['60', '300', '900', '3600', '21600', '86400']; // 1m, 5m, 15m, 1h, 6h, 1d
  const granularityStrings = ['1m', '5m', '15m', '1h', '6h', '1d'];
  
  granularities.forEach((granularitySeconds, index) => {
    const granularityStr = granularityStrings[index];
    const mappingKey = `BTC-USD:${granularitySeconds}`;

    // Set up granularity mapping
    granularityMappings.set(mappingKey, granularityStr);
    granularityMappingTimes.set(mappingKey, Date.now());

    // Subscribe to real-time data
    coinbaseWebSocket.subscribeMatches('BTC-USD', granularitySeconds);
    console.log(`📡 Auto-subscribed to BTC-USD ${granularityStr} (${granularitySeconds}s) for continuous updates`);
  });

  // 🚀 RADICAL OPTIMIZATION: Subscribe to ticker for INSTANT price updates
  coinbaseWebSocket.subscribeTicker('BTC-USD');

  // 📊 Try WebSocket level2 first for real-time orderbook (public feed, no auth needed!)
  console.log('🚀 Starting AUTHENTICATED WebSocket level2 for real-time orderbook updates...');
  console.log('🔐 Attempting to connect with CDP authentication (no polling fallback)');

  coinbaseWebSocket.subscribeLevel2('BTC-USD');

  // Track if we're receiving WebSocket level2 data
  let usingWebSocketLevel2 = false;
  let level2MessageCount = 0;
  let lastLevel2Log = Date.now();

  // Listen for level2 updates from WebSocket
  coinbaseWebSocket.on('level2', (orderbookData) => {
    if (!usingWebSocketLevel2) {
      console.log('✅✅✅ AUTHENTICATED L2 WEBSOCKET CONNECTED AND RECEIVING DATA! ✅✅✅');
      console.log('📊 Real-time orderbook updates are now streaming');
      usingWebSocketLevel2 = true;
    }

    level2MessageCount++;

    // Cache snapshot for new clients
    if (orderbookData.type === 'snapshot') {
      cachedLevel2Snapshot = orderbookData;
    }

    // Log every second instead of every 100 messages
    const now = Date.now();
    if (now - lastLevel2Log >= 1000) {
      lastLevel2Log = now;
    }

    // Forward to all clients with 'level2' type
    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'level2',
          data: orderbookData
        }));
      }
    });
  });

  // 🚀 PERF: Subscribe to Redis Pub/Sub for orderbook deltas
  // These are ONLY the changed price levels, not full snapshots
  // Frontend receives minimal data - only what changed
  const deltaSubscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  });

  deltaSubscriber.on('message', (channel, message) => {
    try {
      const delta = JSON.parse(message);

      // Broadcast delta to all connected WebSocket clients
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({
            type: 'orderbook-delta',
            data: delta
          }));
        }
      });
    } catch (error) {
      console.error(`❌ Failed to parse orderbook delta:`, error.message);
    }
  });

  deltaSubscriber.on('error', (error) => {
    console.error('❌ Redis delta subscriber error:', error.message);
  });

  // Subscribe to all orderbook delta channels (wildcard pattern) - non-blocking
  deltaSubscriber.psubscribe('orderbook:*:delta').catch(err => {
    console.error('❌ Failed to subscribe to orderbook deltas:', err.message);
  });

  // Log subscription success after a short delay
  setTimeout(() => {
    console.log(`✅ Orderbook delta subscriber initialized (pattern: orderbook:*:delta)`);
  }, 100);

  // ✅ Using Advanced Trade WebSocket with CDP JWT authentication for real-time push updates
  // No polling fallback needed - WebSocket provides instant updates
  setTimeout(() => {
    if (usingWebSocketLevel2) {
      console.log(`✅ WebSocket Level2 active! Received ${level2MessageCount} updates.`);
      console.log('📊 Using REAL-TIME PUSH updates from Advanced Trade WebSocket');
    } else {
      console.log('⚠️ WebSocket Level2 not receiving data - check CDP API keys');
    }
  }, 5000);

  // Set up Coinbase WebSocket event handlers
  coinbaseWebSocket.on('candle', (candleData) => {

    // Convert granularity seconds back to string using mapping
    const mappingKey = `${candleData.product_id}:${candleData.granularity}`;
    const granularityString = granularityMappings.get(mappingKey) || '1m'; // Default fallback

    // Create proper subscription key with string granularity
    const subscriptionKey = `${candleData.product_id}:${granularityString}`;


    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        // Check if this client is subscribed to this data
        const clientId = client._clientId || 'unknown';
        const clientSubs = chartSubscriptions.get(clientId);

        if (clientSubs && clientSubs.has(subscriptionKey)) {
          // 🔥 RACE CONDITION FIX: Throttle emissions to prevent duplicate spam
          const throttleKey = `${clientId}:${subscriptionKey}`;
          const lastEmitTime = lastEmissionTimes.get(throttleKey) || 0;
          const now = Date.now();

          // Only emit if:
          // 1. It's a completed candle (always emit these), OR
          // 2. More than 100ms has passed since last emission (10 updates/sec max)
          const shouldEmit = candleData.type === 'complete' || (now - lastEmitTime > 100);

          if (shouldEmit) {
            lastEmissionTimes.set(throttleKey, now);

            const messageToSend = {
              type: 'candle',
              pair: candleData.product_id,
              granularity: granularityString,
              time: candleData.time,
              open: candleData.open,
              high: candleData.high,
              low: candleData.low,
              close: candleData.close,
              volume: candleData.volume,
              candleType: candleData.type
            };

            client.send(JSON.stringify(messageToSend));
          }
        }
      }
    });
  });

  // 🚀 RADICAL OPTIMIZATION: Add ticker support for INSTANT price updates (no throttling!)
  coinbaseWebSocket.on('ticker', (tickerData) => {
    // Forward ticker updates to ALL clients with NO THROTTLING
    // This gives us near-instant price updates (hundreds per second)
    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        const clientId = client._clientId || 'unknown';
        const clientSubs = chartSubscriptions.get(clientId);

        // Check if client is subscribed to this pair
        if (clientSubs && clientSubs.has(`${tickerData.product_id}:1m`)) {
          client.send(JSON.stringify({
            type: 'ticker',
            pair: tickerData.product_id,
            price: tickerData.price,
            time: Date.now() / 1000  // Unix timestamp
          }));
        }
      }
    });
  });

  coinbaseWebSocket.on('error', (error) => {
    console.error('Coinbase WebSocket error:', error);
  });

  coinbaseWebSocket.on('disconnected', () => {
    console.log('Coinbase WebSocket disconnected');
  });
})();

app.use('/api/trading', tradingRoutes(botManager));

// 🚀 Orderbook API endpoints for frontend hydration
app.get('/api/orderbook/:productId', async (req, res) => {
  const { productId } = req.params;

  try {
    console.log(`📥 [API] Received orderbook request for ${productId}`);

    // Get full cached orderbook for immediate frontend hydration
    const orderbook = await redisOrderbookCache.getFullOrderbook(productId);

    if (!orderbook) {
      console.log(`⏭️ [API] No cached orderbook for ${productId}`);
      return res.json({
        success: false,
        message: 'No cached orderbook available yet',
        data: { bids: [], asks: [] }
      });
    }

    console.log(`✅ [API] Returning cached orderbook for ${productId}: ${orderbook.bids.length} bids, ${orderbook.asks.length} asks`);

    res.json({
      success: true,
      data: orderbook
    });
  } catch (error) {
    console.error(`❌ Failed to get orderbook for ${productId}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: { bids: [], asks: [] }
    });
  }
});

// Get orderbook filtered to specific range (for API clients)
app.get('/api/orderbook/:productId/range', async (req, res) => {
  const { productId } = req.params;
  const depthRange = parseInt(req.query.depth) || 25000;

  try {
    const orderbook = await redisOrderbookCache.getOrderbookForAPI(productId, depthRange);

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
});

// 🚀 Get top N orders for orderbook list display (ultra-fast Redis query for frontend list)
// This endpoint is optimized for real-time orderbook list rendering with minimal latency
app.get('/api/orderbook/:productId/top', async (req, res) => {
  const { productId } = req.params;
  const count = Math.min(parseInt(req.query.count) || 12, 50); // Limit to max 50 rows

  try {
    // Get just the top N bids and asks from Redis (sorted sets)
    // This is extremely fast - O(log N) + O(K) where K is the number of results
    const orderbook = await redisOrderbookCache.getTopOrders(productId, count);

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
});

// 🚀 Get recent candles from Redis for frontend hydration
// Frontend loads chart instantly with cached candles while WebSocket streams live updates
app.get('/api/candles/:pair/:granularity', async (req, res) => {
  const { pair, granularity } = req.params;
  const hours = parseInt(req.query.hours) || 24; // Default last 24 hours

  try {
    // Calculate time range for fetching candles
    const now = Date.now();
    const endTime = Math.floor(now / 1000); // Convert to seconds
    const startTime = endTime - (hours * 60 * 60); // Subtract hours in seconds

    // Get candles from Redis cache
    let candles = await redisCandleStorage.getCandles(pair, granularity, startTime, endTime);

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
          await redisCandleStorage.storeCandles(pair, granularity, candles).catch(err => {
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
});

// 🕐 Server time endpoint for synchronized timers
// Used by timers and chart animation to stay synchronized with server time
app.get('/api/time', (req, res) => {
  const now = Date.now();
  const seconds = Math.floor(now / 1000);

  res.json({
    success: true,
    timestamp: now,           // milliseconds
    unixTime: seconds,        // seconds (for granularity calculations)
    iso: new Date(now).toISOString(),
    serverTime: now
  });
});

app.get('/health', (req, res) => {
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
    coinbaseWebSocket: coinbaseWebSocket.getStatus(),
    subscriptions: {
      chartSubscriptions: chartSubscriptions.size,
      activeSubscriptions: activeSubscriptions.size,
      granularityMappings: granularityMappings.size,
      granularityMappingTimes: granularityMappingTimes.size
    },
    botManager: {
      totalBots: botManager.bots.size,
      activeBotId: botManager.activeBotId,
      status: botManager.getStatus()
    }
  });
});

// Debug endpoint for frontend logging
app.post('/api/debug-log', (req, res) => {
  const { message } = req.body;
  console.log(`🌐 [Frontend Debug]: ${message}`);
  res.json({ success: true });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Trading backend server running on ${HOST}:${PORT}`);
  console.log(`📡 WebSocket server ready on ws://${HOST}:${PORT}`);
  console.log(`💹 Trading service initialized`);
  console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);
});

// Shutdown handling
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n${signal} received, shutting down gracefully`);
  
  // Set environment variable to indicate we're truly shutting down
  process.env.SHUTTING_DOWN = 'true';
  
  // Stop bot manager
  botManager.cleanup();

  // Stop continuous candle updater
  console.log('🛑 Stopping Continuous Candle Updater...');
  continuousCandleUpdater.stopAll();

  // 🔥 MEMORY LEAK FIX: Clean up all Maps and subscriptions
  console.log('🧹 Cleaning up memory...');
  chartSubscriptions.clear();
  activeSubscriptions.clear();
  granularityMappings.clear();
  granularityMappingTimes.clear();
  lastEmissionTimes.clear(); // 🔥 RACE CONDITION FIX

  // Clear the cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  // Disconnect Coinbase WebSocket
  coinbaseWebSocket.disconnect();
  
  // Close all WebSocket connections
  wss.clients.forEach(client => {
    client.close();
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('Server closed and memory cleaned');
    process.exit(0);
  });
  
  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Prevent multiple listeners warning
process.setMaxListeners(0);