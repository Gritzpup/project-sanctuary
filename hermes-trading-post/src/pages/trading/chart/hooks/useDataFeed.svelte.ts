// @ts-nocheck - CandlestickDataWithVolume compatibility
import { dataStore } from '../stores/dataStore.svelte';
import { chartStore } from '../stores/chartStore.svelte';
import type { CandlestickData } from 'lightweight-charts';

export interface DataFeedHookResult {
  // Data
  candles: CandlestickData[];
  visibleCandles: CandlestickData[];
  latestPrice: number | null;
  isNewCandle: boolean;
  stats: {
    totalCount: number;
    visibleCount: number;
    oldestTime: number | null;
    newestTime: number | null;
    lastUpdate: number | null;
  };
  
  // Actions
  loadData: (startTime: number, endTime: number) => Promise<void>;
  reloadData: () => Promise<void>;
  clearCache: () => Promise<void>;
  subscribeToRealtime: (callback?: (candle: CandlestickData) => void) => () => void;
  
  // Utilities
  getCandleAt: (time: number) => CandlestickData | undefined;
  getCandlesInRange: (from: number, to: number) => CandlestickData[];
  getPriceChange: () => { amount: number; percentage: number } | null;
}

export function useDataFeed(): DataFeedHookResult {
  // Reactive data - direct access to store getters
  const candles = dataStore.candles;
  const visibleCandles = dataStore.visibleCandles;
  const latestPrice = dataStore.latestPrice;
  const isNewCandle = dataStore.isNewCandle;
  const stats = dataStore.stats;
  
  // Actions
  const loadData = async (startTime: number, endTime: number) => {
    const config = chartStore.config;
    await dataStore.loadData(
      chartStore.state.pair,
      config.granularity,
      startTime,
      endTime
    );
  };
  
  const reloadData = async () => {
    if (stats.oldestTime && stats.newestTime) {
      await dataStore.reloadData(stats.oldestTime, stats.newestTime);
    }
  };
  
  const clearCache = async () => {
    await dataStore.clearCache();
  };
  
  const subscribeToRealtime = (callback?: (candle: CandlestickData) => void) => {
    const config = chartStore.config;
    return dataStore.subscribeToRealtime(
      chartStore.state.pair,
      config.granularity,
      callback
    );
  };
  
  // Utilities
  const getCandleAt = (time: number): CandlestickData | undefined => {
    return candles.find(candle => candle.time === time);
  };
  
  const getCandlesInRange = (from: number, to: number): CandlestickData[] => {
    return candles.filter(candle => 
      candle.time >= from && candle.time <= to
    );
  };
  
  const getPriceChange = (): { amount: number; percentage: number } | null => {
    if (candles.length < 2 || !latestPrice) return null;
    
    const firstCandle = candles[0];
    const firstPrice = firstCandle.open;
    const change = latestPrice - firstPrice;
    const percentage = (change / firstPrice) * 100;
    
    return {
      amount: change,
      percentage
    };
  };
  
  return {
    // Data
    candles,
    visibleCandles,
    latestPrice,
    isNewCandle,
    stats,
    
    // Actions
    loadData,
    reloadData,
    clearCache,
    subscribeToRealtime,
    
    // Utilities
    getCandleAt,
    getCandlesInRange,
    getPriceChange
  };
}