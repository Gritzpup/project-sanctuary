"""
GPU Memory Management for Quantum Memory System
Handles VRAM allocation, pooling, monitoring, and OOM prevention
"""

import torch
import logging
import psutil
import GPUtil
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
import threading
import queue
import gc
import weakref
from dataclasses import dataclass
import warnings

logger = logging.getLogger(__name__)


@dataclass
class MemoryStats:
    """GPU memory statistics"""
    total_vram: int
    used_vram: int
    free_vram: int
    reserved_pytorch: int
    allocated_pytorch: int
    cached_pytorch: int
    timestamp: datetime


class GPUMemoryPool:
    """Custom memory pool for GPU tensors"""
    
    def __init__(self, initial_size_mb: int = 512, growth_factor: float = 1.5):
        """
        Initialize GPU memory pool
        
        Args:
            initial_size_mb: Initial pool size in MB
            growth_factor: Factor to grow pool when needed
        """
        self.initial_size_mb = initial_size_mb
        self.growth_factor = growth_factor
        self.pools = {}  # device -> pool
        self.allocations = {}  # tensor_id -> (device, size)
        self._lock = threading.Lock()
        
        # Pre-allocate pools
        if torch.cuda.is_available():
            for device_id in range(torch.cuda.device_count()):
                self._initialize_pool(device_id)
                
    def _initialize_pool(self, device_id: int):
        """Initialize memory pool for a device"""
        device = torch.device(f'cuda:{device_id}')
        
        # Allocate initial pool
        size_bytes = self.initial_size_mb * 1024 * 1024
        # Pre-allocate memory by creating and deleting a tensor
        dummy = torch.empty(size_bytes // 4, dtype=torch.float32, device=device)
        pool = dummy.data_ptr()
        del dummy
        
        self.pools[device_id] = {
            'buffer': pool,
            'size': size_bytes,
            'used': 0,
            'free_list': [(0, size_bytes)]  # (offset, size) tuples
        }
        
        logger.info(f"Initialized GPU memory pool on device {device_id}: {self.initial_size_mb}MB")
        
    def allocate(self, size: int, device: torch.device) -> torch.Tensor:
        """Allocate tensor from pool"""
        device_id = device.index or 0
        
        with self._lock:
            pool = self.pools.get(device_id)
            if not pool:
                self._initialize_pool(device_id)
                pool = self.pools[device_id]
                
            # Find free block
            for i, (offset, block_size) in enumerate(pool['free_list']):
                if block_size >= size:
                    # Allocate from this block
                    tensor = torch.as_tensor(
                        pool['buffer'][offset:offset + size],
                        device=device
                    ).view(-1)
                    
                    # Update free list
                    if block_size > size:
                        pool['free_list'][i] = (offset + size, block_size - size)
                    else:
                        pool['free_list'].pop(i)
                        
                    pool['used'] += size
                    
                    # Track allocation
                    tensor_id = id(tensor)
                    self.allocations[tensor_id] = (device_id, size)
                    
                    # Set up cleanup callback
                    weakref.finalize(tensor, self._deallocate, tensor_id)
                    
                    return tensor
                    
            # No suitable block found, grow pool
            self._grow_pool(device_id, size)
            return self.allocate(size, device)
            
    def _grow_pool(self, device_id: int, min_size: int):
        """Grow memory pool"""
        pool = self.pools[device_id]
        
        # Calculate new size
        current_size = pool['size']
        new_size = max(
            int(current_size * self.growth_factor),
            current_size + min_size
        )
        
        # Allocate additional memory
        additional = new_size - current_size
        # Allocate additional memory
        dummy = torch.empty(additional // 4, dtype=torch.float32, device=f'cuda:{device_id}')
        new_buffer = dummy.data_ptr()
        del dummy
        
        # Merge buffers (simplified - in practice would need proper management)
        pool['size'] = new_size
        pool['free_list'].append((current_size, additional))
        
        logger.info(f"Grew GPU pool on device {device_id}: {current_size//1024//1024}MB -> {new_size//1024//1024}MB")
        
    def _deallocate(self, tensor_id: int):
        """Deallocate tensor and return to pool"""
        with self._lock:
            if tensor_id in self.allocations:
                device_id, size = self.allocations.pop(tensor_id)
                pool = self.pools[device_id]
                
                # Add back to free list (simplified - should merge adjacent blocks)
                pool['free_list'].append((pool['used'] - size, size))
                pool['used'] -= size
                
    def get_stats(self) -> Dict[int, Dict[str, Any]]:
        """Get pool statistics"""
        stats = {}
        
        with self._lock:
            for device_id, pool in self.pools.items():
                stats[device_id] = {
                    'total_size_mb': pool['size'] // 1024 // 1024,
                    'used_mb': pool['used'] // 1024 // 1024,
                    'free_mb': (pool['size'] - pool['used']) // 1024 // 1024,
                    'fragmentation': len(pool['free_list'])
                }
                
        return stats


class VRAMMonitor:
    """Monitor GPU VRAM usage"""
    
    def __init__(self, warning_threshold: float = 0.8, critical_threshold: float = 0.95):
        """
        Initialize VRAM monitor
        
        Args:
            warning_threshold: Warn when VRAM usage exceeds this fraction
            critical_threshold: Critical alert when VRAM usage exceeds this fraction
        """
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
        self._monitoring = False
        self._monitor_thread = None
        self._callbacks = []
        
    def start_monitoring(self, interval: float = 1.0):
        """Start VRAM monitoring"""
        if self._monitoring:
            return
            
        self._monitoring = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval,),
            daemon=True
        )
        self._monitor_thread.start()
        logger.info(f"Started VRAM monitoring (interval: {interval}s)")
        
    def stop_monitoring(self):
        """Stop VRAM monitoring"""
        self._monitoring = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
            
    def _monitor_loop(self, interval: float):
        """Monitor loop running in separate thread"""
        while self._monitoring:
            try:
                stats = self.get_current_stats()
                
                # Check thresholds
                for device_id in range(torch.cuda.device_count()):
                    usage_fraction = stats[device_id]['used_vram'] / stats[device_id]['total_vram']
                    
                    if usage_fraction > self.critical_threshold:
                        self._trigger_callbacks('critical', device_id, stats[device_id])
                    elif usage_fraction > self.warning_threshold:
                        self._trigger_callbacks('warning', device_id, stats[device_id])
                        
            except Exception as e:
                logger.error(f"Error in VRAM monitor: {e}")
                
            torch.cuda.synchronize()  # Ensure accurate measurements
            time.sleep(interval)
            
    def get_current_stats(self) -> Dict[int, MemoryStats]:
        """Get current VRAM statistics"""
        stats = {}
        
        for device_id in range(torch.cuda.device_count()):
            torch.cuda.set_device(device_id)
            
            # PyTorch stats
            allocated = torch.cuda.memory_allocated(device_id)
            reserved = torch.cuda.memory_reserved(device_id)
            cached = reserved  # memory_cached is deprecated, it's the same as memory_reserved
            
            # Total VRAM from GPUtil
            try:
                gpus = GPUtil.getGPUs()
                if device_id < len(gpus):
                    total = gpus[device_id].memoryTotal * 1024 * 1024
                    used = gpus[device_id].memoryUsed * 1024 * 1024
                    free = gpus[device_id].memoryFree * 1024 * 1024
                else:
                    # Fallback
                    total = torch.cuda.get_device_properties(device_id).total_memory
                    used = reserved
                    free = total - used
            except:
                # Fallback if GPUtil fails
                total = torch.cuda.get_device_properties(device_id).total_memory
                used = reserved
                free = total - used
                
            stats[device_id] = MemoryStats(
                total_vram=total,
                used_vram=used,
                free_vram=free,
                reserved_pytorch=reserved,
                allocated_pytorch=allocated,
                cached_pytorch=cached,
                timestamp=datetime.now()
            )
            
        return stats
        
    def register_callback(self, callback):
        """Register callback for memory alerts"""
        self._callbacks.append(callback)
        
    def _trigger_callbacks(self, level: str, device_id: int, stats: MemoryStats):
        """Trigger registered callbacks"""
        for callback in self._callbacks:
            try:
                callback(level, device_id, stats)
            except Exception as e:
                logger.error(f"Error in VRAM callback: {e}")


class OOMPrevention:
    """Out-of-Memory prevention strategies"""
    
    def __init__(self, safety_margin_mb: int = 512):
        """
        Initialize OOM prevention
        
        Args:
            safety_margin_mb: Keep this much VRAM free
        """
        self.safety_margin_mb = safety_margin_mb
        self.original_allocator = None
        
    def enable(self):
        """Enable OOM prevention"""
        # Enable garbage collection
        gc.enable()
        
        # Set PyTorch to use less aggressive caching
        torch.cuda.set_per_process_memory_fraction(0.8)
        
        # Clear cache
        torch.cuda.empty_cache()
        
        self.original_allocator = True  # Flag to indicate enabled
        logger.info(f"Enabled OOM prevention (safety margin: {self.safety_margin_mb}MB)")
        
    def disable(self):
        """Disable OOM prevention"""
        if self.original_allocator:
            # Reset to default memory fraction
            torch.cuda.set_per_process_memory_fraction(1.0)
            self.original_allocator = None
            
    def check_memory_available(self, size_bytes: int, device: int = 0) -> bool:
        """Check if memory allocation would be safe"""
        stats = torch.cuda.memory_stats(device)
        free = stats.get('reserved_bytes.all.current', 0) - stats.get('allocated_bytes.all.current', 0)
        
        return free - size_bytes >= self.safety_margin_mb * 1024 * 1024
        
    def _emergency_cleanup(self, device: int):
        """Emergency memory cleanup"""
        logger.warning(f"Emergency memory cleanup on device {device}")
        
        # Clear PyTorch cache
        torch.cuda.empty_cache()
        
        # Force garbage collection
        gc.collect()
        
        # Synchronize to ensure cleanup
        torch.cuda.synchronize(device)


class MixedPrecisionManager:
    """Manage mixed precision (FP16/FP32) for memory efficiency"""
    
    def __init__(self, default_dtype: torch.dtype = torch.float16):
        """
        Initialize mixed precision manager
        
        Args:
            default_dtype: Default dtype for computations
        """
        self.default_dtype = default_dtype
        self.original_dtype = torch.get_default_dtype()
        self.enabled = False
        
    def enable(self):
        """Enable mixed precision"""
        if not self.enabled:
            torch.set_default_dtype(self.default_dtype)
            self.enabled = True
            logger.info(f"Enabled mixed precision: {self.default_dtype}")
            
    def disable(self):
        """Disable mixed precision"""
        if self.enabled:
            torch.set_default_dtype(self.original_dtype)
            self.enabled = False
            
    @staticmethod
    def autocast_context(device_type: str = 'cuda', dtype: torch.dtype = torch.float16):
        """Get autocast context for mixed precision"""
        return torch.amp.autocast(device_type=device_type, enabled=True, dtype=dtype)
        
    @staticmethod
    def scale_loss(loss: torch.Tensor, scaler) -> torch.Tensor:
        """Scale loss for mixed precision training"""
        return scaler.scale(loss)


class GPUMemoryManager:
    """Main GPU memory manager combining all components"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize GPU memory manager
        
        Args:
            config: Configuration dictionary
        """
        config = config or {}
        
        # Initialize components
        self.memory_pool = GPUMemoryPool(
            initial_size_mb=config.get('pool_size_mb', 512),
            growth_factor=config.get('pool_growth_factor', 1.5)
        )
        
        self.vram_monitor = VRAMMonitor(
            warning_threshold=config.get('warning_threshold', 0.8),
            critical_threshold=config.get('critical_threshold', 0.95)
        )
        
        self.oom_prevention = OOMPrevention(
            safety_margin_mb=config.get('safety_margin_mb', 512)
        )
        
        self.mixed_precision = MixedPrecisionManager(
            default_dtype=torch.float16 if config.get('use_fp16', True) else torch.float32
        )
        
        # Register cleanup callback
        self.vram_monitor.register_callback(self._memory_alert_callback)
        
        # Auto-start monitoring
        if config.get('auto_monitor', True):
            self.vram_monitor.start_monitoring()
            
        # Enable safety features
        if config.get('enable_oom_prevention', True):
            self.oom_prevention.enable()
            
        if config.get('enable_mixed_precision', True):
            self.mixed_precision.enable()
            
    def _memory_alert_callback(self, level: str, device_id: int, stats: MemoryStats):
        """Handle memory alerts"""
        usage_pct = (stats.used_vram / stats.total_vram) * 100
        
        if level == 'critical':
            logger.critical(f"GPU {device_id} VRAM critical: {usage_pct:.1f}% used")
            # Force cleanup
            self.force_cleanup(device_id)
        elif level == 'warning':
            logger.warning(f"GPU {device_id} VRAM warning: {usage_pct:.1f}% used")
            
    def force_cleanup(self, device_id: Optional[int] = None):
        """Force memory cleanup"""
        devices = [device_id] if device_id is not None else range(torch.cuda.device_count())
        
        for dev in devices:
            torch.cuda.set_device(dev)
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
            
        gc.collect()
        
        logger.info(f"Forced memory cleanup on devices: {devices}")
        
    def get_summary(self) -> Dict[str, Any]:
        """Get memory management summary"""
        return {
            'vram_stats': self.vram_monitor.get_current_stats(),
            'pool_stats': self.memory_pool.get_stats(),
            'mixed_precision_enabled': self.mixed_precision.enabled,
            'oom_prevention_enabled': self.oom_prevention.original_allocator is not None
        }
        
    def __del__(self):
        """Cleanup on deletion"""
        self.vram_monitor.stop_monitoring()
        self.oom_prevention.disable()
        self.mixed_precision.disable()


# Example usage
if __name__ == "__main__":
    import time
    
    # Test GPU memory manager
    manager = GPUMemoryManager({
        'pool_size_mb': 256,
        'warning_threshold': 0.7,
        'enable_mixed_precision': True
    })
    
    print("GPU Memory Manager initialized")
    
    # Test allocation
    with manager.mixed_precision.autocast_context():
        # Allocate some tensors
        tensors = []
        for i in range(5):
            t = torch.randn(1024, 1024, device='cuda:0', dtype=torch.float16)
            tensors.append(t)
            print(f"Allocated tensor {i}")
            
    # Check stats
    summary = manager.get_summary()
    print("\nMemory Summary:")
    print(f"VRAM Stats: {summary['vram_stats']}")
    print(f"Pool Stats: {summary['pool_stats']}")
    
    # Cleanup
    manager.force_cleanup()
    print("\nAfter cleanup:")
    print(f"VRAM Stats: {manager.vram_monitor.get_current_stats()}")