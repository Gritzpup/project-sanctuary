#!/bin/bash
# Stop Sanctuary Memory System - Canary Environment

echo "🛑 Stopping Sanctuary Memory System (Canary)"
echo "=========================================="

CANARY_DIR="/home/ubuntumain/.sanctuary-memory-canary"
PID_FILE="$CANARY_DIR/.service_pids"

if [ ! -f "$PID_FILE" ]; then
    echo "⚠️  No PID file found. Services may not be running."
    echo "  Checking for orphan processes..."
    
    # Try to find processes anyway
    ps aux | grep -E "(mvp_memory_production|websocket_metrics|metrics_aggregator)" | grep -v grep
    
    exit 0
fi

echo ""
echo "📋 Stopping services..."

# Read PIDs and stop each service
while read pid; do
    if ps -p $pid > /dev/null 2>&1; then
        echo "  Stopping process $pid..."
        kill -TERM $pid
        
        # Wait up to 5 seconds for graceful shutdown
        count=0
        while ps -p $pid > /dev/null 2>&1 && [ $count -lt 5 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            echo "    Force killing $pid..."
            kill -9 $pid
        else
            echo "    ✓ Stopped gracefully"
        fi
    else
        echo "  Process $pid already stopped"
    fi
done < "$PID_FILE"

# Remove PID file
rm -f "$PID_FILE"

echo ""
echo "✅ All services stopped"
echo ""

# Optional: Create final backup
read -p "Create final backup before shutdown? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating backup..."
    if [ -f "$CANARY_DIR/backup.sh" ]; then
        "$CANARY_DIR/backup.sh"
    else
        echo "Backup script not found, skipping..."
    fi
fi

echo ""
echo "🏁 Shutdown complete"