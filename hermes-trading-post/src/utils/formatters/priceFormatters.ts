/**
 * Price Formatting Utilities
 * 
 * Centralized price and currency formatting functions.
 * Eliminates duplicate formatting logic across components.
 */

export interface FormatOptions {
  currency?: string;
  decimals?: number;
  style?: 'currency' | 'decimal';
  compact?: boolean;
}

/**
 * Format a price as currency
 * @param price - Price value to format
 * @param options - Formatting options
 * @returns Formatted price string
 */
export function formatPrice(price: number | null, options: FormatOptions = {}): string {
  if (price === null || price === undefined) return 'N/A';
  
  const {
    currency = 'USD',
    decimals = 4,
    style = 'currency',
    compact = false
  } = options;

  const formatOptions: Intl.NumberFormatOptions = {
    style,
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals
  };

  if (style === 'currency') {
    formatOptions.currency = currency;
  }

  if (compact && Math.abs(price) >= 1000) {
    formatOptions.notation = 'compact';
  }

  return new Intl.NumberFormat('en-US', formatOptions).format(price);
}

/**
 * Format a price as plain decimal (no currency symbol)
 * @param price - Price value to format
 * @param decimals - Number of decimal places
 * @returns Formatted price string
 */
export function formatPriceDecimal(price: number | null, decimals: number = 2): string {
  return formatPrice(price, { style: 'decimal', decimals });
}

/**
 * Format price change with +/- prefix
 * @param oldPrice - Previous price
 * @param newPrice - Current price
 * @param options - Formatting options
 * @returns Formatted price change string
 */
export function formatPriceChange(oldPrice: number, newPrice: number, options: FormatOptions = {}): string {
  const change = newPrice - oldPrice;
  const prefix = change >= 0 ? '+' : '';
  return prefix + formatPrice(change, options);
}

/**
 * Format percentage change
 * @param oldPrice - Previous price
 * @param newPrice - Current price
 * @returns Formatted percentage string
 */
export function formatPercentageChange(oldPrice: number, newPrice: number): string {
  if (oldPrice === 0) return '0.00%';
  
  const change = ((newPrice - oldPrice) / oldPrice) * 100;
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
}

/**
 * Format a number with commas as thousand separators
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format PnL (Profit and Loss) with appropriate +/- styling
 * @param pnl - P&L value
 * @param decimals - Number of decimal places
 * @returns Formatted PnL string
 */
export function formatPnL(pnl: number, decimals: number = 2): string {
  const prefix = pnl >= 0 ? '+' : '';
  return `${prefix}${pnl.toFixed(decimals)}`;
}

/**
 * Get appropriate price precision based on price magnitude
 * @param price - Price value
 * @returns Number of decimal places to use
 */
export function getOptimalPrecision(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 1) return 4;
  if (price >= 0.1) return 5;
  return 8; // For very small prices (crypto)
}

/**
 * Format price with optimal precision
 * @param price - Price value
 * @param options - Additional formatting options
 * @returns Formatted price with optimal precision
 */
export function formatPriceOptimal(price: number | null, options: Omit<FormatOptions, 'decimals'> = {}): string {
  if (price === null || price === undefined) return 'N/A';
  
  const decimals = getOptimalPrecision(price);
  return formatPrice(price, { ...options, decimals });
}