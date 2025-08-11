import type { ChartDataFeed } from './chartDataFeed';
import type { Strategy } from '../strategies/base/Strategy';
import type { CandleData } from '../types/coinbase';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

export interface PaperTestOptions {
  date: Date;
  strategy: Strategy;
  initialBalance: number;
  chart: IChartApi;
  candleSeries: ISeriesApi<'Candlestick'>;
  dataFeed: ChartDataFeed;
  granularity: string;
  onProgress?: (progress: number) => void;
  onTrade?: (trade: any) => void;
  onComplete?: (results: PaperTestResults) => void;
  onCandle?: (candle: CandleData) => void;
}

export interface PaperTestResults {
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  finalBalance: number;
  trades: any[];
  maxDrawdown: number;
}

export class PaperTestService {
  private isRunning = false;
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private currentSimTime: number = 0;
  private endTime: number = 0;
  private candles: CandleData[] = [];
  private currentCandleIndex = 0;
  private trades: any[] = [];
  private balance: number = 0;
  private btcBalance: number = 0;
  private positions: any[] = [];
  
  // Constants
  private readonly SIMULATION_DURATION = 30000; // 30 seconds
  private readonly TIME_MULTIPLIER = 2880; // 24 hours in 30 seconds
  
  async start(options: PaperTestOptions): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.trades = [];
    this.balance = options.initialBalance;
    this.btcBalance = 0;
    this.positions = [];
    
    try {
      // Load historical data for the selected date
      const startOfDay = new Date(options.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(options.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      this.startTime = Math.floor(startOfDay.getTime() / 1000);
      this.endTime = Math.floor(endOfDay.getTime() / 1000);
      this.currentSimTime = this.startTime;
      
      console.log('Loading historical data for:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
      
      // Fetch all candles for the day
      this.candles = await options.dataFeed.getDataForVisibleRange(
        this.startTime, 
        this.endTime,
        'paper-test'
      );
      
      if (this.candles.length === 0) {
        throw new Error('No data available for selected date');
      }
      
      console.log(`Loaded ${this.candles.length} candles for Paper Test`);
      
      // Clear the chart and prepare for animation
      options.candleSeries.setData([]);
      
      // Start the time-lapse animation
      this.animate(options);
      
    } catch (error) {
      console.error('Paper Test error:', error);
      this.stop();
      throw error;
    }
  }
  
  private animate(options: PaperTestOptions): void {
    const animationStartTime = Date.now();
    let lastUpdateTime = animationStartTime;
    
    const step = () => {
      if (!this.isRunning) return;
      
      const now = Date.now();
      const elapsed = now - animationStartTime;
      const progress = Math.min(elapsed / this.SIMULATION_DURATION, 1);
      
      // Update progress
      if (options.onProgress) {
        options.onProgress(progress * 100);
      }
      
      // Calculate current simulation time
      const dayDuration = this.endTime - this.startTime;
      this.currentSimTime = this.startTime + (dayDuration * progress);
      
      // Add candles that should be visible at current sim time
      while (this.currentCandleIndex < this.candles.length) {
        const candle = this.candles[this.currentCandleIndex];
        if (candle.time > this.currentSimTime) break;
        
        // Add candle to chart
        const chartCandle = {
          time: candle.time as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        };
        
        options.candleSeries.update(chartCandle);
        
        // Notify about new candle
        if (options.onCandle) {
          options.onCandle(candle);
        }
        
        // Run strategy on this candle
        this.processCandle(candle, options);
        
        this.currentCandleIndex++;
      }
      
      // Update chart time scale to follow current time
      if (now - lastUpdateTime > 100) { // Update every 100ms
        try {
          const visibleRange = {
            from: (this.currentSimTime - 3600) as Time, // Show last hour
            to: this.currentSimTime as Time
          };
          options.chart.timeScale().setVisibleRange(visibleRange);
        } catch (e) {
          // Ignore time scale errors
        }
        lastUpdateTime = now;
      }
      
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.complete(options);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(step);
  }
  
  private processCandle(candle: CandleData, options: PaperTestOptions): void {
    // Update current price
    const currentPrice = candle.close;
    
    // Feed candle to strategy
    const signals = options.strategy.analyze({
      price: currentPrice,
      volume: 0, // No volume data in our candles
      timestamp: candle.time * 1000,
      candle: candle
    });
    
    // Process signals
    if (signals.action === 'buy' && signals.amount && signals.price) {
      this.executeBuy(signals.amount, signals.price, candle.time, options);
    } else if (signals.action === 'sell' && signals.amount && signals.price) {
      this.executeSell(signals.amount, signals.price, candle.time, options);
    }
    
    // Update positions with current price
    this.updatePositions(currentPrice);
  }
  
  private executeBuy(amount: number, price: number, timestamp: number, options: PaperTestOptions): void {
    if (this.balance < amount) return;
    
    const size = amount / price;
    this.balance -= amount;
    this.btcBalance += size;
    
    const trade = {
      id: `test-${Date.now()}-${Math.random()}`,
      type: 'buy',
      price: price,
      amount: size,
      total: amount,
      timestamp: timestamp,
      time: new Date(timestamp * 1000).toISOString()
    };
    
    this.trades.push(trade);
    this.positions.push({
      entryPrice: price,
      size: size,
      timestamp: timestamp
    });
    
    if (options.onTrade) {
      options.onTrade(trade);
    }
  }
  
  private executeSell(amount: number, price: number, timestamp: number, options: PaperTestOptions): void {
    if (this.btcBalance < amount) return;
    
    const proceeds = amount * price;
    this.balance += proceeds;
    this.btcBalance -= amount;
    
    // Calculate profit from positions
    let remainingToSell = amount;
    let totalCost = 0;
    
    // FIFO selling
    this.positions = this.positions.filter(pos => {
      if (remainingToSell <= 0) return true;
      
      if (pos.size <= remainingToSell) {
        totalCost += pos.entryPrice * pos.size;
        remainingToSell -= pos.size;
        return false;
      } else {
        totalCost += pos.entryPrice * remainingToSell;
        pos.size -= remainingToSell;
        remainingToSell = 0;
        return true;
      }
    });
    
    const profit = proceeds - totalCost;
    
    const trade = {
      id: `test-${Date.now()}-${Math.random()}`,
      type: 'sell',
      price: price,
      amount: amount,
      total: proceeds,
      profit: profit,
      timestamp: timestamp,
      time: new Date(timestamp * 1000).toISOString()
    };
    
    this.trades.push(trade);
    
    if (options.onTrade) {
      options.onTrade(trade);
    }
  }
  
  private updatePositions(currentPrice: number): void {
    // Update unrealized P&L for positions
    this.positions.forEach(pos => {
      pos.unrealizedPnL = (currentPrice - pos.entryPrice) * pos.size;
    });
  }
  
  private complete(options: PaperTestOptions): void {
    this.isRunning = false;
    
    // Calculate final results
    const sellTrades = this.trades.filter(t => t.type === 'sell');
    const profitableTrades = sellTrades.filter(t => t.profit > 0);
    const totalProfit = sellTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    
    // Add unrealized P&L from open positions
    const lastPrice = this.candles[this.candles.length - 1]?.close || 0;
    const unrealizedPnL = this.positions.reduce((sum, pos) => 
      sum + ((lastPrice - pos.entryPrice) * pos.size), 0
    );
    
    const finalBalance = this.balance + (this.btcBalance * lastPrice);
    const totalReturn = ((finalBalance - options.initialBalance) / options.initialBalance) * 100;
    
    // Calculate max drawdown
    let maxBalance = options.initialBalance;
    let maxDrawdown = 0;
    let runningBalance = options.initialBalance;
    
    this.trades.forEach(trade => {
      if (trade.type === 'buy') {
        runningBalance -= trade.total;
      } else {
        runningBalance += trade.total;
      }
      maxBalance = Math.max(maxBalance, runningBalance);
      const drawdown = ((maxBalance - runningBalance) / maxBalance) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });
    
    const results: PaperTestResults = {
      totalTrades: this.trades.length,
      winRate: sellTrades.length > 0 ? (profitableTrades.length / sellTrades.length) * 100 : 0,
      totalReturn: totalReturn,
      finalBalance: finalBalance,
      trades: this.trades,
      maxDrawdown: maxDrawdown
    };
    
    if (options.onComplete) {
      options.onComplete(results);
    }
  }
  
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const paperTestService = new PaperTestService();