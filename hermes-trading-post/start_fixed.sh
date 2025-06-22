#!/bin/bash
# Hermes Trading Post - Fixed Startup Script

echo "🚀 Starting Hermes Trading Post..."
echo "=================================="

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# If we're already in any venv, deactivate it
if [ -n "$VIRTUAL_ENV" ]; then
    echo "📍 Deactivating current virtual environment..."
    deactivate 2>/dev/null || true
fi

# Now activate our project venv
if [ -d "venv" ]; then
    echo "✅ Activating project virtual environment..."
    source venv/bin/activate
else
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
fi

# Install dependencies if needed
if [ ! -f "venv/.deps_installed" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    # Try GPU dependencies first, fallback to CPU-only if it fails
    if pip install -r requirements_chart_acceleration.txt; then
        echo "✅ GPU acceleration dependencies installed"
    else
        echo "⚠️  GPU dependencies failed, installing CPU-only dependencies..."
        pip install -r requirements_dash.txt
    fi
    touch venv/.deps_installed
    echo "✅ Dependencies installed"
fi

# Check for GPU capabilities
echo ""
echo "🔍 Detecting hardware capabilities..."
python -c "from components.chart_acceleration import get_system_capabilities; caps = get_system_capabilities(); print(f'   System: {caps}')" 2>/dev/null || echo "   ⚠️  Chart acceleration not yet initialized"

# Start the Dash application
echo ""
echo "🎯 Starting Dash application on http://localhost:8050"
echo "   Press Ctrl+C to stop"
echo ""

python dash_app.py