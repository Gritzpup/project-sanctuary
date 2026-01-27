import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import cors from 'cors';
import dotenv from 'dotenv';
import { BotManager } from './services/botManager.js';

dotenv.config();

const app = express();
const PORT = process.env.BOTS_PORT || 4829;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const botManager = new BotManager();

// Store all connected WebSocket clients for broadcasting
const wsClients = new Set();

// Initialize Redis client for bot data
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('connect', () => {
});

redis.on('error', (err) => {
});

// Helper function to broadcast to all WebSocket clients
function broadcastToClients(message) {
  const messageString = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageString);
    }
  });
}

// WebSocket message handler for commands from backend and price updates
wss.on('connection', (ws) => {

  // Add to clients set
  wsClients.add(ws);

  // Also add to botManager for backward compatibility
  botManager.addClient(ws);

  // Send initial bot status to new client
  const initialStatus = botManager.getStatus();
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Hermes Bots Service',
    status: initialStatus
  }));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        // Price updates from main backend
        case 'ticker':
          if (message.data && message.data.price) {
            botManager.updateRealtimePrice(message.data.price, message.data.product_id);
          }
          break;

        // Bot control commands
        case 'start':
          {
            const activeBot = botManager.getActiveBot();
            if (activeBot) {
              // Use strategy config from message or default
              const strategyConfig = message.strategyConfig || {
                strategyType: 'reverse-descending-grid',
                strategyConfig: {}
              };
              await activeBot.startTrading(strategyConfig);
              const status = activeBot.getStatus();
              ws.send(JSON.stringify({
                type: 'status',
                data: status
              }));
            }
          }
          break;

        case 'stop':
          {
            console.log('[Backend] Stop command received');
            const activeBot = botManager.getActiveBot();
            if (activeBot) {
              console.log('[Backend] Stopping active bot:', botManager.activeBotId);
              await activeBot.stopTrading();
              const status = activeBot.getStatus();
              console.log('[Backend] Bot stopped, isRunning:', status.isRunning);
              ws.send(JSON.stringify({
                type: 'status',
                data: status
              }));
            } else {
              console.log('[Backend] No active bot to stop');
            }
          }
          break;

        case 'pause':
          {
            const activeBot = botManager.getActiveBot();
            if (activeBot) {
              activeBot.pauseTrading();
              const status = activeBot.getStatus();
              ws.send(JSON.stringify({
                type: 'status',
                data: status
              }));
            }
          }
          break;

        case 'resume':
          {
            const activeBot = botManager.getActiveBot();
            if (activeBot) {
              activeBot.resumeTrading();
              const status = activeBot.getStatus();
              ws.send(JSON.stringify({
                type: 'status',
                data: status
              }));
            }
          }
          break;

        case 'getStatus':
          {
            const status = botManager.getStatus();
            ws.send(JSON.stringify({
              type: 'status',
              data: status
            }));
          }
          break;

        case 'getManagerState':
          {
            const state = botManager.getManagerState();
            ws.send(JSON.stringify({
              type: 'managerState',
              data: state
            }));
          }
          break;

        case 'selectBot':
          // 🔇 SILENCED: Too spammy - fires constantly from frontend polling
          // console.log('[Backend] SelectBot command received:', message.botId);
          if (message.botId) {
            try {
              botManager.selectBot(message.botId);
              // console.log('[Backend] Bot selected, activeBotId now:', botManager.activeBotId);
              // Send manager state first
              ws.send(JSON.stringify({
                type: 'managerState',
                data: botManager.getManagerState()
              }));
              // CRITICAL: Also send the new bot's status so UI updates isRunning/isPaused
              const selectedBot = botManager.getActiveBot();
              if (selectedBot) {
                const status = selectedBot.getStatus();
                // console.log('[Backend] Sending selected bot status, isRunning:', status.isRunning);
                ws.send(JSON.stringify({
                  type: 'status',
                  data: status
                }));
              }
            } catch (err) {
              console.error('[Backend] SelectBot error:', err.message);
            }
          }
          break;

        default:
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    botManager.removeClient(ws);
  });
});

// REST API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'hermes-bots',
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      external: `${Math.round(process.memoryUsage().external / 1024 / 1024)} MB`
    },
    botManager: {
      totalBots: botManager.bots.size,
      activeBotId: botManager.activeBotId,
      status: botManager.getActiveBot() ? {
        isRunning: botManager.getActiveBot().isRunning,
        isPaused: botManager.getActiveBot().isPaused
      } : null
    }
  });
});

// Get all bots status
app.get('/api/bots', (req, res) => {
  const bots = Array.from(botManager.bots.values()).map(bot => ({
    id: bot.id,
    name: bot.name,
    strategy: bot.strategy?.constructor?.name || 'unknown',
    isRunning: bot.isRunning,
    isPaused: bot.isPaused,
    balance: bot.balance,
    positions: bot.positions?.length || 0,
    trades: bot.trades?.length || 0
  }));

  res.json({
    success: true,
    data: {
      bots,
      activeBotId: botManager.activeBotId,
      totalBots: botManager.bots.size
    }
  });
});

// Get active bot status
app.get('/api/bots/active', (req, res) => {
  const activeBot = botManager.getActiveBot();

  if (!activeBot) {
    return res.status(404).json({
      success: false,
      error: 'No active bot'
    });
  }

  res.json({
    success: true,
    data: {
      id: activeBot.id,
      name: activeBot.name,
      strategy: activeBot.strategy?.constructor?.name || 'unknown',
      isRunning: activeBot.isRunning,
      isPaused: activeBot.isPaused,
      balance: activeBot.balance,
      positions: activeBot.positions,
      trades: activeBot.trades,
      stats: activeBot.getStats ? activeBot.getStats() : null
    }
  });
});

// Switch active bot
app.post('/api/bots/switch', (req, res) => {
  const { botId } = req.body;

  if (!botId) {
    return res.status(400).json({
      success: false,
      error: 'botId is required'
    });
  }

  try {
    botManager.switchActiveBot(botId);

    res.json({
      success: true,
      data: {
        activeBotId: botManager.activeBotId,
        message: `Switched to bot: ${botId}`
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Start bot
app.post('/api/bots/start', async (req, res) => {
  const activeBot = botManager.getActiveBot();

  if (!activeBot) {
    return res.status(404).json({
      success: false,
      error: 'No active bot'
    });
  }

  try {
    // Use strategy config from request or default
    const strategyConfig = req.body.strategyConfig || {
      strategyType: 'reverse-descending-grid',
      strategyConfig: {}
    };

    await activeBot.startTrading(strategyConfig);
    const status = activeBot.getStatus();

    res.json({
      success: true,
      data: {
        botId: botManager.activeBotId,
        status: status,
        message: 'Bot started successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop bot
app.post('/api/bots/stop', async (req, res) => {
  const activeBot = botManager.getActiveBot();

  if (!activeBot) {
    return res.status(404).json({
      success: false,
      error: 'No active bot'
    });
  }

  try {
    await activeBot.stopTrading();
    const status = activeBot.getStatus();

    res.json({
      success: true,
      data: {
        botId: botManager.activeBotId,
        status: status,
        message: 'Bot stopped successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pause bot
app.post('/api/bots/pause', (req, res) => {
  const activeBot = botManager.getActiveBot();

  if (!activeBot) {
    return res.status(404).json({
      success: false,
      error: 'No active bot'
    });
  }

  try {
    activeBot.pauseTrading();
    const status = activeBot.getStatus();

    res.json({
      success: true,
      data: {
        botId: botManager.activeBotId,
        status: status,
        message: 'Bot paused successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume bot
app.post('/api/bots/resume', (req, res) => {
  const activeBot = botManager.getActiveBot();

  if (!activeBot) {
    return res.status(404).json({
      success: false,
      error: 'No active bot'
    });
  }

  try {
    activeBot.resumeTrading();
    const status = activeBot.getStatus();

    res.json({
      success: true,
      data: {
        botId: botManager.activeBotId,
        status: status,
        message: 'Bot resumed successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize default bots on startup
(async () => {

  try {
    await botManager.initializeDefaultBots();
  } catch (error) {
  }
})();

// Broadcast bot status updates every 2 seconds
const broadcastStatusInterval = setInterval(() => {
  if (wsClients.size > 0) {
    const activeBot = botManager.getActiveBot();
    if (activeBot && activeBot.isRunning) {
      const status = activeBot.getStatus();
      broadcastToClients({
        type: 'status',
        data: status
      });
    }
  }
}, 2000);

// Start the server
server.listen(PORT, HOST, () => {
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {

  try {
    // Clear the broadcast status interval
    clearInterval(broadcastStatusInterval);

    // Stop all bots
    for (const bot of botManager.bots.values()) {
      if (bot.isRunning) {
        bot.stop();
      }
    }

    // Close WebSocket connections
    wss.clients.forEach(client => {
      client.close();
    });

    // Close Redis connection
    await redis.quit();

    // Close HTTP server
    server.close(() => {
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      process.exit(1);
    }, 10000);
  } catch (error) {
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
