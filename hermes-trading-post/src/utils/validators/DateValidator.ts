import type { ValidationResult, DateValidationOptions } from './ValidationTypes';
import { createValidationResult } from './ValidationTypes';

export class DateValidator {
  public static validateDate(
    value: any,
    options: DateValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Date is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    let dateValue: Date;

    // Convert to Date object
    if (value instanceof Date) {
      dateValue = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      dateValue = new Date(value);
    } else {
      errors.push('Date must be a valid Date object, string, or number');
      return createValidationResult(false, errors, warnings);
    }

    // Check if it's a valid date
    if (isNaN(dateValue.getTime())) {
      errors.push('Date is invalid');
      return createValidationResult(false, errors, warnings);
    }

    // Check date range
    if (options.minDate && dateValue < options.minDate) {
      errors.push(`Date cannot be before ${options.minDate.toLocaleDateString()}`);
    }

    if (options.maxDate && dateValue > options.maxDate) {
      errors.push(`Date cannot be after ${options.maxDate.toLocaleDateString()}`);
    }

    // Check future/past restrictions
    const now = new Date();
    
    if (options.futureOnly && dateValue <= now) {
      errors.push('Date must be in the future');
    }

    if (options.pastOnly && dateValue >= now) {
      errors.push('Date must be in the past');
    }

    // Add warnings for extreme dates
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    if (dateValue < oneYearAgo) {
      warnings.push('Date is more than one year in the past');
    }

    if (dateValue > oneYearFromNow) {
      warnings.push('Date is more than one year in the future');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateTimeString(
    value: any,
    options: DateValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Time is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value);

    // Check time format (HH:MM or HH:MM:SS)
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    if (!timePattern.test(strValue)) {
      errors.push('Time format is invalid (use HH:MM or HH:MM:SS)');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateDateString(
    value: any,
    options: DateValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Date is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to string
    const strValue = String(value);

    // Check ISO date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(strValue)) {
      errors.push('Date format is invalid (use YYYY-MM-DD)');
      return createValidationResult(false, errors, warnings);
    }

    // Validate the actual date
    const dateResult = this.validateDate(strValue, options);
    return dateResult;
  }

  public static validateTimestamp(
    value: any,
    options: DateValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Timestamp is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Timestamp must be a valid number');
      return createValidationResult(false, errors, warnings);
    }

    // Check if it's a reasonable timestamp (after 1970 and before 2100)
    const minTimestamp = 0; // Unix epoch
    const maxTimestamp = 4102444800000; // Year 2100

    if (numValue < minTimestamp) {
      errors.push('Timestamp is too old (before Unix epoch)');
    }

    if (numValue > maxTimestamp) {
      errors.push('Timestamp is too far in the future');
    }

    // Check if it's in milliseconds or seconds
    const now = Date.now();
    const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);

    if (numValue > now && numValue < now / 1000) {
      warnings.push('Timestamp appears to be in seconds (consider using milliseconds)');
    }

    if (numValue > oneYearFromNow) {
      warnings.push('Timestamp is far in the future');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateDuration(
    value: any,
    options: { minSeconds?: number; maxSeconds?: number; required?: boolean } = {}
  ): ValidationResult {
    const {
      minSeconds = 0,
      maxSeconds = Number.MAX_SAFE_INTEGER,
      required = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (required) {
        errors.push('Duration is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    // Convert to number (assume seconds)
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue) || !isFinite(numValue)) {
      errors.push('Duration must be a valid number');
      return createValidationResult(false, errors, warnings);
    }

    // Check if it's positive
    if (numValue < 0) {
      errors.push('Duration cannot be negative');
    }

    // Check range
    if (numValue < minSeconds) {
      errors.push(`Duration must be at least ${minSeconds} seconds`);
    }

    if (numValue > maxSeconds) {
      errors.push(`Duration cannot exceed ${maxSeconds} seconds`);
    }

    // Add warnings for unusual durations
    if (numValue > 86400) { // More than 24 hours
      warnings.push('Duration is longer than 24 hours');
    }

    if (numValue < 1 && numValue > 0) {
      warnings.push('Duration is less than 1 second');
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateAge(
    birthDate: any,
    options: { minAge?: number; maxAge?: number; required?: boolean } = {}
  ): ValidationResult {
    const {
      minAge = 0,
      maxAge = 150,
      required = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate the birth date first
    const dateResult = this.validateDate(birthDate, { required, pastOnly: true });
    if (!dateResult.isValid) {
      return dateResult;
    }

    const birthDateObj = new Date(birthDate);
    const now = new Date();
    
    // Calculate age
    let age = now.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = now.getMonth() - birthDateObj.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDateObj.getDate())) {
      age--;
    }

    // Check age range
    if (age < minAge) {
      errors.push(`Age must be at least ${minAge} years`);
    }

    if (age > maxAge) {
      errors.push(`Age cannot exceed ${maxAge} years`);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }
}