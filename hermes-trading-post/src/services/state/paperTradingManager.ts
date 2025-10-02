/**
 * @file paperTradingManager.ts
 * @description Manages multiple paper trading bot instances
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { PaperTradingService, type PaperTradingState } from '../paper-trading';
import { Strategy } from '../../strategies/base/Strategy';
import { tradingBackendService } from './tradingBackendService';

export interface BotInstance {
  id: string;
  name: string;
  strategyType: string;
  service: PaperTradingService;
  state: PaperTradingState;
}

export interface BotManagerState {
  selectedStrategy: string;
  activeTabId: string;
  bots: Record<string, BotInstance[]>; // Keyed by strategy type
}

class PaperTradingManager {
  private state: Writable<BotManagerState>;
  private maxBotsPerStrategy = 6;

  constructor() {
    // Initialize state
    this.state = writable<BotManagerState>({
      selectedStrategy: 'reverse-ratio',
      activeTabId: '',
      bots: {
        'reverse-ratio': [],
        'grid-trading': [],
        'rsi-mean-reversion': [],
        'dca': [],
        'vwap-bounce': [],
        'micro-scalping': []
      }
    });

    // Load saved bot configurations
    this.loadSavedBots();
  }

  getState(): Writable<BotManagerState> {
    return this.state;
  }

  private createBotId(strategyType: string, index: number): string {
    return `${strategyType}-bot-${index + 1}`;
  }

  private createBotName(index: number): string {
    return `Bot ${index + 1}`;
  }

  initializeBotsForStrategy(strategyType: string): void {
    const state = get(this.state);
    
    // Only initialize if not already done
    if (state.bots[strategyType] && state.bots[strategyType].length > 0) {
      return;
    }

    const bots: BotInstance[] = [];
    
    for (let i = 0; i < this.maxBotsPerStrategy; i++) {
      const botId = this.createBotId(strategyType, i);
      const botName = this.createBotName(i);
      
      // Create a new paper trading service instance with bot ID
      const service = new PaperTradingService(botId);
      
      bots.push({
        id: botId,
        name: botName,
        strategyType,
        service,
        state: service.getInitialState()
      });
    }

    this.state.update(s => ({
      ...s,
      bots: {
        ...s.bots,
        [strategyType]: bots
      }
    }));

    // Set active bot
    if (state.activeTabId && state.activeTabId.startsWith(strategyType)) {
      // Restore the saved bot selection if it exists
      const savedBot = bots.find(bot => bot.id === state.activeTabId);
      if (savedBot) {
        this.selectBot(strategyType, state.activeTabId);
      } else {
        // Saved bot not found, select first bot
        this.selectBot(strategyType, bots[0].id);
      }
    } else if (!state.activeTabId) {
      // No saved selection, select first bot
      this.selectBot(strategyType, bots[0].id);
    }
  }

  selectStrategy(strategyType: string): void {
    this.state.update(s => ({
      ...s,
      selectedStrategy: strategyType
    }));

    // Initialize bots for this strategy if needed
    this.initializeBotsForStrategy(strategyType);

    // Select first bot of this strategy
    const state = get(this.state);
    const bots = state.bots[strategyType];
    if (bots && bots.length > 0) {
      this.selectBot(strategyType, bots[0].id);
    }
  }

  selectBot(strategyType: string, botId: string): void {
    this.state.update(s => ({
      ...s,
      activeTabId: botId
    }));

    // Save configuration immediately when bot is selected
    this.saveConfiguration();

    // Notify backend - retry if WebSocket is not ready
    const notifyBackend = () => {
      if (tradingBackendService.isConnected()) {
        tradingBackendService.selectBot(botId);
      } else {
        setTimeout(notifyBackend, 100);
      }
    };
    notifyBackend();
  }

  getActiveBot(): BotInstance | null {
    const state = get(this.state);
    const { selectedStrategy, activeTabId, bots } = state;
    
    if (!selectedStrategy || !activeTabId) return null;
    
    const strategyBots = bots[selectedStrategy];
    if (!strategyBots) return null;
    
    return strategyBots.find(bot => bot.id === activeTabId) || null;
  }

  getBotsForStrategy(strategyType: string): BotInstance[] {
    const state = get(this.state);
    return state.bots[strategyType] || [];
  }

  updateBotState(botId: string, newState: Partial<PaperTradingState>): void {
    this.state.update(s => {
      const updatedBots = { ...s.bots };
      
      // Find and update the bot across all strategies
      for (const strategyType in updatedBots) {
        const botIndex = updatedBots[strategyType].findIndex(bot => bot.id === botId);
        if (botIndex !== -1) {
          updatedBots[strategyType][botIndex].state = {
            ...updatedBots[strategyType][botIndex].state,
            ...newState
          };
          break;
        }
      }
      
      return {
        ...s,
        bots: updatedBots
      };
    });
  }

  private loadSavedBots(): void {
    // Load saved bot configurations from localStorage
    const savedConfig = localStorage.getItem('paperTrading_manager_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        
        // Restore selected strategy and active tab
        this.state.update(s => ({
          ...s,
          selectedStrategy: config.selectedStrategy || 'reverse-ratio',
          activeTabId: config.activeTabId || ''
        }));
        
        // Initialize saved strategies
        if (config.strategies) {
          config.strategies.forEach((strategyType: string) => {
            this.initializeBotsForStrategy(strategyType);
          });
        }
      } catch (error) {
        console.error('Failed to load saved bot configuration:', error);
      }
    }
  }

  saveConfiguration(): void {
    const state = get(this.state);
    const config = {
      selectedStrategy: state.selectedStrategy,
      activeTabId: state.activeTabId,
      strategies: Object.keys(state.bots).filter(key => 
        state.bots[key] && state.bots[key].length > 0
      )
    };
    
    localStorage.setItem('paperTrading_manager_config', JSON.stringify(config));
  }
}

// Export singleton instance
export const paperTradingManager = new PaperTradingManager();