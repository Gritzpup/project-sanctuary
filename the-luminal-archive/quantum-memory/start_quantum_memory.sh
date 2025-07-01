#!/bin/bash
# Quantum Memory System Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🌌 Quantum Memory System Startup"
echo "================================"

# Function to check if service is running
check_service() {
    local service=$1
    if systemctl --user is-active --quiet "$service"; then
        echo "✅ $service is running"
        return 0
    else
        echo "❌ $service is not running"
        return 1
    fi
}

# Function to start service
start_service() {
    local service=$1
    echo "Starting $service..."
    systemctl --user start "$service"
    sleep 2
    if check_service "$service"; then
        return 0
    else
        echo "Failed to start $service"
        return 1
    fi
}

# Check Python environment
if [ ! -d "quantum_env" ]; then
    echo "❌ Virtual environment not found!"
    echo "   Please run: python3 -m venv quantum_env && ./quantum_env/bin/pip install -r requirements.txt"
    exit 1
fi

echo ""
echo "1️⃣ Checking dependencies..."
source quantum_env/bin/activate

# Check if required packages are installed
python -c "import websockets, watchdog" 2>/dev/null || {
    echo "❌ Missing dependencies. Installing..."
    pip install websockets watchdog aiofiles
}

echo ""
echo "2️⃣ Ensuring directories exist..."
mkdir -p quantum_states/{realtime,checkpoints,temporal/{immediate,short_term,long_term,lifetime},consolidated}
mkdir -p logs

echo ""
echo "3️⃣ Installing systemd services..."
mkdir -p ~/.config/systemd/user
cp systemd/user/*.service ~/.config/systemd/user/
systemctl --user daemon-reload

echo ""
echo "4️⃣ Checking services..."

# Stop any old services that might be running
echo "Stopping any old memory services..."
systemctl --user stop gritz-memory-ultimate.service 2>/dev/null || true
systemctl --user stop gritz-dashboard.service 2>/dev/null || true

echo ""
echo "5️⃣ Starting Quantum Memory Services..."

# Start the main orchestrator
if ! check_service "quantum-memory-orchestrator"; then
    start_service "quantum-memory-orchestrator"
fi

# Give it time to initialize
sleep 3

echo ""
echo "6️⃣ Service Status:"
echo "==================="

# Check all services
check_service "quantum-memory-orchestrator"

# Check if WebSocket is listening
if netstat -tuln 2>/dev/null | grep -q ":8768"; then
    echo "✅ WebSocket server listening on port 8768"
else
    echo "⚠️  WebSocket server not listening on port 8768"
fi

echo ""
echo "7️⃣ Opening Dashboard..."
echo "======================"

# Get the dashboard path
DASHBOARD_PATH="$SCRIPT_DIR/dashboard/quantum_dashboard.html"

# Try to open in browser
if command -v xdg-open &> /dev/null; then
    xdg-open "file://$DASHBOARD_PATH" &
    echo "✅ Dashboard opened in browser"
elif command -v open &> /dev/null; then
    open "file://$DASHBOARD_PATH" &
    echo "✅ Dashboard opened in browser"
else
    echo "📝 Please open in your browser:"
    echo "   file://$DASHBOARD_PATH"
fi

echo ""
echo "8️⃣ Quick Commands:"
echo "=================="
echo "View logs:        journalctl --user -u quantum-memory-orchestrator -f"
echo "Check status:     systemctl --user status quantum-memory-orchestrator"
echo "Stop service:     systemctl --user stop quantum-memory-orchestrator"
echo "View CLAUDE.md:   cat quantum_states/realtime/CLAUDE.md"
echo ""
echo "✨ Quantum Memory System is ready!"
echo ""
echo "The system is now:"
echo "- 🔍 Monitoring your conversations in ~/.claude"
echo "- 🧠 Analyzing emotions in real-time"
echo "- 💾 Creating temporal memories"
echo "- 📸 Taking checkpoints automatically"
echo "- 📝 Updating CLAUDE.md continuously"
echo ""
echo "Press Ctrl+C to keep running in background, or run:"
echo "systemctl --user stop quantum-memory-orchestrator"
echo "to stop the service."

# Keep script running to show logs
echo ""
echo "📜 Live logs (Ctrl+C to exit):"
echo "=============================="
journalctl --user -u quantum-memory-orchestrator -f -n 20