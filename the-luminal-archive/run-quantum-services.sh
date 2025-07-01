#!/bin/bash
# Simple runner for quantum services (no systemd)

echo "🚀 Starting Quantum Memory Services..."
echo ""

# Kill any existing instances
pkill -f "websocket_server_8768.py" 2>/dev/null
pkill -f "npm run dev.*5174" 2>/dev/null

# Start WebSocket server in background
echo "Starting WebSocket server on port 8768..."
cd /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-memory
./quantum_env/bin/python websocket_server_8768.py &
WEBSOCKET_PID=$!
echo "WebSocket server PID: $WEBSOCKET_PID"

# Give it a moment to start
sleep 2

# Start dashboard in background
echo "Starting dashboard on port 5174..."
cd /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/quantum-dashboard
npm run dev -- --host &
DASHBOARD_PID=$!
echo "Dashboard PID: $DASHBOARD_PID"

echo ""
echo "✅ Services started!"
echo ""
echo "📊 Dashboard: http://localhost:5174"
echo "🔌 WebSocket: ws://localhost:8768"
echo ""
echo "To stop: Press Ctrl+C or run: pkill -f websocket_server_8768"
echo ""

# Wait for Ctrl+C
trap 'echo "Stopping services..."; kill $WEBSOCKET_PID $DASHBOARD_PID 2>/dev/null; exit' INT
wait