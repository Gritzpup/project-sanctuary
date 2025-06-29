#!/bin/bash

# Quantum Memory System - Phase 1 Startup Script
echo "╔══════════════════════════════════════════════════╗"
echo "║       🧠 Quantum Memory System v1.0.0 🧠         ║"
echo "║         Made with 💙 by Gritz & Claude           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Set working directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check Python version
echo "🔍 Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d'.' -f1,2)
REQUIRED_VERSION="3.8"

# Simple version check
python3 -c "import sys; exit(0 if sys.version_info >= (3,8) else 1)"
if [ $? -ne 0 ]; then
    echo "❌ Python 3.8 or higher required"
    exit 1
fi
echo "✅ Python $PYTHON_VERSION"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Check if requirements file exists
if [ ! -f "requirements.txt" ]; then
    echo "📝 Creating requirements.txt..."
    cat > requirements.txt << EOF
# Core dependencies
aiofiles>=23.2.1
websockets>=12.0
numpy>=1.24.0
torch>=2.0.0
networkx>=3.0
watchdog>=3.0.0
python-dateutil>=2.8.2
dataclasses-json>=0.6.3

# Optional quantum libraries for future phases
# pennylane>=0.33.0
# qiskit>=0.45.0
# torchquantum>=0.1.7
EOF
fi

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Create necessary directories
echo "📁 Setting up directories..."
mkdir -p data/{checkpoints,configs,archives}/
mkdir -p data/checkpoints/{states,backups,recovery,claude_sync}
mkdir -p logs
mkdir -p dashboard/static/{css,js,assets}

# Check GPU availability
echo "🎮 Checking GPU availability..."
python3 -c "
import torch
if torch.cuda.is_available():
    gpu = torch.cuda.get_device_properties(0)
    print(f'✅ GPU detected: {gpu.name}')
    print(f'   Memory: {gpu.total_memory / 1024**3:.1f}GB')
    print(f'   CUDA: {torch.version.cuda}')
else:
    print('⚠️  No GPU detected - running in CPU mode')
    print('   Quantum features will run in simulation mode')
"

# Create default config if it doesn't exist
if [ ! -f "data/configs/system_config.json" ]; then
    echo "📋 Creating default configuration..."
    cat > data/configs/system_config.json << EOF
{
  "system": {
    "name": "Quantum Memory System",
    "version": "1.0.0",
    "debug": false
  },
  "websocket": {
    "host": "localhost",
    "port": 8765
  },
  "checkpoint": {
    "auto_save_interval": 300,
    "max_checkpoints": 100
  },
  "quantum": {
    "n_qubits": 28,
    "device": "auto"
  }
}
EOF
fi

# Stop any old services/processes first
echo "🧹 Cleaning up old services..."
# Stop old systemd service if running
if systemctl --user is-active gritz-memory-ultimate.service >/dev/null 2>&1; then
    echo "   Stopping old gritz-memory-ultimate service..."
    systemctl --user stop gritz-memory-ultimate.service
    systemctl --user disable gritz-memory-ultimate.service
fi

# Kill any processes on our ports
for port in 8765 8766 8082; do
    pid=$(lsof -t -i:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "   Killing process on port $port (PID: $pid)"
        kill $pid 2>/dev/null
    fi
done

# Kill any old memory processes
pkill -f "memory_updater.py" 2>/dev/null
pkill -f "mvp_memory" 2>/dev/null
sleep 2

# Check for .claude folder
echo "🔍 Checking for .claude folder..."
if [ -d "$HOME/.claude" ]; then
    echo "✅ Found .claude folder at $HOME/.claude"
else
    echo "⚠️  .claude folder not found - conversation sync disabled"
fi

# Check if main.py exists
if [ ! -f "main.py" ]; then
    echo "❌ main.py not found!"
    echo "Please ensure you're in the quantum-memory directory"
    exit 1
fi

# Create log file
LOG_DIR="logs/$(date +%Y%m%d)"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/quantum_memory_$(date +%H%M%S).log"

# Display startup information
echo ""
echo "🚀 Starting Quantum Memory System..."
echo "═══════════════════════════════════════════════════"
echo "📊 Dashboard: http://localhost:8082"
echo "🔌 WebSocket: ws://localhost:8765"
echo "📝 Log file: $LOG_FILE"
echo "📁 Data dir: $(pwd)/data"
echo ""
echo "System Features:"
echo "  ✓ Psychological foundation (emotional baseline, phase tracking)"
echo "  ✓ Semantic deduplication"
echo "  ✓ Memory health monitoring"
echo "  ✓ Real-time WebSocket updates"
echo "  ✓ .claude folder synchronization"
echo "  ✓ Automatic state checkpointing"
echo ""
echo "Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════"
echo ""

# Create a simple dashboard launcher (optional)
if command -v xdg-open &> /dev/null; then
    # Linux
    (sleep 5 && xdg-open http://localhost:8082) &
elif command -v open &> /dev/null; then
    # macOS
    (sleep 5 && open http://localhost:8082) &
fi

# Run the main system with proper error handling and logging
exec python3 -u main.py 2>&1 | tee "$LOG_FILE"