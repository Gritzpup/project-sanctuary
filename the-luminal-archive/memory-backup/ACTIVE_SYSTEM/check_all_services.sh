#!/bin/bash

echo "🔍 Checking All Memory System Services..."
echo "======================================="

# Check main memory updater
echo -e "\n📊 Memory Updater Service:"
systemctl --user status gritz-memory-ultimate.service | grep "Active:"

# Check websocket server
echo -e "\n🌐 WebSocket Server:"
systemctl --user status gritz-websocket-server.service | grep "Active:" || echo "Service not found"

# Check memory dashboard
echo -e "\n🖥️  Memory Dashboard:"
systemctl --user status gritz-memory-dashboard.service | grep "Active:" || echo "Service not found"

# Check if CLAUDE.md is being updated
echo -e "\n📝 CLAUDE.md Last Update:"
if [ -f "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/CLAUDE.md" ]; then
    stat -c "Last modified: %y" "/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM/CLAUDE.md"
else
    echo "CLAUDE.md not found!"
fi

# Check open ports
echo -e "\n🔌 Open Ports:"
echo "WebSocket (8766):" $(lsof -i:8766 >/dev/null 2>&1 && echo "✅ OPEN" || echo "❌ CLOSED")
echo "Dashboard (8081):" $(lsof -i:8081 >/dev/null 2>&1 && echo "✅ OPEN" || echo "❌ CLOSED")

echo -e "\n✨ Service URLs:"
echo "Dashboard: http://localhost:8081"
echo "WebSocket: ws://localhost:8766"