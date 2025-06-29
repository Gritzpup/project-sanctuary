#!/usr/bin/env python3
"""
System requirements checker for Quantum Memory System
Identifies what might need sudo (but doesn't use it)
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path


def check_python_version():
    """Check Python version"""
    version = sys.version_info
    print(f"Python Version: {version.major}.{version.minor}.{version.micro}")
    
    if version >= (3, 8):
        print("✅ Python version OK")
        return True
    else:
        print("❌ Python 3.8+ required")
        return False


def check_gpu():
    """Check GPU availability"""
    try:
        import torch
        if torch.cuda.is_available():
            gpu = torch.cuda.get_device_properties(0)
            print(f"✅ GPU: {gpu.name}")
            print(f"   Memory: {gpu.total_memory / 1024**3:.1f}GB")
            
            # Check if we can allocate memory
            try:
                test_tensor = torch.randn(1000, 1000).cuda()
                del test_tensor
                print("   ✅ GPU memory allocation OK")
            except:
                print("   ⚠️  GPU memory allocation failed (might need nvidia-smi reset)")
                
            return True
        else:
            print("⚠️  No GPU detected - will run in CPU mode")
            return True  # Not critical for Phase 1
    except ImportError:
        print("⚠️  PyTorch not installed yet")
        return True  # Will be installed by requirements


def check_permissions():
    """Check file system permissions"""
    issues = []
    
    # Check .claude folder
    claude_path = Path.home() / ".claude"
    if claude_path.exists():
        if os.access(claude_path, os.R_OK):
            print("✅ Can read .claude folder")
        else:
            print("❌ Cannot read .claude folder")
            issues.append("claude_read")
    else:
        print("⚠️  .claude folder not found")
        
    # Check current directory write permissions
    test_file = Path("test_write.tmp")
    try:
        test_file.touch()
        test_file.unlink()
        print("✅ Can write to project directory")
    except:
        print("❌ Cannot write to project directory")
        issues.append("project_write")
        
    return len(issues) == 0, issues


def check_ports():
    """Check if required ports are available"""
    ports = {
        8765: "WebSocket server",
        8082: "Dashboard"
    }
    
    issues = []
    for port, service in ports.items():
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            
            if result == 0:
                print(f"⚠️  Port {port} ({service}) is in use")
                issues.append(port)
            else:
                print(f"✅ Port {port} ({service}) is available")
        except:
            print(f"⚠️  Could not check port {port}")
            
    return len(issues) == 0, issues


def check_system_resources():
    """Check system resources"""
    import psutil
    
    # Memory
    mem = psutil.virtual_memory()
    print(f"System Memory: {mem.total / 1024**3:.1f}GB total, {mem.available / 1024**3:.1f}GB available")
    
    if mem.available / 1024**3 < 2:
        print("⚠️  Low memory - recommend at least 2GB free")
    else:
        print("✅ Memory OK")
        
    # Disk space
    disk = psutil.disk_usage('/')
    print(f"Disk Space: {disk.free / 1024**3:.1f}GB free")
    
    if disk.free / 1024**3 < 5:
        print("⚠️  Low disk space - recommend at least 5GB free")
    else:
        print("✅ Disk space OK")
        

def suggest_optimizations():
    """Suggest system optimizations (that might need sudo)"""
    print("\n=== Optional Optimizations ===")
    print("The following optimizations could improve performance but require sudo:")
    print("(The system works fine without these!)\n")
    
    suggestions = [
        ("Increase file watch limit", "echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf"),
        ("GPU persistence mode", "sudo nvidia-smi -pm 1"),
        ("Disable GPU ECC (more memory)", "sudo nvidia-smi -e 0"),
    ]
    
    for desc, cmd in suggestions:
        print(f"• {desc}")
        print(f"  Command: {cmd}")
        print()


def main():
    """Run all checks"""
    print("=== Quantum Memory System Requirements Check ===\n")
    
    all_good = True
    
    # Basic checks
    all_good &= check_python_version()
    print()
    
    all_good &= check_gpu()
    print()
    
    perms_ok, perm_issues = check_permissions()
    all_good &= perms_ok
    print()
    
    ports_ok, port_issues = check_ports()
    all_good &= ports_ok
    print()
    
    try:
        check_system_resources()
    except:
        print("Could not check system resources")
    print()
    
    # Summary
    if all_good:
        print("✅ All checks passed! System is ready.")
        print("\nYou can start with: ./scripts/start_quantum_memory.sh")
    else:
        print("⚠️  Some issues detected, but most are not critical for Phase 1")
        
        if perm_issues:
            print(f"\nPermission issues: {perm_issues}")
            print("These might need fixing for full functionality")
            
        if port_issues:
            print(f"\nPorts in use: {port_issues}")
            print("You may need to stop other services or change ports in config")
            
    # Show optimizations
    suggest_optimizations()
    
    print("\n✨ Remember: Phase 1 runs entirely in user space!")
    print("No sudo required for core functionality.\n")


if __name__ == "__main__":
    # Make sure we have psutil
    try:
        import psutil
    except ImportError:
        print("Installing psutil for system checks...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
        import psutil
        
    main()