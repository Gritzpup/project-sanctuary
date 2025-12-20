/**
 * Bot State Persistence Layer
 * Saves and restores bot state to/from Redis for auto-resume after restart
 */

import Redis from 'ioredis';

const REDIS_KEY_PREFIX = 'hermes:bot:state:';
const ACTIVE_BOT_KEY = 'hermes:bot:active';

export class BotStatePersistence {
  constructor() {
    this.redis = new Redis({
      port: 6379,
      host: 'localhost',
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on('error', (err) => {
    });

    this.redis.on('connect', () => {
    });
  }

  /**
   * Save bot state to Redis
   */
  async saveBotState(botId, state) {
    try {
      const key = `${REDIS_KEY_PREFIX}${botId}`;
      const stateJson = JSON.stringify({
        ...state,
        lastSaved: new Date().toISOString()
      });

      await this.redis.set(key, stateJson);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load bot state from Redis
   */
  async loadBotState(botId) {
    try {
      const key = `${REDIS_KEY_PREFIX}${botId}`;
      const stateJson = await this.redis.get(key);

      if (!stateJson) {
        return null;
      }

      const state = JSON.parse(stateJson);
      return state;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save which bot is currently active
   */
  async saveActiveBotId(botId) {
    try {
      await this.redis.set(ACTIVE_BOT_KEY, botId || '');
    } catch (error) {
    }
  }

  /**
   * Load which bot should be active
   */
  async loadActiveBotId() {
    try {
      const botId = await this.redis.get(ACTIVE_BOT_KEY);
      if (botId) {
      }
      return botId || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all saved bot IDs
   */
  async getAllBotIds() {
    try {
      const pattern = `${REDIS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const botIds = keys.map(key => key.replace(REDIS_KEY_PREFIX, ''));
      return botIds;
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete bot state
   */
  async deleteBotState(botId) {
    try {
      const key = `${REDIS_KEY_PREFIX}${botId}`;
      await this.redis.del(key);
    } catch (error) {
    }
  }

  /**
   * Clear all bot states
   */
  async clearAllStates() {
    try {
      const pattern = `${REDIS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      await this.redis.del(ACTIVE_BOT_KEY);
    } catch (error) {
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}
