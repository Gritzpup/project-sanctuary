#!/bin/bash
# Run the ncurses-based quantum memory monitor
# No flicker, smooth updates, full visibility

cd "$(dirname "$0")"

echo "Starting Quantum Memory Monitor (NCurses Edition)..."
echo "Press 'q' to quit"
echo ""

# Run the monitor
python3 scripts/monitor_ncurses.py