#!/bin/bash
# Start script for Redis Status Monitor

SERVICE_NAME="redis_monitor"
SERVICE_DESC="Redis Status Monitor - Real-time quantum memory monitoring"

echo "Starting $SERVICE_NAME..."

# Set up environment
QUANTUM_DIR="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory"
export PYTHONPATH="$QUANTUM_DIR:$PYTHONPATH"
export REDIS_URL="redis://localhost:6379"

# Activate virtual environment
if [ -d "$QUANTUM_DIR/quantum_env" ]; then
    source "$QUANTUM_DIR/quantum_env/bin/activate"
elif [ -d "$QUANTUM_DIR/venv" ]; then
    source "$QUANTUM_DIR/venv/bin/activate"
fi

# Change to quantum directory
cd "$QUANTUM_DIR"

# This runs in foreground for monitoring
echo "Redis Status Monitor - Press Ctrl+C to exit"
echo "Monitoring quantum memory states in Redis..."
echo ""

# Run the monitor
python3 scripts/monitors/redis_status_monitor.py