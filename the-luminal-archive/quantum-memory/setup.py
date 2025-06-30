#!/usr/bin/env python3
"""
Setup script for Quantum-Enhanced Memory System
"""
import subprocess
import sys
import os

def setup_environment():
    """Set up the quantum memory development environment."""
    print("🚀 Setting up Quantum-Enhanced Memory System...")
    
    # Check Python version
    if sys.version_info < (3, 9):
        print("❌ Python 3.9+ required")
        sys.exit(1)
    
    # Check CUDA
    cuda_home = os.environ.get('CUDA_HOME', '/usr/local/cuda')
    if not os.path.exists(cuda_home):
        print("⚠️  CUDA not found at", cuda_home)
        print("   Please install CUDA or set CUDA_HOME")
    else:
        print("✅ CUDA found at", cuda_home)
    
    # Install PyTorch with CUDA support first
    print("\n📦 Installing PyTorch with CUDA 12.1 support...")
    subprocess.run([
        sys.executable, "-m", "pip", "install",
        "torch", "torchvision", "torchaudio",
        "--index-url", "https://download.pytorch.org/whl/cu121"
    ], check=True)
    
    # Install other requirements
    print("\n📦 Installing remaining dependencies...")
    subprocess.run([
        sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
    ], check=True)
    
    print("\n✅ Setup complete! Activate environment with:")
    print("   source activate_quantum_env.sh")

if __name__ == "__main__":
    setup_environment()