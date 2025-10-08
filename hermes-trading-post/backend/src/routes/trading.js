import express from 'express';
import { redisCandleStorage } from '../services/redis/RedisCandleStorage.js';
import { historicalDataService } from '../services/HistoricalDataService.js';

export default function tradingRoutes(botManager) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json(botManager.getStatus());
  });

  router.post('/start', (req, res) => {
    const { strategy, reset } = req.body;
    try {
      botManager.startTrading({ strategy, reset });
      res.json({ 
        message: 'Trading started',
        status: botManager.getStatus() 
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stop', (req, res) => {
    try {
      botManager.stopTrading();
      res.json({ 
        message: 'Trading stopped',
        status: botManager.getStatus() 
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/pause', (req, res) => {
    try {
      botManager.pauseTrading();
      res.json({ 
        message: 'Trading paused',
        status: botManager.getStatus() 
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/resume', (req, res) => {
    try {
      botManager.resumeTrading();
      res.json({ 
        message: 'Trading resumed',
        status: botManager.getStatus() 
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/strategy', (req, res) => {
    const { strategy } = req.body;
    try {
      botManager.updateStrategy(strategy);
      res.json({ 
        message: 'Strategy updated',
        status: botManager.getStatus() 
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/trades', (req, res) => {
    const activeBot = botManager.getActiveBot();
    if (!activeBot) {
      res.json({ trades: [], count: 0 });
    } else {
      res.json({
        trades: activeBot.trades || [],
        count: activeBot.trades?.length || 0
      });
    }
  });

  router.get('/positions', (req, res) => {
    const activeBot = botManager.getActiveBot();
    if (!activeBot) {
      res.json({ positions: [], count: 0 });
    } else {
      res.json({
        positions: activeBot.positions || [],
        count: activeBot.positions?.length || 0
      });
    }
  });

  router.post('/reset', (req, res) => {
    try {
      const activeBot = botManager.getActiveBot();
      if (activeBot) {
        activeBot.resetState();
      }
      res.json({ 
        message: 'Trading state reset',
        status: botManager.getStatus() 
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Bot management routes
  router.get('/bots', (req, res) => {
    res.json(botManager.getManagerState());
  });

  router.post('/bots', (req, res) => {
    const { strategyType, botName, config } = req.body;
    try {
      const botId = botManager.createBot(strategyType, botName, config);
      res.json({ 
        message: 'Bot created',
        botId,
        state: botManager.getManagerState()
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/bots/:botId/select', (req, res) => {
    const { botId } = req.params;
    try {
      botManager.selectBot(botId);
      res.json({ 
        message: 'Bot selected',
        botId,
        status: botManager.getStatus()
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/bots/:botId', (req, res) => {
    const { botId } = req.params;
    try {
      botManager.deleteBot(botId);
      res.json({ 
        message: 'Bot deleted',
        botId,
        state: botManager.getManagerState()
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Chart data endpoint using Redis storage
  router.get('/chart-data', async (req, res) => {
    try {
      const { pair = 'BTC-USD', granularity = '1m', startTime, endTime, maxCandles = 1000 } = req.query;
      
      const now = Math.floor(Date.now() / 1000);
      const calculatedEndTime = endTime ? parseInt(endTime) : now;
      
      // Calculate start time based on maxCandles if not provided
      const granularitySeconds = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
        '4h': 14400,
        '6h': 21600,
        '12h': 43200,
        '1d': 86400
      }[granularity] || 60;
      
      const calculatedStartTime = startTime ? 
        parseInt(startTime) : 
        calculatedEndTime - (parseInt(maxCandles) * granularitySeconds);
      
      console.log(`📊 Chart data request: ${pair} ${granularity} from ${new Date(calculatedStartTime * 1000).toISOString()} to ${new Date(calculatedEndTime * 1000).toISOString()}`);
      
      // Try to get data from Redis first
      const allCandles = await redisCandleStorage.getCandles(
        pair,
        granularity,
        calculatedStartTime,
        calculatedEndTime
      );
      
      // Limit results to maxCandles (keep most recent)
      const maxCandlesInt = parseInt(maxCandles);
      const candles = allCandles.length > maxCandlesInt ? 
        allCandles.slice(-maxCandlesInt) : 
        allCandles;
      
      // Get metadata for cache info
      const metadata = await redisCandleStorage.getMetadata(pair, granularity);
      
      // Calculate cache metrics
      const expectedCandles = Math.ceil((calculatedEndTime - calculatedStartTime) / granularitySeconds);
      const cacheHitRatio = expectedCandles > 0 ? candles.length / expectedCandles : 0;
      
      res.json({
        success: true,
        data: {
          candles: candles.map(candle => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
          })),
          metadata: {
            pair,
            granularity,
            totalCandles: candles.length,
            firstTimestamp: candles[0]?.time || calculatedStartTime,
            lastTimestamp: candles[candles.length - 1]?.time || calculatedEndTime,
            source: 'redis',
            cacheHitRatio,
            storageMetadata: metadata
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Chart data request failed:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        data: {
          candles: [],
          metadata: {
            totalCandles: 0,
            source: 'error',
            cacheHitRatio: 0
          }
        }
      });
    }
  });

  // Redis storage statistics endpoint
  router.get('/storage-stats', async (req, res) => {
    try {
      const stats = await redisCandleStorage.getStorageStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Storage stats request failed:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Populate historical data endpoint
  router.post('/populate-historical', async (req, res) => {
    try {
      const { pair = 'BTC-USD', granularity = '1m', days = 7 } = req.body;
      
      console.log(`📈 Historical data population requested: ${pair} ${granularity} ${days} days`);
      
      // Check if already running
      const status = historicalDataService.getStatus();
      if (status.isRunning) {
        return res.json({
          success: false,
          message: 'Historical data fetch already in progress',
          status
        });
      }
      
      // Start historical data fetch (don't await - run in background)
      historicalDataService.fetchHistoricalData(pair, granularity, parseInt(days));
      
      res.json({
        success: true,
        data: {
          pair,
          granularity,
          days: parseInt(days),
          message: `Started fetching ${days} days of historical data`,
          status: historicalDataService.getStatus()
        }
      });
      
    } catch (error) {
      console.error('❌ Historical data population failed:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}