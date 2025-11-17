/**
 * Trading operation handlers for Paper Trading
 */

import { tradingBackendService } from '../../../services/state/tradingBackendService';
import { builtInStrategies, DEFAULT_STRATEGY_CONFIG, DEFAULT_BALANCE } from '../constants/StrategyConstants';
import type { TradingState } from '../types/TradingTypes';
import { ChartIntegration } from '../utils/ChartIntegration';

export class TradingOperations {
  public static async handleStrategyChange(strategyType: string, tradingStateUpdater: (updater: (current: TradingState) => TradingState) => void) {
    
    tradingStateUpdater(current => ({
      ...current,
      selectedStrategyType: strategyType
    }));
    
    try {
      // Update strategy parameters for current session
      await tradingBackendService.updateStrategy(strategyType);
      
      // Persist strategy selection in backend database for this bot
      await tradingBackendService.updateSelectedStrategy(strategyType);
      
    } catch (error) {
    }
  }

  public static async handleBalanceChange(balance: number, tradingStateUpdater: (updater: (current: TradingState) => TradingState) => void) {
    
    tradingStateUpdater(current => ({
      ...current,
      balance
    }));
    
    try {
      await tradingBackendService.updateBalance(balance);
    } catch (error) {
    }
  }

  public static async handleStartTrading(currentState: TradingState) {
    
    try {
      const selectedStrategy = builtInStrategies.find(s => s.value === currentState.selectedStrategyType);
      
      if (!selectedStrategy) {
        throw new Error(`No strategy found for type: ${currentState.selectedStrategyType}`);
      }
      
      const strategyConfig = {
        strategyType: selectedStrategy.value,
        strategyConfig: DEFAULT_STRATEGY_CONFIG
      };
      
      await tradingBackendService.startTrading(strategyConfig);
    } catch (error) {
    }
  }

  public static async handlePauseTrading() {
    
    try {
      await tradingBackendService.pauseTrading();
    } catch (error) {
    }
  }

  public static async handleResumeTrading() {
    
    try {
      await tradingBackendService.resumeTrading();
    } catch (error) {
    }
  }

  public static async handleStopTrading() {
    
    try {
      await tradingBackendService.stopTrading();
    } catch (error) {
    }
  }

  public static async handleReset(
    tradingStateUpdater: (updater: (current: TradingState) => TradingState) => void,
    chartComponent?: any
  ) {
    
    try {
      await tradingBackendService.resetTrading();
      
      // Reset local state
      tradingStateUpdater(current => ({
        ...current,
        isRunning: false,
        isPaused: false,
        trades: [],
        positions: [],
        balance: DEFAULT_BALANCE,
        totalReturn: 0,
        totalFees: 0
      }));
      
      // Clear chart markers
      ChartIntegration.clearChartMarkers(chartComponent);
      
    } catch (error) {
    }
  }
}