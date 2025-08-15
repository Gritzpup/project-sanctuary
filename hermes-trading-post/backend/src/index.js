import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { TradingService } from './services/tradingService.js';
import tradingRoutes from './routes/trading.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4827; // Fixed port for development

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const tradingService = new TradingService();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');

  tradingService.addClient(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data);
      
      switch (data.type) {
        case 'start':
          tradingService.startTrading(data.config);
          break;
        case 'stop':
          tradingService.stopTrading();
          break;
        case 'pause':
          tradingService.pauseTrading();
          break;
        case 'resume':
          tradingService.resumeTrading();
          break;
        case 'getStatus':
          ws.send(JSON.stringify({
            type: 'status',
            data: tradingService.getStatus()
          }));
          break;
        case 'updateStrategy':
          tradingService.updateStrategy(data.strategy);
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
    tradingService.removeClient(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to trading backend',
    status: tradingService.getStatus()
  }));
});

app.use('/api/trading', tradingRoutes(tradingService));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    trading: tradingService.getStatus()
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Trading backend server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`💹 Trading service initialized`);
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
  
  // Stop trading service
  tradingService.cleanup();
  
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