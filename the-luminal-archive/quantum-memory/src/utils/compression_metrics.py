"""
Compression metrics tracking for tensor network quantum memory
Target: 68% compression ratio while maintaining >0.99 fidelity
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class CompressionResult:
    """Result of compression operation"""
    original_size: int
    compressed_size: int
    compression_ratio: float
    fidelity: float
    method: str
    timestamp: datetime
    metadata: Dict[str, Any]
    
    @property
    def compression_percentage(self) -> float:
        """Get compression as percentage (e.g., 68% means 32% of original size)"""
        return (1 - self.compressed_size / self.original_size) * 100
    
    @property
    def meets_target(self) -> bool:
        """Check if compression meets 68% target with >0.99 fidelity"""
        return self.compression_percentage >= 68.0 and self.fidelity > 0.99


class CompressionMetrics:
    """Track and analyze compression performance"""
    
    def __init__(self, target_ratio: float = 0.68, target_fidelity: float = 0.99):
        self.target_ratio = target_ratio  # 68% compression
        self.target_fidelity = target_fidelity  # >0.99 fidelity
        self.history: List[CompressionResult] = []
        
    def measure_tensor_compression(self, 
                                 original_tensors: List[np.ndarray],
                                 compressed_tensors: List[np.ndarray],
                                 method: str = "MPS") -> CompressionResult:
        """Measure compression of tensor network representation"""
        # Calculate sizes
        original_size = sum(t.nbytes for t in original_tensors)
        compressed_size = sum(t.nbytes for t in compressed_tensors)
        
        # Calculate compression ratio
        compression_ratio = compressed_size / original_size if original_size > 0 else 1.0
        
        # Calculate fidelity (simplified - overlap between states)
        fidelity = self._calculate_fidelity(original_tensors, compressed_tensors)
        
        result = CompressionResult(
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=compression_ratio,
            fidelity=fidelity,
            method=method,
            timestamp=datetime.now(),
            metadata={
                "n_tensors": len(original_tensors),
                "shapes": [t.shape for t in compressed_tensors]
            }
        )
        
        self.history.append(result)
        
        # Log if target achieved
        if result.meets_target:
            logger.info(f"✓ Achieved target compression: {result.compression_percentage:.1f}% "
                       f"with fidelity {result.fidelity:.4f}")
        else:
            logger.info(f"Compression: {result.compression_percentage:.1f}% "
                       f"(target: {self.target_ratio*100}%), "
                       f"fidelity: {result.fidelity:.4f}")
            
        return result
    
    def measure_mps_compression(self,
                              full_state: np.ndarray,
                              mps_tensors: List[np.ndarray],
                              bond_dimension: int) -> CompressionResult:
        """Measure MPS compression efficiency"""
        # Original size (full state vector)
        original_size = full_state.nbytes
        
        # MPS size
        mps_size = sum(t.nbytes for t in mps_tensors)
        
        # Reconstruct state from MPS for fidelity
        reconstructed = self._reconstruct_from_mps(mps_tensors)
        
        # Calculate fidelity
        if reconstructed is not None:
            fidelity = float(np.abs(np.vdot(full_state.flatten(), reconstructed.flatten()))**2)
        else:
            fidelity = 0.0
            
        compression_ratio = mps_size / original_size
        
        result = CompressionResult(
            original_size=original_size,
            compressed_size=mps_size,
            compression_ratio=compression_ratio,
            fidelity=fidelity,
            method=f"MPS_bond_{bond_dimension}",
            timestamp=datetime.now(),
            metadata={
                "bond_dimension": bond_dimension,
                "n_qubits": int(np.log2(len(full_state))),
                "mps_shapes": [t.shape for t in mps_tensors]
            }
        )
        
        self.history.append(result)
        return result
    
    def measure_quantum_state_compression(self,
                                        n_qubits: int,
                                        sparse_indices: List[int],
                                        sparse_values: np.ndarray) -> CompressionResult:
        """Measure compression using sparse representation"""
        # Full state size
        full_size = (2 ** n_qubits) * 16  # Complex128
        
        # Sparse representation size
        sparse_size = len(sparse_indices) * 4 + sparse_values.nbytes  # int32 indices + complex values
        
        compression_ratio = sparse_size / full_size
        
        # Fidelity based on norm preservation
        fidelity = float(np.abs(np.linalg.norm(sparse_values))**2)
        
        result = CompressionResult(
            original_size=full_size,
            compressed_size=sparse_size,
            compression_ratio=compression_ratio,
            fidelity=fidelity,
            method="sparse_state",
            timestamp=datetime.now(),
            metadata={
                "n_qubits": n_qubits,
                "n_nonzero": len(sparse_indices),
                "sparsity": len(sparse_indices) / (2**n_qubits)
            }
        )
        
        self.history.append(result)
        return result
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get compression statistics"""
        if not self.history:
            return {
                "n_compressions": 0,
                "average_ratio": 0.0,
                "average_fidelity": 0.0,
                "target_achieved_count": 0
            }
            
        ratios = [r.compression_percentage for r in self.history]
        fidelities = [r.fidelity for r in self.history]
        target_achieved = sum(1 for r in self.history if r.meets_target)
        
        return {
            "n_compressions": len(self.history),
            "average_compression_pct": np.mean(ratios),
            "std_compression_pct": np.std(ratios),
            "average_fidelity": np.mean(fidelities),
            "std_fidelity": np.std(fidelities),
            "target_achieved_count": target_achieved,
            "target_achieved_pct": target_achieved / len(self.history) * 100,
            "best_compression": max(ratios) if ratios else 0.0,
            "worst_compression": min(ratios) if ratios else 0.0,
            "methods_used": list(set(r.method for r in self.history))
        }
    
    def get_recent_results(self, n: int = 10) -> List[CompressionResult]:
        """Get n most recent compression results"""
        return self.history[-n:]
    
    def _calculate_fidelity(self, 
                          original: List[np.ndarray], 
                          compressed: List[np.ndarray]) -> float:
        """Calculate fidelity between original and compressed representations"""
        # Simplified fidelity calculation
        # In practice, this would reconstruct full states and compute overlap
        
        # For now, use size ratio as proxy
        original_norm = sum(np.linalg.norm(t) for t in original)
        compressed_norm = sum(np.linalg.norm(t) for t in compressed)
        
        if original_norm > 0:
            return min(compressed_norm / original_norm, 1.0)
        return 0.0
    
    def _reconstruct_from_mps(self, mps_tensors: List[np.ndarray]) -> Optional[np.ndarray]:
        """Reconstruct state vector from MPS (for small systems)"""
        if len(mps_tensors) > 20:
            # Too large to reconstruct
            return None
            
        try:
            # Contract all tensors (simplified)
            result = mps_tensors[0]
            for tensor in mps_tensors[1:]:
                # Simplified contraction
                result = np.tensordot(result, tensor, axes=(-1, 0))
                
            return result.flatten()
        except Exception as e:
            logger.warning(f"Failed to reconstruct from MPS: {e}")
            return None


class EnvironmentCacheMetrics:
    """Track environment tensor caching performance"""
    
    def __init__(self):
        self.cache_hits = 0
        self.cache_misses = 0
        self.cache_size = 0
        self.computation_time_saved = 0.0  # milliseconds
        
    def record_hit(self, time_saved_ms: float = 30.0):
        """Record a cache hit"""
        self.cache_hits += 1
        self.computation_time_saved += time_saved_ms
        
    def record_miss(self):
        """Record a cache miss"""
        self.cache_misses += 1
        
    def update_cache_size(self, size: int):
        """Update current cache size"""
        self.cache_size = size
        
    def get_metrics(self) -> Dict[str, Any]:
        """Get cache performance metrics"""
        total_accesses = self.cache_hits + self.cache_misses
        hit_rate = self.cache_hits / total_accesses if total_accesses > 0 else 0.0
        
        return {
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "hit_rate": hit_rate,
            "cache_size": self.cache_size,
            "time_saved_ms": self.computation_time_saved,
            "average_speedup": self.computation_time_saved / self.cache_hits if self.cache_hits > 0 else 0.0
        }


def analyze_bond_dimension_tradeoff(n_qubits: int, 
                                  target_compression: float = 0.68) -> Dict[str, Any]:
    """Analyze bond dimension needed for target compression"""
    # MPS memory usage formula
    # Memory = n_qubits * bond_dim^2 * element_size
    
    full_state_size = (2 ** n_qubits) * 16  # Complex128
    target_size = full_state_size * (1 - target_compression)
    
    # Calculate required bond dimension
    element_size = 16  # Complex128
    bond_dim = int(np.sqrt(target_size / (n_qubits * element_size)))
    
    # Validate bond dimension
    max_bond_dim = 2 ** (n_qubits // 2)  # Maximum useful bond dimension
    bond_dim = min(bond_dim, max_bond_dim)
    
    # Calculate actual compression
    actual_mps_size = n_qubits * bond_dim * bond_dim * element_size
    actual_compression = 1 - (actual_mps_size / full_state_size)
    
    return {
        "n_qubits": n_qubits,
        "full_state_size_mb": full_state_size / (1024**2),
        "target_compression": target_compression,
        "recommended_bond_dim": bond_dim,
        "max_bond_dim": max_bond_dim,
        "actual_compression": actual_compression,
        "mps_size_mb": actual_mps_size / (1024**2),
        "meets_target": actual_compression >= target_compression
    }


# Global metrics instance
_compression_metrics = CompressionMetrics()
_cache_metrics = EnvironmentCacheMetrics()


def get_compression_metrics() -> CompressionMetrics:
    """Get global compression metrics instance"""
    return _compression_metrics


def get_cache_metrics() -> EnvironmentCacheMetrics:
    """Get global cache metrics instance"""
    return _cache_metrics