import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { TradingService } from './services/tradingService.js';
import { BotManager } from './services/botManager.js';
import tradingRoutes from './routes/trading.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4827; // Fixed port for development
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const botManager = new BotManager();

// Initialize default bots on startup
// Use async IIFE to handle async initialization
(async () => {
  await botManager.initializeDefaultBots();
})();

wss.on('connection', (ws) => {
  // console.log('New WebSocket connection established');

  botManager.addClient(ws);

  // Also add client to all bot instances for price updates
  botManager.bots.forEach(bot => {
    bot.addClient(ws);
  });

  ws.on('message', (message) => {
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
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
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
  
  // Close all WebSocket connections
  wss.clients.forEach(client => {
    client.close();
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('Server closed');
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