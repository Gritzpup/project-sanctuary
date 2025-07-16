import type { CandleData } from '../types/coinbase';
import { CoinbaseWebSocket } from './coinbaseWebSocket';
import { CandleAggregator } from './candleAggregator';

export class SimpleChartDataFeed {
  private ws: CoinbaseWebSocket;
  private symbol = 'BTC-USD';
  
  // Store all 1-minute candles in memory
  private oneMinuteCandles: Map<number, CandleData> = new Map();
  private currentPrice = 100000;
  
  // Subscribers
  private subscribers: Map<string, (candle: CandleData) => void> = new Map();

  constructor() {
    this.ws = new CoinbaseWebSocket();
    this.generateDemoData();
    this.setupWebSocket();
    this.startPriceSimulation();
  }

  private generateDemoData() {
    console.log('Generating realistic BTC-USD demo data...');
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = Math.floor(now / 60) * 60;
    
    // Generate 7 days of 1-minute candles
    const days = 7;
    const totalMinutes = days * 24 * 60;
    
    // Start with a realistic BTC price
    let price = 98000 + Math.random() * 4000; // Between 98k and 102k
    let momentum = 0;
    let trendDirection = Math.random() > 0.5 ? 1 : -1;
    let trendStrength = 0.0001 + Math.random() * 0.0002;
    let trendDuration = Math.floor(60 + Math.random() * 180); // 1-4 hours
    let minutesInTrend = 0;
    
    for (let i = totalMinutes; i >= 0; i--) {
      const time = currentMinute - (i * 60);
      
      // Update trend periodically
      minutesInTrend++;
      if (minutesInTrend > trendDuration) {
        // Possibly reverse trend
        if (Math.random() > 0.7) {
          trendDirection *= -1;
        }
        trendStrength = 0.0001 + Math.random() * 0.0002;
        trendDuration = Math.floor(60 + Math.random() * 180);
        minutesInTrend = 0;
      }
      
      // Time of day volatility (more volatile during US market hours)
      const hour = new Date(time * 1000).getUTCHours();
      const baseVolatility = (hour >= 13 && hour <= 21) ? 0.0008 : 0.0004;
      const volatility = baseVolatility + Math.random() * 0.0004;
      
      // Apply momentum and mean reversion
      momentum = momentum * 0.95 + (Math.random() - 0.5) * 0.05;
      const trend = trendDirection * trendStrength;
      
      // Calculate price change with trend, momentum, and randomness
      const priceChange = price * volatility * (Math.random() - 0.5 + trend + momentum * 0.1);
      price = Math.max(90000, Math.min(110000, price + priceChange));
      
      // Generate realistic OHLC
      const open = price;
      
      // Intrabar movements - more realistic distribution
      const barVolatility = 20 + Math.random() * 80;
      const moves = [];
      for (let j = 0; j < 4; j++) {
        moves.push(open + (Math.random() - 0.5) * barVolatility);
      }
      
      const high = Math.max(open, ...moves);
      const low = Math.min(open, ...moves);
      const close = moves[moves.length - 1];
      
      // Volume based on volatility (higher volatility = higher volume)
      const baseVolume = 50;
      const volume = baseVolume + Math.abs(close - open) * 0.5 + Math.random() * 50;
      
      // Update price for next iteration
      price = close;
      
      this.oneMinuteCandles.set(time, {
        time,
        open,
        high,
        low,
        close,
        volume
      });
    }
    
    console.log(`Generated ${this.oneMinuteCandles.size} realistic BTC candles`);
    console.log(`Price range: $${Math.min(...Array.from(this.oneMinuteCandles.values()).map(c => c.low)).toFixed(0)} - $${Math.max(...Array.from(this.oneMinuteCandles.values()).map(c => c.high)).toFixed(0)}`);
    
    // Set current price to the last candle's close
    const lastCandle = this.oneMinuteCandles.get(currentMinute);
    if (lastCandle) {
      this.currentPrice = lastCandle.close;
      console.log(`Current BTC price: $${this.currentPrice.toFixed(2)}`);
    }
  }

  private setupWebSocket() {
    this.ws.onPrice((price) => {
      this.currentPrice = price;
      this.updateCurrentCandle(price);
    });
  }

  private startPriceSimulation() {
    // In demo mode, simulate realistic price changes
    let momentum = 0;
    let microTrend = Math.random() > 0.5 ? 1 : -1;
    
    setInterval(() => {
      // Occasionally change micro trend
      if (Math.random() > 0.95) {
        microTrend *= -1;
      }
      
      // Update momentum
      momentum = momentum * 0.9 + (Math.random() - 0.5) * 0.1;
      
      // Small realistic price change
      const volatility = 0.00005 + Math.random() * 0.00015; // 0.005% - 0.02%
      const trendComponent = microTrend * 0.00002;
      const change = this.currentPrice * volatility * (Math.random() - 0.5 + momentum + trendComponent);
      
      this.currentPrice += change;
      this.currentPrice = Math.max(90000, Math.min(110000, this.currentPrice));
      
      this.updateCurrentCandle(this.currentPrice);
    }, 1000);
  }

  private updateCurrentCandle(price: number) {
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = Math.floor(now / 60) * 60;
    
    let candle = this.oneMinuteCandles.get(currentMinute);
    
    if (!candle) {
      // New minute started
      candle = {
        time: currentMinute,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0
      };
      this.oneMinuteCandles.set(currentMinute, candle);
    } else {
      // Update existing candle
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
    }
    
    // Notify subscribers about the update
    this.notifySubscribers(candle);
  }

  /**
   * Get candles for a specific time range and granularity
   */
  getData(startTime: number, endTime: number, granularity: string): CandleData[] {
    // Get all 1-minute candles in range
    const oneMinCandles: CandleData[] = [];
    
    // Align times to minute boundaries
    startTime = Math.floor(startTime / 60) * 60;
    endTime = Math.floor(endTime / 60) * 60;
    
    for (let time = startTime; time <= endTime; time += 60) {
      const candle = this.oneMinuteCandles.get(time);
      if (candle) {
        oneMinCandles.push(candle);
      }
    }
    
    // Aggregate to requested granularity
    if (granularity === '1m') {
      return oneMinCandles;
    }
    
    return CandleAggregator.aggregate(oneMinCandles, granularity);
  }

  /**
   * Subscribe to updates for the current candle only
   */
  subscribe(id: string, callback: (candle: CandleData) => void) {
    this.subscribers.set(id, callback);
  }

  unsubscribe(id: string) {
    this.subscribers.delete(id);
  }

  private notifySubscribers(candle: CandleData) {
    this.subscribers.forEach(callback => callback(candle));
  }

  getTotalCandleCount(): number {
    return this.oneMinuteCandles.size;
  }

  disconnect() {
    this.ws.disconnect();
  }
}