#!/usr/bin/env node

// Monitor script to check trading execution
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:4828');

let startTime = Date.now();
let priceHistory = [];
let lastPrice = 0;
let highPrice = 0;
let lowPrice = Infinity;
let lastStatus = null;

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'getStatus' }));
  
  // Request status updates every 10 seconds
  setInterval(() => {
    ws.send(JSON.stringify({ type: 'getStatus' }));
  }, 10000);
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
    
    let nextBuyInfo = '';
    let nextSellInfo = '';
    
    if (lastStatus && lastStatus.nextBuyPrice) {
      const distanceToNextBuy = ((price - lastStatus.nextBuyPrice) / price) * 100;
      nextBuyInfo = ` | Next buy: $${lastStatus.nextBuyPrice.toFixed(2)} (${distanceToNextBuy.toFixed(3)}% away)`;
    }
    
    if (lastStatus && lastStatus.nextSellPrice) {
      const distanceToNextSell = ((lastStatus.nextSellPrice - price) / price) * 100;
      nextSellInfo = ` | Next sell: $${lastStatus.nextSellPrice.toFixed(2)} (${distanceToNextSell.toFixed(3)}% away)`;
    }
    
    
    // Alert if price is close to next buy price
    if (lastStatus && lastStatus.nextBuyPrice && price <= lastStatus.nextBuyPrice * 1.001) {
    }
    
    // Alert if price is close to next sell price
    if (lastStatus && lastStatus.nextSellPrice && price >= lastStatus.nextSellPrice * 0.999) {
    }
    
    lastPrice = price;
    priceHistory.push({ time, price, dropFromHigh });
    
    // Keep only last 100 prices
    if (priceHistory.length > 100) {
      priceHistory.shift();
    }
  } else if (message.type === 'trade') {
  } else if (message.type === 'status') {
    lastStatus = message.data;
  }
});

ws.on('error', (error) => {
});

ws.on('close', () => {
  
  // Print summary
  
  // Find largest drops
  const drops = priceHistory.filter(p => p.dropFromHigh > 0).sort((a, b) => b.dropFromHigh - a.dropFromHigh);
  if (drops.length > 0) {
    drops.slice(0, 5).forEach(d => {
    });
  }
  
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  ws.close();
});

