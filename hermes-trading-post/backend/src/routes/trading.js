import express from 'express';

export default function tradingRoutes(tradingService) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json(tradingService.getStatus());
  });

  router.post('/start', (req, res) => {
    const { strategy, reset } = req.body;
    tradingService.startTrading({ strategy, reset });
    res.json({ 
      message: 'Trading started',
      status: tradingService.getStatus() 
    });
  });

  router.post('/stop', (req, res) => {
    tradingService.stopTrading();
    res.json({ 
      message: 'Trading stopped',
      status: tradingService.getStatus() 
    });
  });

  router.post('/pause', (req, res) => {
    tradingService.pauseTrading();
    res.json({ 
      message: 'Trading paused',
      status: tradingService.getStatus() 
    });
  });

  router.post('/resume', (req, res) => {
    tradingService.resumeTrading();
    res.json({ 
      message: 'Trading resumed',
      status: tradingService.getStatus() 
    });
  });

  router.put('/strategy', (req, res) => {
    const { strategy } = req.body;
    tradingService.updateStrategy(strategy);
    res.json({ 
      message: 'Strategy updated',
      status: tradingService.getStatus() 
    });
  });

  router.get('/trades', (req, res) => {
    res.json({
      trades: tradingService.trades,
      count: tradingService.trades.length
    });
  });

  router.get('/positions', (req, res) => {
    res.json({
      positions: tradingService.positions,
      count: tradingService.positions.length
    });
  });

  router.post('/reset', (req, res) => {
    tradingService.resetState();
    res.json({ 
      message: 'Trading state reset',
      status: tradingService.getStatus() 
    });
  });

  return router;
}