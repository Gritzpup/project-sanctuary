import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { TradingService } from './services/tradingService.js';
import { BotManager } from './services/botManager.js';
import { coinbaseWebSocket } from './services/coinbaseWebSocket.js';
import { historicalDataService } from './services/HistoricalDataService.js';
import tradingRoutes from './routes/trading.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4828; // Main backend port for WebSocket bridge
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const botManager = new BotManager();

// Track chart subscriptions
const chartSubscriptions = new Map(); // key: clientId, value: Set of "pair:granularity" strings
// Track active subscriptions to include granularity in candle data
const activeSubscriptions = new Map(); // key: "pair", value: Set of granularities

// Track granularity mappings for proper subscription key matching
const granularityMappings = new Map(); // key: "pair:granularitySeconds", value: "granularityString"

// 🔥 MEMORY LEAK FIX: Track mapping creation times for TTL cleanup
const granularityMappingTimes = new Map(); // key: "pair:granularitySeconds", value: timestamp

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

// 🔥 MEMORY LEAK FIX: Clean up old granularity mappings (TTL: 1 hour)
function cleanupOldMappings() {
  const TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, timestamp] of granularityMappingTimes.entries()) {
    if (now - timestamp > TTL) {
      granularityMappings.delete(key);
      granularityMappingTimes.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old granularity mappings`);
  }
}

// 🔥 MEMORY LEAK FIX: Periodic cleanup every 30 minutes
let cleanupInterval = setInterval(cleanupOldMappings, 30 * 60 * 1000);

// 🔥 MEMORY MONITORING: Add memory usage monitoring and circuit breaker
function monitorMemoryUsage() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  // Log memory usage every 5 minutes
  console.log(`📊 Memory Usage: RSS: ${rssMB}MB, Heap: ${heapUsedMB}/${heapTotalMB}MB, Clients: ${wss.clients.size}, Subscriptions: ${chartSubscriptions.size}`);
  
  // Circuit breaker: If memory usage exceeds 1GB, force cleanup
  if (memUsage.heapUsed > 1024 * 1024 * 1024) {
    console.warn(`⚠️ HIGH MEMORY USAGE: ${heapUsedMB}MB - Forcing cleanup`);
    
    // Force cleanup of old mappings
    cleanupOldMappings();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }
    
    // If still high after cleanup, log warning
    const newMemUsage = process.memoryUsage();
    const newHeapUsedMB = Math.round(newMemUsage.heapUsed / 1024 / 1024);
    if (newMemUsage.heapUsed > 800 * 1024 * 1024) {
      console.error(`🚨 CRITICAL MEMORY: ${newHeapUsedMB}MB after cleanup - Consider restarting`);
    }
  }
}

// Monitor memory every 5 minutes
let memoryMonitorInterval = setInterval(monitorMemoryUsage, 5 * 60 * 1000);

// Initial memory check
setTimeout(monitorMemoryUsage, 10000);

// Initialize default bots on startup
// Use async IIFE to handle async initialization
(async () => {
  await botManager.initializeDefaultBots();
  
  // Initialize Historical Data Service (fetch historical candles)
  console.log('🚀 Initializing Historical Data Service...');
  await historicalDataService.initialize('BTC-USD', '1m');
  
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
    });
  });
  
  coinbaseWebSocket.on('error', (error) => {
    console.error('Coinbase WebSocket error:', error);
  });
  
  coinbaseWebSocket.on('disconnected', () => {
    console.log('Coinbase WebSocket disconnected');
  });
})();

wss.on('connection', (ws) => {
  // console.log('New WebSocket connection established');
  
  // Generate unique client ID for tracking subscriptions
  ws._clientId = Math.random().toString(36).substring(7);
  chartSubscriptions.set(ws._clientId, new Set());

  botManager.addClient(ws);

  // Also add client to all bot instances for price updates
  botManager.bots.forEach(bot => {
    bot.addClient(ws);
  });

  // 🔥 MEMORY LEAK FIX: Clean up on disconnect
  ws.on('close', () => {
    // Remove client subscriptions
    chartSubscriptions.delete(ws._clientId);
    
    // Remove client from bot manager
    botManager.removeClient(ws);
    
    // Remove client from all bots
    botManager.bots.forEach(bot => {
      bot.removeClient(ws);
    });
    
    console.log(`🧹 WebSocket client ${ws._clientId} disconnected and cleaned up`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${ws._clientId}:`, error);
    // Trigger cleanup on error
    ws.close();
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      // Only log non-status messages to reduce spam
      if (data.type !== 'getStatus' && data.type !== 'getManagerState') {
        // console.log('Received message:', data.type);
      }
      
      switch (data.type) {
        // Bot management commands
        case 'createBot':
          const botId = botManager.createBot(data.strategyType, data.botName, data.config);
          ws.send(JSON.stringify({
            type: 'botCreated',
            data: { botId }
          }));
          break;
          
        case 'selectBot':
          botManager.selectBot(data.botId);
          break;
          
        case 'deleteBot':
          botManager.deleteBot(data.botId);
          break;
          
        case 'getManagerState':
          ws.send(JSON.stringify({
            type: 'managerState',
            data: botManager.getManagerState()
          }));
          break;
          
        // Trading commands (forwarded to active bot)
        case 'start':
          console.log('Start trading request received:', {
            config: data.config,
            activeBotId: botManager.activeBotId,
            hasActiveBot: !!botManager.getActiveBot()
          });
          botManager.startTrading(data.config);
          break;
        case 'stop':
          // If botId provided, select that bot first
          if (data.botId) {
            botManager.selectBot(data.botId);
          }
          botManager.stopTrading();
          // Send updated status
          ws.send(JSON.stringify({
            type: 'tradingStopped',
            status: botManager.getStatus()
          }));
          break;
        case 'pause':
          // If botId provided, select that bot first
          if (data.botId) {
            botManager.selectBot(data.botId);
          }
          botManager.pauseTrading();
          break;
        case 'resume':
          // If botId provided, select that bot first
          if (data.botId) {
            botManager.selectBot(data.botId);
          }
          botManager.resumeTrading();
          break;
        case 'getStatus':
          ws.send(JSON.stringify({
            type: 'status',
            data: botManager.getStatus()
          }));
          break;
        case 'updateStrategy':
          botManager.updateStrategy(data.strategy);
          break;
        case 'updateSelectedStrategy':
          // Update just the dropdown selection for persistence
          const bot = data.botId ? botManager.getBot(data.botId) : botManager.getActiveBot();
          if (bot) {
            await bot.updateSelectedStrategy(data.strategyType);
            ws.send(JSON.stringify({
              type: 'selectedStrategyUpdated',
              botId: data.botId || botManager.activeBotId,
              strategyType: data.strategyType
            }));
          }
          break;
        case 'realtimePrice':
          // Forward real-time price to bot manager
          if (data.data && data.data.price) {
            // console.log(`Backend received real-time price: ${data.data.price}`);
            botManager.updateRealtimePrice(data.data.price, data.data.product_id);
          }
          break;
        case 'reset':
          console.log('Reset request received for bot:', data.botId);
          const botToReset = data.botId ? botManager.getBot(data.botId) : botManager.getActiveBot();
          if (botToReset) {
            botToReset.resetState();
            // Save the cleared state to file
            botToReset.saveState().catch(error => {
              console.error('Failed to save reset state:', error);
            });
            ws.send(JSON.stringify({
              type: 'resetComplete',
              botId: data.botId || botManager.activeBotId,
              status: botToReset.getStatus()
            }));
            // Broadcast updated manager state
            botManager.broadcast({
              type: 'managerState',
              data: botManager.getManagerState()
            });
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'No bot found to reset'
            }));
          }
          break;
        case 'forceSell':
          console.log('🧪 FORCE SELL request received for testing vault allocation');
          const botToSell = botManager.getActiveBot();
          if (botToSell) {
            // Force trigger a sell signal to test vault allocation
            const currentPrice = botToSell.currentPrice || 112000; // Use current price or fallback
            console.log(`🧪 Forcing sell at price: $${currentPrice}`);
            
            // Call the orchestrator's executeSellSignal directly for testing
            if (botToSell.orchestrator) {
              // Check current BTC balance before forcing sell
              const currentBtc = botToSell.orchestrator.positionManager.getTotalBtc();
              console.log(`🧪 Current BTC balance: ${currentBtc} BTC`);
              
              if (currentBtc === 0) {
                // No BTC to sell - simulate a profitable trade for testing
                console.log('🧪 No BTC to sell, simulating a profitable trade for testing...');
                const simulatedBtc = 0.1; // Simulate 0.1 BTC
                const simulatedCostBasis = currentPrice * 0.95 * simulatedBtc; // 5% profit
                
                // Temporarily add position for testing
                botToSell.orchestrator.balance.btc = simulatedBtc;
                botToSell.orchestrator.positionManager.addPosition({
                  size: simulatedBtc,
                  entryPrice: currentPrice * 0.95,
                  timestamp: Date.now()
                });
                
                console.log(`🧪 Simulated position: ${simulatedBtc} BTC at cost basis $${simulatedCostBasis.toFixed(2)}`);
              }
              
              const mockSignal = { reason: data.reason || 'Force sell for vault allocation test' };
              botToSell.orchestrator.executeSellSignal(mockSignal, currentPrice).then(() => {
                console.log('🧪 Force sell completed, vault allocation should be applied');
                ws.send(JSON.stringify({
                  type: 'forceSellComplete',
                  status: botToSell.getStatus()
                }));
              }).catch(error => {
                console.error('🧪 Force sell failed:', error);
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Force sell failed: ' + error.message
                }));
              });
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Bot orchestrator not available'
              }));
            }
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'No active bot found for force sell'
            }));
          }
          break;
        case 'subscribe':
          // Chart subscription - subscribe to Coinbase real-time data
          console.log('Chart subscription received:', data.pair, data.granularity);
          
          const subscriptionKey = `${data.pair}:${data.granularity}`;
          const clientSubs = chartSubscriptions.get(ws._clientId);
          
          if (clientSubs && !clientSubs.has(subscriptionKey)) {
            clientSubs.add(subscriptionKey);
            
            // Track active granularities for this pair
            if (!activeSubscriptions.has(data.pair)) {
              activeSubscriptions.set(data.pair, new Set());
            }
            activeSubscriptions.get(data.pair).add(data.granularity);
            
            // Convert granularity string to seconds for Coinbase
            const granularitySeconds = getGranularitySeconds(data.granularity);
            
            // Track the mapping between seconds and string for this pair
            const mappingKey = `${data.pair}:${granularitySeconds}`;
            granularityMappings.set(mappingKey, data.granularity);
            // 🔥 MEMORY LEAK FIX: Track creation time for TTL cleanup
            granularityMappingTimes.set(mappingKey, Date.now());
            
            // Subscribe to Coinbase WebSocket for this pair
            coinbaseWebSocket.subscribeMatches(data.pair, granularitySeconds);
            
            console.log(`📡 Subscribed client ${ws._clientId} to ${subscriptionKey} (${granularitySeconds}s)`);
          }
          
          ws.send(JSON.stringify({
            type: 'subscribed',
            pair: data.pair,
            granularity: data.granularity
          }));
          break;
          
        case 'unsubscribe':
          // Chart unsubscription
          console.log('Chart unsubscription received:', data.pair, data.granularity);
          
          const unsubKey = `${data.pair}:${data.granularity}`;
          const clientSubsUnsub = chartSubscriptions.get(ws._clientId);
          
          if (clientSubsUnsub && clientSubsUnsub.has(unsubKey)) {
            clientSubsUnsub.delete(unsubKey);
            
            // Check if any other clients are still subscribed to this pair
            let stillSubscribed = false;
            chartSubscriptions.forEach((subs) => {
              if (subs.has(unsubKey)) {
                stillSubscribed = true;
              }
            });
            
            // If no clients are subscribed, unsubscribe from Coinbase
            if (!stillSubscribed) {
              coinbaseWebSocket.unsubscribe(data.pair, 'matches');
              console.log(`📡 Unsubscribed from Coinbase for ${unsubKey} - no more clients`);
              
              // 🔥 MEMORY LEAK FIX: Clean up granularity mappings and timestamps
              const granularitySeconds = getGranularitySeconds(data.granularity);
              const mappingKey = `${data.pair}:${granularitySeconds}`;
              granularityMappings.delete(mappingKey);
              granularityMappingTimes.delete(mappingKey);
              console.log(`🧹 Cleaned up granularity mapping: ${mappingKey}`);
            }
            
            console.log(`📡 Unsubscribed client ${ws._clientId} from ${unsubKey}`);
          }
          
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            pair: data.pair,
            granularity: data.granularity
          }));
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    
    // Clean up chart subscriptions for this client
    const clientSubs = chartSubscriptions.get(ws._clientId);
    if (clientSubs) {
      clientSubs.forEach(subscriptionKey => {
        // Check if any other clients are still subscribed to this data
        let stillSubscribed = false;
        chartSubscriptions.forEach((subs, clientId) => {
          if (clientId !== ws._clientId && subs.has(subscriptionKey)) {
            stillSubscribed = true;
          }
        });
        
        // If no other clients are subscribed, unsubscribe from Coinbase
        if (!stillSubscribed) {
          const [pair, granularityStr] = subscriptionKey.split(':');
          coinbaseWebSocket.unsubscribe(pair, 'matches');
          console.log(`📡 Unsubscribed from Coinbase for ${subscriptionKey} - client disconnected`);
          
          // 🔥 MEMORY LEAK FIX: Clean up granularity mappings and timestamps
          const granularitySeconds = getGranularitySeconds(granularityStr);
          const mappingKey = `${pair}:${granularitySeconds}`;
          granularityMappings.delete(mappingKey);
          granularityMappingTimes.delete(mappingKey);
          console.log(`🧹 Cleaned up granularity mapping: ${mappingKey}`);
        }
      });
      
      chartSubscriptions.delete(ws._clientId);
    }
    
    botManager.removeClient(ws);
    
    // Remove from all bot instances
    botManager.bots.forEach(bot => {
      bot.removeClient(ws);
    });
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to trading backend with bot manager',
    managerState: botManager.getManagerState(),
    status: botManager.getStatus()
  }));
});

app.use('/api/trading', tradingRoutes(botManager));

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
  
  // 🔥 MEMORY LEAK FIX: Clean up all Maps and subscriptions
  console.log('🧹 Cleaning up memory...');
  chartSubscriptions.clear();
  activeSubscriptions.clear();
  granularityMappings.clear();
  granularityMappingTimes.clear();
  
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