<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Strategy } from '../../../../strategies/base/Strategy';

  // Props
  export let selectedStrategyType: string = 'reverse-ratio';
  export let strategyParameters: Record<string, any> = {};
  export let currentStrategy: Strategy | null = null;
  export let disabled: boolean = false;
  export let showAdvanced: boolean = false;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    parametersChange: {
      strategyType: string;
      parameters: Record<string, any>;
      validation: { isValid: boolean; errors: string[] };
    };
    resetToDefaults: {
      strategyType: string;
    };
  }>();

  // Parameter definitions for each strategy
  const parameterDefinitions: Record<string, any> = {
    'reverse-ratio': {
      title: 'Reverse Ratio Strategy',
      description: 'Hair-trigger entries on micro-dips with increasing position sizes',
      parameters: [
        {
          key: 'initialDropPercent',
          label: 'Initial Drop %',
          type: 'number',
          default: 0.1,
          min: 0.01,
          max: 5,
          step: 0.01,
          description: 'Percentage drop from recent high to trigger first buy',
          category: 'entry'
        },
        {
          key: 'levelDropPercent',
          label: 'Level Drop %',
          type: 'number',
          default: 0.1,
          min: 0.01,
          max: 2,
          step: 0.01,
          description: 'Percentage drop between each buy level',
          category: 'entry'
        },
        {
          key: 'ratioMultiplier',
          label: 'Ratio Multiplier',
          type: 'number',
          default: 2,
          min: 1,
          max: 5,
          step: 0.1,
          description: 'Position size multiplier for each level',
          category: 'sizing'
        },
        {
          key: 'profitTarget',
          label: 'Profit Target %',
          type: 'number',
          default: 0.85,
          min: 0.1,
          max: 10,
          step: 0.05,
          description: 'Percentage above average entry to sell all positions',
          category: 'exit'
        },
        {
          key: 'maxLevels',
          label: 'Max Levels',
          type: 'number',
          default: 12,
          min: 3,
          max: 20,
          step: 1,
          description: 'Maximum number of buy levels',
          category: 'risk'
        },
        {
          key: 'basePositionPercent',
          label: 'Base Position %',
          type: 'number',
          default: 6,
          min: 1,
          max: 50,
          step: 1,
          description: 'Percentage of balance for first level',
          category: 'sizing'
        },
        {
          key: 'maxPositionPercent',
          label: 'Max Position %',
          type: 'number',
          default: 90,
          min: 10,
          max: 100,
          step: 5,
          description: 'Maximum percentage of balance across all levels',
          category: 'risk'
        },
        {
          key: 'vaultAllocation',
          label: 'Vault Allocation %',
          type: 'number',
          default: 85.7,
          min: 0,
          max: 100,
          step: 0.1,
          description: 'Percentage of profit to move to vault',
          category: 'advanced'
        },
        {
          key: 'btcGrowthAllocation',
          label: 'BTC Growth %',
          type: 'number',
          default: 14.3,
          min: 0,
          max: 100,
          step: 0.1,
          description: 'Percentage of profit to keep in BTC',
          category: 'advanced'
        }
      ]
    },
    'grid-trading': {
      title: 'Grid Trading Strategy',
      description: 'Places buy and sell orders at regular price intervals',
      parameters: [
        {
          key: 'gridLevels',
          label: 'Grid Levels',
          type: 'number',
          default: 10,
          min: 3,
          max: 50,
          step: 1,
          description: 'Number of grid levels',
          category: 'grid'
        },
        {
          key: 'gridSpacing',
          label: 'Grid Spacing %',
          type: 'number',
          default: 2,
          min: 0.1,
          max: 10,
          step: 0.1,
          description: 'Percentage spacing between grid levels',
          category: 'grid'
        },
        {
          key: 'positionSizePerGrid',
          label: 'Position Size Per Grid %',
          type: 'number',
          default: 10,
          min: 1,
          max: 50,
          step: 1,
          description: 'Percentage of balance per grid level',
          category: 'sizing'
        },
        {
          key: 'autoAdjustBounds',
          label: 'Auto Adjust Bounds',
          type: 'boolean',
          default: true,
          description: 'Automatically adjust grid bounds based on volatility',
          category: 'grid'
        },
        {
          key: 'vaultAllocation',
          label: 'Vault Allocation %',
          type: 'number',
          default: 95,
          min: 0,
          max: 100,
          step: 1,
          description: 'Percentage of profit to move to vault',
          category: 'advanced'
        }
      ]
    },
    'rsi-mean-reversion': {
      title: 'RSI Mean Reversion Strategy',
      description: 'Trades RSI oversold/overbought conditions',
      parameters: [
        {
          key: 'rsiPeriod',
          label: 'RSI Period',
          type: 'number',
          default: 14,
          min: 5,
          max: 50,
          step: 1,
          description: 'Number of periods for RSI calculation',
          category: 'indicator'
        },
        {
          key: 'oversoldLevel',
          label: 'Oversold Level',
          type: 'number',
          default: 30,
          min: 10,
          max: 40,
          step: 1,
          description: 'RSI level to trigger buy signal',
          category: 'indicator'
        },
        {
          key: 'overboughtLevel',
          label: 'Overbought Level',
          type: 'number',
          default: 70,
          min: 60,
          max: 90,
          step: 1,
          description: 'RSI level to trigger sell signal',
          category: 'indicator'
        },
        {
          key: 'positionSize',
          label: 'Position Size %',
          type: 'number',
          default: 50,
          min: 10,
          max: 100,
          step: 5,
          description: 'Percentage of balance per trade',
          category: 'sizing'
        },
        {
          key: 'confirmationCandles',
          label: 'Confirmation Candles',
          type: 'number',
          default: 2,
          min: 0,
          max: 10,
          step: 1,
          description: 'Number of candles to confirm reversal',
          category: 'signal'
        },
        {
          key: 'useDivergence',
          label: 'Use Divergence',
          type: 'boolean',
          default: true,
          description: 'Look for price/RSI divergence signals',
          category: 'signal'
        }
      ]
    },
    // Add more strategies as needed
    'dca': {
      title: 'Dollar Cost Averaging',
      description: 'Regular periodic purchases',
      parameters: [
        {
          key: 'intervalMinutes',
          label: 'Interval (minutes)',
          type: 'number',
          default: 60,
          min: 1,
          max: 1440,
          step: 1,
          description: 'Time between purchases in minutes',
          category: 'timing'
        },
        {
          key: 'purchaseAmount',
          label: 'Purchase Amount %',
          type: 'number',
          default: 5,
          min: 1,
          max: 25,
          step: 0.5,
          description: 'Percentage of balance to purchase each interval',
          category: 'sizing'
        }
      ]
    },
    'vwap-bounce': {
      title: 'VWAP Bounce Strategy',
      description: 'Trade VWAP support/resistance levels',
      parameters: [
        {
          key: 'vwapPeriod',
          label: 'VWAP Period',
          type: 'number',
          default: 20,
          min: 10,
          max: 100,
          step: 5,
          description: 'Period for VWAP calculation',
          category: 'indicator'
        },
        {
          key: 'bounceThreshold',
          label: 'Bounce Threshold %',
          type: 'number',
          default: 0.5,
          min: 0.1,
          max: 2,
          step: 0.1,
          description: 'Percentage deviation from VWAP to trigger trade',
          category: 'signal'
        }
      ]
    }
  };

  // Get current strategy definition
  $: strategyDef = parameterDefinitions[selectedStrategyType] || {
    title: 'Unknown Strategy',
    description: 'No parameter configuration available',
    parameters: []
  };

  // Group parameters by category
  $: parametersByCategory = strategyDef.parameters.reduce((acc: Record<string, any[]>, param: any) => {
    const category = param.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(param);
    return acc;
  }, {});

  // Filter parameters based on advanced mode
  $: visibleCategories = Object.keys(parametersByCategory).filter(category => 
    showAdvanced || category !== 'advanced'
  );

  // Validation
  function validateParameters(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const param of strategyDef.parameters) {
      const value = strategyParameters[param.key];
      
      if (value === undefined || value === null || value === '') {
        errors.push(`${param.label} is required`);
        continue;
      }
      
      if (param.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push(`${param.label} must be a valid number`);
        } else {
          if (param.min !== undefined && numValue < param.min) {
            errors.push(`${param.label} must be at least ${param.min}`);
          }
          if (param.max !== undefined && numValue > param.max) {
            errors.push(`${param.label} must be at most ${param.max}`);
          }
        }
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  // Handle parameter change
  function handleParameterChange(key: string, value: any) {
    strategyParameters[key] = value;
    const validation = validateParameters();
    
    dispatch('parametersChange', {
      strategyType: selectedStrategyType,
      parameters: { ...strategyParameters },
      validation
    });
  }

  // Reset to defaults
  function resetToDefaults() {
    const defaultParams: Record<string, any> = {};
    for (const param of strategyDef.parameters) {
      defaultParams[param.key] = param.default;
    }
    strategyParameters = { ...defaultParams };
    
    dispatch('resetToDefaults', {
      strategyType: selectedStrategyType
    });
    
    dispatch('parametersChange', {
      strategyType: selectedStrategyType,
      parameters: { ...strategyParameters },
      validation: { isValid: true, errors: [] }
    });
  }

  // Initialize defaults if no parameters are set
  function initializeDefaults() {
    if (Object.keys(strategyParameters).length === 0) {
      resetToDefaults();
    }
  }

  // Initialize when strategy type changes
  $: if (selectedStrategyType && strategyDef.parameters.length > 0) {
    initializeDefaults();
  }

  // Category display names
  const categoryNames: Record<string, string> = {
    entry: '📈 Entry Conditions',
    exit: '📉 Exit Conditions',
    sizing: '💰 Position Sizing',
    risk: '⚠️ Risk Management',
    indicator: '📊 Technical Indicators',
    signal: '🎯 Signal Settings',
    timing: '⏰ Timing',
    grid: '🔲 Grid Settings',
    advanced: '🔧 Advanced Settings',
    general: '⚙️ General Settings'
  };
</script>

<div class="strategy-parameters">
  <div class="parameters-header">
    <div class="strategy-info">
      <h3>{strategyDef.title}</h3>
      <p class="strategy-description">{strategyDef.description}</p>
    </div>
    <div class="parameters-controls">
      {#if strategyDef.parameters.length > 0}
        <label class="advanced-toggle">
          <input type="checkbox" bind:checked={showAdvanced} />
          <span>Show Advanced</span>
        </label>
        <button 
          type="button" 
          class="reset-btn"
          on:click={resetToDefaults}
          {disabled}
          title="Reset all parameters to default values"
        >
          Reset to Defaults
        </button>
      {/if}
    </div>
  </div>

  {#if strategyDef.parameters.length === 0}
    <div class="no-parameters">
      <p>This strategy has no configurable parameters.</p>
    </div>
  {:else}
    <div class="parameters-form" class:disabled>
      {#each visibleCategories as category}
        <div class="parameter-category">
          <h4 class="category-title">
            {categoryNames[category] || category}
          </h4>
          <div class="category-parameters">
            {#each parametersByCategory[category] as param}
              <div class="parameter-field">
                <label>
                  <span class="parameter-label">
                    {param.label}
                    {#if param.description}
                      <span class="parameter-tooltip" title={param.description}>?</span>
                    {/if}
                  </span>
                  
                  {#if param.type === 'number'}
                    <input
                      type="number"
                      min={param.min}
                      max={param.max}
                      step={param.step || 'any'}
                      value={strategyParameters[param.key] ?? param.default}
                      on:input={(e) => handleParameterChange(param.key, Number(e.target.value))}
                      {disabled}
                    />
                  {:else if param.type === 'boolean'}
                    <div class="checkbox-wrapper">
                      <input
                        type="checkbox"
                        checked={strategyParameters[param.key] ?? param.default}
                        on:change={(e) => handleParameterChange(param.key, e.target.checked)}
                        {disabled}
                      />
                      <span class="checkmark"></span>
                    </div>
                  {:else if param.type === 'select'}
                    <select
                      value={strategyParameters[param.key] ?? param.default}
                      on:change={(e) => handleParameterChange(param.key, e.target.value)}
                      {disabled}
                    >
                      {#each param.options as option}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  {:else}
                    <input
                      type="text"
                      value={strategyParameters[param.key] ?? param.default}
                      on:input={(e) => handleParameterChange(param.key, e.target.value)}
                      {disabled}
                    />
                  {/if}
                </label>
                
                {#if param.description}
                  <div class="parameter-description">
                    {param.description}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .strategy-parameters {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .parameters-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #374151;
  }

  .strategy-info h3 {
    margin: 0 0 4px 0;
    color: #f3f4f6;
    font-size: 16px;
    font-weight: 600;
  }

  .strategy-description {
    margin: 0;
    color: #9ca3af;
    font-size: 13px;
    font-style: italic;
  }

  .parameters-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .advanced-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #e5e7eb;
    cursor: pointer;
  }

  .advanced-toggle input[type="checkbox"] {
    margin: 0;
  }

  .reset-btn {
    padding: 6px 12px;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #f3f4f6;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reset-btn:hover:not(:disabled) {
    background: #4b5563;
    border-color: #6b7280;
  }

  .reset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .no-parameters {
    padding: 24px;
    text-align: center;
    background: rgba(55, 65, 81, 0.3);
    border-radius: 8px;
    color: #9ca3af;
  }

  .parameters-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .parameters-form.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .parameter-category {
    background: rgba(55, 65, 81, 0.3);
    border-radius: 8px;
    padding: 16px;
  }

  .category-title {
    margin: 0 0 12px 0;
    color: #e5e7eb;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .category-parameters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .parameter-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .parameter-field label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .parameter-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 500;
  }

  .parameter-tooltip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    background: #4b5563;
    color: #f3f4f6;
    border-radius: 50%;
    font-size: 10px;
    font-weight: bold;
    cursor: help;
  }

  .parameter-field input,
  .parameter-field select {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    padding: 6px 8px;
    color: #f3f4f6;
    font-size: 13px;
  }

  .parameter-field input:focus,
  .parameter-field select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
  }

  .checkbox-wrapper input[type="checkbox"] {
    margin: 0;
    width: auto;
    height: auto;
  }

  .parameter-description {
    color: #9ca3af;
    font-size: 11px;
    font-style: italic;
    margin-top: 2px;
  }
</style>