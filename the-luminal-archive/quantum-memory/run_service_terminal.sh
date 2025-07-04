#!/bin/bash
# Launch the Quantum Memory Service Terminal

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Activate virtual environment if it exists
if [ -d "quantum_env" ]; then
    source quantum_env/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# Check if required packages are installed
python3 -c "import curses, psutil" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing required packages..."
    pip install psutil
fi

# Run the service terminal
python3 scripts/service_terminal.py