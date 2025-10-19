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
import { ServerLifecycle } from './services/ServerLifecycle.js';
import { RESTAPIService } from './services/RESTAPIService.js';

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

// Phase 5C: Initialize REST API service
const restAPIService = new RESTAPIService({
  redisOrderbookCache,
  redisCandleStorage,
  botManager,
  coinbaseWebSocket,
  continuousCandleUpdater,
  chartSubscriptions,
  activeSubscriptions: subscriptionManager.activeSubscriptions,
  granularityMappings: subscriptionManager.granularityMappings,
  memoryMonitor
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

// Phase 5C: Register REST API service routes
restAPIService.registerRoutes(app);

// Debug endpoint for frontend logging
app.post('/api/debug-log', (req, res) => {
  const { message } = req.body;
  console.log(`🌐 [Frontend Debug]: ${message}`);
  res.json({ success: true });
});

// Phase 5C: Initialize Server Lifecycle manager
const serverLifecycle = new ServerLifecycle(server, wss, {
  botManager,
  continuousCandleUpdater,
  coinbaseWebSocket,
  memoryMonitor,
  chartSubscriptions,
  activeSubscriptions,
  granularityMappings,
  granularityMappingTimes,
  lastEmissionTimes
});

// Start the server
(async () => {
  try {
    await serverLifecycle.startServer(PORT, HOST);
    console.log(`📡 WebSocket server ready on ws://${HOST}:${PORT}`);
    console.log(`💹 Trading service initialized`);
    console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);

    // Initialize signal handlers for graceful shutdown
    serverLifecycle.initializeSignalHandlers();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

