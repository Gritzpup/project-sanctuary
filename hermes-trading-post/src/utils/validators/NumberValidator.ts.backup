import type { ValidationResult, NumberValidationOptions } from './ValidationTypes';
import { createValidationResult } from './ValidationTypes';

export class NumberValidator {
  public static validatePrice(
    value: any,
    options: NumberValidationOptions = {}
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
      if (options.required !== false) {
        errors.push('Price is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Price must be a valid number');
      return createValidationResult(false, errors, warnings);
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

    // Add warnings for extreme values
    if (numValue > 1000000) {
      warnings.push('Price is unusually high');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateQuantity(
    value: any,
    options: NumberValidationOptions = {}
  ): ValidationResult {
    const {
      min = 0,
      max = Number.MAX_SAFE_INTEGER,
      allowZero = false,
      allowNegative = false,
      precision = 8
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Quantity is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Quantity must be a valid number');
      return createValidationResult(false, errors, warnings);
    }

    // Check zero
    if (numValue === 0 && !allowZero) {
      errors.push('Quantity cannot be zero');
    }

    // Check negative
    if (numValue < 0 && !allowNegative) {
      errors.push('Quantity cannot be negative');
    }

    // Check range
    if (numValue < min) {
      errors.push(`Quantity must be at least ${min}`);
    }

    if (numValue > max) {
      errors.push(`Quantity cannot exceed ${max}`);
    }

    // Check precision
    if (precision && numValue.toString().split('.')[1]?.length > precision) {
      errors.push(`Quantity cannot have more than ${precision} decimal places`);
    }

    // Add warnings for very small quantities
    if (numValue > 0 && numValue < 0.00000001) {
      warnings.push('Quantity is very small and may be rounded');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validatePercentage(
    value: any,
    options: NumberValidationOptions = {}
  ): ValidationResult {
    const {
      min = 0,
      max = 100,
      allowZero = true,
      allowNegative = false
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Percentage is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Percentage must be a valid number');
      return createValidationResult(false, errors, warnings);
    }

    // Check zero
    if (numValue === 0 && !allowZero) {
      errors.push('Percentage cannot be zero');
    }

    // Check negative
    if (numValue < 0 && !allowNegative) {
      errors.push('Percentage cannot be negative');
    }

    // Check range
    if (numValue < min) {
      errors.push(`Percentage must be at least ${min}%`);
    }

    if (numValue > max) {
      errors.push(`Percentage cannot exceed ${max}%`);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateBalance(
    value: any,
    options: NumberValidationOptions = {}
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
      if (options.required !== false) {
        errors.push('Balance is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Balance must be a valid number');
      return createValidationResult(false, errors, warnings);
    }

    // Check zero
    if (numValue === 0 && !allowZero) {
      errors.push('Balance cannot be zero');
    }

    // Check negative
    if (numValue < 0 && !allowNegative) {
      errors.push('Balance cannot be negative');
    }

    // Check range
    if (numValue < min) {
      errors.push(`Balance must be at least ${min}`);
    }

    if (numValue > max) {
      errors.push(`Balance cannot exceed ${max}`);
    }

    // Add warnings for low balances
    if (numValue > 0 && numValue < 100) {
      warnings.push('Balance is very low and may limit trading opportunities');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateFeeRate(
    value: any,
    options: NumberValidationOptions = {}
  ): ValidationResult {
    const {
      min = 0,
      max = 10, // 10% max fee rate
      allowZero = true,
      allowNegative = false
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Fee rate is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Fee rate must be a valid number');
      return createValidationResult(false, errors, warnings);
    }

    // Check zero
    if (numValue === 0 && !allowZero) {
      errors.push('Fee rate cannot be zero');
    }

    // Check negative
    if (numValue < 0 && !allowNegative) {
      errors.push('Fee rate cannot be negative');
    }

    // Check range
    if (numValue < min) {
      errors.push(`Fee rate must be at least ${min}%`);
    }

    if (numValue > max) {
      errors.push(`Fee rate cannot exceed ${max}%`);
    }

    // Add warnings for high fee rates
    if (numValue > 1) {
      warnings.push('Fee rate is unusually high');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }
}