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
      console.error('❌ [BotPersistence] Redis connection error:', err.message);
    });

    this.redis.on('connect', () => {
      console.log('✅ [BotPersistence] Connected to Redis');
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
      console.log(`💾 [BotPersistence] Saved state for bot ${botId}`);
      return true;
    } catch (error) {
      console.error(`❌ [BotPersistence] Failed to save state for ${botId}:`, error);
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
        console.log(`📭 [BotPersistence] No saved state found for bot ${botId}`);
        return null;
      }

      const state = JSON.parse(stateJson);
      console.log(`📥 [BotPersistence] Loaded state for bot ${botId} (saved: ${state.lastSaved})`);
      return state;
    } catch (error) {
      console.error(`❌ [BotPersistence] Failed to load state for ${botId}:`, error);
      return null;
    }
  }

  /**
   * Save which bot is currently active
   */
  async saveActiveBotId(botId) {
    try {
      await this.redis.set(ACTIVE_BOT_KEY, botId || '');
      console.log(`💾 [BotPersistence] Saved active bot: ${botId || 'none'}`);
    } catch (error) {
      console.error('❌ [BotPersistence] Failed to save active bot ID:', error);
    }
  }

  /**
   * Load which bot should be active
   */
  async loadActiveBotId() {
    try {
      const botId = await this.redis.get(ACTIVE_BOT_KEY);
      if (botId) {
        console.log(`📥 [BotPersistence] Loaded active bot: ${botId}`);
      }
      return botId || null;
    } catch (error) {
      console.error('❌ [BotPersistence] Failed to load active bot ID:', error);
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
      console.log(`📋 [BotPersistence] Found ${botIds.length} saved bot(s):`, botIds);
      return botIds;
    } catch (error) {
      console.error('❌ [BotPersistence] Failed to get bot list:', error);
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
      console.log(`🗑️  [BotPersistence] Deleted state for bot ${botId}`);
    } catch (error) {
      console.error(`❌ [BotPersistence] Failed to delete state for ${botId}:`, error);
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
        console.log(`🗑️  [BotPersistence] Cleared ${keys.length} bot state(s)`);
      }
      await this.redis.del(ACTIVE_BOT_KEY);
    } catch (error) {
      console.error('❌ [BotPersistence] Failed to clear all states:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}
