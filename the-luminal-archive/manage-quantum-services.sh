#!/bin/bash
# Quantum Memory Services Manager

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Quantum Memory Services Manager${NC}"
echo "================================"
echo ""

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}This script must be run as root (use sudo)${NC}"
        exit 1
    fi
}

# Function to install services
install_services() {
    echo -e "${YELLOW}Installing services...${NC}"
    
    # Create symlinks to service files in their current locations
    ln -sf /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum-websocket.service /etc/systemd/system/
    ln -sf /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-dashboard/quantum-dashboard.service /etc/systemd/system/
    
    # Set permissions on project directories if needed
    chmod +x /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/websocket_server_8768_advanced.py
    
    # Reload systemd
    systemctl daemon-reload
    
    echo -e "${GREEN}Services installed (using symlinks)!${NC}"
}

# Function to enable services
enable_services() {
    echo -e "${YELLOW}Enabling services...${NC}"
    
    systemctl enable quantum-websocket.service
    systemctl enable quantum-dashboard.service
    
    echo -e "${GREEN}Services enabled!${NC}"
}

# Function to start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    
    systemctl start quantum-websocket.service
    sleep 2  # Give WebSocket time to start
    systemctl start quantum-dashboard.service
    
    echo -e "${GREEN}Services started!${NC}"
}

# Function to stop services
stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"
    
    systemctl stop quantum-dashboard.service
    systemctl stop quantum-websocket.service
    
    echo -e "${GREEN}Services stopped!${NC}"
}

# Function to show status
show_status() {
    echo -e "${YELLOW}Service Status:${NC}"
    echo ""
    echo "WebSocket Server (Port 8768):"
    systemctl status quantum-websocket.service --no-pager | head -n 5
    echo ""
    echo "Dashboard (Port 5174):"
    systemctl status quantum-dashboard.service --no-pager | head -n 5
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}Recent logs:${NC}"
    echo ""
    echo "WebSocket Server logs:"
    journalctl -u quantum-websocket.service -n 10 --no-pager
    echo ""
    echo "Dashboard logs:"
    journalctl -u quantum-dashboard.service -n 10 --no-pager
}

# Main menu
case "$1" in
    install)
        check_root
        install_services
        ;;
    enable)
        check_root
        enable_services
        ;;
    start)
        check_root
        start_services
        ;;
    stop)
        check_root
        stop_services
        ;;
    restart)
        check_root
        stop_services
        sleep 2
        start_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    setup)
        check_root
        install_services
        enable_services
        start_services
        echo ""
        echo -e "${GREEN}Setup complete!${NC}"
        echo ""
        echo "WebSocket server: ws://localhost:8768"
        echo "Dashboard: http://localhost:5174"
        ;;
    remove)
        check_root
        stop_services
        systemctl disable quantum-websocket.service
        systemctl disable quantum-dashboard.service
        rm -f /etc/systemd/system/quantum-websocket.service
        rm -f /etc/systemd/system/quantum-dashboard.service
        systemctl daemon-reload
        echo -e "${GREEN}Services removed!${NC}"
        ;;
    *)
        echo "Usage: $0 {install|enable|start|stop|restart|status|logs|setup|remove}"
        echo ""
        echo "Commands:"
        echo "  setup    - Install, enable and start services (first time setup)"
        echo "  install  - Install service files"
        echo "  enable   - Enable services to start on boot"
        echo "  start    - Start services"
        echo "  stop     - Stop services"
        echo "  restart  - Restart services"
        echo "  status   - Show service status"
        echo "  logs     - Show recent logs"
        echo "  remove   - Remove services completely"
        echo ""
        echo "Quick setup: sudo $0 setup"
        exit 1
        ;;
esac