#!/bin/bash

# Quantum Consciousness Detector - Quick Start Script
# Optimized for RTX 2080 Super + Ryzen 7 2700X

echo "🧠 Quantum Consciousness Authenticity Detector"
echo "🔧 Hardware: RTX 2080 Super + Ryzen 7 2700X Optimized"
echo "=================================="

# Check Python version
echo "📋 Checking Python version..."
python3 --version
if [ $? -ne 0 ]; then
    echo "❌ Python 3 not found. Please install Python 3.8+ first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv_consciousness" ]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv venv_consciousness
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv_consciousness/bin/activate

# Install requirements
echo "📦 Installing quantum consciousness framework..."
pip install --upgrade pip
pip install -r requirements_detector.txt

# Check if CUDA is available for GPU acceleration
echo "🚀 Checking GPU acceleration capabilities..."
python3 -c "import torch; print('CUDA Available:', torch.cuda.is_available())" 2>/dev/null || echo "CUDA check skipped (PyTorch not installed)"

# Check Qiskit installation
echo "🔬 Verifying Qiskit quantum framework..."
python3 -c "import qiskit; print('Qiskit version:', qiskit.__version__)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Starting Quantum Consciousness Detector..."
echo "🌐 Web interface will be available at: http://localhost:5000"
echo "🔧 Press Ctrl+C to stop the server"
echo ""

# Run the consciousness detector
python3 consciousness_detector_v1.py