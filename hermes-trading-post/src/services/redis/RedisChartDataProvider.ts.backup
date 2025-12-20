/**
 * Redis Chart Data Provider
 * 
 * Seamless chart data provider with 5-year deep storage,
 * instant granularity switching, and real-time updates
 */

import type { CandlestickData } from 'lightweight-charts';
import { redisCandleStorage, type StoredCandle } from './RedisCandleStorage';
import { candleAggregator } from './CandleAggregator';
import { GRANULARITY_SECONDS } from './RedisConfig';
import { CoinbaseAPI } from '../api/coinbaseApi';
import { logger } from '../logging';

export interface ChartDataRequest {
  pair: string;
  granularity: string;
  startTime?: number;
  endTime?: number;
  maxCandles?: number;
}

export interface ChartDataResponse {
  candles: CandlestickData[];
  metadata: {
    totalCandles: number;
    firstTimestamp: number;
    lastTimestamp: number;
    source: 'redis' | 'api' | 'hybrid';
    cacheHitRatio: number;
  };
}

export class RedisChartDataProvider {
  private coinbaseApi: CoinbaseAPI;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.coinbaseApi = new CoinbaseAPI();
  }

  /**
   * Initialize the Redis data provider
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      // Connect to Redis
      await redisCandleStorage.connect();
      
      // Check if we have recent data, if not, perform initial population
      await this.ensureRecentData('BTC-USD');
      
      this.isInitialized = true;
      logger.info( 'Initialized successfully');
      
    } catch (error) {
      logger.error( 'Initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get chart data with seamless Redis/API fallback
   */
  async getChartData(request: ChartDataRequest): Promise<ChartDataResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { pair, granularity, startTime, endTime, maxCandles = 5000 } = request;
    
    // Calculate time range if not provided
    const calculatedEndTime = endTime || Math.floor(Date.now() / 1000);
    const granularitySeconds = GRANULARITY_SECONDS[granularity];
    const calculatedStartTime = startTime || (calculatedEndTime - (maxCandles * granularitySeconds));

    logger.debug( 'Chart data request', {
      pair,
      granularity,
      startTime: calculatedStartTime,
      endTime: calculatedEndTime,
      maxCandles
    });

    try {
      // Try to get data from Redis first
      const redisCandles = await redisCandleStorage.getCandles(
        pair,
        granularity,
        calculatedStartTime,
        calculatedEndTime
      );

      // Check data completeness
      const expectedCandles = Math.ceil((calculatedEndTime - calculatedStartTime) / granularitySeconds);
      const cacheHitRatio = redisCandles.length / expectedCandles;
      
      let finalCandles: StoredCandle[];
      let source: 'redis' | 'api' | 'hybrid' = 'redis';

      if (cacheHitRatio >= 0.95) {
        // Redis has sufficient data
        finalCandles = redisCandles;
        logger.debug( 'Served from Redis cache', {
          candleCount: redisCandles.length,
          cacheHitRatio
        });
        
      } else {
        // Need to fill gaps with API data
        source = cacheHitRatio > 0 ? 'hybrid' : 'api';
        finalCandles = await this.fillDataGaps(
          pair,
          granularity,
          calculatedStartTime,
          calculatedEndTime,
          redisCandles
        );
        
        logger.info( 'Filled data gaps', {
          source,
          redisCandleCount: redisCandles.length,
          finalCandleCount: finalCandles.length,
          cacheHitRatio
        });
      }

      // Convert to chart format
      const chartCandles: CandlestickData[] = finalCandles.map(candle => ({
        time: candle.time as any,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));

      return {
        candles: chartCandles,
        metadata: {
          totalCandles: chartCandles.length,
          firstTimestamp: chartCandles[0]?.time as number || calculatedStartTime,
          lastTimestamp: chartCandles[chartCandles.length - 1]?.time as number || calculatedEndTime,
          source,
          cacheHitRatio
        }
      };

    } catch (error) {
      logger.error( 'Error getting chart data', { error: error.message });
      
      // Fallback to API only
      return this.getChartDataFromAPI(request);
    }
  }

  /**
   * Fill data gaps using Coinbase API and store in Redis
   */
  private async fillDataGaps(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number,
    existingCandles: StoredCandle[]
  ): Promise<StoredCandle[]> {
    
    // Identify gaps in the data
    const gaps = this.identifyDataGaps(existingCandles, startTime, endTime, granularity);
    
    // Fetch missing data from API
    const allCandles = [...existingCandles];
    
    for (const gap of gaps) {
      try {
        const gapCandles = await this.fetchCandlesFromAPI(pair, granularity, gap.start, gap.end);
        
        if (gapCandles.length > 0) {
          allCandles.push(...gapCandles);
          
          // Store the fetched data in Redis for future use
          await redisCandleStorage.storeCandles(pair, granularity, gapCandles);
          
          logger.debug( 'Filled data gap', {
            pair,
            granularity,
            gapStart: new Date(gap.start * 1000).toISOString(),
            gapEnd: new Date(gap.end * 1000).toISOString(),
            fetchedCandles: gapCandles.length
          });
        }
        
      } catch (error) {
        logger.warn( 'Failed to fill data gap', { 
          error: error.message,
          gap
        });
      }
    }

    // Sort all candles by timestamp
    allCandles.sort((a, b) => a.time - b.time);
    
    return allCandles;
  }

  /**
   * Identify gaps in the existing data
   */
  private identifyDataGaps(
    existingCandles: StoredCandle[],
    startTime: number,
    endTime: number,
    granularity: string
  ): Array<{ start: number; end: number }> {
    
    const granularitySeconds = GRANULARITY_SECONDS[granularity];
    const gaps: Array<{ start: number; end: number }> = [];
    
    if (existingCandles.length === 0) {
      // No existing data, entire range is a gap
      return [{ start: startTime, end: endTime }];
    }

    // Sort existing candles
    const sortedCandles = [...existingCandles].sort((a, b) => a.time - b.time);
    
    // Check gap before first candle
    if (sortedCandles[0].time > startTime) {
      gaps.push({
        start: startTime,
        end: sortedCandles[0].time - granularitySeconds
      });
    }

    // Check gaps between candles
    for (let i = 0; i < sortedCandles.length - 1; i++) {
      const currentTime = sortedCandles[i].time;
      const nextTime = sortedCandles[i + 1].time;
      const expectedNextTime = currentTime + granularitySeconds;
      
      if (nextTime > expectedNextTime) {
        gaps.push({
          start: expectedNextTime,
          end: nextTime - granularitySeconds
        });
      }
    }

    // Check gap after last candle
    const lastCandle = sortedCandles[sortedCandles.length - 1];
    if (lastCandle.time < endTime) {
      gaps.push({
        start: lastCandle.time + granularitySeconds,
        end: endTime
      });
    }

    return gaps.filter(gap => gap.start <= gap.end);
  }

  /**
   * Fetch candles from Coinbase API
   */
  private async fetchCandlesFromAPI(
    pair: string,
    granularity: string,
    startTime: number,
    endTime: number
  ): Promise<StoredCandle[]> {
    
    const granularitySeconds = GRANULARITY_SECONDS[granularity];
    const apiData = await this.coinbaseApi.getCandles(
      pair,
      granularitySeconds,
      startTime.toString(),
      endTime.toString()
    );

    return apiData.map(candle => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume || 0
    }));
  }

  /**
   * Fallback to API-only data retrieval
   */
  private async getChartDataFromAPI(request: ChartDataRequest): Promise<ChartDataResponse> {
    const { pair, granularity, startTime, endTime, maxCandles = 5000 } = request;
    
    const calculatedEndTime = endTime || Math.floor(Date.now() / 1000);
    const granularitySeconds = GRANULARITY_SECONDS[granularity];
    const calculatedStartTime = startTime || (calculatedEndTime - (maxCandles * granularitySeconds));

    try {
      const candles = await this.fetchCandlesFromAPI(
        pair,
        granularity,
        calculatedStartTime,
        calculatedEndTime
      );

      // Store in Redis for future use
      if (candles.length > 0) {
        redisCandleStorage.storeCandles(pair, granularity, candles).catch(error => {
          logger.warn( 'Failed to cache API data', { error: error.message });
        });
      }

      const chartCandles: CandlestickData[] = candles.map(candle => ({
        time: candle.time as any,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));

      return {
        candles: chartCandles,
        metadata: {
          totalCandles: chartCandles.length,
          firstTimestamp: chartCandles[0]?.time as number || calculatedStartTime,
          lastTimestamp: chartCandles[chartCandles.length - 1]?.time as number || calculatedEndTime,
          source: 'api',
          cacheHitRatio: 0
        }
      };

    } catch (error) {
      logger.error( 'API fallback failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure we have recent data for a pair
   */
  private async ensureRecentData(pair: string): Promise<void> {
    const metadata = await redisCandleStorage.getMetadata(pair, '1m');
    const now = Math.floor(Date.now() / 1000);
    
    if (!metadata || (now - metadata.lastTimestamp) > 3600) {
      // Missing or stale data, fetch recent candles
      logger.info( 'Populating recent data', { pair });
      
      const endTime = now;
      const startTime = endTime - (1000 * 60); // Last 1000 minutes
      
      try {
        const recentCandles = await this.fetchCandlesFromAPI(pair, '1m', startTime, endTime);
        
        if (recentCandles.length > 0) {
          await redisCandleStorage.storeCandles(pair, '1m', recentCandles);
          
          // Generate aggregated candles for other granularities
          await this.generateAggregatedCandles(pair, recentCandles);
          
          logger.info( 'Populated recent data', {
            pair,
            candleCount: recentCandles.length
          });
        }
        
      } catch (error) {
        logger.warn( 'Failed to populate recent data', { 
          error: error.message 
        });
      }
    }
  }

  /**
   * Generate aggregated candles for all supported granularities
   */
  private async generateAggregatedCandles(pair: string, baseCandles: StoredCandle[]): Promise<void> {
    const granularities = ['5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d'];
    
    for (const granularity of granularities) {
      try {
        const aggregatedCandles = candleAggregator.aggregateCandles(baseCandles, granularity);
        
        if (aggregatedCandles.length > 0) {
          await redisCandleStorage.storeCandles(pair, granularity, aggregatedCandles);
        }
        
      } catch (error) {
        logger.warn( 'Failed to generate aggregated candles', {
          error: error.message,
          granularity
        });
      }
    }
  }

  /**
   * Update candles with new real-time data
   */
  async updateWithNewCandle(pair: string, newCandle: StoredCandle): Promise<void> {
    try {
      // Store the new 1-minute candle
      await redisCandleStorage.storeCandles(pair, '1m', [newCandle]);
      
      // Update aggregated candles
      await this.updateAggregatedCandles(pair, newCandle);
      
      logger.debug( 'Updated with new candle', {
        pair,
        timestamp: new Date(newCandle.time * 1000).toISOString(),
        price: newCandle.close
      });
      
    } catch (error) {
      logger.error( 'Failed to update with new candle', {
        error: error.message
      });
    }
  }

  /**
   * Update aggregated candles when a new base candle arrives
   */
  private async updateAggregatedCandles(pair: string, newCandle: StoredCandle): Promise<void> {
    const granularities = ['5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d'];
    
    for (const granularity of granularities) {
      try {
        // For real-time updates, we need to check if this candle affects the current period
        const granularitySeconds = GRANULARITY_SECONDS[granularity];
        const periodStart = Math.floor(newCandle.time / granularitySeconds) * granularitySeconds;
        
        // Get source candles for this period and re-aggregate
        const sourceCandles = await redisCandleStorage.getCandles(
          pair,
          '1m',
          periodStart,
          periodStart + granularitySeconds - 1
        );
        
        if (sourceCandles.length > 0) {
          const aggregatedCandles = candleAggregator.aggregateCandles(sourceCandles, granularity);
          await redisCandleStorage.storeCandles(pair, granularity, aggregatedCandles);
        }
        
      } catch (error) {
        logger.warn( 'Failed to update aggregated candle', {
          error: error.message,
          granularity
        });
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<any> {
    return redisCandleStorage.getStorageStats();
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(pair: string = 'BTC-USD'): Promise<void> {
    const granularities = ['1m', '5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d'];
    
    for (const granularity of granularities) {
      await redisCandleStorage.cleanupOldData(pair, granularity);
    }
  }
}

// Export singleton instance
export const redisChartDataProvider = new RedisChartDataProvider();