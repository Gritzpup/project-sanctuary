// Unified validation utilities to eliminate duplication

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class NumberValidator {
  public static validatePrice(
    value: any,
    options: {
      min?: number;
      max?: number;
      allowZero?: boolean;
      allowNegative?: boolean;
    } = {}
  ): ValidationResult {
    const {
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      allowZero = true,
      allowNegative = false
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      errors.push('Price is required');
      return { isValid: false, errors, warnings };
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Price must be a valid number');
      return { isValid: false, errors, warnings };
    }

    // Check zero
    if (numValue === 0 && !allowZero) {
      errors.push('Price cannot be zero');
    }

    // Check negative
    if (numValue < 0 && !allowNegative) {
      errors.push('Price cannot be negative');
    }

    // Check range
    if (numValue < min) {
      errors.push(`Price must be at least ${min}`);
    }

    if (numValue > max) {
      errors.push(`Price cannot exceed ${max}`);
    }

    // Warnings for unusual values
    if (numValue > 1000000) {
      warnings.push('Price seems unusually high');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public static validatePercentage(
    value: any,
    options: {
      min?: number;
      max?: number;
      allowNegative?: boolean;
    } = {}
  ): ValidationResult {
    const {
      min = -100,
      max = 100,
      allowNegative = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (value === null || value === undefined) {
      errors.push('Percentage is required');
      return { isValid: false, errors, warnings };
    }

    const numValue = Number(value);

    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Percentage must be a valid number');
      return { isValid: false, errors, warnings };
    }

    if (numValue < 0 && !allowNegative) {
      errors.push('Percentage cannot be negative');
    }

    if (numValue < min) {
      errors.push(`Percentage must be at least ${min}%`);
    }

    if (numValue > max) {
      errors.push(`Percentage cannot exceed ${max}%`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public static validateInteger(
    value: any,
    options: {
      min?: number;
      max?: number;
      allowZero?: boolean;
    } = {}
  ): ValidationResult {
    const {
      min = Number.MIN_SAFE_INTEGER,
      max = Number.MAX_SAFE_INTEGER,
      allowZero = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (value === null || value === undefined) {
      errors.push('Value is required');
      return { isValid: false, errors, warnings };
    }

    const numValue = Number(value);

    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Value must be a valid number');
      return { isValid: false, errors, warnings };
    }

    if (!Number.isInteger(numValue)) {
      errors.push('Value must be an integer');
    }

    if (numValue === 0 && !allowZero) {
      errors.push('Value cannot be zero');
    }

    if (numValue < min) {
      errors.push(`Value must be at least ${min}`);
    }

    if (numValue > max) {
      errors.push(`Value cannot exceed ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export class StringValidator {
  public static validateSymbol(symbol: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!symbol) {
      errors.push('Symbol is required');
      return { isValid: false, errors, warnings };
    }

    const strValue = String(symbol).trim().toUpperCase();

    if (strValue.length === 0) {
      errors.push('Symbol cannot be empty');
      return { isValid: false, errors, warnings };
    }

    if (strValue.length < 2) {
      errors.push('Symbol must be at least 2 characters');
    }

    if (strValue.length > 10) {
      errors.push('Symbol cannot exceed 10 characters');
    }

    if (!/^[A-Z\-]+$/.test(strValue)) {
      errors.push('Symbol can only contain letters and hyphens');
    }

    // Common trading pairs validation
    const validPairs = ['BTC-USD', 'ETH-USD', 'BTC-EUR', 'ETH-EUR', 'PAXG-USD'];
    if (!validPairs.includes(strValue)) {
      warnings.push('Symbol is not a commonly traded pair');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public static validateGranularity(granularity: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!granularity) {
      errors.push('Granularity is required');
      return { isValid: false, errors, warnings };
    }

    const strValue = String(granularity).trim().toLowerCase();
    const validGranularities = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

    if (!validGranularities.includes(strValue)) {
      errors.push(`Granularity must be one of: ${validGranularities.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public static validateEmail(email: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!email) {
      errors.push('Email is required');
      return { isValid: false, errors, warnings };
    }

    const strValue = String(email).trim().toLowerCase();

    if (strValue.length === 0) {
      errors.push('Email cannot be empty');
      return { isValid: false, errors, warnings };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(strValue)) {
      errors.push('Email format is invalid');
    }

    if (strValue.length > 320) {
      errors.push('Email is too long');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export class DateValidator {
  public static validateTimestamp(timestamp: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (timestamp === null || timestamp === undefined) {
      errors.push('Timestamp is required');
      return { isValid: false, errors, warnings };
    }

    const numValue = Number(timestamp);

    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Timestamp must be a valid number');
      return { isValid: false, errors, warnings };
    }

    // Check if timestamp is in reasonable range (between 2010 and 2050)
    const minTimestamp = new Date('2010-01-01').getTime() / 1000;
    const maxTimestamp = new Date('2050-12-31').getTime() / 1000;

    // Handle both seconds and milliseconds
    let normalizedTimestamp = numValue;
    if (numValue > 10000000000) {
      normalizedTimestamp = numValue / 1000; // Convert from milliseconds to seconds
    }

    if (normalizedTimestamp < minTimestamp) {
      errors.push('Timestamp is too old (before 2010)');
    }

    if (normalizedTimestamp > maxTimestamp) {
      errors.push('Timestamp is too far in the future (after 2050)');
    }

    // Warning for future timestamps
    const now = Date.now() / 1000;
    if (normalizedTimestamp > now + 86400) { // More than 1 day in the future
      warnings.push('Timestamp is in the future');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public static validateDateRange(
    startTime: any,
    endTime: any,
    options: {
      maxRangeDays?: number;
      allowFuture?: boolean;
    } = {}
  ): ValidationResult {
    const {
      maxRangeDays = 365,
      allowFuture = false
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate individual timestamps
    const startValidation = DateValidator.validateTimestamp(startTime);
    const endValidation = DateValidator.validateTimestamp(endTime);

    if (!startValidation.isValid) {
      errors.push(`Start time: ${startValidation.errors.join(', ')}`);
    }

    if (!endValidation.isValid) {
      errors.push(`End time: ${endValidation.errors.join(', ')}`);
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    const startTimestamp = Number(startTime);
    const endTimestamp = Number(endTime);

    // Normalize to seconds if needed
    const normalizedStart = startTimestamp > 10000000000 ? startTimestamp / 1000 : startTimestamp;
    const normalizedEnd = endTimestamp > 10000000000 ? endTimestamp / 1000 : endTimestamp;

    // Check order
    if (normalizedStart >= normalizedEnd) {
      errors.push('Start time must be before end time');
    }

    // Check range
    const rangeDays = (normalizedEnd - normalizedStart) / 86400;
    if (rangeDays > maxRangeDays) {
      errors.push(`Date range cannot exceed ${maxRangeDays} days`);
    }

    // Check future dates
    if (!allowFuture) {
      const now = Date.now() / 1000;
      if (normalizedEnd > now) {
        errors.push('End time cannot be in the future');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export class TradingValidator {
  public static validateTradingPair(pair: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!pair) {
      errors.push('Trading pair is required');
      return { isValid: false, errors, warnings };
    }

    const strValue = String(pair).trim().toUpperCase();

    if (!strValue.includes('-')) {
      errors.push('Trading pair must be in format BASE-QUOTE (e.g., BTC-USD)');
      return { isValid: false, errors, warnings };
    }

    const [base, quote] = strValue.split('-');

    if (!base || !quote) {
      errors.push('Both base and quote currencies are required');
      return { isValid: false, errors, warnings };
    }

    if (base.length < 2 || base.length > 5) {
      errors.push('Base currency must be 2-5 characters');
    }

    if (quote.length < 2 || quote.length > 5) {
      errors.push('Quote currency must be 2-5 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public static validateOrderSize(
    size: any,
    options: {
      minSize?: number;
      maxSize?: number;
      precision?: number;
    } = {}
  ): ValidationResult {
    const {
      minSize = 0.001,
      maxSize = 1000,
      precision = 8
    } = options;

    const priceValidation = NumberValidator.validatePrice(size, {
      min: minSize,
      max: maxSize,
      allowZero: false,
      allowNegative: false
    });

    if (!priceValidation.isValid) {
      return priceValidation;
    }

    const numValue = Number(size);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check precision
    const decimalPlaces = (numValue.toString().split('.')[1] || '').length;
    if (decimalPlaces > precision) {
      errors.push(`Order size precision cannot exceed ${precision} decimal places`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Convenience validation functions
export const validatePrice = NumberValidator.validatePrice;
export const validatePercentage = NumberValidator.validatePercentage;
export const validateSymbol = StringValidator.validateSymbol;
export const validateGranularity = StringValidator.validateGranularity;
export const validateTimestamp = DateValidator.validateTimestamp;
export const validateTradingPair = TradingValidator.validateTradingPair;