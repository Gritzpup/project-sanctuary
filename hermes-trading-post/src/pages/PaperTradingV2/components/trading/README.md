# Strategy Trading Components

This directory contains the extracted strategy-related components from PaperTrading.svelte:

## Components

### StrategySelector.svelte
Handles strategy selection with a dropdown interface.

**Props:**
- `selectedStrategyType: string` - Currently selected strategy type
- `strategies: Array` - Available strategies list
- `currentStrategy: Strategy | null` - Current strategy instance
- `disabled: boolean` - Disable the selector
- `syncIndicator: boolean` - Show sync indicator

**Events:**
- `strategyChange` - Fired when strategy selection changes

### StrategyParameters.svelte
Comprehensive parameter configuration interface with validation.

**Props:**
- `selectedStrategyType: string` - Strategy type to configure
- `strategyParameters: Record<string, any>` - Current parameter values
- `currentStrategy: Strategy | null` - Strategy instance
- `disabled: boolean` - Disable parameter inputs
- `showAdvanced: boolean` - Show advanced parameters

**Events:**
- `parametersChange` - Fired when parameters change with validation
- `resetToDefaults` - Fired when reset button is clicked

## Usage Example

```svelte
<script lang="ts">
  import { StrategySelector, StrategyParameters } from './components/trading';
  import type { Strategy } from '../../../strategies/base/Strategy';
  
  let selectedStrategyType = 'reverse-ratio';
  let strategyParameters = {};
  let currentStrategy: Strategy | null = null;
  let strategies = [
    {
      value: 'reverse-ratio',
      label: 'Reverse Ratio',
      description: 'Grid trading with reverse position sizing',
      isCustom: false
    },
    // ... more strategies
  ];

  function handleStrategyChange(event) {
    const { strategyType } = event.detail;
    selectedStrategyType = strategyType;
    // Create new strategy instance, reset parameters, etc.
  }

  function handleParametersChange(event) {
    const { parameters, validation } = event.detail;
    strategyParameters = parameters;
    
    if (validation.isValid) {
      // Apply parameters to strategy
    } else {
      console.log('Validation errors:', validation.errors);
    }
  }
</script>

<StrategySelector 
  bind:selectedStrategyType
  {strategies}
  {currentStrategy}
  on:strategyChange={handleStrategyChange}
/>

<StrategyParameters
  {selectedStrategyType}
  bind:strategyParameters
  {currentStrategy}
  on:parametersChange={handleParametersChange}
  on:resetToDefaults={handleParametersReset}
/>
```

## Parameter Definitions

The StrategyParameters component includes built-in parameter definitions for:

- **reverse-ratio**: Ultra micro-scalping with hair-trigger entries
- **grid-trading**: Regular price interval grid trading
- **rsi-mean-reversion**: RSI-based mean reversion trading
- **dca**: Dollar cost averaging
- **vwap-bounce**: VWAP support/resistance trading

Each strategy's parameters are organized by categories:
- 📈 Entry Conditions
- 📉 Exit Conditions  
- 💰 Position Sizing
- ⚠️ Risk Management
- 📊 Technical Indicators
- 🎯 Signal Settings
- ⏰ Timing
- 🔧 Advanced Settings

## Integration with PaperTrading

These components are designed to be drop-in replacements for the strategy-related functionality in PaperTrading.svelte. They maintain the same event interfaces and data structures for seamless integration.

## Strategy Creation Functions

The components work with the existing strategy creation pattern:

```typescript
function createStrategy(type: string, parameters: Record<string, any>): Strategy {
  switch (type) {
    case 'reverse-ratio':
      return new ReverseRatioStrategy(parameters);
    case 'grid-trading':
      return new GridTradingStrategy(parameters);
    // ... etc
    default:
      throw new Error(`Unknown strategy type: ${type}`);
  }
}
```