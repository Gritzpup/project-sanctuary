#!/bin/bash
# Start the Quantum Memory Dashboard

echo "🚀 Starting Quantum Memory Dashboard..."
echo ""
echo "Dashboard will run on: http://localhost:5174"
echo "WebSocket connection: ws://localhost:8768"
echo ""
echo "Make sure the WebSocket server is running on port 8768!"
echo "(You can run: python websocket_server_8768.py)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server
npm run dev