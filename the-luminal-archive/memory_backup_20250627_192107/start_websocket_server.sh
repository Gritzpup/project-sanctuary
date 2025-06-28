#!/bin/bash
# Start the Smart WebSocket Memory System

echo "🌐 Starting Gritz Memory System with WebSocket Support"
echo "=================================================="
echo ""
echo "This implements your brilliant idea:"
echo "✅ WebSocket status indicator (0 or 1)"
echo "✅ No more constant timestamp updates"
echo "✅ Real-time updates via WebSocket"
echo "✅ Much less disk I/O!"
echo ""

# Check if websockets module is installed
python3 -c "import websockets" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing websockets module..."
    pip3 install --user --break-system-packages websockets
fi

echo "Starting server..."
echo "WebSocket will be available at: ws://localhost:8765"
echo ""
echo "Test it with: ./websocket_test_client.py"
echo ""

# Run the WebSocket version
python3 /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/advanced_memory_updater_ws.py