import type { ValidationResult, TradingValidationOptions } from './ValidationTypes';
import { createValidationResult, combineValidationResults } from './ValidationTypes';
import { NumberValidator } from './NumberValidator';
import { StringValidator } from './StringValidator';
import { DateValidator } from './DateValidator';
import type { SupportedTradingPair, SupportedGranularity, SupportedStrategy } from '../../types/trading/trading';

export class TradingValidator {
  private static readonly SUPPORTED_PAIRS = [
    'BTC-USD', 'ETH-USD', 'LTC-USD', 'BCH-USD', 'PAXG-USD',
    'ADA-USD', 'DOT-USD', 'LINK-USD', 'XLM-USD', 'UNI-USD'
  ];

  private static readonly SUPPORTED_GRANULARITIES = [
    '1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'
  ];

  private static readonly SUPPORTED_STRATEGIES = [
    'reverse-descending-grid', 'grid-trading', 'rsi-mean-reversion', 'dca',
    'vwap-bounce', 'micro-scalping', 'proper-scalping', 'ultra-micro-scalping'
  ];

  public static validateTradingPair(
    value: unknown,
    options: TradingValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // First validate as a string
    const stringResult = StringValidator.validateTradingPair(value, options);
    if (!stringResult.isValid) {
      return stringResult;
    }

    const pairValue = String(value).toUpperCase();

    // Check if pair is supported
    const supportedPairs = options.supportedPairs || this.SUPPORTED_PAIRS;
    if (!supportedPairs.includes(pairValue)) {
      errors.push(`Trading pair "${pairValue}" is not supported. Supported pairs: ${supportedPairs.join(', ')}`);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateGranularity(
    value: unknown,
    options: TradingValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Granularity is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    const granularityValue = String(value).toLowerCase();

    // Check if granularity is supported
    const supportedGranularities = options.supportedGranularities || this.SUPPORTED_GRANULARITIES;
    if (!supportedGranularities.includes(granularityValue)) {
      errors.push(`Granularity "${granularityValue}" is not supported. Supported granularities: ${supportedGranularities.join(', ')}`);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateStrategyType(
    value: any,
    options: TradingValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if value exists
    if (value === null || value === undefined) {
      if (options.required !== false) {
        errors.push('Strategy type is required');
      }
      return createValidationResult(false, errors, warnings);
    }

    const strategyValue = String(value).toLowerCase();

    // Check if strategy is supported
    if (!this.SUPPORTED_STRATEGIES.includes(strategyValue)) {
      errors.push(`Strategy "${strategyValue}" is not supported. Supported strategies: ${this.SUPPORTED_STRATEGIES.join(', ')}`);
    }

    return createValidationResult(errors.length === 0, errors, warnings);
  }

  public static validateTradeSize(
    quantity: any,
    price: any,
    balance: any,
    options: TradingValidationOptions = {}
  ): ValidationResult {
    const results: ValidationResult[] = [];

    // Validate quantity
    results.push(NumberValidator.validateQuantity(quantity, {
      min: 0.00000001,
      max: 1000000,
      allowZero: false,
      precision: 8
    }));

    // Validate price
    results.push(NumberValidator.validatePrice(price, {
      min: 0.01,
      max: 10000000,
      allowZero: false
    }));

    // Validate balance
    results.push(NumberValidator.validateBalance(balance, {
      min: 0,
      allowZero: false
    }));

    const combinedResult = combineValidationResults(results);
    
    if (combinedResult.isValid) {
      const quantityNum = Number(quantity);
      const priceNum = Number(price);
      const balanceNum = Number(balance);
      const tradeValue = quantityNum * priceNum;

      // Check if trade value exceeds balance
      if (tradeValue > balanceNum) {
        combinedResult.errors.push('Trade value exceeds available balance');
        combinedResult.isValid = false;
      }

      // Check minimum trade value
      const minTradeValue = options.minBalance || 1;
      if (tradeValue < minTradeValue) {
        combinedResult.warnings.push(`Trade value is below recommended minimum of $${minTradeValue}`);
      }

      // Check if trade uses too much of balance
      const balancePercentage = (tradeValue / balanceNum) * 100;
      if (balancePercentage > 50) {
        combinedResult.warnings.push(`Trade uses ${balancePercentage.toFixed(1)}% of total balance`);
      }
    }

    return combinedResult;
  }

  public static validateTradingConfig(config: {
    strategyType?: any;
    pair?: any;
    granularity?: any;
    balance?: any;
    feeRate?: any;
    stopLoss?: any;
    takeProfit?: any;
  }): ValidationResult {
    const results: ValidationResult[] = [];

    // Validate strategy type
    if (config.strategyType !== undefined) {
      results.push(this.validateStrategyType(config.strategyType));
    }

    // Validate trading pair
    if (config.pair !== undefined) {
      results.push(this.validateTradingPair(config.pair));
    }

    // Validate granularity
    if (config.granularity !== undefined) {
      results.push(this.validateGranularity(config.granularity));
    }

    // Validate balance
    if (config.balance !== undefined) {
      results.push(NumberValidator.validateBalance(config.balance, {
        min: 10, // Minimum $10 for trading
        allowZero: false
      }));
    }

    // Validate fee rate
    if (config.feeRate !== undefined) {
      results.push(NumberValidator.validateFeeRate(config.feeRate));
    }

    // Validate stop loss
    if (config.stopLoss !== undefined) {
      results.push(NumberValidator.validatePercentage(config.stopLoss, {
        min: 0.1,
        max: 50,
        allowZero: false
      }));
    }

    // Validate take profit
    if (config.takeProfit !== undefined) {
      results.push(NumberValidator.validatePercentage(config.takeProfit, {
        min: 0.1,
        max: 1000,
        allowZero: false
      }));
    }

    const combinedResult = combineValidationResults(results);

    // Cross-validation checks
    if (combinedResult.isValid && config.stopLoss && config.takeProfit) {
      const stopLossNum = Number(config.stopLoss);
      const takeProfitNum = Number(config.takeProfit);
      
      if (stopLossNum >= takeProfitNum) {
        combinedResult.warnings.push('Stop loss should be lower than take profit for optimal risk/reward ratio');
      }
    }

    return combinedResult;
  }

  public static validateBacktestConfig(config: {
    startDate?: any;
    endDate?: any;
    initialBalance?: any;
    strategyType?: any;
    pair?: any;
    granularity?: any;
  }): ValidationResult {
    const results: ValidationResult[] = [];

    // Validate start date
    if (config.startDate !== undefined) {
      results.push(DateValidator.validateDate(config.startDate, {
        pastOnly: true,
        required: true
      }));
    }

    // Validate end date
    if (config.endDate !== undefined) {
      results.push(DateValidator.validateDate(config.endDate, {
        pastOnly: true,
        required: true
      }));
    }

    // Validate initial balance
    if (config.initialBalance !== undefined) {
      results.push(NumberValidator.validateBalance(config.initialBalance, {
        min: 100, // Minimum $100 for backtesting
        max: 10000000,
        allowZero: false
      }));
    }

    // Use trading config validation for other fields
    const tradingConfigResult = this.validateTradingConfig(config);
    results.push(tradingConfigResult);

    const combinedResult = combineValidationResults(results);

    // Cross-validation for dates
    if (combinedResult.isValid && config.startDate && config.endDate) {
      const startDate = new Date(config.startDate);
      const endDate = new Date(config.endDate);
      
      if (startDate >= endDate) {
        combinedResult.errors.push('Start date must be before end date');
        combinedResult.isValid = false;
      }

      // Check if date range is reasonable
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 1) {
        combinedResult.warnings.push('Backtest period is very short (less than 1 day)');
      }

      if (daysDiff > 365) {
        combinedResult.warnings.push('Backtest period is very long (more than 1 year) and may take time to complete');
      }
    }

    return combinedResult;
  }

  public static validateApiCredentials(credentials: {
    apiKey?: any;
    apiSecret?: any;
    passphrase?: any;
    sandbox?: any;
  }): ValidationResult {
    const results: ValidationResult[] = [];

    // Validate API key
    if (credentials.apiKey !== undefined) {
      results.push(StringValidator.validateApiKey(credentials.apiKey, {
        required: true,
        minLength: 32,
        maxLength: 128
      }));
    }

    // Validate API secret
    if (credentials.apiSecret !== undefined) {
      results.push(StringValidator.validateApiKey(credentials.apiSecret, {
        required: true,
        minLength: 32,
        maxLength: 128
      }));
    }

    // Validate passphrase (for some exchanges)
    if (credentials.passphrase !== undefined) {
      results.push(StringValidator.validateRequired(credentials.passphrase, 'Passphrase', {
        minLength: 8,
        maxLength: 100
      }));
    }

    // Validate sandbox flag
    if (credentials.sandbox !== undefined && typeof credentials.sandbox !== 'boolean') {
      const result = createValidationResult(false, ['Sandbox flag must be a boolean value']);
      results.push(result);
    }

    return combineValidationResults(results);
  }
}