"""
Hardware Acceleration Detection
Auto-detects GPU, CPU, and system capabilities for optimal chart rendering
"""
import platform
import subprocess
import os
import logging
from typing import Dict, List, Optional, Tuple
import psutil

logger = logging.getLogger(__name__)

class SystemCapabilities:
    """Detected system acceleration capabilities"""
    
    def __init__(self):
        # Hardware detection
        self.has_nvidia_gpu = False
        self.has_amd_gpu = False
        self.has_intel_gpu = False
        self.gpu_memory_gb = 0
        self.gpu_compute_capability: Optional[str] = None
        
        # CPU capabilities
        self.cpu_cores = 0
        self.cpu_threads = 0
        self.cpu_brand = ""
        self.has_avx2 = False
        self.has_avx512 = False
        self.memory_gb = 0
        
        # System capabilities
        self.is_linux = False
        self.is_windows = False
        self.has_real_time_kernel = False
        self.has_isolated_cpus = False
        self.has_huge_pages = False
        
        # Software availability
        self.has_moderngl = False
        self.has_cuda = False
        self.has_cupy = False
        self.has_pygame = False
        
        # Performance estimates
        self.estimated_chart_latency_ms = 390.0  # Previous Plotly baseline
        self.max_estimated_fps = 5
        self.performance_tier = "standard"
        
    def __str__(self) -> str:
        return (f"SystemCapabilities("
                f"GPU={'NVIDIA' if self.has_nvidia_gpu else 'None'}, "
                f"CPU={self.cpu_brand}, "
                f"RAM={self.memory_gb}GB, "
                f"OS={'Linux' if self.is_linux else 'Windows'}, "
                f"Tier={self.performance_tier})")


class AccelerationDetector:
    """Detects available hardware acceleration and estimates performance"""
    
    def __init__(self):
        self.capabilities = SystemCapabilities()
        
    def detect_capabilities(self) -> SystemCapabilities:
        """Comprehensive system capability detection"""
        
        # Basic system info
        self._detect_os()
        self._detect_cpu()
        self._detect_memory()
        
        # GPU detection
        self._detect_gpu()
        
        # Software dependencies
        self._detect_software()
        
        # Linux-specific optimizations
        if self.capabilities.is_linux:
            self._detect_linux_optimizations()
            
        # Performance estimation
        self._estimate_performance()
        
        logger.info(f"Detected capabilities: {self.capabilities}")
        return self.capabilities
        
    def _detect_os(self):
        """Detect operating system and version"""
        system = platform.system().lower()
        self.capabilities.is_linux = system == "linux"
        self.capabilities.is_windows = system == "windows"
        
        if self.capabilities.is_linux:
            try:
                # Check kernel version for real-time support
                kernel = platform.release()
                self.capabilities.has_real_time_kernel = "rt" in kernel.lower()
            except:
                pass
                
    def _detect_cpu(self):
        """Detect CPU capabilities"""
        self.capabilities.cpu_cores = psutil.cpu_count(logical=False) or 1
        self.capabilities.cpu_threads = psutil.cpu_count(logical=True) or 1
        
        try:
            # Get CPU brand
            if self.capabilities.is_linux:
                with open('/proc/cpuinfo', 'r') as f:
                    for line in f:
                        if line.startswith('model name'):
                            self.capabilities.cpu_brand = line.split(':')[1].strip()
                            break
            else:
                self.capabilities.cpu_brand = platform.processor()
                
            # Check for SIMD capabilities
            if self.capabilities.is_linux:
                with open('/proc/cpuinfo', 'r') as f:
                    cpuinfo = f.read()
                    self.capabilities.has_avx2 = 'avx2' in cpuinfo
                    self.capabilities.has_avx512 = 'avx512' in cpuinfo
                    
        except Exception as e:
            logger.warning(f"CPU detection error: {e}")
            
    def _detect_memory(self):
        """Detect system memory"""
        memory = psutil.virtual_memory()
        self.capabilities.memory_gb = round(memory.total / (1024**3))
        
    def _detect_gpu(self):
        """Detect GPU capabilities"""
        try:
            # Try nvidia-smi for NVIDIA GPU
            result = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total,compute_cap', 
                                   '--format=csv,noheader,nounits'], 
                                  capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if line.strip():
                        parts = line.split(',')
                        if len(parts) >= 3:
                            gpu_name = parts[0].strip()
                            memory_mb = int(parts[1].strip())
                            compute_cap = parts[2].strip()
                            
                            if "rtx 2080" in gpu_name.lower():
                                # Detected RTX 2080 Super - our target GPU!
                                self.capabilities.has_nvidia_gpu = True
                                self.capabilities.gpu_memory_gb = memory_mb // 1024
                                self.capabilities.gpu_compute_capability = compute_cap
                                logger.info(f"RTX 2080 Super detected! Memory: {self.capabilities.gpu_memory_gb}GB")
                                break
                            elif "nvidia" in gpu_name.lower() or "geforce" in gpu_name.lower():
                                self.capabilities.has_nvidia_gpu = True
                                self.capabilities.gpu_memory_gb = memory_mb // 1024
                                self.capabilities.gpu_compute_capability = compute_cap
                                
        except Exception as e:
            logger.debug(f"NVIDIA GPU detection failed: {e}")
            
        # Try to detect AMD GPU
        try:
            if self.capabilities.is_linux:
                result = subprocess.run(['lspci'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0 and 'amd' in result.stdout.lower():
                    self.capabilities.has_amd_gpu = True
        except Exception as e:
            logger.debug(f"AMD GPU detection failed: {e}")
            
    def _detect_software(self):
        """Detect required software dependencies"""
        
        # Test ModernGL
        try:
            import moderngl
            self.capabilities.has_moderngl = True
        except ImportError:
            pass
            
        # Test CUDA
        try:
            import cupy
            self.capabilities.has_cupy = True
            self.capabilities.has_cuda = True
        except ImportError:
            try:
                result = subprocess.run(['nvcc', '--version'], capture_output=True, timeout=5)
                self.capabilities.has_cuda = result.returncode == 0
            except:
                pass
                
        # Test Pygame
        try:
            import pygame
            self.capabilities.has_pygame = True
        except ImportError:
            pass
            
    def _detect_linux_optimizations(self):
        """Detect Linux-specific performance optimizations"""
        
        # Check for CPU isolation
        try:
            with open('/proc/cmdline', 'r') as f:
                cmdline = f.read()
                self.capabilities.has_isolated_cpus = 'isolcpus=' in cmdline
        except:
            pass
            
        # Check for huge pages
        try:
            with open('/proc/meminfo', 'r') as f:
                meminfo = f.read()
                if 'HugePages_Total:' in meminfo:
                    for line in meminfo.split('\n'):
                        if line.startswith('HugePages_Total:'):
                            total = int(line.split()[1])
                            self.capabilities.has_huge_pages = total > 0
                            break
        except:
            pass
            
    def _estimate_performance(self):
        """Estimate chart rendering performance based on detected capabilities"""
        
        # Base latency (previous Plotly baseline)
        base_latency = 390.0
        
        # Performance multipliers
        gpu_multiplier = 1.0
        cpu_multiplier = 1.0
        os_multiplier = 1.0
        
        # GPU acceleration
        if self.capabilities.has_nvidia_gpu and self.capabilities.has_moderngl:
            if "2080" in (self.capabilities.gpu_compute_capability or ""):
                # RTX 2080 Super - our target hardware
                gpu_multiplier = 0.0005  # 0.2ms target (1950x improvement)
                self.capabilities.performance_tier = "extreme"
                self.capabilities.max_estimated_fps = 120
            else:
                # Other NVIDIA GPU
                gpu_multiplier = 0.05  # 20ms (19x improvement)  
                self.capabilities.performance_tier = "high"
                self.capabilities.max_estimated_fps = 60
        elif self.capabilities.has_moderngl:
            # CPU ModernGL
            gpu_multiplier = 0.15  # 60ms (6x improvement)
            self.capabilities.performance_tier = "medium"
            self.capabilities.max_estimated_fps = 20
            
        # CPU optimizations
        if self.capabilities.cpu_threads >= 16 and self.capabilities.has_avx2:
            cpu_multiplier = 0.7  # 30% improvement
        elif self.capabilities.cpu_threads >= 8:
            cpu_multiplier = 0.8  # 20% improvement
            
        # Linux optimizations  
        if self.capabilities.is_linux:
            os_multiplier = 0.6  # 40% improvement
            if self.capabilities.has_real_time_kernel:
                os_multiplier *= 0.8  # Additional 20% improvement
            if self.capabilities.has_isolated_cpus:
                os_multiplier *= 0.9  # Additional 10% improvement
                
        # Calculate final estimate
        self.capabilities.estimated_chart_latency_ms = (
            base_latency * gpu_multiplier * cpu_multiplier * os_multiplier
        )
        
        # Update performance tier based on final estimate
        if self.capabilities.estimated_chart_latency_ms < 1.0:
            self.capabilities.performance_tier = "extreme"  # <1ms
        elif self.capabilities.estimated_chart_latency_ms < 10.0:
            self.capabilities.performance_tier = "high"     # 1-10ms  
        elif self.capabilities.estimated_chart_latency_ms < 50.0:
            self.capabilities.performance_tier = "medium"   # 10-50ms
        else:
            self.capabilities.performance_tier = "standard" # >50ms
            
        logger.info(f"Performance estimate: {self.capabilities.estimated_chart_latency_ms:.2f}ms "
                   f"({self.capabilities.performance_tier} tier)")
