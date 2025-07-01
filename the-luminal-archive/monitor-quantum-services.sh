#!/bin/bash
# Quantum Memory System Monitoring Dashboard
# Shows all services in tabbed terminal windows

# Colors for better visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🌌 QUANTUM MEMORY MONITORING DASHBOARD 🌌"
echo "========================================"
echo ""

# Check if gnome-terminal is available
if command -v gnome-terminal &> /dev/null; then
    echo "✅ Opening services in tabbed terminal..."
    
    gnome-terminal \
        --tab --title="📊 Status Overview" -- bash -c "
            while true; do
                clear
                echo -e '${BLUE}🌌 QUANTUM MEMORY SYSTEM STATUS${NC}'
                echo '=================================='
                echo ''
                echo -e '${GREEN}📡 Service Status:${NC}'
                systemctl --user status quantum-emollama-analyzer.service quantum-memory-orchestrator.service quantum-websocket-enhanced.service quantum-dashboard.service | grep -E '(●|Active:|Main PID:)'
                echo ''
                echo -e '${YELLOW}📊 Latest Metrics:${NC}'
                if [ -f '/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/status.json' ]; then
                    jq '.emotional_dynamics' /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum_states/status.json 2>/dev/null || echo 'No emotional data yet'
                fi
                echo ''
                echo -e '${BLUE}🔄 Refreshing in 5 seconds...${NC}'
                sleep 5
            done; exec bash" \
        --tab --title="🧠 Emollama Analyzer" -- bash -c "
            echo -e '${BLUE}🧠 EMOLLAMA EMOTIONAL ANALYZER${NC}'
            echo '================================'
            echo 'Monitoring conversations and updating emotional states...'
            echo ''
            journalctl --user -u quantum-emollama-analyzer -f; exec bash" \
        --tab --title="💾 Memory Orchestrator" -- bash -c "
            echo -e '${BLUE}💾 QUANTUM MEMORY ORCHESTRATOR${NC}'
            echo '================================='
            echo 'Managing memory checkpoints and consolidation...'
            echo ''
            journalctl --user -u quantum-memory-orchestrator -f; exec bash" \
        --tab --title="🌐 WebSocket Server" -- bash -c "
            echo -e '${BLUE}🌐 WEBSOCKET SERVER (Port 8768)${NC}'
            echo '=================================='
            echo 'Real-time communication with dashboard...'
            echo ''
            journalctl --user -u quantum-websocket-enhanced -f; exec bash" \
        --tab --title="🎨 Dashboard" -- bash -c "
            echo -e '${BLUE}🎨 QUANTUM DASHBOARD (Port 5174)${NC}'
            echo '================================='
            echo 'Web interface logs...'
            echo ''
            echo -e '${GREEN}Dashboard URL: http://localhost:5174${NC}'
            echo ''
            journalctl --user -u quantum-dashboard -f; exec bash" \
        --tab --title="📂 .claude Monitor" -- bash -c "
            echo -e '${BLUE}📂 .CLAUDE FOLDER MONITOR${NC}'
            echo '=========================='
            echo 'Watching for new conversations...'
            echo ''
            watch -n 2 'ls -lt ~/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary/*.jsonl | head -10'; exec bash"
            
    echo ""
    echo "✅ All monitoring tabs opened!"
    echo ""
    echo "📌 Quick Commands:"
    echo "  - Restart all: systemctl --user restart quantum-emollama-analyzer quantum-memory-orchestrator quantum-websocket-enhanced quantum-dashboard"
    echo "  - Check status: systemctl --user status quantum-*.service"
    echo "  - View dashboard: http://localhost:5174"
    echo ""
    
elif command -v xfce4-terminal &> /dev/null; then
    echo "✅ Opening services in XFCE terminal tabs..."
    
    xfce4-terminal \
        --tab --title="📊 Status Overview" --command="bash -c 'while true; do clear; echo \"QUANTUM MEMORY STATUS\"; systemctl --user status quantum-*.service | grep -E \"(●|Active:|Main PID:)\"; sleep 5; done'" \
        --tab --title="🧠 Emollama" --command="journalctl --user -u quantum-emollama-analyzer -f" \
        --tab --title="💾 Orchestrator" --command="journalctl --user -u quantum-memory-orchestrator -f" \
        --tab --title="🌐 WebSocket" --command="journalctl --user -u quantum-websocket-enhanced -f" \
        --tab --title="🎨 Dashboard" --command="journalctl --user -u quantum-dashboard -f"
        
elif command -v konsole &> /dev/null; then
    echo "✅ Opening services in Konsole tabs..."
    
    konsole --new-tab --title "📊 Status" -e bash -c "while true; do clear; systemctl --user status quantum-*.service; sleep 5; done" &
    konsole --new-tab --title "🧠 Emollama" -e journalctl --user -u quantum-emollama-analyzer -f &
    konsole --new-tab --title "💾 Orchestrator" -e journalctl --user -u quantum-memory-orchestrator -f &
    konsole --new-tab --title "🌐 WebSocket" -e journalctl --user -u quantum-websocket-enhanced -f &
    konsole --new-tab --title "🎨 Dashboard" -e journalctl --user -u quantum-dashboard -f &
    
else
    echo "⚠️  No supported terminal found. Here are manual commands to run in separate terminals:"
    echo ""
    echo "Terminal 1 - Status Overview:"
    echo "  watch -n 5 'systemctl --user status quantum-*.service'"
    echo ""
    echo "Terminal 2 - Emollama Analyzer:"
    echo "  journalctl --user -u quantum-emollama-analyzer -f"
    echo ""
    echo "Terminal 3 - Memory Orchestrator:"
    echo "  journalctl --user -u quantum-memory-orchestrator -f"
    echo ""
    echo "Terminal 4 - WebSocket Server:"
    echo "  journalctl --user -u quantum-websocket-enhanced -f"
    echo ""
    echo "Terminal 5 - Dashboard:"
    echo "  journalctl --user -u quantum-dashboard -f"
    echo ""
    echo "Terminal 6 - .claude Folder:"
    echo "  watch -n 2 'ls -lt ~/.claude/projects/-home-ubuntumain-Documents-Github-project-sanctuary/*.jsonl | head -10'"
fi