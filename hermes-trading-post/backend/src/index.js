import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import cors from 'cors';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import { TradingService } from './services/tradingService.js';
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

// Track WebSocket client connections
wss.on('connection', (ws) => {
  console.log(`🔌 [WebSocket] Client connected - total clients: ${wss.clients.size}`);

  ws.on('close', () => {
    console.log(`🔌 [WebSocket] Client disconnected - total clients: ${wss.clients.size}`);
  });
});

// 🤖 Bot Manager now runs on separate hermes-bots service (port 4829)
// Create WebSocket connection to bots service
const BOTS_SERVICE_URL = process.env.BOTS_SERVICE_URL || 'ws://localhost:4829';
let botsWebSocket = null;
let botsReconnectTimeout = null;  // ⚡ PERF: Track reconnect timeout for cleanup

const connectToBotsService = () => {
  console.log(`🤖 Connecting to Hermes Bots Service at ${BOTS_SERVICE_URL}...`);

  botsWebSocket = new WebSocket(BOTS_SERVICE_URL);

  botsWebSocket.on('open', () => {
    console.log('✅ Connected to Hermes Bots Service');
  });

  botsWebSocket.on('message', (data) => {
    // Forward bot service messages to all frontend clients
    try {
      const message = JSON.parse(data.toString());
      // 🔇 SILENCED: Too spammy - fires constantly for status updates
      // console.log(`📨 [Backend] Forwarding bot message: ${message.type}`);
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify(message));
        }
      });
    } catch (error) {
      console.error('❌ Error forwarding bot message:', error.message);
    }
  });

  botsWebSocket.on('error', (error) => {
    console.error('❌ Bots Service connection error:', error.message);
  });

  botsWebSocket.on('close', () => {
    console.log('🔴 Disconnected from Bots Service, reconnecting in 5s...');
    botsWebSocket = null;
    // ⚡ PERF: Clear any existing reconnect timeout to prevent stacking
    if (botsReconnectTimeout) {
      clearTimeout(botsReconnectTimeout);
    }
    // ⚡ PERF: Track timeout so it can be cleared on shutdown
    botsReconnectTimeout = setTimeout(connectToBotsService, 5000);
  });
};

// Start connection to bots service
connectToBotsService();

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
  coinbaseWebSocket,
  subscriptionManager,
  getGranularitySeconds,
  chartSubscriptions,
  activeSubscriptions: subscriptionManager.activeSubscriptions,
  granularityMappings: subscriptionManager.granularityMappings,
  granularityMappingTimes,
  lastEmissionTimes,
  cachedLevel2Snapshot: null,
  botsWebSocket: () => botsWebSocket // Pass function to get current botsWebSocket
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
  coinbaseWebSocket,
  continuousCandleUpdater,
  chartSubscriptions,
  activeSubscriptions: subscriptionManager.activeSubscriptions,
  granularityMappings: subscriptionManager.granularityMappings,
  memoryMonitor
});

// Initialize services on startup
// Use async IIFE to handle async initialization
(async () => {
  
  // All supported trading pairs
  const tradingPairs = ['BTC-USD', 'ETH-USD', 'PAXG-USD'];

  // Initialize Historical Data Service (fetch historical candles for all granularities)
  // 🚀 FIX: Load all granularities needed for timeframe compatibility
  console.log('🚀 Initializing Historical Data Service for all granularities...');
  try {
    const granularities = ['1m', '5m', '15m', '1h', '6h', '1d'];

    for (const pair of tradingPairs) {
      console.log(`📥 Initializing historical data for ${pair}...`);
      for (const granularity of granularities) {
        console.log(`  📥 ${pair} ${granularity}...`);
        const histResult = await historicalDataService.initialize(pair, granularity);
        if (histResult) {
          console.log(`  ✅ ${pair} ${granularity} initialized`);
        } else {
          console.warn(`  ⚠️ ${pair} ${granularity} returned false`);
        }
        // Small delay between initializations to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const status = historicalDataService.getStatus();
    console.log(`📊 Historical Data Status: ${status.stats.totalCandles} candles total, ${status.stats.totalRequests} requests, ${status.stats.errors} errors`);
  } catch (error) {
    console.error('❌ Failed to initialize Historical Data Service:', error.message);
  }

  // Initialize Continuous Candle Updater for constant API updates
  // 🚀 FIX: Now using public Exchange API instead of authenticated Advanced Trade API
  console.log('🔄 Starting Continuous Candle Updater Service...');
  for (const pair of tradingPairs) {
    continuousCandleUpdater.startAllGranularities(pair);
    console.log(`  🔄 Continuous updates started for ${pair}`);
  }

  // 🔧 FIX: Broadcast candles from ContinuousCandleUpdater (REST API fallback)
  // This ensures chart keeps updating even if WebSocket market_trades stops
  // ALSO ensures frontend stays in sync with Redis database
  continuousCandleUpdater.on('candles_updated', (data) => {
    // data format: { product_id, granularity, candles: [...] }
    console.log(`📡 [ContinuousUpdater] Broadcasting ${data.candles.length} candles for ${data.product_id} (${data.granularity}) - SYNCING FROM REDIS`);

    // Broadcast each candle to frontend
    // These are AUTHORITATIVE candles from Redis - they override any WebSocket data
    data.candles.forEach(candle => {
      // 🔧 FIX: RedisChartService expects FLAT format (message.pair, not message.data.pair)
      const candleMessage = {
        type: 'candle',
        pair: data.product_id,
        granularity: data.granularity,
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        candleType: 'sync' // Mark as sync to indicate this is authoritative Redis data
      };
      wsHandler.broadcast(candleMessage);
    });
  });

  // Initialize Broadcast Service for WebSocket message broadcasting
  console.log('🔊 Initializing Broadcast Service...');
  broadcastService.initialize();

  // Connect to Coinbase WebSocket for real-time market data
  console.log('🔗 Connecting to Coinbase Advanced Trade WebSocket...');
  try {
    await coinbaseWebSocket.connect();
    console.log('✅ Connected to Coinbase Advanced Trade WebSocket');

    // Subscribe to BTC-USD level2, ticker, and candles streams via Advanced Trade API
    coinbaseWebSocket.subscribeLevel2('BTC-USD');
    coinbaseWebSocket.subscribeTicker('BTC-USD');
    coinbaseWebSocket.subscribeCandles('BTC-USD'); // ✅ PROPER candles channel - provides 5m OHLCV data every second
    console.log('📊 Subscribed to BTC-USD level2, ticker, and candles (via Advanced Trade API with JWT)');

    // 🔧 FIX: Link Coinbase level2 events to WebSocketHandler snapshot cache
    // Set this up AFTER subscription so we don't miss events
    // 🚀 PHASE 5F FIX: Store handler references for cleanup to prevent memory leaks
    // ✅ CRITICAL: Handle BOTH snapshot (full orderbook) and update (incremental) events
    // 🔄 BROADCAST: Forward snapshots to all connected WebSocket clients
    // ⏱️ THROTTLE: Limit update broadcasts to prevent browser OOM
    let lastLevel2UpdateBroadcastTime = 0;
    let lastLevel2SnapshotBroadcastTime = 0;
    const LEVEL2_UPDATE_THROTTLE_MS = 500; // Broadcast updates max 2x per second to prevent browser OOM
    const LEVEL2_SNAPSHOT_THROTTLE_MS = 5000; // Broadcast snapshots every 5 seconds

    const level2Handler = (data) => {
      if (!data) return;

      // Snapshot events contain full orderbook state
      if (data.type === 'snapshot' && data.bids && data.asks) {
        // 🔧 REDUCED LOGGING: Only log snapshots (rare events)
        console.log(`📨 [Backend] Received level2 SNAPSHOT: ${data.bids.length} bids, ${data.asks.length} asks`);

        // 🔧 FIX: Limit snapshot size to prevent memory exhaustion
        // Only keep top 100 bids/asks (closest to current price)
        // Bids are sorted descending (highest first), asks ascending (lowest first)
        const limitedData = {
          ...data,
          bids: data.bids.slice(0, 100),
          asks: data.asks.slice(0, 100)
        };

        wsHandler.setCachedLevel2Snapshot(limitedData);

        // 🔧 FIX: Throttle snapshot broadcasts to prevent memory pressure
        // Snapshots are huge (1000+ levels) and come frequently, causing OOM
        const now = Date.now();
        const timeSinceLastSnapshot = now - lastLevel2SnapshotBroadcastTime;

        // Only broadcast snapshot every 5 seconds (less frequent than updates)
        if (timeSinceLastSnapshot >= LEVEL2_SNAPSHOT_THROTTLE_MS) {
          const snapshotMessage = {
            type: 'level2',
            data: limitedData
          };

          wsHandler.broadcast(snapshotMessage);
          console.log(`📤 [Backend] Broadcast level2 snapshot (100 bids, 100 asks) to connected clients`);
          lastLevel2SnapshotBroadcastTime = now;
        }
      }
      // Update events contain incremental changes (only changed price levels)
      else if (data.type === 'update' && data.changes) {
        // 🔧 REMOVED: Excessive logging for every update - only log broadcasts
        // ⏱️ THROTTLE: Only broadcast if enough time has passed since last broadcast
        // This prevents browser OOM from too many WebSocket messages
        const now = Date.now();
        const timeSinceLastUpdate = now - lastLevel2UpdateBroadcastTime;

        if (timeSinceLastUpdate >= LEVEL2_UPDATE_THROTTLE_MS) {
          const updateMessage = {
            type: 'level2',
            data: data
          };

          wsHandler.broadcast(updateMessage);
          lastLevel2UpdateBroadcastTime = now;
          // 🔇 SILENCED: Too spammy - fires every 100ms
          // console.log(`📤 [Backend] Broadcast level2 update (${data.changes.length} changes)`);
        }
        // 🔧 REMOVED: Excessive "Skipped" logging causing log bloat
      }
    };

    const errorHandler = (error) => {
      console.error('Coinbase WebSocket error:', error);
    };

    const disconnectedHandler = () => {
      console.log('Coinbase WebSocket disconnected');
    };

    // 🔧 FIX: Add ticker event handler for real-time price updates
    const tickerHandler = (data) => {
      if (!data) return;

      // Broadcast ticker data to all connected WebSocket clients
      wsHandler.broadcast({
        type: 'ticker',
        data: data
      });

      // Forward price updates to bots service via WebSocket
      if (data.price && botsWebSocket && botsWebSocket.readyState === WebSocket.OPEN) {
        botsWebSocket.send(JSON.stringify({
          type: 'ticker',
          data: data
        }));
      }
    };

    // 🔧 FIX: Add candle event handler for real-time candle updates
    const candleHandler = (candleData) => {
      if (!candleData) return;

      // 🔧 FIX: RedisChartService expects FLAT format (message.pair, not message.data.pair)
      // RedisChartService.ts line 326: const subscriptionKey = `${message.pair}:${message.granularity}`;
      const frontendCandle = {
        type: 'candle',
        pair: candleData.product_id,
        granularity: candleData.granularityKey || `${candleData.granularity}s`,
        time: candleData.time,
        open: candleData.open,
        high: candleData.high,
        low: candleData.low,
        close: candleData.close,
        volume: candleData.volume || 0,
        candleType: candleData.type  // WebSocket or complete
      };

      // Broadcast candle to all connected WebSocket clients
      wsHandler.broadcast(frontendCandle);

      // 🔇 SILENCED: Too spammy - fires 6x per second (all granularities)
      // console.log(`📊 [Backend] New ${candleData.type} candle (${candleData.granularityKey}): ${candleData.product_id} at $${candleData.close}`);
    };

    coinbaseWebSocket.on('level2', level2Handler);
    coinbaseWebSocket.on('ticker', tickerHandler);
    coinbaseWebSocket.on('candle', candleHandler);
    coinbaseWebSocket.on('error', errorHandler);
    coinbaseWebSocket.on('disconnected', disconnectedHandler);

    // Store references for cleanup
    coinbaseWebSocket.__level2Handler = level2Handler;
    coinbaseWebSocket.__tickerHandler = tickerHandler;
    coinbaseWebSocket.__candleHandler = candleHandler;
    coinbaseWebSocket.__errorHandler = errorHandler;
    coinbaseWebSocket.__disconnectedHandler = disconnectedHandler;

    console.log('🔗 Linked Coinbase level2, ticker, and candle events to WebSocketHandler');
  } catch (error) {
    console.error('❌ Failed to connect to Coinbase WebSocket:', error.message);
  }
})();

app.use('/api/trading', tradingRoutes());

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
  continuousCandleUpdater,
  coinbaseWebSocket,
  memoryMonitor,
  chartSubscriptions,
  activeSubscriptions,
  granularityMappings,
  granularityMappingTimes,
  lastEmissionTimes,
  botsWebSocket, // Add bots WebSocket for cleanup
  botsReconnectTimeout: () => botsReconnectTimeout, // Pass getter for current timeout
  clearBotsReconnectTimeout: () => {
    if (botsReconnectTimeout) {
      clearTimeout(botsReconnectTimeout);
      botsReconnectTimeout = null;
    }
  }
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

