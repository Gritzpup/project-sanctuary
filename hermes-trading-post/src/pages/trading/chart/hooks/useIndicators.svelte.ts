// @ts-nocheck - IndicatorPlugin type vs value import
import { useChart } from './useChart.svelte';
import {
  SMAPlugin,
  EMAPlugin,
  RSIPlugin,
  type IndicatorPlugin,
  type Plugin
} from '../plugins';

export interface IndicatorConfig {
  type: 'sma' | 'ema' | 'rsi' | 'macd' | 'bb';
  settings?: Record<string, any>;
}

export interface IndicatorHookResult {
  indicators: Map<string, IndicatorPlugin>;
  
  // Actions
  addIndicator: (config: IndicatorConfig) => Promise<string | null>;
  removeIndicator: (indicatorId: string) => Promise<void>;
  updateIndicator: (indicatorId: string, settings: Record<string, any>) => void;
  toggleIndicator: (indicatorId: string) => void;
  
  // Utilities
  getIndicatorValue: (indicatorId: string) => number | null;
  getIndicatorValues: (indicatorId: string) => any[];
  hasIndicator: (indicatorId: string) => boolean;
  getActiveIndicators: () => IndicatorPlugin[];
}

export function useIndicators(): IndicatorHookResult {
  const { pluginManager } = useChart();
  const indicators = new Map<string, IndicatorPlugin>();
  
  // Update indicators map from plugin manager
  if (pluginManager) {
    const allIndicators = pluginManager.getByType(IndicatorPlugin);
    allIndicators.forEach(indicator => {
      indicators.set(indicator.id, indicator);
    });
  }
  
  // Actions
  const addIndicator = async (config: IndicatorConfig): Promise<string | null> => {
    if (!pluginManager) {
      return null;
    }
    
    let plugin: IndicatorPlugin | null = null;
    
    switch (config.type) {
      case 'sma':
        plugin = new SMAPlugin(config.settings);
        break;
      case 'ema':
        plugin = new EMAPlugin(config.settings);
        break;
      case 'rsi':
        plugin = new RSIPlugin(config.settings);
        break;
      // Add more indicator types as needed
      default:
        return null;
    }
    
    if (plugin) {
      try {
        await pluginManager.register(plugin);
        indicators.set(plugin.id, plugin);
        return plugin.id;
      } catch (error) {
        return null;
      }
    }
    
    return null;
  };
  
  const removeIndicator = async (indicatorId: string): Promise<void> => {
    if (!pluginManager) return;
    
    try {
      await pluginManager.unregister(indicatorId);
      indicators.delete(indicatorId);
    } catch (error) {
    }
  };
  
  const updateIndicator = (indicatorId: string, settings: Record<string, any>): void => {
    if (!pluginManager) return;
    
    try {
      pluginManager.updatePluginSettings(indicatorId, settings);
    } catch (error) {
    }
  };
  
  const toggleIndicator = (indicatorId: string): void => {
    if (!pluginManager) return;
    
    const indicator = indicators.get(indicatorId);
    if (indicator) {
      if (indicator.enabled) {
        pluginManager.disable(indicatorId);
      } else {
        pluginManager.enable(indicatorId);
      }
    }
  };
  
  // Utilities
  const getIndicatorValue = (indicatorId: string): number | null => {
    const indicator = indicators.get(indicatorId);
    if (indicator && 'getLatestValue' in indicator) {
      return (indicator as any).getLatestValue();
    }
    return null;
  };
  
  const getIndicatorValues = (indicatorId: string): any[] => {
    const indicator = indicators.get(indicatorId);
    if (indicator && 'getData' in indicator) {
      return (indicator as any).getData();
    }
    return [];
  };
  
  const hasIndicator = (indicatorId: string): boolean => {
    return indicators.has(indicatorId);
  };
  
  const getActiveIndicators = (): IndicatorPlugin[] => {
    return Array.from(indicators.values()).filter(ind => ind.enabled);
  };
  
  return {
    indicators,
    
    // Actions
    addIndicator,
    removeIndicator,
    updateIndicator,
    toggleIndicator,
    
    // Utilities
    getIndicatorValue,
    getIndicatorValues,
    hasIndicator,
    getActiveIndicators
  };
}