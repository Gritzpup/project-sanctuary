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
import { BroadcastService } from './services/BroadcastService.js';

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

// Phase 5C: Initialize broadcast service
// Note: deltaSubscriber will be created during async initialization below
let deltaSubscriber = null; // Will be initialized in async IIFE
const broadcastService = new BroadcastService(wss, {
  continuousCandleUpdater,
  coinbaseWebSocket,
  subscriptionManager,
  getGranularitySeconds,
  chartSubscriptions,
  granularityMappings: subscriptionManager.granularityMappings,
  lastEmissionTimes,
  cachedLevel2Snapshot: null,
  deltaSubscriber: null // Will be updated after Redis connection
});

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

  // Initialize Broadcast Service for WebSocket message broadcasting
  console.log('🔊 Initializing Broadcast Service...');
  broadcastService.initialize();

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