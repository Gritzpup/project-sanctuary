#!/bin/bash
# One-time global setup for Hermes Trading Post on dedicated machine

echo "🚀 Hermes Trading Post - Global Setup"
echo "====================================="
echo "⚠️  This will install packages globally on your system"
echo "   Recommended only for dedicated trading machines"
echo ""

# Install all dependencies globally
echo "📦 Installing core dependencies..."
pip3 install --break-system-packages -r requirements_dash.txt

echo ""
echo "🚀 Installing performance dependencies..."
pip3 install --break-system-packages psutil aiohttp

echo ""
echo "🎮 Installing GPU acceleration dependencies (optional)..."
pip3 install --break-system-packages moderngl pygame || echo "⚠️  GPU dependencies failed (optional)"

# If NVIDIA GPU is detected, suggest CUDA
if nvidia-smi &>/dev/null; then
    echo ""
    echo "🎯 NVIDIA GPU detected! For maximum performance:"
    echo "   pip3 install --break-system-packages cupy-cuda12x"
    echo "   (Requires CUDA toolkit installed)"
fi

echo ""
echo "✅ Setup complete! Run ./start.sh to launch the app"