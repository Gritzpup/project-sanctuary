#!/bin/bash

echo "Updating all import paths after filesystem reorganization..."

# Update CollapsibleSidebar imports (already done, but make sure)
find src -name "*.svelte" -exec sed -i "s|from '\./CollapsibleSidebar\.svelte'|from '../components/layout/CollapsibleSidebar.svelte'|g" {} \;

# Update API service imports
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/coinbaseApi'|from '../services/api/coinbaseApi'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./coinbaseApi'|from './api/coinbaseApi'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./coinbaseApi'|from '../api/coinbaseApi'|g" {} \;

find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/coinbaseWebSocket'|from '../services/api/coinbaseWebSocket'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./coinbaseWebSocket'|from './api/coinbaseWebSocket'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./coinbaseWebSocket'|from '../api/coinbaseWebSocket'|g" {} \;

find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/newsService'|from '../services/api/newsService'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./newsService'|from './api/newsService'|g" {} \;

# Update state service imports
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/paperTradingManager'|from '../services/state/paperTradingManager'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./paperTradingManager'|from './state/paperTradingManager'|g" {} \;

find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/tradingBackendService'|from '../services/state/tradingBackendService'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./tradingBackendService'|from './state/tradingBackendService'|g" {} \;

find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/vaultService'|from '../services/state/vaultService'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./vaultService'|from './state/vaultService'|g" {} \;

# Update data service imports
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/historicalDataLoader'|from '../services/data/historicalDataLoader'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./historicalDataLoader'|from './data/historicalDataLoader'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./historicalDataLoader'|from '../data/historicalDataLoader'|g" {} \;

find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/realtimeCandleAggregator'|from '../services/data/realtimeCandleAggregator'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./realtimeCandleAggregator'|from './data/realtimeCandleAggregator'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./realtimeCandleAggregator'|from '../data/realtimeCandleAggregator'|g" {} \;

find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./services/candleAggregator'|from '../services/data/candleAggregator'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\./candleAggregator'|from './data/candleAggregator'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./candleAggregator'|from '../data/candleAggregator'|g" {} \;

# Update backtesting component imports
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./components/BacktestChart'|from '../components/backtesting/BacktestChart'|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|from '\.\./components/BacktestStats'|from '../components/backtesting/BacktestStats'|g" {} \;

# Update page references (remove Refactored)
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|BacktestingRefactored|Backtesting|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|PaperTradingRefactored|PaperTrading|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|VaultRefactored|Vault|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|NewsRefactored|News|g" {} \;
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i "s|ChartRefactored|Chart|g" {} \;

echo "Import paths updated!"