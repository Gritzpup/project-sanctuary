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
import { DebugLoggingService } from './services/DebugLoggingService.js';
import { ErrorHandlerService } from './services/ErrorHandlerService.js';
import { ConfigurationService } from './services/ConfigurationService.js';

dotenv.config();

// Phase 5C: Initialize core services
const logger = new DebugLoggingService();
const errorHandler = new ErrorHandlerService(logger);
const config = new ConfigurationService();

const app = express();
const PORT = config.get('PORT');
const HOST = config.get('HOST');

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

// Note: We'll set up the level2 listener after Coinbase connects and subscribes
// This is done in the async IIFE below

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

  // Connect to Coinbase WebSocket for real-time market data
  console.log('🔗 Connecting to Coinbase WebSocket...');
  try {
    await coinbaseWebSocket.connect();
    console.log('✅ Connected to Coinbase WebSocket');

    // Subscribe to BTC-USD level2 and ticker streams
    coinbaseWebSocket.subscribeLevel2('BTC-USD');
    coinbaseWebSocket.subscribeTicker('BTC-USD');
    console.log('📊 Subscribed to BTC-USD level2 and ticker');

    // 🔧 FIX: Link Coinbase level2 events to WebSocketHandler snapshot cache
    // Set this up AFTER subscription so we don't miss events
    // 🚀 PHASE 5F FIX: Store handler references for cleanup to prevent memory leaks
    const level2Handler = (data) => {
      console.log(`📨 [Backend] Received Coinbase level2 event with ${data?.bids?.length || 0} bids and ${data?.asks?.length || 0} asks`);
      if (data && data.bids && data.asks) {
        // Forward the snapshot to WebSocketHandler so clients can request it
        console.log(`✅ [Backend] Caching level2 snapshot for WebSocketHandler (${data.bids.length} bids, ${data.asks.length} asks)`);
        wsHandler.setCachedLevel2Snapshot(data);
      }
    };

    const errorHandler = (error) => {
      console.error('Coinbase WebSocket error:', error);
    };

    const disconnectedHandler = () => {
      console.log('Coinbase WebSocket disconnected');
    };

    coinbaseWebSocket.on('level2', level2Handler);
    coinbaseWebSocket.on('error', errorHandler);
    coinbaseWebSocket.on('disconnected', disconnectedHandler);

    // Store references for cleanup
    coinbaseWebSocket.__level2Handler = level2Handler;
    coinbaseWebSocket.__errorHandler = errorHandler;
    coinbaseWebSocket.__disconnectedHandler = disconnectedHandler;

    console.log('🔗 Linked Coinbase level2 events to WebSocketHandler');
  } catch (error) {
    console.error('❌ Failed to connect to Coinbase WebSocket:', error.message);
  }
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

