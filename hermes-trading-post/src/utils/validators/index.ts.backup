/**
 * Centralized validator exports
 * Import all validators from a single entry point
 */

// Types and interfaces
export type {
  ValidationResult,
  ValidationOptions,
  NumberValidationOptions,
  StringValidationOptions,
  DateValidationOptions,
  TradingValidationOptions
} from './ValidationTypes';

export {
  createValidationResult,
  combineValidationResults
} from './ValidationTypes';

// Individual validator classes
export { NumberValidator } from './NumberValidator';
export { StringValidator } from './StringValidator';
export { DateValidator } from './DateValidator';
export { TradingValidator } from './TradingValidator';

// Convenience re-exports for backward compatibility
export const Validators = {
  Number: NumberValidator,
  String: StringValidator,
  Date: DateValidator,
  Trading: TradingValidator
};

// Unified validation functions for common use cases
export function validatePrice(value: any, options = {}) {
  return NumberValidator.validatePrice(value, options);
}

export function validateQuantity(value: any, options = {}) {
  return NumberValidator.validateQuantity(value, options);
}

export function validateBalance(value: any, options = {}) {
  return NumberValidator.validateBalance(value, options);
}

export function validateTradingPair(value: any, options = {}) {
  return TradingValidator.validateTradingPair(value, options);
}

export function validateStrategyType(value: any, options = {}) {
  return TradingValidator.validateStrategyType(value, options);
}

export function validateTradingConfig(config: any) {
  return TradingValidator.validateTradingConfig(config);
}

export function validateBacktestConfig(config: any) {
  return TradingValidator.validateBacktestConfig(config);
}