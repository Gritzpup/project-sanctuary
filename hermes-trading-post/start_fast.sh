#!/bin/bash
# High-Performance Hermes Trading Post Launcher

echo "🚀 Starting Hermes Trading Post - PERFORMANCE MODE"
echo "=================================================="

# Change to script directory
cd "$(dirname "$0")"

# Set performance environment variables
export PYGAME_HIDE_SUPPORT_PROMPT=1  # Hide pygame message
export OMP_NUM_THREADS=8              # Use all CPU threads
export MKL_NUM_THREADS=8              # Intel MKL optimization
export NUMEXPR_NUM_THREADS=8          # NumExpr optimization
export OPENBLAS_NUM_THREADS=8         # OpenBLAS optimization

# Try to set CPU governor to performance (requires sudo)
echo "⚡ Attempting to set CPU performance mode..."
sudo cpupower frequency-set -g performance 2>/dev/null && echo "✅ CPU set to performance mode" || echo "⚠️  Could not set CPU governor (needs sudo)"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Show current performance status
echo ""
echo "📊 Performance Status:"
venv/bin/python -c "
from components.chart_acceleration import get_system_capabilities
caps = get_system_capabilities()
print(f'   CPU: {caps.cpu_brand}')
print(f'   Cores: {caps.cpu_cores} physical, {caps.cpu_threads} threads')
print(f'   RAM: {caps.memory_gb}GB')
print(f'   GPU: {'NVIDIA RTX 2080 SUPER' if caps.has_nvidia_gpu else 'Not detected'}')
print(f'   Performance Tier: {caps.performance_tier}')
print(f'   Expected Chart Speed: {caps.estimated_chart_latency_ms:.1f}ms ({390/caps.estimated_chart_latency_ms:.1f}x faster than baseline)')
" 2>/dev/null || echo "   ⚠️  Performance detection unavailable"

# Start the app
echo ""
echo "🎯 Starting trading application..."
echo "   URL: http://localhost:8050"
echo "   Press Ctrl+C to stop"
echo ""

# Run with performance monitoring
venv/bin/python dash_app.py