import axios from 'axios';

async function testCoinbaseAPI() {
  try {
    console.log('Testing Coinbase API...');
    
    // Test ticker
    const tickerResponse = await axios.get('https://api.exchange.coinbase.com/products/BTC-USD/ticker');
    console.log('Ticker:', tickerResponse.data.price);
    
    // Test candles
    const candlesResponse = await axios.get('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60');
    console.log('Candles count:', candlesResponse.data.length);
    console.log('First candle:', candlesResponse.data[0]);
    console.log('Last candle:', candlesResponse.data[candlesResponse.data.length - 1]);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testCoinbaseAPI();