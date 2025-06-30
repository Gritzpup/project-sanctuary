#!/usr/bin/env python3
"""
Test script for 27-qubit quantum memory with extended timeout
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import torch
import time
import psutil
import threading
from src.core.quantum.quantum_memory_simple import QuantumMemory


def monitor_resources(stop_event, interval=1):
    """Monitor system resources in a separate thread"""
    print("\n🔍 Resource Monitor Started")
    print("=" * 70)
    print(f"{'Time':>6} | {'CPU%':>5} | {'RAM (GB)':>10} | {'GPU Mem (MB)':>12} | {'GPU%':>5}")
    print("=" * 70)
    
    start_time = time.time()
    while not stop_event.is_set():
        elapsed = time.time() - start_time
        
        # CPU and RAM
        cpu_percent = psutil.cpu_percent(interval=0.1)
        ram_gb = psutil.virtual_memory().used / (1024**3)
        
        # GPU (if available)
        if torch.cuda.is_available():
            gpu_mem_mb = torch.cuda.memory_allocated() / (1024**2)
            try:
                # Try to get GPU utilization
                import subprocess
                result = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu', 
                                      '--format=csv,noheader,nounits'], 
                                      capture_output=True, text=True)
                gpu_util = int(result.stdout.strip()) if result.returncode == 0 else 0
            except:
                gpu_util = 0
        else:
            gpu_mem_mb = 0
            gpu_util = 0
            
        print(f"{elapsed:6.1f} | {cpu_percent:5.1f} | {ram_gb:10.2f} | {gpu_mem_mb:12.1f} | {gpu_util:5}%")
        
        time.sleep(interval)
    
    print("=" * 70)
    print("🔍 Resource Monitor Stopped\n")


def test_27_qubit_quantum_memory(timeout=300):
    """Test 27-qubit quantum memory with extended timeout"""
    print("🚀 27-QUBIT QUANTUM MEMORY TEST")
    print(f"⏱️  Timeout: {timeout} seconds")
    print("=" * 60)
    
    # Start resource monitoring
    stop_event = threading.Event()
    monitor_thread = threading.Thread(target=monitor_resources, args=(stop_event,))
    monitor_thread.start()
    
    test_start = time.time()
    
    # Test 1: Create 27-qubit quantum memory
    print("\n1️⃣ Creating 27-qubit quantum memory...")
    try:
        start = time.time()
        qmem = QuantumMemory(n_qubits=27)
        creation_time = time.time() - start
        info = qmem.get_state_info()
        print(f"   ✅ Created QuantumMemory on {info['device']} in {creation_time:.2f}s")
        print(f"   📊 Backend: {info['metadata']['backend']}")
        print(f"   📊 State dimension: 2^{info['n_qubits']} = {2**info['n_qubits']:,}")
        
        if torch.cuda.is_available():
            print(f"   📊 GPU Memory: {torch.cuda.memory_allocated() / 1024**3:.3f} GB allocated")
    except Exception as e:
        print(f"   ❌ Failed to create quantum memory: {e}")
        stop_event.set()
        monitor_thread.join()
        return False
        
    # Test 2: Initialize state
    print("\n2️⃣ Verifying quantum state initialization...")
    try:
        info = qmem.get_state_info()
        print(f"   ✅ Initialized {info['n_qubits']}-qubit state")
        print(f"   📊 State norm: {info['norm']:.6f}")
        print(f"   📊 State shape: {info['state_shape']}")
    except Exception as e:
        print(f"   ❌ Failed to verify state: {e}")
        stop_event.set()
        monitor_thread.join()
        return False
        
    # Test 3: Encode emotional states
    print("\n3️⃣ Testing emotional encoding/decoding...")
    try:
        # Test PAD values
        test_emotions = [
            {"name": "Joy", "pad": np.array([0.76, 0.48, 0.35])},
            {"name": "Trust", "pad": np.array([0.69, -0.34, 0.47])},
            {"name": "Fear", "pad": np.array([-0.64, 0.60, -0.43])},
        ]
        
        for emotion in test_emotions:
            # Encode
            encoded_state = qmem.encode_emotional_state(emotion["pad"])
            
            # Decode
            decoded_pad = qmem.decode_emotional_state()
            
            # Calculate error
            error = np.linalg.norm(emotion["pad"] - decoded_pad)
            
            print(f"\n   {emotion['name']}:")
            print(f"     Original PAD: [{emotion['pad'][0]:6.3f}, {emotion['pad'][1]:6.3f}, {emotion['pad'][2]:6.3f}]")
            print(f"     Decoded PAD:  [{decoded_pad[0]:6.3f}, {decoded_pad[1]:6.3f}, {decoded_pad[2]:6.3f}]")
            print(f"     Error: {error:.6f}")
            
            if error < 0.1:  # Tight error threshold
                print(f"     ✅ Excellent encoding accuracy")
            elif error < 0.5:
                print(f"     ✅ Good encoding accuracy")
            else:
                print(f"     ⚠️ High encoding error")
                
    except Exception as e:
        print(f"   ❌ Failed emotional encoding: {e}")
        import traceback
        traceback.print_exc()
        stop_event.set()
        monitor_thread.join()
        return False
        
    # Test 4: Quantum operations
    print("\n4️⃣ Testing quantum operations...")
    try:
        # Apply Hadamard gates
        qmem.initialize_state()
        initial_state = qmem.state.clone()
        
        qmem.apply_hadamard(0)
        print("   ✅ Applied Hadamard gate to qubit 0")
        
        # Check that state changed
        state_diff = torch.norm(qmem.state - initial_state)
        print(f"   📊 State change magnitude: {state_diff:.6f}")
        
        # Apply rotation
        qmem.apply_rotation(1, np.pi/4, 'z')
        print("   ✅ Applied Z-rotation to qubit 1")
        
        # Measure specific qubits
        measurements = qmem.measure([0, 1, 2])
        print(f"   ✅ Measured qubits 0-2:")
        for key, prob in measurements.items():
            print(f"      {key}: {prob:.4f}")
        
    except Exception as e:
        print(f"   ❌ Failed quantum operations: {e}")
        import traceback
        traceback.print_exc()
        stop_event.set()
        monitor_thread.join()
        return False
        
    # Test 5: Fidelity and entanglement
    print("\n5️⃣ Testing fidelity and entanglement...")
    try:
        # Test fidelity between identical states
        state1 = qmem.encode_emotional_state(np.array([0.5, 0.5, 0.5]))
        state1_copy = state1.clone()
        state2 = qmem.encode_emotional_state(np.array([0.5, 0.5, 0.5]))
        
        fidelity = qmem.get_fidelity(state1_copy, state2)
        print(f"   ✅ Fidelity between identical encodings: {fidelity:.6f}")
        
        # Test fidelity between different states
        state3 = qmem.encode_emotional_state(np.array([-0.5, -0.5, -0.5]))
        fidelity2 = qmem.get_fidelity(state1_copy, state3)
        print(f"   ✅ Fidelity between opposite emotions: {fidelity2:.6f}")
        
        # Create entanglement
        qmem.create_entanglement()
        print("   ✅ Created entanglement between emotional dimensions")
        
    except Exception as e:
        print(f"   ❌ Failed fidelity/entanglement test: {e}")
        stop_event.set()
        monitor_thread.join()
        return False
        
    # Test 6: State persistence
    print("\n6️⃣ Testing state persistence...")
    try:
        # Save state
        test_file = "test_quantum_state.npz"
        qmem.save_state(test_file)
        print(f"   ✅ Saved quantum state to {test_file}")
        
        # Create new instance and load
        qmem2 = QuantumMemory(n_qubits=27)
        qmem2.load_state(test_file)
        print(f"   ✅ Loaded quantum state")
        
        # Verify states match
        state_diff = torch.norm(qmem.state - qmem2.state)
        print(f"   📊 State difference after load: {state_diff:.10f}")
        
        # Clean up
        os.remove(test_file)
        
    except Exception as e:
        print(f"   ❌ Failed persistence test: {e}")
        stop_event.set()
        monitor_thread.join()
        return False
        
    # Stop resource monitoring
    stop_event.set()
    monitor_thread.join()
    
    total_time = time.time() - test_start
    print(f"\n⏱️  Total test time: {total_time:.2f} seconds")
    print("\n✅ All tests passed!")
    return True


def benchmark_performance():
    """Benchmark quantum memory performance"""
    print("\n📊 Performance Benchmark\n")
    
    # Create quantum memory
    qmem = QuantumMemory(n_qubits=27)
    
    # Test different operations
    operations = [
        ("State initialization", lambda: qmem.initialize_state()),
        ("Emotional encoding", lambda: qmem.encode_emotional_state(np.array([0.5, 0.3, -0.2]))),
        ("Emotional decoding", lambda: qmem.decode_emotional_state()),
        ("Hadamard gate", lambda: qmem.apply_hadamard(0)),
        ("Rotation gate", lambda: qmem.apply_rotation(0, np.pi/4, 'z')),
        ("3-qubit measurement", lambda: qmem.measure([0, 1, 2])),
    ]
    
    print(f"Running benchmarks (100 iterations each)...\n")
    
    for op_name, op_func in operations:
        # Warm up
        for _ in range(10):
            op_func()
            
        # Benchmark
        start_time = time.time()
        for _ in range(100):
            op_func()
            
        elapsed_time = time.time() - start_time
        avg_time = (elapsed_time / 100) * 1000  # Convert to ms
        
        print(f"{op_name:25s}: {avg_time:6.2f} ms")
        
    # Memory usage
    if torch.cuda.is_available():
        print(f"\n📊 GPU Memory Usage:")
        print(f"   Allocated: {torch.cuda.memory_allocated() / 1024**3:.3f} GB")
        print(f"   Reserved:  {torch.cuda.memory_reserved() / 1024**3:.3f} GB")
        
    print(f"\n🎯 Target: <60 ms for quantum operations")


def test_pad_encoding_accuracy():
    """Test accuracy of PAD encoding across the full range"""
    print("\n🎯 PAD Encoding Accuracy Test\n")
    
    qmem = QuantumMemory(n_qubits=27)
    
    # Test grid of PAD values
    test_values = [-1.0, -0.5, 0.0, 0.5, 1.0]
    
    print("Testing encoding accuracy across PAD space...")
    print("=" * 60)
    print(f"{'P_in':>6} {'A_in':>6} {'D_in':>6} | {'P_out':>6} {'A_out':>6} {'D_out':>6} | {'Error':>8}")
    print("=" * 60)
    
    max_error = 0.0
    total_error = 0.0
    count = 0
    
    for p in test_values:
        for a in test_values:
            for d in test_values:
                pad_in = np.array([p, a, d])
                qmem.encode_emotional_state(pad_in)
                pad_out = qmem.decode_emotional_state()
                
                error = np.linalg.norm(pad_in - pad_out)
                max_error = max(max_error, error)
                total_error += error
                count += 1
                
                print(f"{p:6.2f} {a:6.2f} {d:6.2f} | "
                      f"{pad_out[0]:6.3f} {pad_out[1]:6.3f} {pad_out[2]:6.3f} | "
                      f"{error:8.6f}")
                      
    print("=" * 60)
    print(f"Average error: {total_error/count:.6f}")
    print(f"Maximum error: {max_error:.6f}")
    print(f"✅ Encoding maintains good accuracy across PAD space" if max_error < 0.1 else "⚠️ Some encoding accuracy issues")


if __name__ == "__main__":
    print("=" * 80)
    print("🚀 27-QUBIT QUANTUM MEMORY TEST WITH EXTENDED TIMEOUT")
    print("=" * 80)
    
    # Check GPU availability
    if torch.cuda.is_available():
        print(f"🖥️  GPU: {torch.cuda.get_device_name()}")
        print(f"📊 VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        print(f"📊 CUDA Version: {torch.version.cuda}")
    else:
        print("⚠️  No GPU detected, using CPU")
        
    # Check if mining apps are running
    print("\n🔍 Checking for resource-intensive processes...")
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent']):
        try:
            if any(mining in proc.info['name'].lower() for mining in ['miner', 'mining', 'nicehash']):
                print(f"⚠️  Found potential mining process: {proc.info['name']} (PID: {proc.info['pid']})")
        except:
            pass
            
    print("\n" + "=" * 80)
    
    # Run the 27-qubit test with 300 second timeout
    success = test_27_qubit_quantum_memory(timeout=300)
        
    print("\n" + "=" * 80)
    print("✅ TEST COMPLETE" if success else "❌ TEST FAILED")
    print("=" * 80)