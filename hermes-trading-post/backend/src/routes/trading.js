import express from 'express';

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

  return router;
}