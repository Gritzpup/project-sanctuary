#!/bin/bash
# Run the optimized ncurses monitor with double buffering

cd "$(dirname "$0")"

echo "Starting Optimized Quantum Memory Monitor..."
echo "This version uses double buffering to eliminate flicker"
echo ""

python3 scripts/monitor_ncurses_optimized.py

echo ""
echo "Monitor stopped."