// Unified formatters to eliminate duplication across the codebase

export class CurrencyFormatter {
  private static readonly DEFAULT_LOCALE = 'en-US';
  private static readonly DEFAULT_CURRENCY = 'USD';

  public static formatPrice(
    price: number,
    options: {
      currency?: string;
      locale?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
      compact?: boolean;
    } = {}
  ): string {
    const {
      currency = CurrencyFormatter.DEFAULT_CURRENCY,
      locale = CurrencyFormatter.DEFAULT_LOCALE,
      minimumFractionDigits = 2,
      maximumFractionDigits = 8,
      compact = false
    } = options;

    if (isNaN(price) || !isFinite(price)) {
      return '$0.00';
    }

    try {
      if (compact && Math.abs(price) >= 1000) {
        return CurrencyFormatter.formatCompactPrice(price, currency, locale);
      }

      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: price < 1 ? 4 : minimumFractionDigits,
        maximumFractionDigits: price < 1 ? maximumFractionDigits : 2
      });

      return formatter.format(price);
    } catch (error) {
      console.warn('Error formatting price:', error);
      return `$${price.toFixed(2)}`;
    }
  }

  private static formatCompactPrice(price: number, currency: string, locale: string): string {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 2
    });

    return formatter.format(price);
  }

  public static formatCrypto(
    amount: number,
    symbol: string = 'BTC',
    options: {
      locale?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    } = {}
  ): string {
    const {
      locale = CurrencyFormatter.DEFAULT_LOCALE,
      minimumFractionDigits = 6,
      maximumFractionDigits = 8
    } = options;

    if (isNaN(amount) || !isFinite(amount)) {
      return `0 ${symbol}`;
    }

    try {
      const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: amount < 0.001 ? maximumFractionDigits : minimumFractionDigits,
        maximumFractionDigits
      });

      return `${formatter.format(amount)} ${symbol}`;
    } catch (error) {
      console.warn('Error formatting crypto amount:', error);
      return `${amount.toFixed(6)} ${symbol}`;
    }
  }
}

export class PercentageFormatter {
  public static formatPercent(
    value: number,
    options: {
      locale?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
      showSign?: boolean;
    } = {}
  ): string {
    const {
      locale = 'en-US',
      minimumFractionDigits = 2,
      maximumFractionDigits = 2,
      showSign = false
    } = options;

    if (isNaN(value) || !isFinite(value)) {
      return '0.00%';
    }

    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits,
        maximumFractionDigits,
        signDisplay: showSign ? 'always' : 'auto'
      });

      return formatter.format(value / 100);
    } catch (error) {
      console.warn('Error formatting percentage:', error);
      const sign = showSign && value > 0 ? '+' : '';
      return `${sign}${value.toFixed(2)}%`;
    }
  }

  public static formatChange(
    value: number,
    options: {
      locale?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    } = {}
  ): { formatted: string; isPositive: boolean; isNegative: boolean } {
    const formatted = PercentageFormatter.formatPercent(value, {
      ...options,
      showSign: true
    });

    return {
      formatted,
      isPositive: value > 0,
      isNegative: value < 0
    };
  }
}

export class NumberFormatter {
  public static formatNumber(
    value: number,
    options: {
      locale?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
      compact?: boolean;
    } = {}
  ): string {
    const {
      locale = 'en-US',
      minimumFractionDigits = 0,
      maximumFractionDigits = 2,
      compact = false
    } = options;

    if (isNaN(value) || !isFinite(value)) {
      return '0';
    }

    try {
      const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
        notation: compact ? 'compact' : 'standard'
      });

      return formatter.format(value);
    } catch (error) {
      console.warn('Error formatting number:', error);
      return value.toFixed(maximumFractionDigits);
    }
  }

  public static formatVolume(volume: number): string {
    if (volume >= 1e9) {
      return NumberFormatter.formatNumber(volume / 1e9, { maximumFractionDigits: 2, compact: true }) + 'B';
    } else if (volume >= 1e6) {
      return NumberFormatter.formatNumber(volume / 1e6, { maximumFractionDigits: 2, compact: true }) + 'M';
    } else if (volume >= 1e3) {
      return NumberFormatter.formatNumber(volume / 1e3, { maximumFractionDigits: 2, compact: true }) + 'K';
    } else {
      return NumberFormatter.formatNumber(volume, { maximumFractionDigits: 0 });
    }
  }
}

export class TimeFormatter {
  public static formatTimestamp(
    timestamp: number,
    options: {
      locale?: string;
      timeZone?: string;
      format?: 'short' | 'medium' | 'long' | 'full' | 'relative' | 'time-only' | 'date-only';
    } = {}
  ): string {
    const {
      locale = 'en-US',
      timeZone = 'UTC',
      format = 'medium'
    } = options;

    if (!timestamp || isNaN(timestamp)) {
      return 'Invalid Date';
    }

    const date = new Date(timestamp * 1000); // Assume timestamp is in seconds

    if (format === 'relative') {
      return TimeFormatter.formatRelativeTime(date, locale);
    }

    try {
      let formatOptions: Intl.DateTimeFormatOptions = { timeZone };

      switch (format) {
        case 'short':
          formatOptions = {
            ...formatOptions,
            year: '2-digit',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          };
          break;
        case 'medium':
          formatOptions = {
            ...formatOptions,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          };
          break;
        case 'long':
          formatOptions = {
            ...formatOptions,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          };
          break;
        case 'full':
          formatOptions = {
            ...formatOptions,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          };
          break;
        case 'time-only':
          formatOptions = {
            ...formatOptions,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          };
          break;
        case 'date-only':
          formatOptions = {
            ...formatOptions,
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          };
          break;
      }

      const formatter = new Intl.DateTimeFormat(locale, formatOptions);
      return formatter.format(date);
    } catch (error) {
      console.warn('Error formatting timestamp:', error);
      return date.toISOString();
    }
  }

  private static formatRelativeTime(date: Date, locale: string): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

      if (diffDays > 0) {
        return rtf.format(-diffDays, 'day');
      } else if (diffHours > 0) {
        return rtf.format(-diffHours, 'hour');
      } else if (diffMinutes > 0) {
        return rtf.format(-diffMinutes, 'minute');
      } else {
        return rtf.format(-diffSeconds, 'second');
      }
    } catch (error) {
      console.warn('Error formatting relative time:', error);
      return 'Just now';
    }
  }

  public static formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000) % 60;
    const minutes = Math.floor(durationMs / (1000 * 60)) % 60;
    const hours = Math.floor(durationMs / (1000 * 60 * 60)) % 24;
    const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Convenience export for commonly used formatters
export const formatPrice = CurrencyFormatter.formatPrice;
export const formatPercent = PercentageFormatter.formatPercent;
export const formatNumber = NumberFormatter.formatNumber;
export const formatTime = TimeFormatter.formatTimestamp;