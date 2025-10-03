/**
 * Common validation types and interfaces
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  required?: boolean;
  allowEmpty?: boolean;
}

export interface NumberValidationOptions extends ValidationOptions {
  min?: number;
  max?: number;
  allowZero?: boolean;
  allowNegative?: boolean;
  precision?: number;
}

export interface StringValidationOptions extends ValidationOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowWhitespace?: boolean;
}

export interface DateValidationOptions extends ValidationOptions {
  minDate?: Date;
  maxDate?: Date;
  futureOnly?: boolean;
  pastOnly?: boolean;
}

export interface TradingValidationOptions extends ValidationOptions {
  minBalance?: number;
  maxBalance?: number;
  supportedPairs?: string[];
  supportedGranularities?: string[];
}

// Utility functions for validation results
export function createValidationResult(
  isValid: boolean,
  errors: string[] = [],
  warnings: string[] = []
): ValidationResult {
  return { isValid, errors, warnings };
}

export function combineValidationResults(results: ValidationResult[]): ValidationResult {
  const combinedErrors: string[] = [];
  const combinedWarnings: string[] = [];
  let isValid = true;

  for (const result of results) {
    if (!result.isValid) {
      isValid = false;
    }
    combinedErrors.push(...result.errors);
    combinedWarnings.push(...result.warnings);
  }

  return createValidationResult(isValid, combinedErrors, combinedWarnings);
}