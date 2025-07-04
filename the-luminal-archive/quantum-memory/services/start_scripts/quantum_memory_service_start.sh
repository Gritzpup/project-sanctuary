#!/bin/bash
# Start script for main Quantum Memory Service with WebSocket

SERVICE_NAME="quantum_memory_service"
SERVICE_DESC="Quantum Memory Service - Main orchestrator with WebSocket server"

echo "Starting $SERVICE_NAME..."

# Set up environment
QUANTUM_DIR="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory"
export PYTHONPATH="$QUANTUM_DIR:$PYTHONPATH"
export REDIS_URL="redis://localhost:6379"
export WEBSOCKET_HOST="localhost"
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

# Kill any process on the WebSocket port
lsof -ti:8768 | xargs kill -9 2>/dev/null

# Change to quantum directory
cd "$QUANTUM_DIR"

echo "Service $SERVICE_NAME started at $(date)" >> "$LOG_FILE"
echo "WebSocket server on ws://localhost:8768" >> "$LOG_FILE"
echo "Quantum memory orchestrator active" >> "$LOG_FILE"

# Run the main service
python3 src/services/quantum_memory_service.py >> "$LOG_FILE" 2>&1