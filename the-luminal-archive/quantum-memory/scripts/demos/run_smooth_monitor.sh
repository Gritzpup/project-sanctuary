#!/bin/bash
# Run the smooth non-flashing quantum memory monitor

cd "$(dirname "$0")"
echo "🚀 Starting Smooth Quantum Memory Monitor..."
echo "📊 This version eliminates terminal flashing while maintaining real-time updates!"
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the smooth monitor
python3 scripts/monitor_everything_smooth.py