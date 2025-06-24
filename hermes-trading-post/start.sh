#!/bin/bash
# Hermes Trading Post - Simple Global Installation

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down Hermes Trading Post..."
    # Kill any python processes related to dash_app
    pkill -f dash_app.py 2>/dev/null || true
    exit 0
}

# Set up trap to catch Ctrl+C and other termination signals
trap cleanup INT TERM EXIT

echo "🚀 Starting Hermes Trading Post..."
echo "=================================="

# Change to script directory
cd "$(dirname "$0")"

# Check if dependencies are installed
if ! python3 -c "import dash" 2>/dev/null; then
    echo "📦 Installing dependencies globally..."
    echo "   (Using --break-system-packages since this is a dedicated machine)"
    
    # Install with --break-system-packages flag for Ubuntu 24.04
    pip3 install --break-system-packages -r requirements.txt
fi

# Run the app directly in production mode
echo ""
echo "🎯 Starting Dash application on http://localhost:8050"
echo "   Press Ctrl+C to stop"
echo ""

# Set debug mode for testing
export DASH_DEBUG=True

# Check if port is already in use
if lsof -Pi :8050 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 8050 is already in use!"
    echo "   Killing existing process..."
    lsof -ti:8050 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Run the app
echo "Starting dashboard app..."
python3 dash_app.py