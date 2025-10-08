/**
 * Candle Aggregation Service
 * 
 * Aggregates 1-minute candles into higher timeframes (5m, 15m, 1h, etc.)
 * with real-time updates and seamless granularity switching
 */

import type { StoredCandle } from './RedisCandleStorage';
import { GRANULARITY_SECONDS } from './RedisConfig';
import { Logger } from '../../utils/Logger';

export interface AggregationRule {
  sourceGranularity: string;
  targetGranularity: string;
  factor: number; // How many source candles make one target candle
}

export class CandleAggregator {
  private aggregationRules: AggregationRule[];

  constructor() {
    this.aggregationRules = this.buildAggregationRules();
  }

  /**
   * Build the aggregation rules hierarchy
   * 1m -> 5m -> 15m -> 1h -> 4h -> 1d -> 1w
   */
  private buildAggregationRules(): AggregationRule[] {
    return [
      // From 1-minute base
      { sourceGranularity: '1m', targetGranularity: '5m', factor: 5 },
      { sourceGranularity: '5m', targetGranularity: '15m', factor: 3 },
      { sourceGranularity: '15m', targetGranularity: '30m', factor: 2 },
      { sourceGranularity: '30m', targetGranularity: '1h', factor: 2 },
      { sourceGranularity: '1h', targetGranularity: '4h', factor: 4 },
      { sourceGranularity: '4h', targetGranularity: '6h', factor: 1.5 }, // Special case
      { sourceGranularity: '6h', targetGranularity: '12h', factor: 2 },
      { sourceGranularity: '12h', targetGranularity: '1d', factor: 2 },
      { sourceGranularity: '1d', targetGranularity: '1w', factor: 7 }
    ];
  }

  /**
   * Aggregate candles from one granularity to another
   */
  aggregateCandles(
    sourceCandles: StoredCandle[],
    targetGranularity: string
  ): StoredCandle[] {
    if (sourceCandles.length === 0) {
      return [];
    }

    const targetSeconds = GRANULARITY_SECONDS[targetGranularity];
    if (!targetSeconds) {
      throw new Error(`Unsupported target granularity: ${targetGranularity}`);
    }

    // Group candles by target timeframe periods
    const candleGroups = this.groupCandlesByTimeframe(sourceCandles, targetSeconds);
    
    // Aggregate each group into a single candle
    const aggregatedCandles: StoredCandle[] = [];
    
    for (const [timestamp, candles] of candleGroups.entries()) {
      const aggregatedCandle = this.aggregateCandleGroup(candles, timestamp);
      if (aggregatedCandle) {
        aggregatedCandles.push(aggregatedCandle);
      }
    }

    // Sort by timestamp
    aggregatedCandles.sort((a, b) => a.time - b.time);

    Logger.debug('CandleAggregator', 'Aggregated candles', {
      sourceCount: sourceCandles.length,
      targetGranularity,
      aggregatedCount: aggregatedCandles.length,
      groups: candleGroups.size
    });

    return aggregatedCandles;
  }

  /**
   * Group candles by target timeframe periods
   */
  private groupCandlesByTimeframe(
    candles: StoredCandle[],
    targetSeconds: number
  ): Map<number, StoredCandle[]> {
    const groups = new Map<number, StoredCandle[]>();

    for (const candle of candles) {
      // Calculate the period start time for this candle
      const periodStart = this.calculatePeriodStart(candle.time, targetSeconds);
      
      if (!groups.has(periodStart)) {
        groups.set(periodStart, []);
      }
      
      groups.get(periodStart)!.push(candle);
    }

    return groups;
  }

  /**
   * Calculate the period start time for a given timestamp and granularity
   */
  private calculatePeriodStart(timestamp: number, granularitySeconds: number): number {
    // For most granularities, align to period boundaries
    if (granularitySeconds < 86400) { // Less than 1 day
      return Math.floor(timestamp / granularitySeconds) * granularitySeconds;
    } else if (granularitySeconds === 86400) { // 1 day
      // Align to midnight UTC
      return Math.floor(timestamp / 86400) * 86400;
    } else if (granularitySeconds === 604800) { // 1 week
      // Align to Monday 00:00 UTC (Unix epoch was Thursday, so Monday is day 4)
      const daysSinceEpoch = Math.floor(timestamp / 86400);
      const dayOfWeek = (daysSinceEpoch + 4) % 7; // Thursday = 0, Monday = 4
      const mondayOffset = dayOfWeek >= 4 ? dayOfWeek - 4 : dayOfWeek + 3;
      return (daysSinceEpoch - mondayOffset) * 86400;
    }
    
    // Default case
    return Math.floor(timestamp / granularitySeconds) * granularitySeconds;
  }

  /**
   * Aggregate a group of candles into a single candle
   */
  private aggregateCandleGroup(candles: StoredCandle[], timestamp: number): StoredCandle | null {
    if (candles.length === 0) {
      return null;
    }

    // Sort candles by timestamp to ensure proper OHLC calculation
    candles.sort((a, b) => a.time - b.time);

    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];

    // Calculate OHLCV
    const open = firstCandle.open;
    const close = lastCandle.close;
    const high = Math.max(...candles.map(c => c.high));
    const low = Math.min(...candles.map(c => c.low));
    const volume = candles.reduce((sum, c) => sum + c.volume, 0);

    return {
      time: timestamp,
      open,
      high,
      low,
      close,
      volume
    };
  }

  /**
   * Get all possible aggregation paths from source to target granularity
   */
  getAggregationPath(sourceGranularity: string, targetGranularity: string): string[] {
    if (sourceGranularity === targetGranularity) {
      return [sourceGranularity];
    }

    // Build a graph of aggregation relationships
    const graph = new Map<string, string[]>();
    for (const rule of this.aggregationRules) {
      if (!graph.has(rule.sourceGranularity)) {
        graph.set(rule.sourceGranularity, []);
      }
      graph.get(rule.sourceGranularity)!.push(rule.targetGranularity);
    }

    // BFS to find shortest path
    const queue: string[][] = [[sourceGranularity]];
    const visited = new Set<string>([sourceGranularity]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];

      if (current === targetGranularity) {
        return path;
      }

      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    throw new Error(`No aggregation path found from ${sourceGranularity} to ${targetGranularity}`);
  }

  /**
   * Check if we can aggregate from source to target granularity
   */
  canAggregate(sourceGranularity: string, targetGranularity: string): boolean {
    try {
      this.getAggregationPath(sourceGranularity, targetGranularity);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Aggregate candles through multiple steps if needed
   */
  async aggregateThroughPath(
    sourceCandles: StoredCandle[],
    sourcegranularity: string,
    targetGranularity: string
  ): Promise<StoredCandle[]> {
    const path = this.getAggregationPath(sourcegranularity, targetGranularity);
    
    if (path.length === 1) {
      return sourceCandles; // No aggregation needed
    }

    let currentCandles = sourceCandles;
    
    // Aggregate step by step through the path
    for (let i = 1; i < path.length; i++) {
      const targetGran = path[i];
      currentCandles = this.aggregateCandles(currentCandles, targetGran);
      
      Logger.debug('CandleAggregator', 'Aggregation step completed', {
        from: path[i - 1],
        to: targetGran,
        inputCount: currentCandles.length,
        outputCount: currentCandles.length
      });
    }

    return currentCandles;
  }

  /**
   * Update higher timeframe candles when a new base candle arrives
   */
  updateAggregatedCandles(
    newCandle: StoredCandle,
    existingCandles: Map<string, StoredCandle[]>,
    sourceGranularity: string = '1m'
  ): Map<string, StoredCandle[]> {
    const updatedCandles = new Map(existingCandles);

    // Find all granularities that can be affected by this update
    const affectedGranularities = this.getAffectedGranularities(sourceGranularity);

    for (const targetGranularity of affectedGranularities) {
      const targetSeconds = GRANULARITY_SECONDS[targetGranularity];
      const periodStart = this.calculatePeriodStart(newCandle.time, targetSeconds);
      
      // Get existing candles for this granularity
      const existing = updatedCandles.get(targetGranularity) || [];
      
      // Check if we need to update an existing aggregated candle or create a new one
      const existingIndex = existing.findIndex(c => c.time === periodStart);
      
      if (existingIndex >= 0) {
        // Update existing aggregated candle
        // This would require getting all source candles for this period
        // and re-aggregating them - simplified for this example
        existing[existingIndex] = this.updateAggregatedCandle(
          existing[existingIndex],
          newCandle,
          targetGranularity
        );
      } else {
        // Create new aggregated candle
        const newAggregated = this.createAggregatedCandle(newCandle, periodStart);
        existing.push(newAggregated);
        existing.sort((a, b) => a.time - b.time);
      }
      
      updatedCandles.set(targetGranularity, existing);
    }

    return updatedCandles;
  }

  /**
   * Get granularities that would be affected by a source granularity update
   */
  private getAffectedGranularities(sourceGranularity: string): string[] {
    const affected: string[] = [];
    
    for (const rule of this.aggregationRules) {
      if (rule.sourceGranularity === sourceGranularity) {
        affected.push(rule.targetGranularity);
        // Recursively find downstream granularities
        affected.push(...this.getAffectedGranularities(rule.targetGranularity));
      }
    }
    
    return [...new Set(affected)]; // Remove duplicates
  }

  /**
   * Update an existing aggregated candle with new data
   */
  private updateAggregatedCandle(
    existingCandle: StoredCandle,
    newCandle: StoredCandle,
    targetGranularity: string
  ): StoredCandle {
    // Simplified update - in reality, we'd need to re-aggregate from source data
    return {
      time: existingCandle.time,
      open: existingCandle.open, // Keep original open
      high: Math.max(existingCandle.high, newCandle.high),
      low: Math.min(existingCandle.low, newCandle.low),
      close: newCandle.close, // Update to latest close
      volume: existingCandle.volume + newCandle.volume
    };
  }

  /**
   * Create a new aggregated candle from a source candle
   */
  private createAggregatedCandle(sourceCandle: StoredCandle, timestamp: number): StoredCandle {
    return {
      time: timestamp,
      open: sourceCandle.open,
      high: sourceCandle.high,
      low: sourceCandle.low,
      close: sourceCandle.close,
      volume: sourceCandle.volume
    };
  }
}

// Export singleton instance
export const candleAggregator = new CandleAggregator();