import type { CandlestickData, Time } from 'lightweight-charts';
import { PERIOD_TO_SECONDS } from './constants';

// Extended CandlestickData with volume
interface CandlestickDataWithVolume extends CandlestickData<Time> {
  volume?: number;
}

// Import shared utilities (Phase 1 refactoring)
import { getCurrentTimestamp } from './timeHelpers';
import { alignTimeToGranularity, getGranularitySeconds } from './granularityHelpers';
import { isValidCandle, validateCandleData } from './validationHelpers';

// Re-export for backward compatibility (will be removed in Phase 2)
export { isValidCandle, validateCandleData } from './validationHelpers';

// Time utilities using shared helpers
export function getCurrentTime(): number {
  return getCurrentTimestamp();
}

export function alignToGranularity(timestamp: number, granularity: string): number {
  return alignTimeToGranularity(timestamp, granularity);
}

export function getTimeRange(period: string, endTime?: number): { start: number; end: number } {
  const end = endTime || getCurrentTimestamp();
  const periodSeconds = PERIOD_TO_SECONDS[period] || 3600;
  const start = end - periodSeconds;

  return { start, end };
}

export function calculateExpectedCandles(period: string, granularity: string): number {
  const periodSeconds = PERIOD_TO_SECONDS[period] || 3600;
  const granularitySeconds = getGranularitySeconds(granularity);

  return Math.ceil(periodSeconds / granularitySeconds);
}

// Price calculations
export function calculatePriceChange(oldPrice: number, newPrice: number): {
  amount: number;
  percentage: number;
  direction: 'up' | 'down' | 'neutral';
} {
  const amount = newPrice - oldPrice;
  const percentage = (amount / oldPrice) * 100;
  const direction = amount > 0 ? 'up' : amount < 0 ? 'down' : 'neutral';

  return { amount, percentage, direction };
}

// Price formatting functions moved to priceFormatters.ts
// Import from there: import { formatPrice, formatPriceDecimal } from '../../../utils/formatters/priceFormatters';

// Candle analysis
export function getCandleType(candle: CandlestickData): 'bullish' | 'bearish' | 'doji' {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  
  if (body / range < 0.1) {
    return 'doji';
  }
  
  return candle.close > candle.open ? 'bullish' : 'bearish';
}

export function calculateCandleBody(candle: CandlestickData): number {
  return Math.abs(candle.close - candle.open);
}

export function calculateUpperWick(candle: CandlestickData): number {
  return candle.high - Math.max(candle.open, candle.close);
}

export function calculateLowerWick(candle: CandlestickData): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

// Data aggregation
export function aggregateCandles(
  candles: CandlestickDataWithVolume[],
  targetGranularity: string,
  sourceGranularity: string
): CandlestickDataWithVolume[] {
  const targetSeconds = getGranularitySeconds(targetGranularity);
  const sourceSeconds = getGranularitySeconds(sourceGranularity);

  if (targetSeconds <= sourceSeconds) {
    return candles;
  }

  const aggregated: Map<number, CandlestickDataWithVolume> = new Map();

  candles.forEach(candle => {
    const alignedTime = alignTimeToGranularity(candle.time as number, targetGranularity);

    if (!aggregated.has(alignedTime)) {
      aggregated.set(alignedTime, {
        time: alignedTime as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0
      });
    } else {
      const existing = aggregated.get(alignedTime)!;
      aggregated.set(alignedTime, {
        time: alignedTime as Time,
        open: existing.open, // Keep first open
        high: Math.max(existing.high, candle.high),
        low: Math.min(existing.low, candle.low),
        close: candle.close, // Use last close
        volume: (existing.volume || 0) + (candle.volume || 0)
      });
    }
  });

  return Array.from(aggregated.values()).sort((a, b) =>
    (a.time as number) - (b.time as number)
  );
}

// Export utilities
export function exportToCSV(candles: CandlestickDataWithVolume[]): string {
  const headers = ['Time', 'Open', 'High', 'Low', 'Close', 'Volume'];
  const rows = candles.map(candle => [
    new Date((candle.time as number) * 1000).toISOString(),
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume || 0
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

export function downloadCSV(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
}