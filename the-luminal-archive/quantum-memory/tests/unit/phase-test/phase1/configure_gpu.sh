#!/bin/bash
# GPU Configuration Script for Quantum Memory System
# Run with: sudo bash configure_gpu.sh

echo "🔧 Configuring GPU for Quantum Memory System..."

# Enable GPU persistence mode
echo "📌 Enabling GPU persistence mode..."
nvidia-smi -pm 1
if [ $? -eq 0 ]; then
    echo "✅ GPU persistence mode enabled"
else
    echo "❌ Failed to enable GPU persistence mode"
    exit 1
fi

# Set GPU power limit to 250W (RTX 2080 Super max)
echo "⚡ Setting GPU power limit to 250W..."
nvidia-smi -pl 250
if [ $? -eq 0 ]; then
    echo "✅ GPU power limit set to 250W"
else
    echo "❌ Failed to set GPU power limit"
    exit 1
fi

# Show current GPU settings
echo ""
echo "📊 Current GPU Settings:"
nvidia-smi --query-gpu=persistence_mode,power.limit --format=csv

# Test PCIe bandwidth
echo ""
echo "🔌 Testing PCIe Bandwidth..."
nvidia-smi -q | grep -A 3 "PCI" | grep -E "(Bus Id|Link)"

# Show Tensor Core info
echo ""
echo "🧮 GPU Compute Capabilities:"
nvidia-smi --query-gpu=compute_cap --format=csv

echo ""
echo "✅ GPU configuration complete!"