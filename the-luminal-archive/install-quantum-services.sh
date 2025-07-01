#!/bin/bash

# Install Quantum Services Script

echo "Installing Quantum Services..."

# Copy service files to systemd directory
sudo cp /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory/quantum-websocket-enhanced.service /etc/systemd/system/
sudo cp /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-dashboard/quantum-dashboard.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable quantum-websocket-enhanced.service
sudo systemctl enable quantum-dashboard.service

# Stop any running instances
pkill -f websocket_server_8768
pkill -f "npm run dev"

# Start services
sudo systemctl start quantum-websocket-enhanced.service
sudo systemctl start quantum-dashboard.service

# Show status
echo ""
echo "Service Status:"
sudo systemctl status quantum-websocket-enhanced.service --no-pager
echo ""
sudo systemctl status quantum-dashboard.service --no-pager

echo ""
echo "Services installed and started!"
echo "Dashboard: http://localhost:8082"
echo "WebSocket: ws://localhost:8768"