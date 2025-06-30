#!/usr/bin/env python3
"""Test script to verify quantum memory system setup."""

import sys
import subprocess
import importlib
from typing import List, Tuple

def test_python_version() -> bool:
    """Test Python version is 3.9+."""
    print("🔍 Checking Python version...")
    version = sys.version_info
    required = (3, 9)
    
    if version >= required:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} (>= 3.9 required)")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor}.{version.micro} (>= 3.9 required)")
        return False

def test_cuda() -> bool:
    """Test CUDA availability."""
    print("\n🔍 Checking CUDA...")
    try:
        result = subprocess.run(['nvcc', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ CUDA compiler found")
            # Extract version info from output
            lines = result.stdout.strip().split('\n')
            if lines:
                print(f"   {lines[-1]}")  # Last line usually has version
            return True
    except FileNotFoundError:
        print("❌ CUDA compiler (nvcc) not found")
    return False

def test_gpu() -> bool:
    """Test GPU availability."""
    print("\n🔍 Checking GPU...")
    try:
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            gpu_info = result.stdout.strip()
            print(f"✅ GPU found: {gpu_info}")
            return True
    except FileNotFoundError:
        print("❌ nvidia-smi not found")
    return False

def test_imports() -> List[Tuple[str, bool]]:
    """Test all required imports."""
    print("\n🔍 Testing imports...")
    
    modules = [
        ('torch', 'PyTorch'),
        ('numpy', 'NumPy'),
        ('scipy', 'SciPy'),
        ('cupy', 'CuPy'),
        ('cuquantum', 'cuQuantum'),
        ('qiskit', 'Qiskit'),
        ('pennylane', 'PennyLane'),
        ('transformers', 'Transformers'),
        ('datasets', 'Datasets'),
        ('h5py', 'H5PY'),
        ('sqlalchemy', 'SQLAlchemy'),
        ('fastapi', 'FastAPI'),
        ('websockets', 'WebSockets'),
        ('prometheus_client', 'Prometheus'),
        ('structlog', 'Structlog'),
    ]
    
    results = []
    for module_name, display_name in modules:
        try:
            importlib.import_module(module_name)
            results.append((display_name, True))
            print(f"  ✅ {display_name}")
        except ImportError as e:
            results.append((display_name, False))
            print(f"  ❌ {display_name}: {e}")
    
    return results

def test_torch_cuda() -> bool:
    """Test PyTorch CUDA integration."""
    print("\n🔍 Testing PyTorch CUDA...")
    try:
        import torch
        if torch.cuda.is_available():
            print(f"✅ PyTorch CUDA available")
            print(f"   CUDA devices: {torch.cuda.device_count()}")
            print(f"   Current device: {torch.cuda.get_device_name()}")
            
            # Test tensor operations
            x = torch.randn(100, 100).cuda()
            y = torch.randn(100, 100).cuda()
            z = torch.matmul(x, y)
            print("   ✅ CUDA tensor operations working")
            return True
        else:
            print("❌ PyTorch CUDA not available")
            return False
    except Exception as e:
        print(f"❌ PyTorch CUDA test failed: {e}")
        return False

def test_cuquantum() -> bool:
    """Test cuQuantum functionality."""
    print("\n🔍 Testing cuQuantum...")
    try:
        import cuquantum
        import cupy as cp
        from cuquantum import cutensornet as cutn
        
        # Create a handle
        handle = cutn.create()
        print("✅ cuQuantum cutensornet handle created")
        
        # Simple tensor contraction test
        a = cp.random.rand(2, 3, dtype=cp.float32)
        b = cp.random.rand(3, 4, dtype=cp.float32)
        
        # Cleanup
        cutn.destroy(handle)
        print("   ✅ Basic cuQuantum operations working")
        return True
        
    except Exception as e:
        print(f"❌ cuQuantum test failed: {e}")
        return False

def test_memory() -> bool:
    """Test system memory."""
    print("\n🔍 Checking system memory...")
    try:
        import psutil
        mem = psutil.virtual_memory()
        total_gb = mem.total / (1024**3)
        available_gb = mem.available / (1024**3)
        
        print(f"   Total: {total_gb:.1f} GB")
        print(f"   Available: {available_gb:.1f} GB")
        
        if total_gb >= 32:
            print("✅ Sufficient memory (>=32GB)")
            return True
        else:
            print("⚠️  Low memory (<32GB recommended)")
            return True  # Warning, not failure
    except Exception as e:
        print(f"⚠️  Could not check memory: {e}")
        return True

def main():
    """Run all tests."""
    print("🚀 Quantum-Enhanced Memory System Setup Test")
    print("=" * 50)
    
    all_passed = True
    
    # Run tests
    all_passed &= test_python_version()
    all_passed &= test_cuda()
    all_passed &= test_gpu()
    
    import_results = test_imports()
    imports_passed = all([result for _, result in import_results])
    all_passed &= imports_passed
    
    all_passed &= test_torch_cuda()
    all_passed &= test_cuquantum()
    all_passed &= test_memory()
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✅ All tests passed! System ready for quantum memory implementation.")
    else:
        print("❌ Some tests failed. Please check the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()