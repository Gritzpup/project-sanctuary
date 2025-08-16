#!/usr/bin/env node

// Monitor script to check trading execution
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:4827');

let startTime = Date.now();
let priceHistory = [];
let lastPrice = 0;
let highPrice = 0;
let lowPrice = Infinity;

ws.on('open', () => {
  console.log('Connected to trading backend');
  ws.send(JSON.stringify({ type: 'getStatus' }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'priceUpdate') {
    const price = message.data.currentPrice;
    const time = new Date().toISOString();
    
    if (lastPrice === 0) {
      lastPrice = price;
      highPrice = price;
      lowPrice = price;
    }
    
    // Track price changes
    const change = ((price - lastPrice) / lastPrice) * 100;
    const dropFromHigh = ((highPrice - price) / highPrice) * 100;
    
    // Update high/low
    if (price > highPrice) highPrice = price;
    if (price < lowPrice) lowPrice = price;
    
    console.log(`[${time}] Price: $${price.toFixed(2)} | Change: ${change >= 0 ? '+' : ''}${change.toFixed(4)}% | Drop from high: ${dropFromHigh.toFixed(4)}% | High: $${highPrice.toFixed(2)} | Low: $${lowPrice.toFixed(2)}`);
    
    // Alert if drop is significant (> 0.01%)
    if (dropFromHigh >= 0.01) {
      console.log(`🎯 POTENTIAL BUY SIGNAL - Price dropped ${dropFromHigh.toFixed(4)}% from high!`);
    }
    
    lastPrice = price;
    priceHistory.push({ time, price, dropFromHigh });
    
    // Keep only last 100 prices
    if (priceHistory.length > 100) {
      priceHistory.shift();
    }
  } else if (message.type === 'trade') {
    console.log('🚨 TRADE EXECUTED:', message.data);
  } else if (message.type === 'status') {
    console.log('Trading status:', {
      isRunning: message.data.isRunning,
      strategy: message.data.strategy?.strategyType || 'none',
      balance: message.data.balance,
      positions: message.data.positions?.length || 0,
      trades: message.data.trades?.length || 0
    });
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from trading backend');
  
  // Print summary
  console.log('\n=== PRICE SUMMARY ===');
  console.log(`Monitoring duration: ${((Date.now() - startTime) / 1000 / 60).toFixed(2)} minutes`);
  console.log(`High: $${highPrice.toFixed(2)}`);
  console.log(`Low: $${lowPrice.toFixed(2)}`);
  console.log(`Range: $${(highPrice - lowPrice).toFixed(2)} (${(((highPrice - lowPrice) / highPrice) * 100).toFixed(4)}%)`);
  
  // Find largest drops
  const drops = priceHistory.filter(p => p.dropFromHigh > 0).sort((a, b) => b.dropFromHigh - a.dropFromHigh);
  if (drops.length > 0) {
    console.log('\nLargest drops from high:');
    drops.slice(0, 5).forEach(d => {
      console.log(`  ${d.time}: ${d.dropFromHigh.toFixed(4)}% (Price: $${d.price.toFixed(2)})`);
    });
  }
  
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  ws.close();
});

console.log('Monitoring trading backend... Press Ctrl+C to stop');
console.log('Watching for price drops >= 0.01% (the configured threshold)');
console.log('---');