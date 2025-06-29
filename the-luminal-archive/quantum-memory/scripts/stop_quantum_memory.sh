#!/bin/bash

# Quantum Memory System - Stop Script
echo "╔══════════════════════════════════════════════════╗"
echo "║        🛑 Stopping Quantum Memory System 🛑       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Set working directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Function to kill processes on specific ports
kill_port_process() {
    local port=$1
    local pid=$(lsof -t -i:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "Stopping process on port $port (PID: $pid)"
        kill $pid 2>/dev/null
        sleep 1
        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
            echo "Force stopping process on port $port"
            kill -9 $pid 2>/dev/null
        fi
    fi
}

# Stop any old services first
echo "🔍 Checking for old services..."
if systemctl --user is-active gritz-memory-ultimate.service >/dev/null 2>&1; then
    echo "Stopping old gritz-memory-ultimate service..."
    systemctl --user stop gritz-memory-ultimate.service
    systemctl --user disable gritz-memory-ultimate.service
fi

# Kill processes on our ports
echo ""
echo "🔌 Freeing up ports..."
kill_port_process 8765  # WebSocket
kill_port_process 8766  # Old WebSocket
kill_port_process 8082  # Dashboard

# Kill any Python processes related to memory system
echo ""
echo "🧹 Cleaning up processes..."
pkill -f "memory_updater.py" 2>/dev/null
pkill -f "mvp_memory" 2>/dev/null
pkill -f "quantum_memory" 2>/dev/null
pkill -f "main.py.*quantum-memory" 2>/dev/null

# Check if virtual environment is active and deactivate
if [ ! -z "$VIRTUAL_ENV" ]; then
    echo "Deactivating virtual environment..."
    deactivate 2>/dev/null || true
fi

# Final verification
echo ""
echo "✅ Verifying cleanup..."
sleep 2

# Check ports
if ! netstat -tuln 2>/dev/null | grep -E '8765|8766|8082' > /dev/null; then
    echo "✅ All ports are free"
else
    echo "⚠️  Some ports may still be in use:"
    netstat -tuln | grep -E '8765|8766|8082'
fi

# Check processes
if ! ps aux | grep -E 'memory_updater|mvp_memory|quantum_memory' | grep -v grep > /dev/null; then
    echo "✅ No memory processes running"
else
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -E 'memory_updater|mvp_memory|quantum_memory' | grep -v grep
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "Quantum Memory System stopped."
echo "═══════════════════════════════════════════════════"