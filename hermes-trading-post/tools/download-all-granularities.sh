#!/bin/bash

#############################################################################
# download-all-granularities.sh - Cache historical OHLCV data in Redis
#############################################################################
# Purpose:
#   Populates Redis cache with historical candlestick data across all
#   supported granularities (1m, 5m, 15m, 1h, 6h, 1d) for fast chart loading.
#
# Usage:
#   bash tools/download-all-granularities.sh
#
# Prerequisites:
#   - Backend API running on localhost:4828 (can be configured via BASE_URL)
#   - Redis server accessible to backend
#   - curl and jq installed on system
#   - Network connectivity to Coinbase Advanced API
#
# Granularities & Time Ranges:
#   - 1m  : 30 days   (~43,200 candles)
#   - 5m  : 90 days   (~25,920 candles)
#   - 15m : 180 days  (~17,280 candles)
#   - 1h  : 365 days  (~8,760 candles)
#   - 6h  : 2 years   (~2,920 candles)
#   - 1d  : 5 years   (~1,825 candles)
#
# Output:
#   - Shows progress for each granularity download
#   - Displays current candle count every 5 seconds
#   - Final summary with total candles cached
#
# Estimated Runtime: 5-15 minutes (depends on API rate limits)
#
# Troubleshooting:
#   - CORS errors: Check backend proxy configuration
#   - API rate limits: Reduce day ranges or add delays between requests
#   - Redis connection: Verify backend Redis configuration
#   - Timeout errors: May indicate slow Coinbase API (normal for large ranges)
#############################################################################

echo "🚀 Starting sequential download of all granularities..."

BASE_URL="http://localhost:4828/api/trading"
PAIR="BTC-USD"

# Define granularities and their optimal day ranges
declare -A GRANULARITIES=(
    ["1m"]="30"      # 30 days of 1m data
    ["5m"]="90"      # 90 days of 5m data  
    ["15m"]="180"    # 180 days of 15m data
    ["1h"]="365"     # 1 year of 1h data
    ["6h"]="720"     # 2 years of 6h data
    ["1d"]="1825"    # 5 years of 1d data
)

# Function to check if download is in progress
check_progress() {
    local granularity=$1
    local count=$(curl -s "${BASE_URL}/chart-data?pair=${PAIR}&granularity=${granularity}&maxCandles=1" | jq '.data.metadata.totalCandles' 2>/dev/null || echo "0")
    echo $count
}

# Function to start download
start_download() {
    local granularity=$1
    local days=$2
    
    echo "📊 Starting download: ${granularity} (${days} days)..."
    
    local response=$(curl -s -X POST "${BASE_URL}/populate-historical" \
        -H "Content-Type: application/json" \
        -d "{\"pair\": \"${PAIR}\", \"granularity\": \"${granularity}\", \"days\": ${days}}")
    
    local success=$(echo $response | jq -r '.success' 2>/dev/null || echo "false")
    
    if [ "$success" = "true" ]; then
        echo "✅ Started ${granularity} download"
        return 0
    else
        local message=$(echo $response | jq -r '.message' 2>/dev/null || echo "Unknown error")
        echo "❌ Failed to start ${granularity}: $message"
        return 1
    fi
}

# Function to wait for download completion
wait_for_completion() {
    local granularity=$1
    local initial_count=$2
    
    echo "⏳ Waiting for ${granularity} download to complete..."
    
    local prev_count=$initial_count
    local stable_count=0
    
    while true; do
        sleep 5
        local current_count=$(check_progress $granularity)
        
        if [ "$current_count" -gt "$prev_count" ]; then
            echo "📈 ${granularity}: ${current_count} candles"
            prev_count=$current_count
            stable_count=0
        else
            stable_count=$((stable_count + 1))
            # If count hasn't changed for 30 seconds (6 iterations), assume complete
            if [ $stable_count -ge 6 ]; then
                echo "✅ ${granularity} download complete: ${current_count} candles"
                break
            fi
        fi
    done
}

# Main download sequence
for granularity in "1m" "5m" "15m" "1h" "6h" "1d"; do
    days=${GRANULARITIES[$granularity]}
    
    echo ""
    echo "🎯 Processing ${granularity} granularity..."
    
    # Check current data
    initial_count=$(check_progress $granularity)
    echo "📋 Current ${granularity} data: ${initial_count} candles"
    
    # Start download
    if start_download $granularity $days; then
        # Wait for completion
        wait_for_completion $granularity $initial_count
    else
        echo "⚠️ Skipping ${granularity} due to error"
    fi
done

echo ""
echo "🎉 All granularity downloads completed!"
echo ""
echo "📊 Final counts:"
for granularity in "1m" "5m" "15m" "1h" "6h" "1d"; do
    count=$(check_progress $granularity)
    echo "  ${granularity}: ${count} candles"
done