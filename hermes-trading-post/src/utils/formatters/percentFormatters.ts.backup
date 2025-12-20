/**
 * Percentage formatting utilities
 * Centralized location for all percentage formatting functions
 */

export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

export function formatPercentChange(oldValue: number, newValue: number, decimals: number = 2): string {
  if (oldValue === 0) return '0.00%';
  
  const change = ((newValue - oldValue) / oldValue) * 100;
  return formatPercent(change, decimals);
}

export function formatPnL(pnl: number | null | undefined, decimals: number = 2): string {
  if (pnl === null || pnl === undefined || isNaN(pnl)) return 'N/A';
  
  const prefix = pnl >= 0 ? '+' : '';
  return `${prefix}${pnl.toFixed(decimals)}`;
}

export function formatPnLPercent(pnl: number | null | undefined, startingValue: number, decimals: number = 2): string {
  if (pnl === null || pnl === undefined || isNaN(pnl) || startingValue === 0) return 'N/A';
  
  const percentChange = (pnl / startingValue) * 100;
  return formatPercent(percentChange, decimals);
}

export function formatGrowth(current: number, starting: number, decimals: number = 2): {
  absolute: string;
  percent: string;
} {
  const growth = current - starting;
  const growthPercent = starting !== 0 ? ((current - starting) / starting) * 100 : 0;
  
  return {
    absolute: formatPnL(growth, decimals),
    percent: formatPercent(growthPercent, decimals)
  };
}