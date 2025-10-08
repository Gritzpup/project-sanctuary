/**
 * ChartDataManager - Manages chart data state and coordinates between modules
 * Extracted from the monolithic chartDataFeed.ts
 */

import type { CandleData } from '../../types/coinbase';

export class ChartDataManager {
  private dataByGranularity: Map<string, CandleData[]> = new Map();
  private currentData: CandleData[] = [];
  private visibleRange: { start: number; end: number } | null = null;
  private maxCandles = 100000; // Support large datasets for historical analysis (5 years of data)
  
  constructor() {
    this.dataByGranularity = new Map();
  }

  /**
   * Store data for a specific granularity
   */
  setDataForGranularity(granularity: string, data: CandleData[]): void {
    this.dataByGranularity.set(granularity, data);
  }

  /**
   * Get data for a specific granularity
   */
  getDataForGranularity(granularity: string): CandleData[] {
    return this.dataByGranularity.get(granularity) || [];
  }

  /**
   * Update current visible data
   */
  setCurrentData(data: CandleData[]): void {
    this.currentData = data;
  }

  /**
   * Get current visible data
   */
  getCurrentData(): CandleData[] {
    return this.currentData;
  }

  /**
   * Set visible time range
   */
  setVisibleRange(start: number, end: number): void {
    this.visibleRange = { start, end };
  }

  /**
   * Get visible time range
   */
  getVisibleRange(): { start: number; end: number } | null {
    return this.visibleRange;
  }

  /**
   * Filter data by time range
   */
  filterDataByRange(data: CandleData[], startTime: number, endTime: number): CandleData[] {
    return data.filter(candle => {
      const time = candle.time * 1000;
      return time >= startTime && time <= endTime;
    });
  }

  /**
   * Merge and deduplicate candle data
   */
  mergeData(existingData: CandleData[], newData: CandleData[]): CandleData[] {
    const dataMap = new Map<number, CandleData>();
    
    // Add existing data
    existingData.forEach(candle => {
      dataMap.set(candle.time, candle);
    });
    
    // Merge new data (overwrites if duplicate)
    newData.forEach(candle => {
      dataMap.set(candle.time, candle);
    });
    
    // Convert back to array and sort
    return Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Identify gaps in data
   */
  findDataGaps(data: CandleData[], startTime: number, endTime: number, granularitySeconds: number): Array<{ start: number; end: number }> {
    const gaps: Array<{ start: number; end: number }> = [];
    
    if (data.length === 0) {
      gaps.push({ start: startTime, end: endTime });
      return gaps;
    }
    
    // Check for gap at the beginning
    const firstTime = data[0].time * 1000;
    if (firstTime - startTime > granularitySeconds * 1000 * 2) {
      gaps.push({ start: startTime, end: firstTime });
    }
    
    // Check for gaps in the middle
    for (let i = 1; i < data.length; i++) {
      const prevTime = data[i - 1].time * 1000;
      const currTime = data[i].time * 1000;
      const expectedGap = granularitySeconds * 1000;
      
      if (currTime - prevTime > expectedGap * 2) {
        gaps.push({ start: prevTime + expectedGap, end: currTime - expectedGap });
      }
    }
    
    // Check for gap at the end
    const lastTime = data[data.length - 1].time * 1000;
    if (endTime - lastTime > granularitySeconds * 1000 * 2) {
      gaps.push({ start: lastTime, end: endTime });
    }
    
    return gaps;
  }

  /**
   * Trim data to max candles limit
   */
  trimToMaxCandles(data: CandleData[]): CandleData[] {
    if (data.length <= this.maxCandles) {
      return data;
    }
    return data.slice(-this.maxCandles);
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    this.dataByGranularity.clear();
    this.currentData = [];
    this.visibleRange = null;
  }

  /**
   * Get statistics about cached data
   */
  getStats(): { granularities: string[], totalCandles: number, memoryEstimate: number } {
    const granularities = Array.from(this.dataByGranularity.keys());
    let totalCandles = 0;
    
    this.dataByGranularity.forEach(data => {
      totalCandles += data.length;
    });
    
    // Rough estimate: ~100 bytes per candle
    const memoryEstimate = totalCandles * 100;
    
    return {
      granularities,
      totalCandles,
      memoryEstimate
    };
  }
}