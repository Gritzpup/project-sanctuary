#!/bin/bash
# Start all essential Quantum Memory services

echo "🚀 Starting Essential Quantum Memory Services..."
echo "=============================================="
echo ""

QUANTUM_DIR="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory"
cd "$QUANTUM_DIR"

# PID tracking file
PID_FILE="/tmp/quantum_services.pids"

# Clear previous PIDs if file exists
> "$PID_FILE"

# Function to check if service is running
check_service() {
    local service_name=$1
    local check_cmd=$2
    
    if eval "$check_cmd" > /dev/null 2>&1; then
        echo "✓ $service_name is running"
        return 0
    else
        echo "✗ $service_name is not running"
        return 1
    fi
}

# 1. Check Redis
echo "1️⃣  Checking Redis..."
if ! check_service "Redis" "redis-cli ping"; then
    echo "   Starting Redis..."
    sudo systemctl start redis-server
    sleep 2
fi

# 2. Start Conversation Aggregator (for current.json)
echo ""
echo "2️⃣  Starting Conversation Aggregator..."
if ! pgrep -f "claude_conversation_manager" > /dev/null; then
    bash services/start_scripts/conversation_manager_start.sh &
    echo $! >> "$PID_FILE"
    echo "   Started conversation aggregator (creates current.json)"
    sleep 2
else
    echo "   Conversation aggregator already running"
fi

# 3. Start Emollama Analyzer
echo ""
echo "3️⃣  Starting Emollama Analyzer..."
if ! pgrep -f "claude_analyzer|folder_analyzer" > /dev/null; then
    bash services/start_scripts/emollama_analyzer_start.sh &
    echo $! >> "$PID_FILE"
    echo "   Started Emollama analyzer (emotional encoding)"
    sleep 2
else
    echo "   Emollama analyzer already running"
fi

# 4. Start Redis File Sync
echo ""
echo "4️⃣  Starting Redis File Sync..."
if ! pgrep -f "redis_file_sync" > /dev/null; then
    python3 src/services/redis_file_sync.py > /tmp/quantum_redis_sync.log 2>&1 &
    echo $! >> "$PID_FILE"
    echo "   Started Redis file sync"
    sleep 1
else
    echo "   Redis file sync already running"
fi

# 5. Start Entity State Updater
echo ""
echo "5️⃣  Starting Entity State Updater..."
if ! pgrep -f "entity_state_updater" > /dev/null; then
    python3 src/services/entity_state_updater.py > /tmp/quantum_entity_updater.log 2>&1 &
    echo $! >> "$PID_FILE"
    echo "   Started entity state updater"
    sleep 1
else
    echo "   Entity state updater already running"
fi

# 6. Start Living Equation Processor (WebSocket)
echo ""
echo "6️⃣  Starting Living Equation Processor..."
if ! lsof -i:8768 > /dev/null 2>&1; then
    bash services/start_scripts/living_equation_start.sh &
    echo $! >> "$PID_FILE"
    echo "   Started living equation processor (WebSocket on port 8768)"
    sleep 3
else
    echo "   Living equation processor already running"
fi

# 7. Optional: Start Dashboard
echo ""
echo "7️⃣  Quantum Dashboard (optional)..."
if ! lsof -i:5174 > /dev/null 2>&1; then
    echo "   Dashboard not running. To start:"
    echo "   cd ../quantum-dashboard && npm run dev"
else
    echo "   Dashboard already running at http://localhost:5174"
fi

echo ""
echo "=============================================="
echo "✅ Essential services started!"
echo ""
echo "Check status with: ./run_service_terminal.sh"
echo "Monitor Redis with: python scripts/monitors/redis_status_monitor.py"
echo "View logs in: /tmp/quantum_*.log"
echo ""