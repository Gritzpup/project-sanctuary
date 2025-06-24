#!/bin/bash
# Hermes Trading Post - Simple Global Installation

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down Hermes Trading Post..."
    # Kill any python processes related to dash_app or patched start
    pkill -f dash_app.py 2>/dev/null || true
    pkill -f hermes_patched_start.py 2>/dev/null || true
    # Clean up temporary files
    rm -f /tmp/hermes_patched_start.py 2>/dev/null || true
    rm -f ./hermes_patched_start.py 2>/dev/null || true
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

# Set environment variables for stability
export DASH_DEBUG=True
export PYGAME_HIDE_SUPPORT_PROMPT=1
export SDL_AUDIODRIVER=dummy
export PYTHONUNBUFFERED=1

# Check if port is already in use
if lsof -Pi :8050 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 8050 is already in use!"
    echo "   Killing existing process..."
    lsof -ti:8050 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Run the app with CPU-only charts to avoid GPU segfaults
echo "Starting dashboard app with CPU-only charts..."

# Create a temporary Python script that patches the chart factory
cat > /tmp/hermes_patched_start.py << 'EOF'
#!/usr/bin/env python3
import sys
import os

# Add the project to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Monkey patch the chart factory to always use CPU chart
def patch_chart_factory():
    from components.chart_acceleration import base_chart
    
    original_create = base_chart.ChartFactory.create_optimal_chart
    
    @staticmethod
    def force_cpu_chart(symbol, width=800, height=600, target_fps=20, prefer_hardware=True):
        """Force CPU chart to avoid GPU segfaults"""
        print(f"[PATCH] Using CPU chart for {symbol} (GPU disabled for stability)")
        
        try:
            from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
            return CPUOptimizedChart(symbol, width, height)
        except Exception as e:
            print(f"[PATCH] Failed to create CPU chart: {e}")
            raise
    
    # Replace the method
    base_chart.ChartFactory.create_optimal_chart = force_cpu_chart
    print("[PATCH] Chart factory patched to use CPU charts only")

# Apply the patch before importing dash_app
patch_chart_factory()

# Now import and run the app
from dash_app import app, server

if __name__ == "__main__":
    print("🚀 Starting Hermes Trading Post with CPU-only charts...")
    print("📊 Dashboard: http://localhost:8050")
    print("⚠️  GPU acceleration temporarily disabled for stability")
    app.run_server(debug=False, host='0.0.0.0', port=8050)
EOF

# Copy the script to current directory and run it
cp /tmp/hermes_patched_start.py ./hermes_patched_start.py
python3 hermes_patched_start.py