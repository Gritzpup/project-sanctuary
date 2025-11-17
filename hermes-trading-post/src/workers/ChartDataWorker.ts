/**
 * Chart Data Worker
 *
 * Offloads heavy data transformations from main thread to background worker.
 * Prevents UI freezes during data processing, especially with large datasets.
 *
 * Operations handled:
 * - Sorting and deduplication
 * - Data validation and normalization
 * - Time range filtering
 * - Volume calculations
 *
 * 🚀 PHASE 17: Main thread relief through worker threads
 * Expected: 90% reduction in frame drops (30-50ms → 5-10ms)
 */

// Worker message types
type WorkerMessage =
  | { type: 'TRANSFORM_CANDLES'; payload: { candles: any[] } }
  | { type: 'DEDUPLICATE'; payload: { candles: any[] } }
  | { type: 'FILTER_TIME_RANGE'; payload: { candles: any[]; start: number; end: number } }
  | { type: 'VALIDATE_CANDLES'; payload: { candles: any[] } }
  | { type: 'CALCULATE_VOLUME_STATS'; payload: { candles: any[] } };

type WorkerResponse =
  | { type: 'CANDLES_READY'; data: any[]; requestId: string }
  | { type: 'DEDUPLICATE_DONE'; data: any[]; requestId: string }
  | { type: 'FILTER_DONE'; data: any[]; requestId: string }
  | { type: 'VALIDATION_DONE'; data: any[]; requestId: string }
  | { type: 'VOLUME_STATS_READY'; data: any; requestId: string }
  | { type: 'ERROR'; error: string; requestId: string };

/**
 * Deduplicate candles by timestamp
 */
function deduplicateByTime(candles: any[]): any[] {
  if (candles.length === 0) return [];

  const seen = new Set<number>();
  const deduplicated: any[] = [];

  for (const candle of candles) {
    const time = typeof candle.time === 'number' ? candle.time : parseInt(candle.time);
    if (!seen.has(time)) {
      seen.add(time);
      deduplicated.push(candle);
    }
  }

  return deduplicated;
}

/**
 * Validate candle data structure
 */
function validateCandle(candle: any): boolean {
  if (!candle) return false;
  if (candle.time == null) return false;
  if (typeof candle.open !== 'number' || candle.open <= 0) return false;
  if (typeof candle.high !== 'number' || candle.high <= 0) return false;
  if (typeof candle.low !== 'number' || candle.low <= 0) return false;
  if (typeof candle.close !== 'number' || candle.close <= 0) return false;
  if (candle.high < candle.low) return false;
  return true;
}

/**
 * Validate and normalize candles
 */
function validateCandles(candles: any[]): any[] {
  return candles.filter(c => {
    try {
      return validateCandle(c);
    } catch {
      return false;
    }
  });
}

/**
 * Sort candles by time
 */
function sortByTime(candles: any[]): any[] {
  const sorted = [...candles];
  sorted.sort((a, b) => {
    const timeA = typeof a.time === 'number' ? a.time : parseInt(a.time);
    const timeB = typeof b.time === 'number' ? b.time : parseInt(b.time);
    return timeA - timeB;
  });
  return sorted;
}

/**
 * Transform candles: validate, deduplicate, sort
 */
function transformCandles(candles: any[]): any[] {
  // 1. Validate candles
  const validated = validateCandles(candles);

  // 2. Deduplicate by time
  const deduplicated = deduplicateByTime(validated);

  // 3. Sort by time
  const sorted = sortByTime(deduplicated);

  return sorted;
}

/**
 * Filter candles by time range
 */
function filterByTimeRange(candles: any[], startTime: number, endTime: number): any[] {
  return candles.filter(c => {
    const time = typeof c.time === 'number' ? c.time : parseInt(c.time);
    return time >= startTime && time <= endTime;
  });
}

/**
 * Calculate volume statistics
 */
function calculateVolumeStats(candles: any[]): {
  totalVolume: number;
  avgVolume: number;
  maxVolume: number;
  minVolume: number;
} {
  if (candles.length === 0) {
    return { totalVolume: 0, avgVolume: 0, maxVolume: 0, minVolume: 0 };
  }

  let totalVolume = 0;
  let maxVolume = 0;
  let minVolume = Infinity;

  for (const candle of candles) {
    const volume = candle.volume || 0;
    totalVolume += volume;
    maxVolume = Math.max(maxVolume, volume);
    minVolume = Math.min(minVolume, volume);
  }

  return {
    totalVolume,
    avgVolume: totalVolume / candles.length,
    maxVolume,
    minVolume: minVolume === Infinity ? 0 : minVolume
  };
}

/**
 * Main worker message handler
 */
self.onmessage = (event: MessageEvent<WorkerMessage & { requestId: string }>) => {
  const { type, payload, requestId } = event.data;

  try {
    let response: WorkerResponse;

    switch (type) {
      case 'TRANSFORM_CANDLES': {
        const transformed = transformCandles(payload.candles);
        response = {
          type: 'CANDLES_READY',
          data: transformed,
          requestId
        };
        break;
      }

      case 'DEDUPLICATE': {
        const deduplicated = deduplicateByTime(payload.candles);
        response = {
          type: 'DEDUPLICATE_DONE',
          data: deduplicated,
          requestId
        };
        break;
      }

      case 'FILTER_TIME_RANGE': {
        const filtered = filterByTimeRange(payload.candles, payload.start, payload.end);
        response = {
          type: 'FILTER_DONE',
          data: filtered,
          requestId
        };
        break;
      }

      case 'VALIDATE_CANDLES': {
        const validated = validateCandles(payload.candles);
        response = {
          type: 'VALIDATION_DONE',
          data: validated,
          requestId
        };
        break;
      }

      case 'CALCULATE_VOLUME_STATS': {
        const stats = calculateVolumeStats(payload.candles);
        response = {
          type: 'VOLUME_STATS_READY',
          data: stats,
          requestId
        };
        break;
      }

      default:
        response = {
          type: 'ERROR',
          error: `Unknown message type: ${type}`,
          requestId
        };
    }

    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: `Worker error: ${error instanceof Error ? error.message : String(error)}`,
      requestId
    });
  }
};

/**
 * Log worker ready (for debugging)
 */
