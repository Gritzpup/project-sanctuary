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
  initialDisplayCandles?: number;
  onProgress?: (progress: number, simTime: number) => void;
  onTrade?: (trade: any) => void;
  onComplete?: (results: PaperTestResults) => void;
  onCandle?: (candle: CandleData) => void;
  onPositionUpdate?: (positions: any[], balance: number, btcBalance: number) => void;
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
  private dataFeed: ChartDataFeed | null = null;
  private processedCandles: CandleData[] = []; // Candles fed to strategy so far
  private currentOptions: PaperTestOptions | null = null;
  private lastLoggedProgress: number = -5; // Track last logged progress for 5% intervals
  
  // Playback control
  private playbackSpeed: number = 1; // Speed multiplier
  private isPaused: boolean = false;
  private pausedAtProgress: number = 0;
  private animationStartTime: number = 0;
  private totalElapsedBeforePause: number = 0;
  
  // Chart markers
  private markers: any[] = [];
  
  // Constants
  private readonly BASE_SIMULATION_DURATION = 60000; // 60 seconds at 1x speed
  private readonly TIME_MULTIPLIER = 1440; // 24 hours in 60 seconds
  
  async start(options: PaperTestOptions): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.trades = [];
    this.balance = options.initialBalance;
    this.btcBalance = 0;
    this.positions = [];
    this.currentCandleIndex = 0;
    this.dataFeed = options.dataFeed;
    
    try {
      // Set the paper-test instance as active
      options.dataFeed.setActiveInstance('paper-test');
      
      // Load historical data for the selected date (midnight to midnight in local time)
      const startOfDay = new Date(options.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(options.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log('Paper Test date range:', {
        selectedDate: options.date.toLocaleDateString(),
        startOfDay: startOfDay.toString(),
        endOfDay: endOfDay.toString(),
        startUTC: startOfDay.toISOString(),
        endUTC: endOfDay.toISOString()
      });
      
      this.startTime = Math.floor(startOfDay.getTime() / 1000);
      this.endTime = Math.floor(endOfDay.getTime() / 1000);
      this.currentSimTime = this.startTime;
      
      console.log('Paper Test: Loading historical data for:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
      console.log('Paper Test: Using granularity:', options.granularity);
      console.log('Paper Test: Start timestamp:', this.startTime, 'End timestamp:', this.endTime);
      console.log('Paper Test: Date range:', new Date(this.startTime * 1000).toISOString(), 'to', new Date(this.endTime * 1000).toISOString());
      
      // First, ensure we have the data loaded for this period
      const daysFromNow = Math.ceil((Date.now() / 1000 - this.startTime) / 86400);
      console.log(`Paper Test: Date is ${daysFromNow} days ago from now`);
      
      // Set the data feed to use the correct granularity
      options.dataFeed.setGranularity(options.granularity);
      
      // Load historical data for the specific date range
      if (daysFromNow > 0) {
        console.log(`Paper Test: Loading historical data for ${options.granularity} for date ${options.date.toLocaleDateString()}`);
        // Add a buffer of 1 hour before and after to ensure we have all data
        const bufferSeconds = 3600; // 1 hour buffer
        await options.dataFeed.loadHistoricalDataForDateRange(
          options.granularity,
          this.startTime - bufferSeconds,
          this.endTime + bufferSeconds,
          'paper-test'
        );
      }
      
      // Use getDataForVisibleRange which is a public method
      console.log('Paper Test: Fetching data for visible range...');
      this.candles = await options.dataFeed.getDataForVisibleRange(
        this.startTime,
        this.endTime,
        'paper-test'
      );
      
      console.log('Paper Test: Total candles loaded:', this.candles.length);
      
      // If still no data, try progressive load as a fallback
      if (this.candles.length === 0) {
        console.log('Paper Test: No data from visible range, trying progressive load...');
        this.candles = await options.dataFeed.loadProgressiveData(
          this.startTime, 
          this.endTime,
          options.granularity,
          'paper-test'
        );
        console.log('Paper Test: Progressive load returned:', this.candles.length, 'candles');
      }
      
      if (this.candles.length === 0) {
        const now = new Date();
        const daysSinceDate = Math.floor((now.getTime() - options.date.getTime()) / (24 * 60 * 60 * 1000));
        
        let errorMsg = `No data available for ${options.date.toLocaleDateString()}`;
        
        // Provide helpful suggestions based on how old the date is
        if (daysSinceDate < 0) {
          errorMsg += `. Cannot test future dates. Please select a past date.`;
        } else if (daysSinceDate === 0) {
          errorMsg += `. Today's data may not be complete yet. Try selecting yesterday or an earlier date.`;
        } else if (daysSinceDate === 1) {
          errorMsg += `. Yesterday's data might not be fully available yet. Try selecting a date from 2-3 days ago.`;
        } else if (daysSinceDate > 365) {
          errorMsg += `. Date is too far in the past (${daysSinceDate} days ago). Try selecting a more recent date within the last year.`;
        } else {
          errorMsg += `. This might be a weekend or holiday when markets were closed. Try selecting a weekday.`;
        }
        
        console.error(errorMsg);
        console.error(`Attempted to load data from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
        throw new Error(errorMsg);
      }
      
      // Sort candles by time to ensure proper order
      this.candles.sort((a, b) => a.time - b.time);
      
      // Verify all candles are within the requested date range
      const candlesOutsideRange = this.candles.filter(c => c.time < this.startTime || c.time > this.endTime);
      if (candlesOutsideRange.length > 0) {
        console.warn(`Paper Test: Found ${candlesOutsideRange.length} candles outside requested date range!`);
        console.warn(`Paper Test: First out-of-range candle: ${new Date(candlesOutsideRange[0].time * 1000).toISOString()}`);
        // Filter to only include candles within the date range
        this.candles = this.candles.filter(c => c.time >= this.startTime && c.time <= this.endTime);
      }
      
      console.log(`Paper Test: Loaded ${this.candles.length} candles for Paper Test at ${options.granularity} granularity`);
      console.log('Paper Test: First candle:', new Date(this.candles[0].time * 1000).toISOString(), `(Unix: ${this.candles[0].time})`);
      console.log('Paper Test: Last candle:', new Date(this.candles[this.candles.length - 1].time * 1000).toISOString(), `(Unix: ${this.candles[this.candles.length - 1].time})`);
      console.log('Paper Test: Expected range:', new Date(this.startTime * 1000).toISOString(), 'to', new Date(this.endTime * 1000).toISOString());
      console.log('Paper Test: Time span:', ((this.candles[this.candles.length - 1].time - this.candles[0].time) / 3600).toFixed(2), 'hours');
      
      // Pre-load all candles for the day
      const chartCandles = this.candles.map(candle => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }));
      options.candleSeries.setData(chartCandles);
      
      // Set initial visible range to first 60 candles (or less if day has fewer)
      const initialWindowSize = Math.min(60, this.candles.length);
      if (initialWindowSize > 0) {
        options.chart.timeScale().setVisibleRange({
          from: this.candles[0].time as Time,
          to: this.candles[initialWindowSize - 1].time as Time
        });
      }
      
      // Reset processed candles for new test
      this.processedCandles = [];
      this.currentOptions = options;
      this.playbackSpeed = 1;
      this.isPaused = false;
      this.totalElapsedBeforePause = 0;
      this.markers = [];
      this.lastLoggedProgress = -5;
      
      // Start the time-lapse animation
      this.animate(options);
      
    } catch (error) {
      console.error('Paper Test error:', error);
      this.stop();
      // Clear the active instance
      options.dataFeed.clearActiveInstance();
      throw error;
    }
  }
  
  private animate(options: PaperTestOptions): void {
    this.animationStartTime = Date.now();
    let lastUpdateTime = this.animationStartTime;
    
    // Fixed window size of 60 candles
    const WINDOW_SIZE = 60;
    
    const step = () => {
      if (!this.isRunning) {
        console.log('Paper Test: Simulation stopped, exiting step function');
        return;
      }
      
      if (this.isPaused) {
        this.animationFrameId = requestAnimationFrame(step);
        return;
      }
      
      const now = Date.now();
      const currentElapsed = now - this.animationStartTime;
      const totalElapsed = this.totalElapsedBeforePause + currentElapsed;
      const effectiveDuration = this.BASE_SIMULATION_DURATION / this.playbackSpeed;
      const progress = Math.min(totalElapsed / effectiveDuration, 1);
      
      // Update progress
      if (options.onProgress) {
        options.onProgress(progress * 100, this.currentSimTime);
      }
      
      // Calculate current simulation time
      const dayDuration = this.endTime - this.startTime;
      this.currentSimTime = this.startTime + (dayDuration * progress);
      
      // Log progress every 5%
      const progressPercent = Math.floor(progress * 100);
      if (progressPercent >= this.lastLoggedProgress + 5) {
        this.lastLoggedProgress = Math.floor(progressPercent / 5) * 5;
        console.log(`\nPaper Test Progress: ${this.lastLoggedProgress}%`);
        console.log(`- Simulation time: ${new Date(this.currentSimTime * 1000).toISOString()} (Unix: ${this.currentSimTime})`);
        console.log(`- Real elapsed time: ${(totalElapsed / 1000).toFixed(1)}s of ${(effectiveDuration / 1000).toFixed(1)}s`);
        console.log(`- Current candle index: ${this.currentCandleIndex}/${this.candles.length}`);
        console.log(`- Playback speed: ${this.playbackSpeed}x`);
        if (this.currentCandleIndex > 0 && this.currentCandleIndex < this.candles.length) {
          const currentCandle = this.candles[this.currentCandleIndex - 1];
          console.log(`- Last processed candle: ${new Date(currentCandle.time * 1000).toISOString()} @ $${currentCandle.close.toFixed(2)}`);
        }
      }
      
      // Find the current candle index based on simulation time
      let currentIndex = 0;
      for (let i = 0; i < this.candles.length; i++) {
        if (this.candles[i].time <= this.currentSimTime) {
          currentIndex = i;
        } else {
          break;
        }
      }
      
      // Process new candles
      while (this.currentCandleIndex <= currentIndex) {
        const candle = this.candles[this.currentCandleIndex];
        
        // Log candle processing with time sync details
        if (this.currentCandleIndex === 0 || this.currentCandleIndex % 10 === 0 || this.currentCandleIndex === this.candles.length - 1) {
          console.log(`Paper Test Candle: #${this.currentCandleIndex + 1}/${this.candles.length}`);
          console.log(`  - Candle time: ${new Date(candle.time * 1000).toISOString()} (Unix: ${candle.time})`);
          console.log(`  - Sim time: ${new Date(this.currentSimTime * 1000).toISOString()} (Unix: ${Math.floor(this.currentSimTime)})`);
          console.log(`  - Time diff: ${(this.currentSimTime - candle.time).toFixed(1)}s`);
          console.log(`  - Price: $${candle.close.toFixed(2)} (O:${candle.open.toFixed(2)} H:${candle.high.toFixed(2)} L:${candle.low.toFixed(2)})`);
        }
        
        // Notify about new candle
        if (options.onCandle) {
          options.onCandle(candle);
        }
        
        // Run strategy on this candle
        this.processCandle(candle, options);
        
        this.currentCandleIndex++;
      }
      
      // Update chart display with sliding window effect
      if (now - lastUpdateTime > 16) { // Update every 16ms for smoother animation
        try {
          // Update markers to show only those up to current time
          if (this.markers.length > 0) {
            const visibleMarkers = this.markers.filter(marker => 
              marker.time <= this.currentSimTime
            );
            options.candleSeries.setMarkers(visibleMarkers);
          }
          
          // Calculate sliding window based on progress
          // We want the view to smoothly scroll through the day
          const activeCandleIndex = Math.floor(progress * (this.candles.length - 1));
          
          if (this.candles.length > WINDOW_SIZE) {
            // For days with more than 60 candles, create a sliding window
            // The window should progress smoothly from start to end
            const maxStartIndex = this.candles.length - WINDOW_SIZE;
            const windowStart = Math.floor(progress * maxStartIndex);
            const windowEnd = windowStart + WINDOW_SIZE - 1;
            
            const visibleRange = {
              from: this.candles[windowStart].time as Time,
              to: this.candles[windowEnd].time as Time
            };
            
            options.chart.timeScale().setVisibleRange(visibleRange);
          } else {
            // For days with 60 or fewer candles, show all
            const visibleRange = {
              from: this.candles[0].time as Time,
              to: this.candles[this.candles.length - 1].time as Time
            };
            
            options.chart.timeScale().setVisibleRange(visibleRange);
          }
        } catch (e) {
          // Ignore time scale errors
          console.warn('Time scale update error:', e);
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
    
    // Add candle to processed list
    this.processedCandles.push(candle);
    
    // Check if we have enough historical data for the strategy
    const requiredData = options.strategy.getRequiredHistoricalData();
    if (this.processedCandles.length < requiredData) {
      return; // Not enough data yet
    }
    
    // Feed candles array and current price to strategy
    const signal = options.strategy.analyze(this.processedCandles, currentPrice);
    
    // Log strategy signal
    if (signal.type !== 'hold') {
      console.log(`Paper Test: Strategy signal - ${signal.type.toUpperCase()} at ${new Date(candle.time * 1000).toISOString()}, price: ${currentPrice}`);
      if (signal.confidence !== undefined) {
        console.log(`Paper Test: Signal confidence: ${signal.confidence}`);
      }
    }
    
    // Process signal based on type
    if (signal.type === 'buy') {
      // Calculate position size based on available balance
      const size = options.strategy.calculatePositionSize(this.balance, signal, currentPrice);
      if (size > 0) {
        const amount = size * currentPrice;
        console.log(`Paper Test: Executing BUY - Size: ${size.toFixed(8)} BTC, Amount: $${amount.toFixed(2)}, Balance: $${this.balance.toFixed(2)}`);
        this.executeBuy(amount, currentPrice, candle.time, options);
      } else {
        console.log(`Paper Test: BUY signal but insufficient balance or position size is 0`);
      }
    } else if (signal.type === 'sell' && signal.size) {
      console.log(`Paper Test: Executing SELL - Size: ${signal.size.toFixed(8)} BTC, Price: $${currentPrice.toFixed(2)}, BTC Balance: ${this.btcBalance.toFixed(8)}`);
      this.executeSell(signal.size, currentPrice, candle.time, options);
    }
    
    // Update positions with current price
    this.updatePositions(currentPrice);
  }
  
  private executeBuy(amount: number, price: number, timestamp: number, options: PaperTestOptions): void {
    if (this.balance < amount) {
      console.log(`Paper Test: Buy order rejected - Insufficient balance. Required: $${amount.toFixed(2)}, Available: $${this.balance.toFixed(2)}`);
      return;
    }
    
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
    console.log(`Paper Test: BUY executed - Trade #${this.trades.length}, Size: ${size.toFixed(8)} BTC @ $${price.toFixed(2)}, Total: $${amount.toFixed(2)}, New Balance: $${this.balance.toFixed(2)}, BTC: ${this.btcBalance.toFixed(8)}`);
    this.positions.push({
      entryPrice: price,
      size: size,
      timestamp: timestamp
    });
    
    if (options.onTrade) {
      options.onTrade(trade);
    }
    
    // Add visual marker on chart
    this.markers.push({
      time: timestamp as Time,
      position: 'belowBar' as const,
      shape: 'arrowUp' as const,
      color: '#26a69a',
      text: 'B'
    });
    
    // Update position callback
    if (options.onPositionUpdate) {
      options.onPositionUpdate(this.positions, this.balance, this.btcBalance);
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
    console.log(`Paper Test: SELL executed - Trade #${this.trades.length}, Size: ${amount.toFixed(8)} BTC @ $${price.toFixed(2)}, Proceeds: $${proceeds.toFixed(2)}, Profit: $${profit.toFixed(2)}, New Balance: $${this.balance.toFixed(2)}, BTC: ${this.btcBalance.toFixed(8)}`);
    
    if (options.onTrade) {
      options.onTrade(trade);
    }
    
    // Add visual marker on chart
    this.markers.push({
      time: timestamp as Time,
      position: 'aboveBar' as const,
      shape: 'arrowDown' as const,
      color: '#ef5350',
      text: 'S'
    });
    
    // Play coin sound for successful sell
    this.playCoinSound();
    
    // Update position callback
    if (options.onPositionUpdate) {
      options.onPositionUpdate(this.positions, this.balance, this.btcBalance);
    }
  }
  
  private updatePositions(currentPrice: number): void {
    // Update unrealized P&L for positions
    this.positions.forEach(pos => {
      pos.unrealizedPnL = (currentPrice - pos.entryPrice) * pos.size;
    });
    
    // Update position callback
    if (this.currentOptions?.onPositionUpdate) {
      this.currentOptions.onPositionUpdate(this.positions, this.balance, this.btcBalance);
    }
  }
  
  private complete(options: PaperTestOptions): void {
    this.isRunning = false;
    
    console.log('\n========== Paper Test Simulation Complete ==========');
    console.log(`Paper Test: Processed ${this.currentCandleIndex} candles`);
    console.log(`Paper Test: Start time: ${new Date(this.startTime * 1000).toISOString()} (Unix: ${this.startTime})`);
    console.log(`Paper Test: End time: ${new Date(this.currentSimTime * 1000).toISOString()} (Unix: ${Math.floor(this.currentSimTime)})`);
    console.log(`Paper Test: Total duration: ${((this.currentSimTime - this.startTime) / 3600).toFixed(2)} hours`);
    
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
    
    console.log(`\nPaper Test Results:`);
    console.log(`- Total Trades: ${this.trades.length} (${this.trades.filter(t => t.type === 'buy').length} buys, ${sellTrades.length} sells)`);
    console.log(`- Win Rate: ${sellTrades.length > 0 ? ((profitableTrades.length / sellTrades.length) * 100).toFixed(2) : 0}%`);
    console.log(`- Total Return: ${totalReturn.toFixed(2)}%`);
    console.log(`- Final Balance: $${finalBalance.toFixed(2)} (started with $${options.initialBalance.toFixed(2)})`);
    console.log(`- Open Positions: ${this.positions.length} with ${this.btcBalance.toFixed(8)} BTC`);
    if (unrealizedPnL !== 0) {
      console.log(`- Unrealized P&L: $${unrealizedPnL.toFixed(2)}`);
    }
    
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
    
    // Clear the active instance after completion
    if (this.dataFeed) {
      this.dataFeed.clearActiveInstance();
      this.dataFeed = null;
    }
  }
  
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.playbackSpeed = 1;
    this.totalElapsedBeforePause = 0;
    this.currentOptions = null;
    this.markers = [];
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Clear the active instance
    if (this.dataFeed) {
      this.dataFeed.clearActiveInstance();
      this.dataFeed = null;
    }
  }
  
  isActive(): boolean {
    return this.isRunning;
  }
  
  isPausedState(): boolean {
    return this.isPaused;
  }
  
  getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }
  
  // Playback control methods
  setPlaybackSpeed(speed: number): void {
    if (this.isPaused) {
      this.playbackSpeed = speed;
    } else {
      // If running, pause briefly to recalculate timing
      const wasRunning = !this.isPaused;
      if (wasRunning) {
        this.pause();
        this.playbackSpeed = speed;
        this.resume();
      }
    }
  }
  
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    
    this.isPaused = true;
    const elapsed = Date.now() - this.animationStartTime;
    this.totalElapsedBeforePause += elapsed;
  }
  
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    
    this.isPaused = false;
    this.animationStartTime = Date.now();
  }
  
  stepForward(): void {
    if (!this.isRunning || !this.isPaused || !this.currentOptions) return;
    
    // Process one candle forward
    if (this.currentCandleIndex < this.candles.length) {
      const candle = this.candles[this.currentCandleIndex];
      
      // Update current simulation time
      this.currentSimTime = candle.time;
      
      // Notify about new candle
      if (this.currentOptions.onCandle) {
        this.currentOptions.onCandle(candle);
      }
      
      // Run strategy on this candle
      this.processCandle(candle, this.currentOptions);
      
      this.currentCandleIndex++;
      
      // Update progress
      const progress = (this.currentCandleIndex / this.candles.length);
      if (this.currentOptions.onProgress) {
        this.currentOptions.onProgress(progress * 100, this.currentSimTime);
      }
      
      // Update visible range and markers
      const WINDOW_SIZE = 60;
      try {
        // Update markers to show only those up to current time
        if (this.markers.length > 0) {
          const visibleMarkers = this.markers.filter(marker => 
            marker.time <= this.currentSimTime
          );
          this.currentOptions.candleSeries.setMarkers(visibleMarkers);
        }
        
        if (this.candles.length > WINDOW_SIZE) {
          // For days with more than 60 candles, create a sliding window
          const maxStartIndex = this.candles.length - WINDOW_SIZE;
          const windowStart = Math.floor(progress * maxStartIndex);
          const windowEnd = windowStart + WINDOW_SIZE - 1;
          
          const visibleRange = {
            from: this.candles[windowStart].time as Time,
            to: this.candles[windowEnd].time as Time
          };
          
          this.currentOptions.chart.timeScale().setVisibleRange(visibleRange);
        }
      } catch (e) {
        console.warn('Time scale update error in stepForward:', e);
      }
    }
  }
  
  private playCoinSound(): void {
    try {
      const audio = new Audio('/sounds/coin-drop.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Coin sound play failed:', e));
    } catch (e) {
      console.log('Failed to create audio:', e);
    }
  }
}

// Export singleton instance
export const paperTestService = new PaperTestService();