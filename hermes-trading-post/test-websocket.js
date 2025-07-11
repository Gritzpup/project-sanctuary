import WebSocket from 'ws';

console.log('Testing Coinbase WebSocket with heartbeat...');

const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
let messageCount = 0;
let lastMessageTime = Date.now();

ws.on('open', () => {
  console.log('WebSocket connected');
  
  // Subscribe to BTC-USD ticker
  const subscribeMessage = {
    type: 'subscribe',
    product_ids: ['BTC-USD'],
    channels: ['ticker']
  };
  
  ws.send(JSON.stringify(subscribeMessage));
  console.log('Sent subscribe message');
  
  // Start heartbeat - resubscribe every 30 seconds
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const timeSinceLastMessage = Date.now() - lastMessageTime;
      console.log(`\n[Heartbeat] Time since last message: ${Math.round(timeSinceLastMessage/1000)}s`);
      console.log('[Heartbeat] Re-subscribing to keep connection alive...');
      ws.send(JSON.stringify(subscribeMessage));
    }
  }, 30000);
});

ws.on('message', (data) => {
  messageCount++;
  lastMessageTime = Date.now();
  const message = JSON.parse(data.toString());
  
  if (message.type === 'subscriptions') {
    console.log('\nSubscription confirmed:', message);
  } else if (message.type === 'ticker' && message.product_id === 'BTC-USD') {
    console.log(`\n[${new Date().toISOString()}] BTC Price: $${message.price} (message #${messageCount})`);
  } else if (message.type === 'error') {
    console.error('\nError message:', message);
  }
});

ws.on('close', () => {
  console.log('\nWebSocket disconnected');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('\nWebSocket error:', error);
});

// Run for 2 minutes to test heartbeat
setTimeout(() => {
  console.log(`\nTest complete. Received ${messageCount} messages.`);
  ws.close();
}, 120000);

console.log('Test will run for 2 minutes to verify heartbeat functionality...');