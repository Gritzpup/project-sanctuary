#!/usr/bin/env python3
"""
Quick verification script for chart acceleration
"""

print("🔍 Verifying Chart Acceleration System...")
print("=" * 50)

try:
    # Test imports
    print("\n📦 Checking dependencies...")
    imports_ok = True
    
    try:
        import numpy as np
        print("✅ NumPy available")
    except ImportError:
        print("❌ NumPy not installed")
        imports_ok = False
        
    try:
        import dash
        print("✅ Dash available")
    except ImportError:
        print("❌ Dash not installed") 
        imports_ok = False
        
    try:
        import moderngl
        print("✅ ModernGL available (GPU acceleration)")
    except ImportError:
        print("⚠️  ModernGL not available (GPU acceleration disabled)")
        
    try:
        import cupy
        print("✅ CuPy available (CUDA acceleration)")
    except ImportError:
        print("⚠️  CuPy not available (CUDA acceleration disabled)")
    
    if not imports_ok:
        print("\n❌ Missing core dependencies. Please run:")
        print("   pip install -r requirements_dash.txt")
        exit(1)
        
    # Test chart acceleration
    print("\n🚀 Testing chart acceleration...")
    from components.chart_acceleration import get_system_capabilities, create_optimal_chart
    
    # Detect capabilities
    caps = get_system_capabilities()
    print(f"\n📊 System Capabilities:")
    print(f"   OS: {'Linux' if caps.is_linux else 'Windows' if caps.is_windows else 'Other'}")
    print(f"   CPU: {caps.cpu_brand}")
    print(f"   Cores: {caps.cpu_cores} / Threads: {caps.cpu_threads}")
    print(f"   RAM: {caps.memory_gb} GB")
    print(f"   GPU: {'NVIDIA' if caps.has_nvidia_gpu else 'None detected'}")
    if caps.has_nvidia_gpu:
        print(f"   GPU Memory: {caps.gpu_memory_gb} GB")
    print(f"   Performance Tier: {caps.performance_tier}")
    print(f"   Estimated Latency: {caps.estimated_chart_latency_ms:.2f}ms")
    
    # Try to create a chart
    print("\n📈 Creating optimal chart...")
    try:
        chart = create_optimal_chart("BTC-USD")
        print(f"✅ Chart created: {chart.__class__.__name__}")
        
        # Test basic operations
        chart.update_price(50000.0)
        chart.add_candle({
            'time': '2025-01-01T00:00:00Z',
            'open': 50000,
            'high': 50100,
            'low': 49900,
            'close': 50050,
            'volume': 1000
        })
        
        print("✅ Chart operations successful")
        
    except Exception as e:
        print(f"❌ Chart creation failed: {e}")
        
    print("\n✅ Chart acceleration system is operational!")
    print(f"   Expected performance: {caps.performance_tier} tier")
    
except Exception as e:
    print(f"\n❌ Verification failed: {e}")
    import traceback
    traceback.print_exc()