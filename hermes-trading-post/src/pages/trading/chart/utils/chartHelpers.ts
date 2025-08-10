import type { CandlestickData, Time } from 'lightweight-charts';
import { PERIOD_TO_SECONDS, GRANULARITY_TO_SECONDS } from './constants';

// Time utilities
export function getCurrentTime(): number {
  return Math.floor(Date.now() / 1000);
}

export function alignToGranularity(timestamp: number, granularity: string): number {
  const granularitySeconds = GRANULARITY_TO_SECONDS[granularity] || 60;
  return Math.floor(timestamp / granularitySeconds) * granularitySeconds;
}

export function getTimeRange(period: string, endTime?: number): { start: number; end: number } {
  const end = endTime || getCurrentTime();
  const periodSeconds = PERIOD_TO_SECONDS[period] || 3600;
  const start = end - periodSeconds;
  
  return { start, end };
}

export function calculateExpectedCandles(period: string, granularity: string): number {
  const periodSeconds = PERIOD_TO_SECONDS[period] || 3600;
  const granularitySeconds = GRANULARITY_TO_SECONDS[granularity] || 60;
  
  return Math.ceil(periodSeconds / granularitySeconds);
}

// Data validation
export function isValidCandle(candle: any): candle is CandlestickData {
  return (
    candle &&
    typeof candle.time === 'number' &&
    typeof candle.open === 'number' &&
    typeof candle.high === 'number' &&
    typeof candle.low === 'number' &&
    typeof candle.close === 'number' &&
    !isNaN(candle.open) &&
    !isNaN(candle.high) &&
    !isNaN(candle.low) &&
    !isNaN(candle.close) &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close
  );
}

export function validateCandleData(data: any[]): CandlestickData[] {
  return data.filter(isValidCandle);
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

export function formatPrice(price: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(price);
}

export function formatCurrency(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

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
  candles: CandlestickData[],
  targetGranularity: string,
  sourceGranularity: string
): CandlestickData[] {
  const targetSeconds = GRANULARITY_TO_SECONDS[targetGranularity];
  const sourceSeconds = GRANULARITY_TO_SECONDS[sourceGranularity];
  
  if (!targetSeconds || !sourceSeconds || targetSeconds <= sourceSeconds) {
    return candles;
  }
  
  const aggregated: Map<number, CandlestickData> = new Map();
  
  candles.forEach(candle => {
    const alignedTime = alignToGranularity(candle.time as number, targetGranularity);
    
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
export function exportToCSV(candles: CandlestickData[]): string {
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