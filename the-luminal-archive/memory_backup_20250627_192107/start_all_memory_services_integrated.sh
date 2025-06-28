#!/bin/bash
# Start ALL memory services with LLM integration

echo "🚀 Starting Integrated Memory System with LLM..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Stop any existing services
echo "🛑 Stopping existing services..."
systemctl --user stop gritz-memory-ultimate.service 2>/dev/null
systemctl --user stop gritz-memory-llm.service 2>/dev/null
pkill -f "advanced_memory_updater_ws.py" 2>/dev/null
pkill -f "llm_memory_service.py" 2>/dev/null

# Start LLM service first
echo "🧠 Starting LLM service..."
systemctl --user start gritz-memory-llm.service

# Wait for LLM to initialize
echo "⏳ Waiting for LLM models to load..."
sleep 5

# Start the integrated WebSocket server with LLM support
echo "🌐 Starting integrated WebSocket memory server..."
source llm_venv/bin/activate
python3 advanced_memory_updater_ws.py &

echo "✅ All services started!"
echo ""
echo "📊 Status:"
echo "- LLM Service: $(systemctl --user is-active gritz-memory-llm.service)"
echo "- WebSocket: ws://localhost:8766"
echo "- Dashboard: http://localhost:8081"
echo ""
echo "🧪 Test with: python3 test_llm_integration.py"