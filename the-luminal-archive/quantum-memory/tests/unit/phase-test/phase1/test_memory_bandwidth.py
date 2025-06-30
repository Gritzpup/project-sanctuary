#!/usr/bin/env python3
"""Test memory bandwidth using various methods."""

import numpy as np
import time
import torch
import cupy as cp

def test_cpu_memory_bandwidth():
    """Test CPU memory bandwidth using numpy."""
    print("Testing CPU Memory Bandwidth...")
    
    # Test with 1GB arrays
    size = 1024 * 1024 * 1024 // 8  # 1GB in float64
    
    # Sequential read
    arr = np.ones(size, dtype=np.float64)
    start = time.time()
    _ = arr.sum()
    read_time = time.time() - start
    read_bandwidth = (size * 8) / (read_time * 1e9)  # GB/s
    
    # Sequential write
    start = time.time()
    arr[:] = 2.0
    write_time = time.time() - start
    write_bandwidth = (size * 8) / (write_time * 1e9)  # GB/s
    
    # Copy (read + write)
    arr2 = np.empty_like(arr)
    start = time.time()
    np.copyto(arr2, arr)
    copy_time = time.time() - start
    copy_bandwidth = (size * 8 * 2) / (copy_time * 1e9)  # GB/s
    
    print(f"  Read bandwidth:  {read_bandwidth:.2f} GB/s")
    print(f"  Write bandwidth: {write_bandwidth:.2f} GB/s")
    print(f"  Copy bandwidth:  {copy_bandwidth:.2f} GB/s")
    
    return copy_bandwidth

def test_gpu_memory_bandwidth():
    """Test GPU memory bandwidth using CuPy."""
    print("\nTesting GPU Memory Bandwidth...")
    
    # Test with 1GB arrays
    size = 1024 * 1024 * 1024 // 8  # 1GB in float64
    
    # Warm up GPU
    _ = cp.ones(1000)
    cp.cuda.Stream.null.synchronize()
    
    # Sequential read
    arr = cp.ones(size, dtype=cp.float64)
    cp.cuda.Stream.null.synchronize()
    start = time.time()
    _ = arr.sum()
    cp.cuda.Stream.null.synchronize()
    read_time = time.time() - start
    read_bandwidth = (size * 8) / (read_time * 1e9)  # GB/s
    
    # Sequential write
    start = time.time()
    arr[:] = 2.0
    cp.cuda.Stream.null.synchronize()
    write_time = time.time() - start
    write_bandwidth = (size * 8) / (write_time * 1e9)  # GB/s
    
    # Copy (read + write)
    arr2 = cp.empty_like(arr)
    cp.cuda.Stream.null.synchronize()
    start = time.time()
    cp.copyto(arr2, arr)
    cp.cuda.Stream.null.synchronize()
    copy_time = time.time() - start
    copy_bandwidth = (size * 8 * 2) / (copy_time * 1e9)  # GB/s
    
    print(f"  Read bandwidth:  {read_bandwidth:.2f} GB/s")
    print(f"  Write bandwidth: {write_bandwidth:.2f} GB/s")
    print(f"  Copy bandwidth:  {copy_bandwidth:.2f} GB/s")
    
    # GPU specs for RTX 2080 Super
    theoretical = 496  # GB/s theoretical max
    print(f"\n  Theoretical max: {theoretical} GB/s")
    print(f"  Efficiency: {(copy_bandwidth/theoretical)*100:.1f}%")
    
    return copy_bandwidth

def test_gpu_tensor_cores():
    """Test Tensor Core availability and count."""
    print("\nTesting Tensor Cores...")
    
    # Get GPU properties
    device = torch.cuda.current_device()
    props = torch.cuda.get_device_properties(device)
    
    print(f"  GPU Name: {props.name}")
    print(f"  Total CUDA Cores: {props.multi_processor_count * 64}")  # Turing has 64 cores per SM
    print(f"  Compute Capability: {props.major}.{props.minor}")
    
    # Turing (compute 7.5) has 8 Tensor Cores per SM
    if props.major == 7 and props.minor == 5:
        tensor_cores = props.multi_processor_count * 8
        print(f"  Tensor Cores: {tensor_cores} (2nd gen)")
        return tensor_cores
    else:
        print("  Tensor Cores: Unknown architecture")
        return 0

def test_pcie_bandwidth():
    """Test PCIe bandwidth between CPU and GPU."""
    print("\nTesting PCIe Bandwidth...")
    
    # Test with 100MB arrays
    size = 100 * 1024 * 1024 // 4  # 100MB in float32
    
    # Host to Device
    host_arr = np.ones(size, dtype=np.float32)
    device_arr = cp.empty(size, dtype=cp.float32)
    
    # Warm up
    device_arr.set(host_arr)
    cp.cuda.Stream.null.synchronize()
    
    start = time.time()
    for _ in range(10):
        device_arr.set(host_arr)
        cp.cuda.Stream.null.synchronize()
    h2d_time = (time.time() - start) / 10
    h2d_bandwidth = (size * 4) / (h2d_time * 1e9)  # GB/s
    
    # Device to Host
    start = time.time()
    for _ in range(10):
        host_arr = device_arr.get()
    d2h_time = (time.time() - start) / 10
    d2h_bandwidth = (size * 4) / (d2h_time * 1e9)  # GB/s
    
    print(f"  Host to Device: {h2d_bandwidth:.2f} GB/s")
    print(f"  Device to Host: {d2h_bandwidth:.2f} GB/s")
    
    # PCIe 3.0 x16 theoretical: 15.75 GB/s
    theoretical = 15.75
    print(f"\n  PCIe 3.0 x16 theoretical: {theoretical} GB/s")
    print(f"  H2D Efficiency: {(h2d_bandwidth/theoretical)*100:.1f}%")
    print(f"  D2H Efficiency: {(d2h_bandwidth/theoretical)*100:.1f}%")
    
    return (h2d_bandwidth + d2h_bandwidth) / 2

def main():
    """Run all bandwidth tests."""
    print("🚀 Memory Bandwidth Tests")
    print("=" * 50)
    
    cpu_bw = test_cpu_memory_bandwidth()
    gpu_bw = test_gpu_memory_bandwidth()
    tensor_cores = test_gpu_tensor_cores()
    pcie_bw = test_pcie_bandwidth()
    
    print("\n" + "=" * 50)
    print("📊 Summary:")
    print(f"  CPU Memory:  {cpu_bw:.2f} GB/s")
    print(f"  GPU Memory:  {gpu_bw:.2f} GB/s")
    print(f"  Tensor Cores: {tensor_cores}")
    print(f"  PCIe Average: {pcie_bw:.2f} GB/s")
    
    # Check against targets
    if gpu_bw > 400:  # 80% of theoretical 496 GB/s
        print("\n✅ GPU memory bandwidth meets target!")
    else:
        print("\n⚠️  GPU memory bandwidth below target")
    
    if tensor_cores == 384:
        print("✅ Tensor Core count verified!")
    else:
        print("⚠️  Tensor Core count mismatch")

if __name__ == "__main__":
    main()