<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let currentPrice: number = 0;
  export let connectionStatus: 'connected' | 'disconnected' | 'error' | 'loading' = 'loading';
  
  const dispatch = createEventDispatcher();
  let selectedDays = 300;
  
  $: statusColor = {
    connected: '#26a69a',
    disconnected: '#ffa726',
    error: '#ef5350',
    loading: '#42a5f5'
  }[connectionStatus];

  $: statusText = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    loading: 'Loading...'
  }[connectionStatus];
  
  async function testAPI() {
    console.log('=== Manual API Test Started ===');
    try {
      // Test proxy endpoint
      console.log('Testing proxy endpoint...');
      const proxyResponse = await fetch('/api/coinbase/products/BTC-USD/ticker');
      console.log('Proxy response status:', proxyResponse.status);
      const proxyData = await proxyResponse.json();
      console.log('Proxy ticker data:', proxyData);
      
      // Test candles endpoint
      console.log('\nTesting candles endpoint...');
      const candlesResponse = await fetch('/api/coinbase/products/BTC-USD/candles?granularity=60');
      console.log('Candles response status:', candlesResponse.status);
      const candlesData = await candlesResponse.json();
      console.log('Candles count:', candlesData.length);
      console.log('First candle:', candlesData[0]);
      console.log('Last candle:', candlesData[candlesData.length - 1]);
      
      console.log('=== API Test Completed Successfully ===');
    } catch (error) {
      console.error('=== API Test Failed ===');
      console.error('Error:', error);
    }
  }
</script>

<div class="sidebar">
  <div class="header">
    <h1>Hermes Trading Post</h1>
    <div class="subtitle">BTC-USD Live Trading Dashboard</div>
  </div>

  <div class="section">
    <h2>Connection Status</h2>
    <div class="status-indicator">
      <div class="status-dot status-{connectionStatus}"></div>
      <span>{statusText}</span>
    </div>
  </div>

  <div class="section">
    <h2>Current Price</h2>
    <div class="price">
      ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  </div>

  <div class="section">
    <h2>Trading Information</h2>
    <div class="info-item">
      <span class="label">Symbol:</span>
      <span class="value">BTC-USD</span>
    </div>
    <div class="info-item">
      <span class="label">Exchange:</span>
      <span class="value">Coinbase</span>
    </div>
    <div class="info-item">
      <span class="label">Interval:</span>
      <span class="value">1 minute</span>
    </div>
  </div>

  <div class="section controls">
    <h2>Chart Controls</h2>
    <div class="timeframe-buttons">
      <button class="btn-base btn-sm btn-timeframe" data-days="1">1D</button>
      <button class="btn-base btn-sm btn-timeframe" data-days="7">1W</button>
      <button class="btn-base btn-sm btn-timeframe" data-days="30">1M</button>
      <button class="btn-base btn-sm btn-timeframe" data-days="90">3M</button>
      <button class="btn-base btn-sm btn-timeframe active" data-days="300">1Y</button>
    </div>
    <div class="control-info">
      <p>• Scroll to zoom in/out</p>
      <p>• Drag to pan</p>
      <p>• Click and drag to measure</p>
    </div>
  </div>

  <div class="section">
    <h2>Debug Tools</h2>
    <button class="btn-base btn-md" on:click={testAPI}>Test Coinbase API</button>
  </div>
</div>

<style>
  .sidebar {
    background-color: #0d0d0d;
    color: #d1d4dc;
    padding: 20px;
    height: 100%;
    overflow-y: auto;
    border-right: 1px solid #2a2a2a;
  }

  .timeframe-buttons {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 5px;
    margin-bottom: 15px;
  }


  .header {
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 1px solid #2a2a2a;
  }

  h1 {
    font-size: 24px;
    margin: 0 0 8px 0;
    color: #42a5f5;
  }

  .subtitle {
    font-size: 14px;
    color: #888;
  }

  .section {
    margin-bottom: 30px;
  }

  h2 {
    font-size: 16px;
    margin: 0 0 15px 0;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

  .price {
    font-size: 32px;
    font-weight: bold;
    color: #26a69a;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 14px;
  }

  .label {
    color: #888;
  }

  .value {
    color: #d1d4dc;
  }

  .controls {
    margin-top: auto;
  }

  .control-info {
    font-size: 13px;
    color: #888;
  }

  .control-info p {
    margin: 5px 0;
  }

  .test-button {
    background-color: #42a5f5;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    width: 100%;
    transition: background-color 0.2s;
  }

  .test-button:hover {
    background-color: #1e88e5;
  }

  .test-button:active {
    background-color: #1565c0;
  }
</style>