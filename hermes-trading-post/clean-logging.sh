#!/bin/bash

echo "🧹 Cleaning excessive console logging..."

# Get the current directory
cd "$(dirname "$0")"

# Function to clean file
clean_file() {
    local file="$1"
    local original_count=$(grep -c "console\." "$file" 2>/dev/null || echo 0)
    
    if [ "$original_count" -gt 5 ]; then
        echo "Cleaning $file ($original_count console statements)"
        
        # Remove verbose logging patterns while keeping errors and essential chart logs
        sed -i '/console\.log.*🔄.*refreshData called/d' "$file"
        sed -i '/console\.log.*🔄.*Getting data\.\.\./d' "$file"
        sed -i '/console\.log.*🔔.*notifyDataUpdate called/d' "$file"
        sed -i '/console\.log.*🔔.*Calling data update callback/d' "$file"
        sed -i '/console\.log.*🔔.*Callback.*completed successfully/d' "$file"
        sed -i '/console\.log.*🔔.*All data update callbacks completed/d' "$file"
        sed -i '/console\.log.*🔔.*subscribeToData called/d' "$file"
        sed -i '/console\.log.*🔔.*Got dataStore/d' "$file"
        sed -i '/console\.log.*🔔.*Calling initial refreshData/d' "$file"
        sed -i '/console\.log.*🔔.*Subscribing to data updates/d' "$file"
        sed -i '/console\.log.*🔔.*Data subscription complete/d' "$file"
        sed -i '/console\.log.*⚠️.*No data to set/d' "$file"
        sed -i '/console\.log.*📊.*Setting.*candles/d' "$file"
        sed -i '/console\.log.*📊.*First candle:/d' "$file"
        sed -i '/console\.log.*📊.*Last candle:/d' "$file"
        sed -i '/console\.log.*📊.*Volume check/d' "$file"
        sed -i '/console\.log.*📊.*Candles with volume data/d' "$file"
        sed -i '/console\.log.*🔄.*Received real-time update/d' "$file"
        sed -i '/console\.log.*🔄.*Formatted candle data/d' "$file"
        sed -i '/console\.log.*🔄.*Updating existing candle/d' "$file"
        sed -i '/console\.log.*🔄.*Added new candle/d' "$file"
        sed -i '/console\.log.*🔄.*Notifying plugins/d' "$file"
        sed -i '/console\.log.*✅.*Plugins notified/d' "$file"
        sed -i '/console\.log.*📊.*Updated DB count/d' "$file"
        sed -i '/console\.log.*📊.*Redis has.*candles/d' "$file"
        sed -i '/console\.log.*🐛.*Debug/d' "$file"
        sed -i '/console\.log.*\[DataStore Debug\]/d' "$file"
        
        # Remove performance logs that aren't chart-related
        sed -i '/console\.log.*\[PERF\]/d' "$file"
        
        # Remove strategy verbose logging
        sed -i '/console\.log.*Strategy.*analyzing/d' "$file"
        sed -i '/console\.log.*Position.*checking/d' "$file"
        sed -i '/console\.log.*Market.*condition/d' "$file"
        sed -i '/console\.log.*Entry.*signal/d' "$file"
        sed -i '/console\.log.*Exit.*signal/d' "$file"
        
        # Remove trading operation verbose logging
        sed -i '/console\.log.*Trade.*executed/d' "$file"
        sed -i '/console\.log.*Order.*placed/d' "$file"
        sed -i '/console\.log.*Balance.*updated/d' "$file"
        
        local new_count=$(grep -c "console\." "$file" 2>/dev/null || echo 0)
        local removed=$((original_count - new_count))
        if [ "$removed" -gt 0 ]; then
            echo "  Removed $removed console statements from $(basename "$file")"
        fi
    fi
}

# Clean all TypeScript and Svelte files
find src -name "*.ts" -o -name "*.svelte" | while read file; do
    clean_file "$file"
done

# Get final count
total_remaining=$(find src -name "*.ts" -o -name "*.svelte" | xargs grep -c "console\." 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')
echo "✅ Cleanup complete. $total_remaining console statements remaining (errors and essential chart logs preserved)"