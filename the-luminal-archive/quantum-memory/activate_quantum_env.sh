#!/bin/bash
# Activation script for Quantum Memory Environment

# Activate virtual environment
source quantum_env/bin/activate

# Set CUDA paths
export PATH=/usr/local/cuda/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH
export CUDA_HOME=/usr/local/cuda

# Set cuQuantum paths
export CUQUANTUM_ROOT=/usr/local/cuda
export LD_LIBRARY_PATH=$CUQUANTUM_ROOT/lib64:$LD_LIBRARY_PATH

# Fix cuQuantum library loading order for CUDA 12.9
export LD_PRELOAD=/usr/local/cuda/lib64/libcublas.so.12:/usr/local/cuda/lib64/libcusolver.so.11

# Display environment info
echo "Quantum Memory Environment Activated!"
echo "Python: $(which python)"
echo "CUDA: $CUDA_HOME"
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null || echo 'Not detected')"