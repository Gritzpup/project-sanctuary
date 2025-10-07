/**
 * Trading operation handlers for Paper Trading
 */

import { tradingBackendService } from '../../../services/state/tradingBackendService';
import { builtInStrategies, DEFAULT_STRATEGY_CONFIG, DEFAULT_BALANCE } from '../constants/StrategyConstants';
import type { TradingState } from '../types/TradingTypes';
import { ChartIntegration } from '../utils/ChartIntegration';

export class TradingOperations {
  public static async handleStrategyChange(strategyType: string, tradingStateUpdater: (updater: (current: TradingState) => TradingState) => void) {
    console.log('🔄 Strategy change requested:', strategyType);
    
    tradingStateUpdater(current => ({
      ...current,
      selectedStrategyType: strategyType
    }));
    
    try {
      // Update strategy parameters for current session
      await tradingBackendService.updateStrategy(strategyType);
      
      // Persist strategy selection in backend database for this bot
      await tradingBackendService.updateSelectedStrategy(strategyType);
      
      console.log('✅ Strategy updated and selection persisted successfully');
    } catch (error) {
      console.error('❌ Failed to update strategy:', error);
    }
  }

  public static async handleBalanceChange(balance: number, tradingStateUpdater: (updater: (current: TradingState) => TradingState) => void) {
    console.log('💰 Balance change requested:', balance);
    
    tradingStateUpdater(current => ({
      ...current,
      balance
    }));
    
    try {
      await tradingBackendService.updateBalance(balance);
      console.log('✅ Balance updated successfully');
    } catch (error) {
      console.error('❌ Failed to update balance:', error);
    }
  }

  public static async handleStartTrading(currentState: TradingState) {
    console.log('▶️ Starting trading...');
    
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
      console.log('✅ Trading started successfully');
    } catch (error) {
      console.error('❌ Failed to start trading:', error);
    }
  }

  public static async handlePauseTrading() {
    console.log('⏸️ Pausing trading...');
    
    try {
      await tradingBackendService.pauseTrading();
      console.log('✅ Trading paused successfully');
    } catch (error) {
      console.error('❌ Failed to pause trading:', error);
    }
  }

  public static async handleResumeTrading() {
    console.log('▶️ Resuming trading...');
    
    try {
      await tradingBackendService.resumeTrading();
      console.log('✅ Trading resumed successfully');
    } catch (error) {
      console.error('❌ Failed to resume trading:', error);
    }
  }

  public static async handleStopTrading() {
    console.log('⏹️ Stopping trading...');
    
    try {
      await tradingBackendService.stopTrading();
      console.log('✅ Trading stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop trading:', error);
    }
  }

  public static async handleReset(
    tradingStateUpdater: (updater: (current: TradingState) => TradingState) => void,
    chartComponent?: any
  ) {
    console.log('🔄 Resetting trading state...');
    
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
      
      console.log('✅ Trading state reset successfully');
    } catch (error) {
      console.error('❌ Failed to reset trading state:', error);
    }
  }
}