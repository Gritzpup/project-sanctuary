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
    try {
      ws.send(JSON.stringify({
        type: 'botManagerState',
        data: this.getManagerState()
      }));
    } catch (error) {
      // Client might have disconnected
      this.clients.delete(ws);
    }
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
    
    // Create new trading service instance for this bot with ID
    const botService = new TradingService(botId);
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

    return botId;
  }

  selectBot(botId) {
    if (!this.bots.has(botId)) {
      throw new Error(`Bot ${botId} not found`);
    }

    this.activeBotId = botId;
    
    // Get bot status for logging
    const bot = this.getActiveBot();
    const status = bot?.getStatus();
    
    // Broadcast update
    this.broadcast({
      type: 'botSelected',
      data: {
        botId,
        status: status
      }
    });
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

  }

  // Initialize default bots for each strategy
  async initializeDefaultBots() {
    const strategies = [
      'reverse-descending-grid',
      'grid-trading',
      'rsi-mean-reversion',
      'dca',
      'vwap-bounce',
      'micro-scalping',
      'proper-scalping',
      'ultra-micro-scalping',
      'test'
    ];

    // First, check which bots already exist by looking for state files
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const dataDir = path.join(__dirname, '../../data');
    
    // Track which bots need to be restarted
    const botsToRestart = [];

    for (const strategy of strategies) {
      // Create 6 bots for each strategy
      for (let i = 1; i <= this.maxBotsPerStrategy; i++) {
        const botId = `${strategy}-bot-${i}`;
        const stateFile = path.join(dataDir, `trading-state-${botId}.json`);
        
        try {
          // Check if state file exists
          const stateData = await fs.readFile(stateFile, 'utf8');
          const state = JSON.parse(stateData);
          
          // Create the bot
          this.createBot(strategy, `Bot ${i}`, {});
          
          // If it was running, mark it for restart
          if (state.isRunning && !state.isPaused && state.strategyConfig) {
            // Extract the actual strategy params from nested config
            let actualConfig = state.strategyConfig;
            let strategyParams = state.strategyParams;
            
            // If we have saved strategyParams, use those directly
            if (strategyParams) {
              botsToRestart.push({
                botId,
                strategyConfig: {
                  strategyType: state.strategyType || 'reverse-descending-grid',
                  strategyConfig: strategyParams
                }
              });
            } else {
              // Otherwise use the nested config
              botsToRestart.push({
                botId,
                strategyConfig: actualConfig
              });
            }
          }
        } catch (error) {
          // State file doesn't exist or is invalid, just create the bot
          try {
            this.createBot(strategy, `Bot ${i}`, {});
          } catch (createError) {
          }
        }
      }
    }

    
    // Wait a bit for all bots to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Restart bots that were running
    for (const { botId, strategyConfig } of botsToRestart) {
      const bot = this.bots.get(botId);
      if (bot) {
        try {
          // Make sure bot is not marked as running yet
          bot.isRunning = false;
          bot.startTrading(strategyConfig);
        } catch (error) {
        }
      }
    }
    
    // Log final status after a delay
    // setTimeout(() => {
    //   let runningCount = 0;
    //   for (const [botId, bot] of this.bots.entries()) {
    //     const status = bot.getStatus();
    //     if (status.isRunning) {
    //       runningCount++;
    //     }
    //   }
    // }, 2000);
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
    //   activeBotId: this.activeBotId,
    //   config
    // });
    
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

  updateRealtimePrice(price, productId) {
    // Update ALL bots with the real-time price (not just running ones)
    // This ensures bots waiting for initial price can start
    for (const [botId, bot] of this.bots.entries()) {
      bot.updateRealtimePrice(price, productId);
    }
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
    const status = bot.getStatus();
    return {
      ...status,
      activeBotId: this.activeBotId,
      botName: bot.botName
    };
  }

  // Clean up all bots
  cleanup() {
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