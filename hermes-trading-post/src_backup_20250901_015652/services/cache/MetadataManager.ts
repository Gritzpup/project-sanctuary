/**
 * MetadataManager - Manages cache metadata
 * Extracted from indexedDBCache.ts
 */

export interface DataMetadata {
  symbol: string;
  earliestData: number;
  latestData: number;
  totalCandles: number;
  lastSync: number;
  granularityRanges: {
    [granularity: string]: {
      startTime: number;
      endTime: number;
      candleCount: number;
    };
  };
}

export class MetadataManager {
  /**
   * Create initial metadata for a symbol
   */
  createMetadata(symbol: string): DataMetadata {
    return {
      symbol,
      earliestData: 0,
      latestData: 0,
      totalCandles: 0,
      lastSync: Date.now(),
      granularityRanges: {}
    };
  }

  /**
   * Update metadata with new data range
   */
  updateMetadata(
    metadata: DataMetadata,
    granularity: string,
    startTime: number,
    endTime: number,
    candleCount: number
  ): DataMetadata {
    const updated = { ...metadata };
    
    // Update overall range
    if (updated.earliestData === 0 || startTime < updated.earliestData) {
      updated.earliestData = startTime;
    }
    if (endTime > updated.latestData) {
      updated.latestData = endTime;
    }
    
    // Update granularity-specific range
    const granRange = updated.granularityRanges[granularity];
    if (!granRange) {
      updated.granularityRanges[granularity] = {
        startTime,
        endTime,
        candleCount
      };
    } else {
      if (startTime < granRange.startTime) {
        granRange.startTime = startTime;
      }
      if (endTime > granRange.endTime) {
        granRange.endTime = endTime;
      }
      granRange.candleCount = candleCount;
    }
    
    // Update total candle count
    updated.totalCandles = Object.values(updated.granularityRanges)
      .reduce((sum, range) => sum + range.candleCount, 0);
    
    updated.lastSync = Date.now();
    
    return updated;
  }

  /**
   * Check if metadata is stale
   */
  isMetadataStale(metadata: DataMetadata, maxAgeMs: number = 3600000): boolean {
    return Date.now() - metadata.lastSync > maxAgeMs;
  }

  /**
   * Get data coverage percentage
   */
  getDataCoverage(
    metadata: DataMetadata,
    granularity: string,
    startTime: number,
    endTime: number
  ): number {
    const granRange = metadata.granularityRanges[granularity];
    if (!granRange) return 0;
    
    const requestedRange = endTime - startTime;
    const availableStart = Math.max(startTime, granRange.startTime);
    const availableEnd = Math.min(endTime, granRange.endTime);
    
    if (availableEnd <= availableStart) return 0;
    
    const availableRange = availableEnd - availableStart;
    return (availableRange / requestedRange) * 100;
  }

  /**
   * Get cache statistics from metadata
   */
  getCacheStats(metadataList: DataMetadata[]): {
    totalSymbols: number;
    totalCandles: number;
    symbols: string[];
    granularities: string[];
    oldestData: number;
    newestData: number;
  } {
    const symbols = new Set<string>();
    const granularities = new Set<string>();
    let totalCandles = 0;
    let oldestData = Date.now();
    let newestData = 0;
    
    for (const metadata of metadataList) {
      symbols.add(metadata.symbol);
      totalCandles += metadata.totalCandles;
      
      if (metadata.earliestData > 0 && metadata.earliestData < oldestData) {
        oldestData = metadata.earliestData;
      }
      if (metadata.latestData > newestData) {
        newestData = metadata.latestData;
      }
      
      Object.keys(metadata.granularityRanges).forEach(g => granularities.add(g));
    }
    
    return {
      totalSymbols: symbols.size,
      totalCandles,
      symbols: Array.from(symbols),
      granularities: Array.from(granularities),
      oldestData,
      newestData
    };
  }

  /**
   * Merge multiple metadata objects
   */
  mergeMetadata(metadataList: DataMetadata[]): DataMetadata | null {
    if (metadataList.length === 0) return null;
    if (metadataList.length === 1) return metadataList[0];
    
    const merged = this.createMetadata(metadataList[0].symbol);
    
    for (const metadata of metadataList) {
      // Update overall range
      if (metadata.earliestData > 0) {
        if (merged.earliestData === 0 || metadata.earliestData < merged.earliestData) {
          merged.earliestData = metadata.earliestData;
        }
      }
      if (metadata.latestData > merged.latestData) {
        merged.latestData = metadata.latestData;
      }
      
      // Merge granularity ranges
      for (const [gran, range] of Object.entries(metadata.granularityRanges)) {
        if (!merged.granularityRanges[gran]) {
          merged.granularityRanges[gran] = { ...range };
        } else {
          const mergedRange = merged.granularityRanges[gran];
          if (range.startTime < mergedRange.startTime) {
            mergedRange.startTime = range.startTime;
          }
          if (range.endTime > mergedRange.endTime) {
            mergedRange.endTime = range.endTime;
          }
          mergedRange.candleCount = Math.max(mergedRange.candleCount, range.candleCount);
        }
      }
    }
    
    // Recalculate total candles
    merged.totalCandles = Object.values(merged.granularityRanges)
      .reduce((sum, range) => sum + range.candleCount, 0);
    
    return merged;
  }
}