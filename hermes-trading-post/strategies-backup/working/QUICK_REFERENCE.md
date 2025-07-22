# 🚀 WORKING STRATEGY - QUICK REFERENCE

## Grid Trading v1 - THE ONE THAT WORKS! ✅

### Quick Setup
1. Go to Backtesting page
2. Default settings already configured
3. Click "Run Backtest"
4. Watch the profits roll in!

### Key Numbers That Work
- **Position Size**: 8% per level
- **Max Levels**: 12 
- **Profit Target**: 0.85%
- **Entry**: 0.02% drop
- **Grid Spacing**: 0.015%

### Why It Works
```
OLD WAY (BROKEN):
Buy 1: $250 (25% of $1000)
Buy 2: $281 (37.5% of $750 left)
Buy 3: NO MONEY LEFT! ❌

NEW WAY (WORKING):
Buy 1: $80 (8% of $1000)
Buy 2: $80 (8% of $1000)
Buy 3-12: $80 each ✅
```

### Profit Math
- Gross: 0.85%
- Fees: -0.825%
- **Net: +0.025% per trade**
- 40 trades/day = 1% daily!

### DON'T CHANGE THESE:
- `ratioMultiplier` MUST be 1.0
- `basePositionPercent` × `maxLevels` ≤ 96%
- Profit target MUST be ≥ 0.85%

### Files
- Full docs: `grid-trading-v1-2025-01-22.md`
- Parameters: `grid-trading-v1-params.json`
- Code backup: `ReverseRatioStrategy-v1-2025-01-22.ts`

### Restore Command
```bash
cd strategies-backup
node restore-strategy.js grid-trading-v1
```

---
**Remember**: This strategy is PROVEN TO WORK. Always test changes against this baseline!