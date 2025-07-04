#!/bin/bash
# Start script for Living Equation Processor

SERVICE_NAME="living_equation"
SERVICE_DESC="Living Equation Processor - Quantum relationship dynamics"

echo "Starting $SERVICE_NAME..."

# Set up environment
QUANTUM_DIR="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory"
export PYTHONPATH="$QUANTUM_DIR:$PYTHONPATH"
export REDIS_URL="redis://localhost:6379"
export WEBSOCKET_PORT="8768"

# Activate virtual environment
if [ -d "$QUANTUM_DIR/quantum_env" ]; then
    source "$QUANTUM_DIR/quantum_env/bin/activate"
elif [ -d "$QUANTUM_DIR/venv" ]; then
    source "$QUANTUM_DIR/venv/bin/activate"
fi

# Create log directory
LOG_DIR="/tmp/quantum_services/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${SERVICE_NAME}_$(date +%Y%m%d_%H%M%S).log"

# Kill any existing WebSocket on 8768
lsof -ti:8768 | xargs kill -9 2>/dev/null
sleep 1

# Change to quantum directory
cd "$QUANTUM_DIR"

echo "Service $SERVICE_NAME started at $(date)" >> "$LOG_FILE"
echo "Living equation processor with WebSocket on port 8768" >> "$LOG_FILE"

# Check which WebSocket server to use
if [ -f "servers/websocket_server_8768_advanced.py" ]; then
    echo "Using advanced WebSocket server" >> "$LOG_FILE"
    python3 servers/websocket_server_8768_advanced.py >> "$LOG_FILE" 2>&1
elif [ -f "src/services/quantum_memory_service.py" ]; then
    echo "Using quantum memory service" >> "$LOG_FILE"
    python3 src/services/quantum_memory_service.py >> "$LOG_FILE" 2>&1
else
    echo "ERROR: No WebSocket server found!" >> "$LOG_FILE"
    exit 1
fi