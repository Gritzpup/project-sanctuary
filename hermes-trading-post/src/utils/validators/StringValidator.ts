import type { ValidationResult, StringValidationOptions } from './ValidationTypes';
import { createValidationResult } from './ValidationTypes';

export class StringValidator {
  public static validateRequired(
    value: any,
    fieldName: string = 'Field',
    options: StringValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      errors.push(`${fieldName} is required`);
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value);

    // Check if empty
    if (strValue.trim().length === 0 && !options.allowEmpty) {
      errors.push(`${fieldName} cannot be empty`);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateLength(
    value: any,
    options: StringValidationOptions = {}
  ): ValidationResult {
    const {
      minLength = 0,
      maxLength = Number.MAX_SAFE_INTEGER,
      allowEmpty = false
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('String value is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value);

    // Check empty
    if (strValue.length === 0 && !allowEmpty) {
      errors.push('String cannot be empty');
      return createValidationResult(false, errors, warnings);
    }

    // Check length
    if (strValue.length < minLength) {
      errors.push(`String must be at least ${minLength} characters long`);
    }

    if (strValue.length > maxLength) {
      errors.push(`String cannot exceed ${maxLength} characters`);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validatePattern(
    value: any,
    pattern: RegExp,
    errorMessage: string = 'String format is invalid',
    options: StringValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('String value is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value);

    // Check pattern
    if (!pattern.test(strValue)) {
      errors.push(errorMessage);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateEmail(
    value: any,
    options: StringValidationOptions = {}
  ): ValidationResult {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return this.validatePattern(
      value,
      emailPattern,
      'Email address format is invalid',
      options
    );
  }

  public static validateUrl(
    value: any,
    options: StringValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('URL is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value);

    try {
      new URL(strValue);
    } catch {
      errors.push('URL format is invalid');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateStrategyName(
    value: any,
    options: StringValidationOptions = {}
  ): ValidationResult {
    const {
      minLength = 1,
      maxLength = 50,
      allowWhitespace = false
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      errors.push('Strategy name is required');
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value).trim();

    // Check empty
    if (strValue.length === 0) {
      errors.push('Strategy name cannot be empty');
      return createValidationResult(false, errors, warnings);
    }

    // Check length
    if (strValue.length < minLength) {
      errors.push(`Strategy name must be at least ${minLength} characters long`);
    }

    if (strValue.length > maxLength) {
      errors.push(`Strategy name cannot exceed ${maxLength} characters`);
    }

    // Check for invalid characters
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!allowWhitespace && !validPattern.test(strValue)) {
      errors.push('Strategy name can only contain letters, numbers, hyphens, and underscores');
    }

    // Check for reserved names
    const reservedNames = ['default', 'null', 'undefined', 'system', 'admin'];
    if (reservedNames.includes(strValue.toLowerCase())) {
      errors.push('Strategy name is reserved and cannot be used');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateTradingPair(
    value: any,
    options: StringValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Trading pair is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value).toUpperCase();

    // Check format (e.g., BTC-USD, ETH-USD)
    const pairPattern = /^[A-Z]{2,10}-[A-Z]{2,10}$/;
    if (!pairPattern.test(strValue)) {
      errors.push('Trading pair format is invalid (e.g., BTC-USD)');
    }

    // Check for common valid pairs
    const commonPairs = ['BTC-USD', 'ETH-USD', 'LTC-USD', 'BCH-USD', 'PAXG-USD'];
    if (!commonPairs.includes(strValue)) {
      warnings.push('Trading pair may not be supported by all exchanges');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateApiKey(
    value: any,
    options: StringValidationOptions = {}
  ): ValidationResult {
    const {
      minLength = 16,
      maxLength = 256
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('API key is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value).trim();

    // Check empty
    if (strValue.length === 0) {
      errors.push('API key cannot be empty');
      return createValidationResult(false, errors, warnings);
    }

    // Check length
    if (strValue.length < minLength) {
      errors.push(`API key must be at least ${minLength} characters long`);
    }

    if (strValue.length > maxLength) {
      errors.push(`API key cannot exceed ${maxLength} characters`);
    }

    // Check for suspicious patterns
    if (strValue.includes(' ')) {
      warnings.push('API key should not contain spaces');
    }

    if (!/^[a-zA-Z0-9+/=_-]+$/.test(strValue)) {
      warnings.push('API key contains unusual characters');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }
}