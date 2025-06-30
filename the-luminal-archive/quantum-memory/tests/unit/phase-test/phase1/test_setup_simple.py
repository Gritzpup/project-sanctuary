#!/usr/bin/env python3
"""
Test script to verify quantum memory environment setup
"""
import sys

def test_cuda():
    """Test CUDA availability."""
    try:
        import torch
        if torch.cuda.is_available():
            print(f"✅ CUDA available: {torch.cuda.get_device_name(0)}")
            print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
            return True
        else:
            print("❌ CUDA not available")
            return False
    except ImportError:
        print("❌ PyTorch not installed")
        return False

def test_cuquantum():
    """Test cuQuantum installation."""
    try:
        import cuquantum
        print("✅ cuQuantum imported successfully")
        return True
    except ImportError:
        print("⚠️  cuQuantum not installed (install with: pip install cuquantum-python)")
        return False

def test_quantum_libs():
    """Test quantum computing libraries."""
    libs = {
        'qiskit': 'Qiskit',
        'pennylane': 'PennyLane',
        'numpy': 'NumPy',
        'scipy': 'SciPy'
    }
    
    all_good = True
    for module, name in libs.items():
        try:
            __import__(module)
            print(f"✅ {name} imported successfully")
        except ImportError:
            print(f"❌ {name} not installed")
            all_good = False
    
    return all_good

def main():
    """Run all tests."""
    print("🔬 Testing Quantum Memory Environment Setup\n")
    
    results = []
    results.append(("CUDA", test_cuda()))
    print()
    results.append(("cuQuantum", test_cuquantum()))
    print()
    results.append(("Quantum Libraries", test_quantum_libs()))
    
    print("\n📊 Summary:")
    all_passed = all(result[1] for result in results)
    
    for test_name, passed in results:
        status = "✅" if passed else "❌"
        print(f"   {status} {test_name}")
    
    if all_passed:
        print("\n🎉 All tests passed! Environment is ready.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please install missing dependencies.")
        sys.exit(1)

if __name__ == "__main__":
    main()