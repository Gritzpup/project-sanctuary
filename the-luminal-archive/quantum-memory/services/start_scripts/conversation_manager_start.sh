#!/bin/bash
# Start script for Claude Conversation Manager (Redis-based)

SERVICE_NAME="conversation_manager"
SERVICE_DESC="Claude Conversation Manager - Aggregates conversations to current.json"

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

# Create log directory
LOG_DIR="/tmp/quantum_services/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${SERVICE_NAME}_$(date +%Y%m%d_%H%M%S).log"

# Change to quantum directory
cd "$QUANTUM_DIR"

echo "Service $SERVICE_NAME started at $(date)" >> "$LOG_FILE"
echo "Monitoring: /home/ubuntumain/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary" >> "$LOG_FILE"
echo "Output: quantum_states/conversations/current.json" >> "$LOG_FILE"

# Check if the v2 script exists (even if disabled)
if [ -f "scripts/claude_conversation_manager_v2.py.DISABLED" ]; then
    echo "Note: Using DISABLED version - rename to enable" >> "$LOG_FILE"
    # Copy the disabled version to a working copy
    cp scripts/claude_conversation_manager_v2.py.DISABLED /tmp/claude_conversation_manager_v2_active.py
    python3 /tmp/claude_conversation_manager_v2_active.py >> "$LOG_FILE" 2>&1
elif [ -f "scripts/claude_conversation_manager_v2.backup.py" ]; then
    echo "Using backup version" >> "$LOG_FILE"
    python3 scripts/claude_conversation_manager_v2.backup.py >> "$LOG_FILE" 2>&1
else
    echo "ERROR: No conversation manager script found!" >> "$LOG_FILE"
    exit 1
fi