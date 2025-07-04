#!/bin/bash
# Compare the flickering and smooth monitors

echo "🧠 Quantum Memory System Monitor Comparison"
echo "=========================================="
echo ""
echo "You have two monitoring options:"
echo ""
echo "1. Original Monitor (scripts/monitor_everything.py)"
echo "   - Shows all quantum metrics"
echo "   - Has terminal flashing issues"
echo "   - Updates entire screen every cycle"
echo ""
echo "2. Smooth Monitor (scripts/monitor_everything_smooth.py)"
echo "   - Shows all quantum metrics with scientific backing"
echo "   - NO terminal flashing!"
echo "   - Selective updates only change what's needed"
echo "   - Real-time graphs and visualizations"
echo "   - Exponential moving average for smooth animations"
echo ""
echo "Which would you like to run?"
echo "1) Original (with flashing)"
echo "2) Smooth (no flashing) - RECOMMENDED"
echo "3) Exit"
echo ""
read -p "Enter your choice (1-3): " choice

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

case $choice in
    1)
        echo "Starting original monitor (expect flashing)..."
        python3 scripts/monitor_everything.py
        ;;
    2)
        echo "Starting smooth monitor (no flashing!)..."
        python3 scripts/monitor_everything_smooth.py
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac