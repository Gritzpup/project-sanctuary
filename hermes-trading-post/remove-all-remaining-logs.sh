#!/bin/bash

# Remove ALL remaining console.log statements completely
# This is an aggressive cleanup to fix the memory leak

PROJECT_DIR="/home/ubuntubox/Documents/Github/project-sanctuary/hermes-trading-post"
cd "$PROJECT_DIR"

echo "Removing ALL remaining logging statements..."

# Files with heavy logging that need complete cleanup
FILES_TO_CLEAN=(
  "src/pages/trading/orderbook/components/DepthChart.svelte"
  "src/pages/trading/orderbook/stores/orderbookStore.svelte.ts"
  "src/pages/trading/chart/core/ChartCore.svelte"
  "src/pages/trading/chart/stores/dataStore.svelte.ts"
  "src/pages/trading/chart/components/canvas/ChartCanvas.svelte"
  "src/components/backtesting/BacktestChart.svelte"
  "src/features/paper-trading/components/controls/TradingStats.svelte"
  "src/pages/trading/chart/components/controls/services/ChartControlsService.svelte"
  "src/pages/trading/orderbook/components/FixedOrderbookList.svelte"
  "src/components/ErrorBoundary.svelte"
  "src/pages/trading/chart/components/overlays/ChartDebug.svelte"
)

for file in "${FILES_TO_CLEAN[@]}"; do
  if [ -f "$file" ]; then
    echo "Cleaning $file..."
    # Remove all console.* lines
    sed -i '/console\.\(log\|info\|warn\|error\|debug\)/d' "$file"
  fi
done

# Also clean all files that have logging through suppress-extension-errors
echo "Removing all logging proxies..."
find src/ -type f \( -name "*.ts" -o -name "*.svelte" -o -name "*.js" \) -exec sed -i '/console\.\(log\|info\|warn\|error\|debug\)/d' {} \;
find backend/ -type f \( -name "*.ts" -o -name "*.js" \) -exec sed -i '/console\.\(log\|info\|warn\|error\|debug\)/d' {} \;

echo "✅ All logging removed!"
