#!/bin/bash
# Sanctuary Services Status Dashboard
# Shows all running services and their ports

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              🏛️  SANCTUARY SERVICES STATUS                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    local service_name=$2
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service_name (Port $port): ${GREEN}RUNNING${NC}"
        local pid=$(lsof -t -i :$port | head -1)
        echo "  └─ PID: $pid"
    else
        echo -e "${RED}✗${NC} $service_name (Port $port): ${RED}NOT RUNNING${NC}"
    fi
}

# Legacy Services
echo -e "${YELLOW}━━━ LEGACY SERVICES (Don't Touch) ━━━${NC}"
check_port 8082 "Old Memory Dashboard"
check_port 8766 "Old Memory WebSocket"
echo

# Quantum Services
echo -e "${BLUE}━━━ QUANTUM SERVICES (Active Development) ━━━${NC}"
check_port 5175 "Quantum Dashboard"
check_port 8768 "Quantum WebSocket"
echo

# AI Services
echo -e "${GREEN}━━━ AI/ML SERVICES ━━━${NC}"
check_port 7860 "Emollama"

# Check for Real-time Analyzer
echo -n "Real-time Analyzer: "
if pgrep -f "claude_folder_analyzer_watchdog" > /dev/null; then
    pid=$(pgrep -f "claude_folder_analyzer_watchdog" | head -1)
    echo -e "${GREEN}RUNNING${NC} (PID: $pid) - ⚡ Instant updates!"
else
    echo -e "${RED}NOT RUNNING${NC}"
fi
echo

# Memory Stats
echo -e "${BLUE}━━━ MEMORY STATISTICS ━━━${NC}"
if [ -f "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/status.json" ]; then
    messages=$(jq -r '.chat_stats.total_messages // "N/A"' /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/status.json 2>/dev/null)
    echo "Total Messages: $messages"
    state=$(jq -r '.emotional_dynamics.current_state // "Unknown"' /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/status.json 2>/dev/null)
    echo "Current State: $state"
    working_on=$(jq -r '.memory_timeline.current_session.working_on // "Unknown"' /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/status.json 2>/dev/null)
    echo "Working On: $working_on"
    last_update=$(jq -r '.memory_timeline.current_session.last_update // "Unknown"' /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/status.json 2>/dev/null | cut -d'T' -f2 | cut -d'.' -f1)
    echo "Last Update: $last_update"
else
    echo "Status file not found"
fi
echo

# Quick Actions
echo -e "${YELLOW}━━━ QUICK ACTIONS ━━━${NC}"
echo "1. View Quantum Dashboard: http://localhost:5175"
echo "2. View Legacy Dashboard: http://localhost:8082"
echo "3. Restart Quantum WebSocket: systemctl --user restart quantum-websocket-enhanced.service"
echo "4. View Quantum Logs: journalctl --user -u quantum-websocket-enhanced.service -f"
echo

echo "╚══════════════════════════════════════════════════════════════╝"