#!/bin/bash
# Manage the Emollama-enhanced Claude folder analyzer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Service name
SERVICE="emollama-analyzer"
SERVICE_FILE="/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/emollama-analyzer.service"

function status() {
    echo -e "${YELLOW}📊 Checking Emollama Analyzer Status...${NC}"
    
    # Check if old keyword analyzer is running
    if pgrep -f "claude_folder_analyzer_simple.py" > /dev/null; then
        echo -e "${RED}⚠️  Old keyword analyzer is still running!${NC}"
        echo "   Use: pkill -f claude_folder_analyzer_simple.py"
    fi
    
    # Check if Emollama analyzer is running
    if systemctl is-active --quiet $SERVICE 2>/dev/null; then
        echo -e "${GREEN}✅ Emollama analyzer is running${NC}"
        systemctl status $SERVICE --no-pager
    elif pgrep -f "claude_folder_analyzer_emollama.py" > /dev/null; then
        echo -e "${YELLOW}🔄 Emollama analyzer is running (not as service)${NC}"
        ps aux | grep -E "claude_folder_analyzer_emollama.py|[e]mollama" | grep -v grep
    else
        echo -e "${RED}❌ Emollama analyzer is not running${NC}"
    fi
}

function start() {
    echo -e "${GREEN}🚀 Starting Emollama Analyzer...${NC}"
    
    # First stop old analyzer if running
    if pgrep -f "claude_folder_analyzer_simple.py" > /dev/null; then
        echo "   Stopping old keyword analyzer..."
        pkill -f "claude_folder_analyzer_simple.py" || true
    fi
    
    # Install service if not already installed
    if ! systemctl list-unit-files | grep -q $SERVICE; then
        echo "   Installing systemd service..."
        sudo cp $SERVICE_FILE /etc/systemd/system/
        sudo systemctl daemon-reload
    fi
    
    # Start the service
    sudo systemctl start $SERVICE
    sudo systemctl enable $SERVICE
    
    echo -e "${GREEN}✅ Emollama analyzer started!${NC}"
    status
}

function stop() {
    echo -e "${YELLOW}🛑 Stopping Emollama Analyzer...${NC}"
    
    # Stop service if running
    if systemctl is-active --quiet $SERVICE 2>/dev/null; then
        sudo systemctl stop $SERVICE
        sudo systemctl disable $SERVICE
    fi
    
    # Kill any running instances
    pkill -f "claude_folder_analyzer_emollama.py" || true
    
    echo -e "${GREEN}✅ Emollama analyzer stopped${NC}"
}

function restart() {
    stop
    sleep 2
    start
}

function run_interactive() {
    echo -e "${GREEN}🖥️  Running Emollama analyzer interactively...${NC}"
    echo "   Press Ctrl+C to stop"
    
    # Stop any existing instances first
    pkill -f "claude_folder_analyzer_emollama.py" || true
    
    # Run with the virtual environment
    cd /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory
    ./run_emollama_analyzer.py
}

function logs() {
    echo -e "${YELLOW}📜 Showing Emollama analyzer logs...${NC}"
    if systemctl is-active --quiet $SERVICE 2>/dev/null; then
        sudo journalctl -u $SERVICE -f
    else
        echo -e "${RED}Service not running. Use 'start' first.${NC}"
    fi
}

# Main menu
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    run)
        run_interactive
        ;;
    logs)
        logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|run|logs}"
        echo ""
        echo "  start   - Start Emollama analyzer as a service"
        echo "  stop    - Stop Emollama analyzer"
        echo "  restart - Restart Emollama analyzer"
        echo "  status  - Check analyzer status"
        echo "  run     - Run interactively (for testing)"
        echo "  logs    - Show service logs"
        exit 1
        ;;
esac