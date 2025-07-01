#!/bin/bash
# Quick check for quantum services

echo "🔍 Checking Quantum Memory Services..."
echo ""

# Check if services are active
echo "Service Status:"
if systemctl is-active --quiet quantum-websocket.service; then
    echo "✅ WebSocket server is running"
else
    echo "❌ WebSocket server is not running"
fi

if systemctl is-active --quiet quantum-dashboard.service; then
    echo "✅ Dashboard is running"
else
    echo "❌ Dashboard is not running"
fi

echo ""
echo "Port Status:"

# Check ports
if netstat -tuln 2>/dev/null | grep -q ":8768 "; then
    echo "✅ Port 8768 (WebSocket) is listening"
else
    echo "❌ Port 8768 (WebSocket) is not listening"
fi

if netstat -tuln 2>/dev/null | grep -q ":5174 "; then
    echo "✅ Port 5174 (Dashboard) is listening"
else
    echo "❌ Port 5174 (Dashboard) is not listening"
fi

echo ""
echo "Access URLs:"
echo "📊 Dashboard: http://localhost:5174"
echo "🔌 WebSocket: ws://localhost:8768"