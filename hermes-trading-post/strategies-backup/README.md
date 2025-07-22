# Strategy Backup System

This folder contains backups of trading strategies that have been tested and proven to work. Each strategy is versioned and documented to prevent loss during future development.

## 📁 Folder Structure

```
strategies-backup/
├── working/              # Strategies confirmed profitable in backtesting
│   ├── *-v1-*.md        # Detailed documentation
│   ├── *-v1-*.ts        # Exact TypeScript code backup
│   └── *-v1-params.json # Configuration parameters
├── experimental/         # Strategies being tested
└── deprecated/          # Old strategies that no longer work
```

## 🎯 Purpose

1. **Preserve Working Strategies**: Never lose a profitable configuration
2. **Version Control**: Track evolution of strategies over time
3. **Quick Restore**: Easily revert to a known-good configuration
4. **Documentation**: Understand WHY a strategy works

## 📋 Current Working Strategies

### 1. Grid Trading v1 (2025-01-22) ✅
- **File**: `working/grid-trading-v1-2025-01-22.md`
- **Status**: PROFITABLE
- **Key Innovation**: Fixed position sizing using initial capital
- **Profit Target**: 0.85% (0.025% net after fees)
- **Success Rate**: 40-60% win rate with frequent small profits

## 🔧 How to Use

### Restore a Strategy
1. Find the strategy's parameter file (e.g., `grid-trading-v1-params.json`)
2. Copy the parameters to `Backtesting.svelte`
3. Or restore the entire TypeScript file from backup

### Add a New Working Strategy
1. Test thoroughly in backtesting
2. Document with markdown file including:
   - Parameters that work
   - Why it works
   - Backtest results
   - Important warnings
3. Backup the TypeScript implementation
4. Create JSON parameter file
5. Update this README

## ⚠️ Important Rules

1. **NEVER** modify files in the `working/` folder
2. **ALWAYS** create new versions instead of overwriting
3. **DOCUMENT** why the strategy works, not just parameters
4. **TEST** on multiple timeframes before marking as "working"

## 📊 Success Criteria

A strategy is considered "working" if:
- Positive returns after fees (0.825% net)
- Consistent performance across different time periods
- Reasonable drawdown (<5%)
- At least 10 trades in backtest
- Win rate > 30%