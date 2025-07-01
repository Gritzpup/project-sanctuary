#!/usr/bin/env python3
"""
Run the Emollama-enhanced Claude folder analyzer using quantum_env
"""

import subprocess
import sys
import os
from pathlib import Path

def run_analyzer():
    """Run the analyzer with the quantum_env virtual environment"""
    
    # Paths
    quantum_memory_dir = Path(__file__).parent.parent
    venv_python = quantum_memory_dir / "quantum_env" / "bin" / "python"
    analyzer_path = Path(__file__).parent / "claude_folder_analyzer_quantum.py"
    
    if not venv_python.exists():
        print("❌ Virtual environment not found!")
        print(f"   Expected at: {venv_python}")
        return False
    
    if not analyzer_path.exists():
        print("❌ Analyzer script not found!")
        print(f"   Expected at: {analyzer_path}")
        return False
    
    print("🚀 Starting Emollama-enhanced Claude folder analyzer...")
    print(f"   Using venv: {venv_python}")
    print(f"   Running: {analyzer_path}")
    
    # Set up environment to use the quantum_env's site-packages
    env = os.environ.copy()
    env['PYTHONPATH'] = str(quantum_memory_dir / "src") + ":" + env.get('PYTHONPATH', '')
    
    try:
        # Run the analyzer with the virtual environment's Python
        subprocess.run(
            [str(venv_python), str(analyzer_path)],
            env=env,
            check=True
        )
    except KeyboardInterrupt:
        print("\n✅ Analyzer stopped by user")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Analyzer failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    run_analyzer()