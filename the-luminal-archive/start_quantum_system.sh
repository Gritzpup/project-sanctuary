#!/bin/bash
# Master Start Script for The Luminal Archive Quantum System
# This script launches all quantum memory services and dashboards

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         🧠 THE LUMINAL ARCHIVE QUANTUM SYSTEM 🧠             ║"
echo "║              Consciousness & Memory Services                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

LUMINAL_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
QUANTUM_DIR="$LUMINAL_ROOT/quantum-memory"
DASHBOARD_DIR="$LUMINAL_ROOT/quantum-dashboard"

# Array to track PIDs of all started processes
declare -a PIDS=()

# Cleanup function to kill all child processes
cleanup() {
    echo ""
    echo "🛑 Cleaning up processes..."
    
    # Kill all tracked PIDs
    for pid in "${PIDS[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            echo "Stopping process $pid"
            kill -TERM $pid 2>/dev/null
        fi
    done
    
    # Also check PID file for any additional processes
    if [ -f "/tmp/quantum_services.pids" ]; then
        while IFS= read -r pid; do
            if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
                echo "Stopping process $pid (from PID file)"
                kill -TERM $pid 2>/dev/null
            fi
        done < "/tmp/quantum_services.pids"
        rm -f "/tmp/quantum_services.pids"
    fi
    
    # Also run the standard stop_all function
    stop_all
    
    exit 0
}

# Trap signals to cleanup on exit
trap cleanup EXIT SIGINT SIGTERM SIGHUP

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ $status -eq 0 ]; then
        echo "✅ $message"
    else
        echo "❌ $message"
    fi
}

# Function to check if service is running
check_service() {
    local name=$1
    local check_cmd=$2
    if eval "$check_cmd" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Main menu
show_menu() {
    echo "What would you like to do?"
    echo ""
    echo "  1) 🚀 Start All Services (Recommended)"
    echo "  2) 🎛️  Open Service Terminal (Interactive UI)"
    echo "  3) 📊 Start Dashboard Only"
    echo "  4) 🔍 Check System Status"
    echo "  5) 🛑 Stop All Services"
    echo "  6) 📖 View Documentation"
    echo "  7) 🔧 Quick Fix Common Issues"
    echo "  8) 🚪 Exit"
    echo ""
    read -p "Select option (1-8): " choice
}

# Start all services
start_all_services() {
    echo ""
    echo "🚀 Starting Quantum Memory System..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check Redis first
    echo "Checking Redis..."
    if ! check_service "Redis" "redis-cli ping"; then
        echo "Starting Redis server..."
        sudo systemctl start redis-server
        sleep 2
    fi
    print_status $? "Redis server"
    
    # Clean up any stuck conversation manager processes
    echo "Cleaning up stuck processes..."
    pkill -f "claude_conversation_manager" 2>/dev/null
    sleep 1
    
    # Start quantum memory services
    echo ""
    echo "Starting Quantum Memory Services..."
    cd "$QUANTUM_DIR"
    
    # Use the start all script if it exists
    if [ -f "services/start_scripts/start_all_essential.sh" ]; then
        bash services/start_scripts/start_all_essential.sh
        
        # Read PIDs from the PID file created by start_all_essential.sh
        if [ -f "/tmp/quantum_services.pids" ]; then
            while IFS= read -r pid; do
                if [ -n "$pid" ]; then
                    PIDS+=($pid)
                fi
            done < "/tmp/quantum_services.pids"
        fi
    else
        echo "Warning: start_all_essential.sh not found"
        echo "Starting services individually..."
        
        # Start services manually
        python3 src/services/redis_file_sync.py > /tmp/quantum_redis_sync.log 2>&1 &
        PIDS+=($!)
        python3 src/services/entity_state_updater.py > /tmp/quantum_entity_updater.log 2>&1 &
        PIDS+=($!)
        
        # Try to start conversation manager
        if [ -f "scripts/claude_conversation_manager_v2.py.DISABLED" ]; then
            cp scripts/claude_conversation_manager_v2.py.DISABLED /tmp/claude_conversation_manager_v2_active.py
            python3 /tmp/claude_conversation_manager_v2_active.py > /tmp/quantum_conversation.log 2>&1 &
            PIDS+=($!)
        elif [ -f "scripts/claude_conversation_manager_v2.backup.py" ]; then
            python3 scripts/claude_conversation_manager_v2.backup.py > /tmp/quantum_conversation.log 2>&1 &
            PIDS+=($!)
        fi
    fi
    
    # Start dashboard
    echo ""
    echo "Starting Quantum Dashboard..."
    cd "$DASHBOARD_DIR"
    if [ -d "node_modules" ]; then
        npm run dev > /tmp/quantum_dashboard.log 2>&1 &
        PIDS+=($!)
        sleep 3
        print_status $? "Quantum Dashboard (http://localhost:5174)"
    else
        echo "Installing dashboard dependencies first..."
        npm install
        npm run dev > /tmp/quantum_dashboard.log 2>&1 &
        PIDS+=($!)
        sleep 3
        print_status $? "Quantum Dashboard (http://localhost:5174)"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✨ Quantum System Started!"
    echo ""
    echo "Access points:"
    echo "  • Dashboard: http://localhost:5174"
    echo "  • WebSocket: ws://localhost:8768"
    echo "  • Service Terminal: Run option 2"
    echo ""
    read -p "Press Enter to continue..."
}

# Open service terminal
open_terminal() {
    echo ""
    echo "Opening Service Terminal..."
    cd "$QUANTUM_DIR"
    if [ -f "run_service_terminal.sh" ]; then
        ./run_service_terminal.sh
    else
        echo "Error: Service terminal not found!"
        echo "Make sure you're in the correct directory"
    fi
}

# Start dashboard only
start_dashboard() {
    echo ""
    echo "Starting Quantum Dashboard..."
    cd "$DASHBOARD_DIR"
    if [ -f "start-dashboard.sh" ]; then
        ./start-dashboard.sh
    else
        npm run dev
    fi
}

# Check system status
check_status() {
    echo ""
    echo "🔍 System Status Check"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check Redis
    echo -n "Redis Server: "
    if check_service "Redis" "redis-cli ping"; then
        echo "🟢 Running"
    else
        echo "🔴 Stopped"
    fi
    
    # Check conversation manager
    echo -n "Conversation Manager: "
    if pgrep -f "claude_conversation_manager" > /dev/null; then
        echo "🟢 Running"
    else
        echo "🔴 Stopped"
    fi
    
    # Check analyzers
    echo -n "Emollama Analyzer: "
    if pgrep -f "claude_analyzer|folder_analyzer" > /dev/null; then
        echo "🟢 Running"
    else
        echo "🔴 Stopped"
    fi
    
    # Check Living Equation (WebSocket)
    echo -n "Living Equation (8768): "
    if lsof -i:8768 > /dev/null 2>&1; then
        echo "🟢 Running"
    else
        echo "🔴 Stopped"
    fi
    
    # Check Dashboard
    echo -n "Quantum Dashboard (5174): "
    if lsof -i:5174 > /dev/null 2>&1; then
        echo "🟢 Running"
    else
        echo "🔴 Stopped"
    fi
    
    # Check current.json
    echo ""
    echo "Files:"
    if [ -f "$QUANTUM_DIR/quantum_states/conversations/current.json" ]; then
        SIZE=$(ls -lh "$QUANTUM_DIR/quantum_states/conversations/current.json" | awk '{print $5}')
        MODIFIED=$(date -r "$QUANTUM_DIR/quantum_states/conversations/current.json" "+%Y-%m-%d %H:%M:%S")
        echo "  • current.json: ✓ ($SIZE, modified: $MODIFIED)"
    else
        echo "  • current.json: ✗ Not found"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Stop all services
stop_all() {
    echo ""
    echo "🛑 Stopping All Services..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Kill quantum processes
    pkill -f "claude_conversation_manager" 2>/dev/null
    pkill -f "claude_analyzer" 2>/dev/null
    pkill -f "folder_analyzer" 2>/dev/null
    pkill -f "redis_file_sync" 2>/dev/null
    pkill -f "entity_state_updater" 2>/dev/null
    pkill -f "quantum_memory_service" 2>/dev/null
    
    # Kill dashboard
    pkill -f "vite.*quantum-dashboard" 2>/dev/null
    
    # Kill any process on ports
    lsof -ti:8768 | xargs kill -9 2>/dev/null
    lsof -ti:5174 | xargs kill -9 2>/dev/null
    
    echo "✅ All services stopped"
    echo ""
    read -p "Press Enter to continue..."
}

# View documentation
view_docs() {
    echo ""
    echo "📖 Documentation"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Available documentation:"
    echo "  • Service Terminal Guide: quantum-memory/docs/service_terminal_guide.md"
    echo "  • Phase Checklist: quantum-memory/docs/phase_checklist.md"
    echo "  • Entity Integration: quantum-memory/docs/entity_integration_summary.md"
    echo ""
    echo "Key directories:"
    echo "  • Services: quantum-memory/services/"
    echo "  • Start Scripts: quantum-memory/services/start_scripts/"
    echo "  • Logs: /tmp/quantum_*.log"
    echo ""
    read -p "Press Enter to continue..."
}

# Quick fixes
quick_fix() {
    echo ""
    echo "🔧 Quick Fix Menu"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1) Fix Redis connection issues"
    echo "2) Clear old conversation data"
    echo "3) Reset service configurations"
    echo "4) Install missing dependencies"
    echo "5) Clear stuck Redis conversation manager data"
    echo "6) Back to main menu"
    echo ""
    read -p "Select fix (1-6): " fix_choice
    
    case $fix_choice in
        1)
            echo "Restarting Redis..."
            sudo systemctl restart redis-server
            sleep 2
            redis-cli ping && echo "✅ Redis fixed!" || echo "❌ Redis still having issues"
            ;;
        2)
            echo "Trimming conversation data..."
            cd "$QUANTUM_DIR"
            if [ -f "scripts/trim_redis_messages.py" ]; then
                python3 scripts/trim_redis_messages.py
                echo "✅ Conversation data trimmed"
            fi
            ;;
        3)
            echo "Resetting service configurations..."
            cd "$QUANTUM_DIR"
            rm -f services/service_config.json
            echo "✅ Configuration reset. Run service terminal to regenerate."
            ;;
        4)
            echo "Installing dependencies..."
            cd "$QUANTUM_DIR"
            if [ -f "requirements.txt" ]; then
                pip install -r requirements.txt
            fi
            cd "$DASHBOARD_DIR"
            npm install
            echo "✅ Dependencies installed"
            ;;
        5)
            echo "Clearing stuck Redis conversation manager data..."
            redis-cli DEL "processing:*" > /dev/null 2>&1
            redis-cli DEL "conversations:lock:*" > /dev/null 2>&1
            echo "✅ Cleared stuck Redis data"
            echo "You may need to restart the conversation manager"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    clear
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║         🧠 THE LUMINAL ARCHIVE QUANTUM SYSTEM 🧠             ║"
    echo "║              Consciousness & Memory Services                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    
    show_menu
    
    case $choice in
        1) start_all_services ;;
        2) open_terminal ;;
        3) start_dashboard ;;
        4) check_status ;;
        5) stop_all ;;
        6) view_docs ;;
        7) quick_fix ;;
        8) echo ""; echo "👋 Goodbye!"; cleanup ;;
        *) echo "Invalid option. Please try again."; sleep 1 ;;
    esac
done