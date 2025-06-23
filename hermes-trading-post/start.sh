#!/bin/bash
# Hermes Trading Post - Simple Global Installation

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

# Set production mode (no debug, no auto-reload)
export DASH_DEBUG=False
python3 dash_app.py