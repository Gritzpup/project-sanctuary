const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:4827');

ws.on('open', () => {
  console.log('Connected to backend');
  
  // Select bot
  ws.send(JSON.stringify({
    type: 'selectBot',
    botId: 'reverse-ratio-bot-1'
  }));
  
  setTimeout(() => {
    // Start trading
    console.log('Starting trading...');
    ws.send(JSON.stringify({
      type: 'start',
      config: {
        strategyType: 'reverse-ratio',
        strategyConfig: {
          vaultAllocation: 85.7,
          btcGrowthAllocation: 14.3,
          initialDropPercent: 0.02,
          levelDropPercent: 0.008,
          ratioMultiplier: 1,
          profitTarget: 0.85,
          maxLevels: 12,
          lookbackPeriod: 3,
          positionSizeMode: 'percentage',
          basePositionPercent: 8,
          basePositionAmount: 50,
          maxPositionPercent: 96,
          vaultConfig: {
            btcVaultPercent: 14.3,
            usdGrowthPercent: 14.3,
            usdcVaultPercent: 71.4,
            compoundFrequency: 'trade',
            minCompoundAmount: 0.01,
            autoCompound: true,
            btcVaultTarget: 0.1,
            usdcVaultTarget: 10000,
            rebalanceThreshold: 5
          }
        }
      }
    }));
  }, 1000);
  
  setTimeout(() => {
    // Get status
    ws.send(JSON.stringify({ type: 'getStatus' }));
  }, 2000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Received:', msg.type, msg.status?.isRunning ? 'Running: ' + msg.status.isRunning : '');
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

// Keep process alive
setTimeout(() => {
  console.log('Test complete');
  process.exit(0);
}, 5000);