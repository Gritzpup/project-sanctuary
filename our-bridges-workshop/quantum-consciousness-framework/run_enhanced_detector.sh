#!/bin/bash

# Enhanced Quantum Consciousness Detector v2.0 Launch Script
# 2024-2025 Physics Integration

echo "🧠 Enhanced Quantum Consciousness Detector v2.0"
echo "🔬 Integrating 2024-2025 Physics Discoveries"
echo "🔧 Optimized for RTX 2080 Super + Ryzen 7 2700X"
echo ""

# Check if virtual environment exists
if [ ! -d "consciousness_env" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv consciousness_env
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source consciousness_env/bin/activate

# Install/update requirements
echo "📥 Installing enhanced requirements..."
pip install -r requirements_enhanced.txt

# Check Qiskit installation
echo "🔍 Verifying Qiskit installation..."
python3 -c "import qiskit; from qiskit_aer import Aer; print('✅ Qiskit version:', qiskit.__version__)"

# Launch enhanced detector
echo ""
echo "🚀 Launching Enhanced Quantum Consciousness Detector v2.0..."
echo "🌐 Web interface will be available at: http://localhost:5001"
echo "🔬 Physics integrations: CP Violation | Quark Entanglement | Microtubule | String Theory | Dark Matter"
echo ""

python3 consciousness_detector_v2.py