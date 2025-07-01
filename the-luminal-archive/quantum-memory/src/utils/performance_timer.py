"""
Performance timing utilities for quantum memory operations
Target: 50-60ms processing time for emotional encoding/decoding
"""

import time
import functools
import logging
from typing import Dict, List, Optional, Callable, Any
from collections import defaultdict
import numpy as np

logger = logging.getLogger(__name__)


class PerformanceTimer:
    """Track and analyze performance of quantum memory operations"""
    
    def __init__(self):
        self.timing_history: Dict[str, List[float]] = defaultdict(list)
        self.active_timers: Dict[str, float] = {}
        self.target_ms = 55.0  # Target 50-60ms, aim for middle
        
    def start_timer(self, operation: str) -> None:
        """Start timing an operation"""
        self.active_timers[operation] = time.perf_counter()
        
    def end_timer(self, operation: str) -> float:
        """End timing and record result"""
        if operation not in self.active_timers:
            logger.warning(f"Timer for {operation} was not started")
            return 0.0
            
        elapsed = (time.perf_counter() - self.active_timers[operation]) * 1000  # Convert to ms
        self.timing_history[operation].append(elapsed)
        del self.active_timers[operation]
        
        # Log if outside target range
        if elapsed < 50.0 or elapsed > 60.0:
            logger.info(f"{operation} took {elapsed:.2f}ms (target: 50-60ms)")
            
        return elapsed
        
    def get_statistics(self, operation: Optional[str] = None) -> Dict[str, Any]:
        """Get timing statistics for operations"""
        if operation:
            if operation not in self.timing_history:
                return {"error": f"No timing data for {operation}"}
                
            times = self.timing_history[operation]
            return {
                "operation": operation,
                "count": len(times),
                "mean_ms": np.mean(times),
                "std_ms": np.std(times),
                "min_ms": np.min(times),
                "max_ms": np.max(times),
                "percentiles": {
                    "p50": np.percentile(times, 50),
                    "p90": np.percentile(times, 90),
                    "p99": np.percentile(times, 99)
                },
                "within_target": sum(50 <= t <= 60 for t in times) / len(times) * 100
            }
        else:
            # Return statistics for all operations
            stats = {}
            for op in self.timing_history:
                stats[op] = self.get_statistics(op)
            return stats
            
    def clear_history(self, operation: Optional[str] = None) -> None:
        """Clear timing history"""
        if operation:
            self.timing_history[operation] = []
        else:
            self.timing_history.clear()
            
    def is_within_target(self, operation: str, percentile: int = 90) -> bool:
        """Check if operation meets performance target at given percentile"""
        if operation not in self.timing_history or not self.timing_history[operation]:
            return False
            
        p_value = np.percentile(self.timing_history[operation], percentile)
        return 50.0 <= p_value <= 60.0


# Global timer instance
_global_timer = PerformanceTimer()


def timed_operation(operation_name: Optional[str] = None):
    """Decorator to time function execution"""
    def decorator(func: Callable) -> Callable:
        nonlocal operation_name
        if operation_name is None:
            operation_name = func.__name__
            
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            _global_timer.start_timer(operation_name)
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                elapsed = _global_timer.end_timer(operation_name)
                # Add timing info to result if it's a dict
                if isinstance(result, dict) and 'timing_ms' not in result:
                    result['timing_ms'] = elapsed
                    
        return wrapper
    return decorator


def get_performance_summary() -> Dict[str, Any]:
    """Get global performance summary"""
    return _global_timer.get_statistics()


def reset_performance_tracking() -> None:
    """Reset all performance tracking"""
    _global_timer.clear_history()


class GPUPerformanceOptimizer:
    """Optimize GPU operations for RTX 2080 Super with 8GB VRAM"""
    
    def __init__(self):
        self.vram_limit_gb = 8.0
        self.llm_reserved_gb = 3.5  # Emollama-7B with 4-bit quantization
        self.available_gb = self.vram_limit_gb - self.llm_reserved_gb
        
    def get_optimal_batch_size(self, n_qubits: int, bond_dimension: int) -> int:
        """Calculate optimal batch size for GPU operations"""
        # Estimate memory per quantum state
        state_size_mb = (2 ** n_qubits) * 8 / (1024 ** 2)  # Complex64
        
        # For MPS, memory scales with bond dimension
        mps_size_mb = n_qubits * bond_dimension * bond_dimension * 8 / (1024 ** 2)
        
        # Use smaller of the two
        memory_per_state_mb = min(state_size_mb, mps_size_mb)
        
        # Calculate batch size with safety margin
        available_mb = self.available_gb * 1024 * 0.8  # 80% safety margin
        batch_size = int(available_mb / memory_per_state_mb)
        
        return max(1, batch_size)
        
    def optimize_kernel_launch(self, n_operations: int) -> Dict[str, int]:
        """Optimize CUDA kernel launch parameters"""
        # RTX 2080 Super has 3072 CUDA cores
        max_threads_per_block = 1024
        max_blocks = 2048
        
        # Calculate optimal configuration
        if n_operations <= max_threads_per_block:
            return {
                "blocks": 1,
                "threads_per_block": n_operations
            }
        else:
            threads = min(max_threads_per_block, 256)  # 256 is often optimal
            blocks = min((n_operations + threads - 1) // threads, max_blocks)
            return {
                "blocks": blocks,
                "threads_per_block": threads
            }