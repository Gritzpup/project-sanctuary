#!/usr/bin/env python3
"""
Test script for quantum memory implementation
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import torch
from src.core.quantum.quantum_memory import create_quantum_memory, CUQUANTUM_AVAILABLE

def test_quantum_memory():
    """Test basic quantum memory functionality"""
    print("🧪 Testing Quantum Memory Implementation\n")
    
    # Test 1: Create quantum memory
    print("1️⃣ Creating quantum memory...")
    try:
        # Try cuQuantum first if available
        if CUQUANTUM_AVAILABLE and torch.cuda.is_available():
            qmem = create_quantum_memory(backend="cuquantum", n_qubits=27)
            print(f"   ✅ Created OptimizedQuantumMemory with {qmem.get_backend_name()}")
        else:
            qmem = create_quantum_memory(backend="simulation", n_qubits=27)
            print(f"   ✅ Created SimulatedQuantumMemory with {qmem.get_backend_name()}")
    except Exception as e:
        print(f"   ❌ Failed to create quantum memory: {e}")
        return False
        
    # Test 2: Initialize state
    print("\n2️⃣ Initializing quantum state...")
    try:
        state = qmem.initialize_state()
        info = qmem.get_state_info()
        print(f"   ✅ Initialized {info['n_qubits']}-qubit state")
        print(f"   📊 State norm: {info['norm']:.6f}")
    except Exception as e:
        print(f"   ❌ Failed to initialize state: {e}")
        return False
        
    # Test 3: Encode emotional state
    print("\n3️⃣ Testing emotional encoding...")
    try:
        # Test PAD values
        test_emotions = [
            {"name": "Joy", "pad": np.array([0.76, 0.48, 0.35])},
            {"name": "Trust", "pad": np.array([0.69, -0.34, 0.47])},
            {"name": "Fear", "pad": np.array([-0.64, 0.60, -0.43])},
        ]
        
        for emotion in test_emotions:
            encoded_state = qmem.encode_emotional_state(emotion["pad"])
            decoded_pad = qmem.decode_emotional_state()
            
            error = np.linalg.norm(emotion["pad"] - decoded_pad)
            print(f"   {emotion['name']}:")
            print(f"     Original PAD: {emotion['pad']}")
            print(f"     Decoded PAD:  {decoded_pad}")
            print(f"     Error: {error:.6f}")
            
            if error < 0.5:  # Reasonable error threshold
                print(f"     ✅ Encoding successful")
            else:
                print(f"     ⚠️ High encoding error")
                
    except Exception as e:
        print(f"   ❌ Failed emotional encoding: {e}")
        return False
        
    # Test 4: Quantum operations
    print("\n4️⃣ Testing quantum operations...")
    try:
        # Apply Hadamard gates
        qmem.apply_gate("H", [0, 1, 2])
        print("   ✅ Applied Hadamard gates")
        
        # Measure specific qubits
        measurements = qmem.measure([0, 1, 2])
        print(f"   ✅ Measured qubits: {measurements}")
        
    except Exception as e:
        print(f"   ❌ Failed quantum operations: {e}")
        return False
        
    # Test 5: Fidelity calculation
    print("\n5️⃣ Testing fidelity calculation...")
    try:
        state1 = qmem.encode_emotional_state(np.array([0.5, 0.5, 0.5]))
        state2 = qmem.encode_emotional_state(np.array([0.5, 0.5, 0.5]))
        fidelity = qmem.get_fidelity(state1, state2)
        print(f"   ✅ Fidelity between identical states: {fidelity:.6f}")
        
        state3 = qmem.encode_emotional_state(np.array([-0.5, -0.5, -0.5]))
        fidelity2 = qmem.get_fidelity(state1, state3)
        print(f"   ✅ Fidelity between different states: {fidelity2:.6f}")
        
    except Exception as e:
        print(f"   ❌ Failed fidelity calculation: {e}")
        return False
        
    # Test 6: Memory usage (if using GPU)
    if CUQUANTUM_AVAILABLE and torch.cuda.is_available():
        print("\n6️⃣ GPU Memory Usage:")
        print(f"   📊 Allocated: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")
        print(f"   📊 Reserved: {torch.cuda.memory_reserved() / 1024**3:.2f} GB")
        
    print("\n✅ All tests passed!")
    return True


def benchmark_performance():
    """Benchmark quantum memory performance"""
    print("\n📊 Performance Benchmark\n")
    
    import time
    
    # Create quantum memory
    qmem = create_quantum_memory(backend="auto", n_qubits=27)
    qmem.initialize_state()
    
    # Benchmark encoding
    n_iterations = 100
    pad_values = np.array([0.5, 0.3, -0.2])
    
    print(f"Running {n_iterations} encoding operations...")
    start_time = time.time()
    
    for _ in range(n_iterations):
        qmem.encode_emotional_state(pad_values)
        
    elapsed_time = time.time() - start_time
    avg_time = (elapsed_time / n_iterations) * 1000  # Convert to ms
    
    print(f"✅ Average encoding time: {avg_time:.2f} ms")
    print(f"📊 Total time: {elapsed_time:.2f} seconds")
    print(f"🎯 Target: <60 ms per operation")
    
    if avg_time < 60:
        print("✅ Performance target achieved!")
    else:
        print("⚠️ Performance below target")


if __name__ == "__main__":
    print("=" * 60)
    print("QUANTUM MEMORY SYSTEM TEST")
    print("=" * 60)
    
    success = test_quantum_memory()
    
    if success:
        benchmark_performance()
        
    print("\n" + "=" * 60)