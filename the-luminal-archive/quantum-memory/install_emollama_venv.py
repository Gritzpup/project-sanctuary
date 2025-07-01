#!/usr/bin/env python3
"""
Install Emollama dependencies in quantum_env virtual environment
"""

import subprocess
import sys
import os
from pathlib import Path

def install_in_venv():
    """Install all dependencies in the quantum_env"""
    
    # Paths
    quantum_memory_dir = Path(__file__).parent
    venv_dir = quantum_memory_dir / "quantum_env"
    venv_python = venv_dir / "bin" / "python"
    venv_pip = venv_dir / "bin" / "pip"
    
    if not venv_python.exists():
        print("❌ Virtual environment not found!")
        print(f"   Expected at: {venv_python}")
        return False
    
    print(f"✅ Found virtual environment at: {venv_dir}")
    
    # Packages needed for Emollama
    packages = [
        'transformers==4.36.2',
        'torch>=2.1.0',
        'accelerate>=0.25.0',
        'bitsandbytes==0.41.3',
        'sentencepiece>=0.1.99',
        'protobuf>=3.20.0',
        'watchdog>=3.0.0',  # For file monitoring
        'aiofiles>=23.2.1'
    ]
    
    print("\n📦 Installing packages in virtual environment...")
    for package in packages:
        print(f"   Installing {package}...")
        try:
            subprocess.run(
                [str(venv_pip), "install", package],
                check=True,
                capture_output=True,
                text=True
            )
            print(f"   ✅ {package} installed")
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Failed to install {package}: {e.stderr}")
            
    print("\n✅ Installation complete!")
    print(f"\nTo use this environment:")
    print(f"   source {venv_dir}/bin/activate")
    print(f"   python3 run_emollama_analyzer.py")
    
    return True

if __name__ == "__main__":
    install_in_venv()