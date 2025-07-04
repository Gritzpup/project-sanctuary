#!/bin/bash
# Start script for Emollama Analyzer with emotional encoding

SERVICE_NAME="emollama_analyzer"
SERVICE_DESC="Emollama Analyzer - Processes conversations with emotional encoding"

echo "Starting $SERVICE_NAME..."

# Set up environment
QUANTUM_DIR="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory"
export PYTHONPATH="$QUANTUM_DIR:$PYTHONPATH"
export REDIS_URL="redis://localhost:6379"
export EMOLLAMA_MODEL="Emollama-7B"
export CUDA_VISIBLE_DEVICES="0"  # Use GPU 0

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

# Change to quantum directory
cd "$QUANTUM_DIR"

echo "Service $SERVICE_NAME started at $(date)" >> "$LOG_FILE"
echo "Using Emollama-7B for emotional analysis" >> "$LOG_FILE"
echo "GPU: RTX 2080 Super" >> "$LOG_FILE"

# Check which analyzer to use
if [ -f "scripts/claude_analyzer_redis.py" ]; then
    echo "Using Redis-based analyzer" >> "$LOG_FILE"
    python3 scripts/claude_analyzer_redis.py >> "$LOG_FILE" 2>&1
elif [ -f "analyzers/claude_folder_analyzer_quantum.py" ]; then
    echo "Using quantum folder analyzer" >> "$LOG_FILE"
    python3 analyzers/claude_folder_analyzer_quantum.py >> "$LOG_FILE" 2>&1
else
    echo "ERROR: No analyzer script found!" >> "$LOG_FILE"
    exit 1
fi