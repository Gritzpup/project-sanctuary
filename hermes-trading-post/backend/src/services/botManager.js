import { TradingService } from './tradingService.js';

export class BotManager {
  constructor() {
    this.bots = new Map(); // botId -> TradingService instance
    this.strategyBots = new Map(); // strategyType -> Set of botIds
    this.clients = new Set();
    this.activeBotId = null;
    this.maxBotsPerStrategy = 6;
  }

  addClient(ws) {
    this.clients.add(ws);
    // Send initial state to new client
    ws.send(JSON.stringify({
      type: 'botManagerState',
      data: this.getManagerState()
    }));
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }

  broadcast(message) {
    const messageString = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(messageString);
      }
    });
  }

  createBot(strategyType, botName, config = {}) {
    // Check if we've reached the max for this strategy
    const strategyBotSet = this.strategyBots.get(strategyType) || new Set();
    if (strategyBotSet.size >= this.maxBotsPerStrategy) {
      throw new Error(`Maximum ${this.maxBotsPerStrategy} bots per strategy reached`);
    }

    // Generate bot ID
    const botNumber = strategyBotSet.size + 1;
    const botId = `${strategyType}-bot-${botNumber}`;
    
    // Create new trading service instance for this bot
    const botService = new TradingService();
    botService.botId = botId;
    botService.botName = botName || `Bot ${botNumber}`;
    
    // Store bot
    this.bots.set(botId, botService);
    
    // Update strategy bot mapping
    if (!this.strategyBots.has(strategyType)) {
      this.strategyBots.set(strategyType, new Set());
    }
    this.strategyBots.get(strategyType).add(botId);

    // Set as active if it's the first bot
    if (!this.activeBotId) {
      this.activeBotId = botId;
    }

    // Broadcast update
    this.broadcast({
      type: 'botCreated',
      data: {
        botId,
        botName: botService.botName,
        strategyType,
        isActive: botId === this.activeBotId
      }
    });

    console.log(`Created bot ${botId} for strategy ${strategyType}`);
    return botId;
  }

  selectBot(botId) {
    if (!this.bots.has(botId)) {
      throw new Error(`Bot ${botId} not found`);
    }

    this.activeBotId = botId;
    
    // Broadcast update
    this.broadcast({
      type: 'botSelected',
      data: {
        botId,
        status: this.getActiveBot()?.getStatus()
      }
    });

    console.log(`Selected bot ${botId}`);
  }

  getActiveBot() {
    return this.activeBotId ? this.bots.get(this.activeBotId) : null;
  }

  getBot(botId) {
    return this.bots.get(botId);
  }

  deleteBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) return;

    // Stop trading if running
    if (bot.isRunning) {
      bot.stopTrading();
    }

    // Clean up bot
    bot.cleanup();

    // Remove from maps
    this.bots.delete(botId);
    
    // Remove from strategy mapping
    for (const [strategyType, botSet] of this.strategyBots.entries()) {
      if (botSet.has(botId)) {
        botSet.delete(botId);
        if (botSet.size === 0) {
          this.strategyBots.delete(strategyType);
        }
        break;
      }
    }

    // Select another bot if this was active
    if (this.activeBotId === botId) {
      this.activeBotId = this.bots.keys().next().value || null;
    }

    // Broadcast update
    this.broadcast({
      type: 'botDeleted',
      data: { botId }
    });

    console.log(`Deleted bot ${botId}`);
  }

  // Initialize default bots for each strategy
  initializeDefaultBots() {
    const strategies = [
      'reverse-ratio',
      'grid-trading',
      'rsi-mean-reversion',
      'dca',
      'vwap-bounce',
      'micro-scalping',
      'proper-scalping'
    ];

    strategies.forEach(strategy => {
      // Create 6 bots for each strategy
      for (let i = 1; i <= this.maxBotsPerStrategy; i++) {
        try {
          this.createBot(strategy, `Bot ${i}`, {});
        } catch (error) {
          console.error(`Failed to create bot for ${strategy}:`, error);
        }
      }
    });

    console.log(`Initialized ${this.bots.size} default bots`);
  }

  // Get state for a specific strategy
  getStrategyBots(strategyType) {
    const botIds = this.strategyBots.get(strategyType) || new Set();
    return Array.from(botIds).map(botId => {
      const bot = this.bots.get(botId);
      const status = bot.getStatus();
      return {
        id: botId,
        name: bot.botName,
        state: {
          isRunning: status.isRunning,
          isPaused: status.isPaused,
          balance: status.balance,
          trades: status.trades || [],
          positions: status.positions || []
        }
      };
    });
  }

  // Get complete manager state
  getManagerState() {
    const state = {
      activeBotId: this.activeBotId,
      bots: {},
      strategyBots: {}
    };

    // Convert strategy bots map
    for (const [strategy, botSet] of this.strategyBots.entries()) {
      state.strategyBots[strategy] = Array.from(botSet);
    }

    // Get all bot states
    for (const [botId, bot] of this.bots.entries()) {
      state.bots[botId] = {
        id: botId,
        name: bot.botName,
        status: bot.getStatus()
      };
    }

    return state;
  }

  // Forward trading commands to active bot
  startTrading(config) {
    const bot = this.getActiveBot();
    if (!bot) {
      throw new Error('No active bot selected');
    }
    return bot.startTrading(config);
  }

  stopTrading() {
    const bot = this.getActiveBot();
    if (!bot) {
      throw new Error('No active bot selected');
    }
    return bot.stopTrading();
  }

  pauseTrading() {
    const bot = this.getActiveBot();
    if (!bot) {
      throw new Error('No active bot selected');
    }
    return bot.pauseTrading();
  }

  resumeTrading() {
    const bot = this.getActiveBot();
    if (!bot) {
      throw new Error('No active bot selected');
    }
    return bot.resumeTrading();
  }

  updateStrategy(strategy) {
    const bot = this.getActiveBot();
    if (!bot) {
      throw new Error('No active bot selected');
    }
    return bot.updateStrategy(strategy);
  }

  getStatus() {
    const bot = this.getActiveBot();
    if (!bot) {
      return {
        isRunning: false,
        isPaused: false,
        activeBotId: null,
        message: 'No active bot'
      };
    }
    return {
      ...bot.getStatus(),
      activeBotId: this.activeBotId,
      botName: bot.botName
    };
  }

  // Clean up all bots
  cleanup() {
    console.log('Cleaning up bot manager...');
    for (const [botId, bot] of this.bots.entries()) {
      if (bot.isRunning) {
        bot.stopTrading();
      }
      bot.cleanup();
    }
    this.bots.clear();
    this.strategyBots.clear();
    this.clients.clear();
  }
}