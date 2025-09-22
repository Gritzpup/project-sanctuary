/**
 * Number formatting utilities
 * Centralized location for all number formatting functions
 */

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatMoney(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatLargeNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1e9) {
    return `${sign}${(absNum / 1e9).toFixed(1)}B`;
  } else if (absNum >= 1e6) {
    return `${sign}${(absNum / 1e6).toFixed(1)}M`;
  } else if (absNum >= 1e3) {
    return `${sign}${(absNum / 1e3).toFixed(1)}K`;
  }
  
  return formatNumber(num);
}

export function formatDecimal(num: number | null | undefined, decimals: number = 2): string {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return num.toFixed(decimals);
}

export function formatInteger(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return Math.round(num).toString();
}