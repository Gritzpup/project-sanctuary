#!/usr/bin/env python3
"""
Quantum Memory System - Phase 1 Final Verification Test
Comprehensive test to verify all Phase 1 components are working correctly.
"""

import sys
import os
import subprocess
import importlib
import time
import json
from pathlib import Path
from typing import List, Tuple, Dict, Any
import torch
import cupy as cp
import numpy as np


class Phase1Verifier:
    """Comprehensive Phase 1 verification tests."""
    
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        
    def add_result(self, category: str, test: str, status: str, details: str = ""):
        """Add a test result."""
        self.results.append({
            "category": category,
            "test": test,
            "status": status,
            "details": details
        })
        
        if status == "PASS":
            self.passed += 1
        elif status == "FAIL":
            self.failed += 1
        elif status == "WARN":
            self.warnings += 1
    
    def run_command(self, cmd: List[str]) -> Tuple[bool, str]:
        """Run a command and return success status and output."""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0, result.stdout + result.stderr
        except Exception as e:
            return False, str(e)
    
    def test_python_environment(self):
        """Test Python environment setup."""
        print("\n🔍 Testing Python Environment...")
        
        # Python version
        version = sys.version_info
        if version >= (3, 10):
            self.add_result("Python", "Version Check", "PASS", 
                          f"Python {version.major}.{version.minor}.{version.micro}")
        else:
            self.add_result("Python", "Version Check", "FAIL", 
                          f"Python {version.major}.{version.minor} (need >= 3.10)")
        
        # Virtual environment
        if 'quantum_env' in sys.prefix:
            self.add_result("Python", "Virtual Environment", "PASS", "quantum_env active")
        else:
            self.add_result("Python", "Virtual Environment", "WARN", "Not in quantum_env")
    
    def test_cuda_setup(self):
        """Test CUDA and GPU setup."""
        print("\n🔍 Testing CUDA & GPU Setup...")
        
        # CUDA compiler - SKIPPED (not needed for this project)
        # We don't need NVCC since we have no custom CUDA kernels to compile
        # All libraries come pre-compiled with CUDA support
        
        # GPU detection
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name()
            self.add_result("CUDA", "GPU Detection", "PASS", gpu_name)
            
            # GPU properties
            props = torch.cuda.get_device_properties(0)
            compute_cap = f"{props.major}.{props.minor}"
            self.add_result("CUDA", "Compute Capability", "PASS", compute_cap)
            
            # VRAM
            vram_gb = props.total_memory / (1024**3)
            self.add_result("CUDA", "VRAM", "PASS", f"{vram_gb:.1f} GB")
            
            # Tensor Cores
            if props.major >= 7:  # Turing or newer
                tensor_cores = props.multi_processor_count * 8  # 8 per SM for Turing
                if tensor_cores == 384:  # RTX 2080 Super
                    self.add_result("CUDA", "Tensor Cores", "PASS", f"{tensor_cores} cores")
                else:
                    self.add_result("CUDA", "Tensor Cores", "WARN", f"{tensor_cores} cores (expected 384)")
        else:
            self.add_result("CUDA", "GPU Detection", "FAIL", "No CUDA GPU found")
        
        # cuDNN
        if torch.backends.cudnn.is_available():
            cudnn_version = torch.backends.cudnn.version()
            self.add_result("CUDA", "cuDNN", "PASS", f"Version {cudnn_version}")
        else:
            self.add_result("CUDA", "cuDNN", "FAIL", "Not available")
    
    def test_quantum_libraries(self):
        """Test quantum computing libraries."""
        print("\n🔍 Testing Quantum Libraries...")
        
        quantum_libs = [
            ('cuquantum', 'cuQuantum'),
            ('qiskit', 'Qiskit'),
            ('pennylane', 'PennyLane'),
            ('tensornetwork', 'TensorNetwork'),
            ('cudaq', 'CUDA-Q'),
        ]
        
        for module_name, display_name in quantum_libs:
            try:
                module = importlib.import_module(module_name)
                version = getattr(module, '__version__', 'unknown')
                self.add_result("Quantum Libraries", display_name, "PASS", f"v{version}")
            except ImportError:
                self.add_result("Quantum Libraries", display_name, "FAIL", "Not installed")
        
        # Test cuQuantum functionality
        try:
            from cuquantum import cutensornet as cutn
            handle = cutn.create()
            cutn.destroy(handle)
            self.add_result("Quantum Libraries", "cuQuantum Functionality", "PASS", "Handle creation works")
        except Exception as e:
            self.add_result("Quantum Libraries", "cuQuantum Functionality", "WARN", str(e))
    
    def test_ml_libraries(self):
        """Test machine learning libraries."""
        print("\n🔍 Testing ML Libraries...")
        
        ml_libs = [
            ('torch', 'PyTorch'),
            ('transformers', 'Transformers'),
            ('accelerate', 'Accelerate'),
            ('bitsandbytes', 'BitsAndBytes'),
            ('flash_attn', 'Flash Attention'),
        ]
        
        for module_name, display_name in ml_libs:
            try:
                module = importlib.import_module(module_name)
                version = getattr(module, '__version__', 'unknown')
                self.add_result("ML Libraries", display_name, "PASS", f"v{version}")
            except ImportError:
                self.add_result("ML Libraries", display_name, "FAIL", "Not installed")
    
    def test_docker_setup(self):
        """Test Docker and GPU support."""
        print("\n🔍 Testing Docker Setup...")
        
        # Docker version
        success, output = self.run_command(['docker', '--version'])
        if success:
            self.add_result("Docker", "Docker Engine", "PASS", output.strip())
        else:
            self.add_result("Docker", "Docker Engine", "FAIL", "Not installed")
        
        # Docker Compose
        success, output = self.run_command(['docker-compose', '--version'])
        if success:
            self.add_result("Docker", "Docker Compose", "PASS", output.strip())
        else:
            self.add_result("Docker", "Docker Compose", "FAIL", "Not installed")
        
        # NVIDIA Container Toolkit
        success, output = self.run_command(['nvidia-ctk', '--version'])
        if success:
            self.add_result("Docker", "NVIDIA Container Toolkit", "PASS", "Installed")
        else:
            self.add_result("Docker", "NVIDIA Container Toolkit", "WARN", "Not verified")
    
    def test_system_optimizations(self):
        """Test system optimizations."""
        print("\n🔍 Testing System Optimizations...")
        
        # Huge Pages
        try:
            with open('/proc/meminfo', 'r') as f:
                meminfo = f.read()
                for line in meminfo.split('\n'):
                    if line.startswith('HugePages_Total:'):
                        huge_pages = int(line.split()[1])
                        if huge_pages >= 2048:  # 4GB
                            self.add_result("System", "Huge Pages", "PASS", f"{huge_pages} pages (4GB)")
                        else:
                            self.add_result("System", "Huge Pages", "WARN", f"{huge_pages} pages")
                        break
        except:
            self.add_result("System", "Huge Pages", "FAIL", "Could not check")
        
        # CPU Governor
        try:
            with open('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor', 'r') as f:
                governor = f.read().strip()
                if governor == 'performance':
                    self.add_result("System", "CPU Governor", "PASS", "Performance mode")
                else:
                    self.add_result("System", "CPU Governor", "WARN", f"{governor} mode")
        except:
            self.add_result("System", "CPU Governor", "WARN", "Could not check")
        
        # File Descriptors
        try:
            import resource
            soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
            if soft >= 65536:
                self.add_result("System", "File Descriptors", "PASS", f"{soft:,} (excellent!)")
            else:
                self.add_result("System", "File Descriptors", "WARN", f"{soft:,} (low)")
        except:
            self.add_result("System", "File Descriptors", "WARN", "Could not check")
    
    def test_development_tools(self):
        """Test development tools."""
        print("\n🔍 Testing Development Tools...")
        
        # Git LFS
        success, output = self.run_command(['git', 'lfs', 'version'])
        if success:
            self.add_result("Dev Tools", "Git LFS", "PASS", output.strip())
        else:
            self.add_result("Dev Tools", "Git LFS", "FAIL", "Not installed")
        
        # Pre-commit
        if Path('.pre-commit-config.yaml').exists():
            self.add_result("Dev Tools", "Pre-commit Config", "PASS", "Configured")
        else:
            self.add_result("Dev Tools", "Pre-commit Config", "FAIL", "Not found")
        
        # VSCode
        success, output = self.run_command(['code', '--version'])
        if success:
            self.add_result("Dev Tools", "VSCode", "PASS", "Installed")
        else:
            self.add_result("Dev Tools", "VSCode", "WARN", "Not found")
    
    def test_project_structure(self):
        """Test project structure."""
        print("\n🔍 Testing Project Structure...")
        
        required_dirs = [
            'src', 'tests', 'docs', 'configs', 'notebooks',
            'tests/installation/phase1', 'data', 'utils'
        ]
        
        for dir_name in required_dirs:
            if Path(dir_name).exists():
                self.add_result("Project Structure", dir_name, "PASS", "Exists")
            else:
                self.add_result("Project Structure", dir_name, "FAIL", "Missing")
        
        # Check important files
        important_files = [
            'requirements.txt', 'setup.py', '.gitignore',
            'docs/phase_checklist.md', 'activate_quantum_env.sh'
        ]
        
        for file_name in important_files:
            if Path(file_name).exists():
                self.add_result("Project Structure", file_name, "PASS", "Exists")
            else:
                self.add_result("Project Structure", file_name, "FAIL", "Missing")
    
    def test_gpu_performance(self):
        """Quick GPU performance test."""
        print("\n🔍 Testing GPU Performance...")
        
        try:
            # Simple bandwidth test
            size = 1024 * 1024 * 256  # 256MB
            a = torch.randn(size // 4, device='cuda', dtype=torch.float32)
            b = torch.empty_like(a)
            
            torch.cuda.synchronize()
            start = time.perf_counter()
            
            for _ in range(10):
                b.copy_(a)
            
            torch.cuda.synchronize()
            elapsed = time.perf_counter() - start
            
            bandwidth_gb_s = (size * 4 * 2 * 10) / (elapsed * 1e9)
            
            if bandwidth_gb_s > 300:  # Good for RTX 2080 Super
                self.add_result("Performance", "GPU Memory Bandwidth", "PASS", 
                              f"{bandwidth_gb_s:.0f} GB/s")
            else:
                self.add_result("Performance", "GPU Memory Bandwidth", "WARN", 
                              f"{bandwidth_gb_s:.0f} GB/s (low)")
        except Exception as e:
            self.add_result("Performance", "GPU Memory Bandwidth", "FAIL", str(e))
    
    def print_results(self):
        """Print all test results."""
        print("\n" + "="*80)
        print("🚀 PHASE 1 FINAL VERIFICATION RESULTS")
        print("="*80)
        
        current_category = None
        for result in self.results:
            if result['category'] != current_category:
                current_category = result['category']
                print(f"\n📋 {current_category}")
                print("-" * 40)
            
            status_icon = "✅" if result['status'] == "PASS" else "❌" if result['status'] == "FAIL" else "⚠️"
            print(f"{status_icon}  {result['test']:<30} {result['details']}")
        
        print("\n" + "="*80)
        print(f"📊 SUMMARY: {self.passed} Passed, {self.failed} Failed, {self.warnings} Warnings")
        
        if self.failed == 0:
            print("\n🎉 PHASE 1 VERIFICATION COMPLETE - ALL CRITICAL TESTS PASSED! 🎉")
            print("✨ Environment is ready for Phase 2: Quantum Memory Implementation ✨")
        else:
            print(f"\n❌ {self.failed} critical tests failed. Please fix before proceeding.")
        
        print("="*80)
        
        return self.failed == 0


def main():
    """Run all Phase 1 verification tests."""
    print("🧪 Starting Quantum Memory System Phase 1 Final Verification...")
    print("This will test all components installed and configured during Phase 1.\n")
    
    verifier = Phase1Verifier()
    
    # Run all tests
    verifier.test_python_environment()
    verifier.test_cuda_setup()
    verifier.test_quantum_libraries()
    verifier.test_ml_libraries()
    verifier.test_docker_setup()
    verifier.test_system_optimizations()
    verifier.test_development_tools()
    verifier.test_project_structure()
    verifier.test_gpu_performance()
    
    # Print results
    success = verifier.print_results()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()