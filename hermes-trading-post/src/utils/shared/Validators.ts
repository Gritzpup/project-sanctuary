/**
 * @deprecated This file has been split into modular validators.
 * Import from '../validators/index' instead.
 * 
 * This file is kept for backward compatibility only.
 */

// Re-export everything from the new modular validators
export * from '../validators/index';

// Legacy imports - these will be removed in a future version
import {
  NumberValidator as NewNumberValidator,
  StringValidator as NewStringValidator,
  DateValidator as NewDateValidator,
  TradingValidator as NewTradingValidator,
  type ValidationResult
} from '../validators/index';

// Legacy class exports for backward compatibility
export const NumberValidator = NewNumberValidator;
export const StringValidator = NewStringValidator;
export const DateValidator = NewDateValidator;
export const TradingValidator = NewTradingValidator;

// Mark this as deprecated in development
if (process.env.NODE_ENV === 'development') {
  console.warn(
    '⚠️  DEPRECATED: utils/shared/Validators.ts is deprecated. ' +
    'Use utils/validators/index.ts instead for better modularity.'
  );
}