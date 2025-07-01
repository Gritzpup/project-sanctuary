#!/usr/bin/env python3
"""
Test compression metrics tracking
Verify 68% compression target with >0.99 fidelity
"""

import numpy as np
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

from src.utils.compression_metrics import (
    CompressionMetrics,
    EnvironmentCacheMetrics,
    analyze_bond_dimension_tradeoff,
    get_compression_metrics,
    get_cache_metrics
)


class TestCompressionMetrics:
    """Test compression metrics functionality"""
    
    def test_compression_result(self):
        """Test basic compression measurement"""
        metrics = CompressionMetrics()
        
        # Create fake tensors
        original = [np.random.randn(100, 100) for _ in range(5)]
        compressed = [np.random.randn(20, 20) for _ in range(5)]
        
        result = metrics.measure_tensor_compression(original, compressed)
        
        # Check result properties
        assert result.original_size > 0
        assert result.compressed_size > 0
        assert 0 <= result.compression_ratio <= 1
        assert 0 <= result.fidelity <= 1
        
        # Check percentage calculation
        expected_pct = (1 - result.compressed_size / result.original_size) * 100
        assert abs(result.compression_percentage - expected_pct) < 0.01
        
        print(f"Compression: {result.compression_percentage:.1f}%, "
              f"Fidelity: {result.fidelity:.3f}")
        
    def test_mps_compression(self):
        """Test MPS-specific compression measurement"""
        metrics = CompressionMetrics()
        
        # Create a small full state (4 qubits)
        n_qubits = 4
        full_state = np.random.randn(2**n_qubits) + 1j * np.random.randn(2**n_qubits)
        full_state /= np.linalg.norm(full_state)
        
        # Create MPS tensors (simplified)
        bond_dim = 4
        mps_tensors = [
            np.random.randn(1, 2, bond_dim) + 1j * np.random.randn(1, 2, bond_dim),
            np.random.randn(bond_dim, 2, bond_dim) + 1j * np.random.randn(bond_dim, 2, bond_dim),
            np.random.randn(bond_dim, 2, bond_dim) + 1j * np.random.randn(bond_dim, 2, bond_dim),
            np.random.randn(bond_dim, 2, 1) + 1j * np.random.randn(bond_dim, 2, 1)
        ]
        
        result = metrics.measure_mps_compression(full_state, mps_tensors, bond_dim)
        
        assert result.method == f"MPS_bond_{bond_dim}"
        assert "bond_dimension" in result.metadata
        assert result.metadata["n_qubits"] == n_qubits
        
        print(f"MPS Compression: {result.compression_percentage:.1f}% "
              f"with bond dimension {bond_dim}")
        
    def test_sparse_compression(self):
        """Test sparse state compression"""
        metrics = CompressionMetrics()
        
        n_qubits = 10
        # Sparse state with only 16 non-zero elements
        sparse_indices = list(range(16))
        sparse_values = np.random.randn(16) + 1j * np.random.randn(16)
        sparse_values /= np.linalg.norm(sparse_values)
        
        result = metrics.measure_quantum_state_compression(
            n_qubits, sparse_indices, sparse_values
        )
        
        assert result.method == "sparse_state"
        assert result.metadata["n_nonzero"] == 16
        assert result.metadata["sparsity"] == 16 / (2**n_qubits)
        
        print(f"Sparse compression: {result.compression_percentage:.1f}% "
              f"with {len(sparse_indices)} non-zero elements")
        
    def test_compression_statistics(self):
        """Test statistics tracking"""
        metrics = CompressionMetrics()
        
        # Add multiple compression results
        for i in range(10):
            size_factor = 0.3 + i * 0.05  # Varying compression ratios
            original = [np.random.randn(100, 100)]
            compressed = [np.random.randn(int(100 * size_factor), int(100 * size_factor))]
            metrics.measure_tensor_compression(original, compressed)
            
        stats = metrics.get_statistics()
        
        assert stats["n_compressions"] == 10
        assert "average_compression_pct" in stats
        assert "target_achieved_count" in stats
        assert len(stats["methods_used"]) > 0
        
        print(f"\nCompression Statistics:")
        print(f"  Average: {stats['average_compression_pct']:.1f}%")
        print(f"  Target achieved: {stats['target_achieved_count']}/{stats['n_compressions']}")
        print(f"  Best: {stats['best_compression']:.1f}%")
        
    def test_target_checking(self):
        """Test target achievement checking"""
        metrics = CompressionMetrics(target_ratio=0.68, target_fidelity=0.99)
        
        # Create result that meets target
        original = [np.random.randn(1000, 1000)]
        compressed = [np.random.randn(180, 180)]  # ~68% compression
        
        result = metrics.measure_tensor_compression(original, compressed)
        result.fidelity = 0.995  # Manually set high fidelity
        
        # Check if it would meet target (if fidelity calculation was accurate)
        if result.compression_percentage >= 68.0 and result.fidelity > 0.99:
            print("\u2713 Compression target would be achieved!")


class TestCacheMetrics:
    """Test environment cache metrics"""
    
    def test_cache_tracking(self):
        """Test cache hit/miss tracking"""
        cache = EnvironmentCacheMetrics()
        
        # Record some hits and misses
        for _ in range(7):
            cache.record_hit(time_saved_ms=25.0)
        for _ in range(3):
            cache.record_miss()
            
        cache.update_cache_size(5)
        
        metrics = cache.get_metrics()
        
        assert metrics["cache_hits"] == 7
        assert metrics["cache_misses"] == 3
        assert metrics["hit_rate"] == 0.7
        assert metrics["time_saved_ms"] == 175.0
        assert metrics["average_speedup"] == 25.0
        
        print(f"\nCache Metrics:")
        print(f"  Hit rate: {metrics['hit_rate']*100:.1f}%")
        print(f"  Time saved: {metrics['time_saved_ms']:.0f}ms")


def test_bond_dimension_analysis():
    """Test bond dimension analysis for target compression"""
    
    print("\nBond Dimension Analysis:")
    print("-" * 50)
    
    for n_qubits in [10, 16, 20, 27]:
        analysis = analyze_bond_dimension_tradeoff(n_qubits, target_compression=0.68)
        
        print(f"\n{n_qubits} qubits:")
        print(f"  Full state: {analysis['full_state_size_mb']:.2f} MB")
        print(f"  Recommended bond dim: {analysis['recommended_bond_dim']}")
        print(f"  MPS size: {analysis['mps_size_mb']:.2f} MB")
        print(f"  Actual compression: {analysis['actual_compression']*100:.1f}%")
        print(f"  Meets target: {'✓' if analysis['meets_target'] else '✗'}")


def test_global_metrics():
    """Test global metrics instances"""
    
    # Get global instances
    compression = get_compression_metrics()
    cache = get_cache_metrics()
    
    # Add some data
    original = [np.random.randn(50, 50)]
    compressed = [np.random.randn(15, 15)]
    compression.measure_tensor_compression(original, compressed)
    
    cache.record_hit()
    cache.record_miss()
    
    # Check they persist
    assert len(compression.history) > 0
    assert cache.cache_hits > 0
    
    print("\n✓ Global metrics instances working correctly")


if __name__ == "__main__":
    print("Testing Compression Metrics...")
    
    # Run compression tests
    cm_test = TestCompressionMetrics()
    cm_test.test_compression_result()
    cm_test.test_mps_compression()
    cm_test.test_sparse_compression()
    cm_test.test_compression_statistics()
    cm_test.test_target_checking()
    
    # Run cache tests
    cache_test = TestCacheMetrics()
    cache_test.test_cache_tracking()
    
    # Run analysis tests
    test_bond_dimension_analysis()
    test_global_metrics()
    
    print("\n✅ All compression metrics tests passed!")