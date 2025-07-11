#!/bin/bash

# Start Quantum Dashboard with BTC Trading Chart

echo "🌌 Starting Quantum Memory Dashboard with BTC Trading Chart..."

# Navigate to the dashboard directory
cd "$(dirname "$0")"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is required but not installed"
    exit 1
fi

# Start a simple HTTP server on port 8888
echo "📊 Starting dashboard server on http://localhost:8888"
echo "✨ Opening quantum_dashboard_with_btc.html"
echo ""
echo "🌐 Access the dashboard at: http://localhost:8888/quantum_dashboard_with_btc.html"
echo "📈 The BTC chart will load historical data and update every minute"
echo ""
echo "Press Ctrl+C to stop the server"

# Start the server
python3 -m http.server 8888 --bind localhost