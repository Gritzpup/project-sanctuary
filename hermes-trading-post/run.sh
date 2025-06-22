#!/bin/bash
# Simple Hermes Trading Post launcher

echo "🚀 Starting Hermes Trading Post..."
echo "=================================="

# Change to script directory
cd "$(dirname "$0")"

# Simple venv activation
if [ -d "venv" ]; then
    echo "✅ Activating virtual environment..."
    source venv/bin/activate
else
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "📦 Installing dependencies..."
    pip install -r requirements_dash.txt
fi

# Run the app
echo ""
echo "🎯 Starting Dash application on http://localhost:8050"
echo "   Press Ctrl+C to stop"
echo ""

python dash_app.py