/**
 * ConfigurationService - Centralized configuration management
 *
 * Phase 5C: Backend Monolith Split
 * Extracted to manage all environment variables and configuration in one place
 * Provides validation, defaults, and runtime configuration updates
 */

export class ConfigurationService {
  constructor() {
    this.config = {
      // Server configuration
      PORT: parseInt(process.env.PORT || '4828'),
      HOST: process.env.HOST || '0.0.0.0',
      NODE_ENV: process.env.NODE_ENV || 'development',

      // Logging configuration
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      ENABLE_TIMESTAMPS: process.env.ENABLE_TIMESTAMPS !== 'false',
      ENABLE_CONTEXTS: process.env.ENABLE_CONTEXTS !== 'false',

      // WebSocket configuration
      WS_HEARTBEAT_INTERVAL: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000'),
      WS_CONNECTION_TIMEOUT: parseInt(process.env.WS_CONNECTION_TIMEOUT || '10000'),
      WS_MAX_RECONNECT_ATTEMPTS: parseInt(process.env.WS_MAX_RECONNECT_ATTEMPTS || '5'),

      // Redis configuration
      REDIS_HOST: process.env.REDIS_HOST || 'localhost',
      REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
      REDIS_DB: parseInt(process.env.REDIS_DB || '0'),

      // Coinbase API configuration
      COINBASE_API_TIMEOUT: parseInt(process.env.COINBASE_API_TIMEOUT || '10000'),
      COINBASE_WS_URL: process.env.COINBASE_WS_URL || 'wss://advanced-trade-ws.coinbase.com',

      // Memory configuration
      MEMORY_THRESHOLD_MB: parseInt(process.env.MEMORY_THRESHOLD_MB || '1024'),
      GC_INTERVAL_MS: parseInt(process.env.GC_INTERVAL_MS || '60000'),

      // Trading configuration
      DEFAULT_PRODUCT_ID: process.env.DEFAULT_PRODUCT_ID || 'BTC-USD',
      DEFAULT_GRANULARITY: process.env.DEFAULT_GRANULARITY || '1m',

      // API configuration
      API_ORDERBOOK_TIMEOUT: parseInt(process.env.API_ORDERBOOK_TIMEOUT || '2000'),
      API_CANDLES_TIMEOUT: parseInt(process.env.API_CANDLES_TIMEOUT || '5000'),
      API_STATS_TIMEOUT: parseInt(process.env.API_STATS_TIMEOUT || '5000'),

      // Subscription configuration
      SUBSCRIPTION_MAPPING_TTL_MS: parseInt(process.env.SUBSCRIPTION_MAPPING_TTL_MS || '3600000'),
      EMISSION_THROTTLE_MS: parseInt(process.env.EMISSION_THROTTLE_MS || '50'),

      // Feature flags
      ENABLE_REDIS_STORAGE: process.env.ENABLE_REDIS_STORAGE !== 'false',
      ENABLE_ORDERBOOK_CACHE: process.env.ENABLE_ORDERBOOK_CACHE !== 'false',
      ENABLE_BROADCAST_SERVICE: process.env.ENABLE_BROADCAST_SERVICE !== 'false'
    };

    this.validateConfig();
  }

  /**
   * Validate configuration values
   */
  validateConfig() {
    const errors = [];

    if (this.config.PORT < 1 || this.config.PORT > 65535) {
      errors.push('Invalid PORT: must be between 1 and 65535');
    }

    if (!['development', 'production', 'test'].includes(this.config.NODE_ENV)) {
      errors.push('Invalid NODE_ENV: must be development, production, or test');
    }

    if (!['debug', 'info', 'warn', 'error'].includes(this.config.LOG_LEVEL)) {
      errors.push('Invalid LOG_LEVEL: must be debug, info, warn, or error');
    }

    if (this.config.WS_CONNECTION_TIMEOUT < 1000) {
      errors.push('WS_CONNECTION_TIMEOUT must be at least 1000ms');
    }

    if (errors.length > 0) {
      console.warn('⚠️ Configuration warnings:', errors);
    }

    return errors;
  }

  /**
   * Get configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Set configuration value at runtime
   */
  set(key, value) {
    const oldValue = this.config[key];
    this.config[key] = value;
    console.log(`⚙️ Configuration updated: ${key} = ${value} (was ${oldValue})`);
    return value;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Check if in production
   */
  isProduction() {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Check if in development
   */
  isDevelopment() {
    return this.config.NODE_ENV === 'development';
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(featureName) {
    const key = `ENABLE_${featureName.toUpperCase()}`;
    return this.config[key] === true;
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig() {
    return {
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT,
      db: this.config.REDIS_DB
    };
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    return {
      port: this.config.PORT,
      host: this.config.HOST,
      env: this.config.NODE_ENV
    };
  }

  /**
   * Get API timeouts configuration
   */
  getTimeoutsConfig() {
    return {
      orderbook: this.config.API_ORDERBOOK_TIMEOUT,
      candles: this.config.API_CANDLES_TIMEOUT,
      stats: this.config.API_STATS_TIMEOUT,
      coinbaseAPI: this.config.COINBASE_API_TIMEOUT,
      websocket: this.config.WS_CONNECTION_TIMEOUT
    };
  }
}

export const config = new ConfigurationService();
