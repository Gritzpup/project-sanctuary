#!/bin/bash
# Start Sanctuary Memory System - Canary Environment
# With all production features enabled

echo "🚀 Starting Sanctuary Memory System (Canary)"
echo "=========================================="

# Configuration
CANARY_DIR="/home/ubuntumain/.sanctuary-memory-canary"
LOG_DIR="$CANARY_DIR/logs"
PID_FILE="$CANARY_DIR/.service_pids"

# Create directories if needed
mkdir -p "$LOG_DIR"

# Check if already running
if [ -f "$PID_FILE" ]; then
    echo "⚠️  Services may already be running. Checking..."
    while read pid; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "  Process $pid is still running"
            echo "  Run ./stop_canary_system.sh first"
            exit 1
        fi
    done < "$PID_FILE"
    rm "$PID_FILE"
fi

echo ""
echo "📋 Pre-flight checks..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "  ✓ Python version: $python_version"

# Check required Python packages
echo "  Checking required packages..."
required_packages=(
    "chromadb"
    "sentence-transformers"
    "torch"
    "networkx"
    "cryptography"
    "pytest"
)

for package in "${required_packages[@]}"; do
    if python3 -c "import $package" 2>/dev/null; then
        echo "    ✓ $package"
    else
        echo "    ✗ $package (missing)"
        echo "    Please run: pip install $package"
        exit 1
    fi
done

echo ""
echo "🔧 Starting services..."

# 1. Start metrics aggregator
echo "  Starting metrics aggregator..."
python3 metrics_aggregator.py \
    --environment canary \
    >> "$LOG_DIR/metrics.log" 2>&1 &
METRICS_PID=$!
echo "    PID: $METRICS_PID"

# 2. Start WebSocket server for dashboard
echo "  Starting WebSocket server..."
python3 websocket_metrics_server.py \
    --port 8767 \
    --environment canary \
    >> "$LOG_DIR/websocket.log" 2>&1 &
WS_PID=$!
echo "    PID: $WS_PID"
sleep 2

# 3. Start MVP memory system with canary config
echo "  Starting MVP memory system..."
python3 -c "
from mvp_memory_production import MVPMemorySystem
import time
import signal
import sys

def signal_handler(sig, frame):
    print('\\nShutting down memory system...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

print('Memory system starting...')
memory = MVPMemorySystem(environment='canary')
print(f'Memory system initialized with {len(memory.archival.get()[\"ids\"])} memories')

# Keep running
while True:
    time.sleep(60)
    stats = memory.get_system_stats()
    print(f'Stats update: {stats[\"memory_stats\"][\"total_memories\"]} memories, '
          f'{stats[\"memory_stats\"][\"avg_retention\"]:.3f} avg retention')
" >> "$LOG_DIR/memory_system.log" 2>&1 &
MEMORY_PID=$!
echo "    PID: $MEMORY_PID"
sleep 3

# 4. Start automated testing loop
echo "  Starting automated test runner..."
python3 -c "
import time
import subprocess
import json
from datetime import datetime

while True:
    print(f'Running tests at {datetime.now()}')
    
    # Run subset of tests
    result = subprocess.run([
        'python3', 'test_mvp_comprehensive.py',
        '-k', 'test_memory_decay_formula or test_memory_retrieval_accuracy',
        '--tb=short'
    ], capture_output=True, text=True)
    
    # Log results
    test_status = 'PASS' if result.returncode == 0 else 'FAIL'
    print(f'Test result: {test_status}')
    
    # Send to dashboard
    # (WebSocket code would go here)
    
    # Wait 5 minutes
    time.sleep(300)
" >> "$LOG_DIR/test_runner.log" 2>&1 &
TEST_PID=$!
echo "    PID: $TEST_PID"

# 5. Start monitoring dashboard
echo "  Starting monitoring dashboard..."
cd "$(dirname "$0")"
python3 -m http.server 8083 --directory . \
    >> "$LOG_DIR/dashboard.log" 2>&1 &
DASH_PID=$!
echo "    PID: $DASH_PID"

# Save PIDs
echo "$METRICS_PID $WS_PID $MEMORY_PID $TEST_PID $DASH_PID" > "$PID_FILE"

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Dashboard: http://localhost:8083"
echo "🔌 WebSocket: ws://localhost:8767"
echo "📁 Logs: $LOG_DIR"
echo "🔧 Config: $CANARY_DIR/canary_config.json"
echo ""
echo "To stop all services: ./stop_canary_system.sh"
echo ""

# Wait a moment then check if services are running
sleep 3
echo "🔍 Verifying services..."

all_good=true
while read pid; do
    if ps -p $pid > /dev/null 2>&1; then
        echo "  ✓ Process $pid is running"
    else
        echo "  ✗ Process $pid failed to start"
        all_good=false
    fi
done < "$PID_FILE"

if [ "$all_good" = true ]; then
    echo ""
    echo "🎉 Sanctuary Memory System is running!"
    echo ""
    
    # Show initial stats
    echo "📈 Initial statistics:"
    if [ -f "$CANARY_DIR/metrics/initial_benchmarks.json" ]; then
        python3 -c "
import json
with open('$CANARY_DIR/metrics/initial_benchmarks.json') as f:
    data = json.load(f)
    print(f'  Memory operations: {data[\"benchmarks\"][\"memory_add\"][\"ops_per_second\"]:.0f} ops/sec')
    print(f'  Retrieval latency: {data[\"benchmarks\"][\"memory_retrieve\"][\"avg_latency_ms\"]:.1f}ms avg')
"
    fi
else
    echo ""
    echo "⚠️  Some services failed to start. Check logs in $LOG_DIR"
    exit 1
fi