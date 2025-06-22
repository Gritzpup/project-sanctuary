#!/usr/bin/env python3
"""
Chart Acceleration Test Suite
Tests all chart implementations and measures performance
"""
import sys
import os
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List

# Add the project root to Python path
sys.path.insert(0, '/home/ubuntumain/Documents/Github/alpaca-trader')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def generate_sample_data(num_candles: int = 50) -> List[Dict]:
    """Generate sample OHLC data for testing"""
    candles = []
    base_price = 50000.0
    current_time = datetime.utcnow()
    
    for i in range(num_candles):
        # Simulate price movement
        price_change = (i % 10 - 5) * 100  # +/- 500 price movement
        open_price = base_price + price_change
        close_price = open_price + ((i % 3) - 1) * 50  # Small open/close difference
        
        high_price = max(open_price, close_price) + 25
        low_price = min(open_price, close_price) - 25
        
        candles.append({
            'time': current_time - timedelta(minutes=(num_candles - i)),
            'open': open_price,
            'high': high_price,
            'low': low_price,
            'close': close_price,
            'volume': 1000.0 + (i * 10)
        })
        
    return candles

def test_system_capabilities():
    """Test system capability detection"""
    print("\n" + "="*60)
    print("SYSTEM CAPABILITY DETECTION")
    print("="*60)
    
    try:
        from components.chart_acceleration import get_system_capabilities
        
        capabilities = get_system_capabilities()
        
        print(f"Operating System: {'Linux' if capabilities.is_linux else 'Windows' if capabilities.is_windows else 'Other'}")
        print(f"CPU: {capabilities.cpu_brand}")
        print(f"CPU Cores: {capabilities.cpu_cores} cores / {capabilities.cpu_threads} threads")
        print(f"Memory: {capabilities.memory_gb} GB")
        print(f"NVIDIA GPU: {'Yes' if capabilities.has_nvidia_gpu else 'No'}")
        
        if capabilities.has_nvidia_gpu:
            print(f"GPU Memory: {capabilities.gpu_memory_gb} GB")
            print(f"Compute Capability: {capabilities.gpu_compute_capability}")
            
        print(f"ModernGL Available: {'Yes' if capabilities.has_moderngl else 'No'}")
        print(f"CUDA Available: {'Yes' if capabilities.has_cuda else 'No'}")
        print(f"CuPy Available: {'Yes' if capabilities.has_cupy else 'No'}")
        
        # Linux-specific features
        if capabilities.is_linux:
            print(f"Real-time Kernel: {'Yes' if capabilities.has_real_time_kernel else 'No'}")
            print(f"CPU Isolation: {'Yes' if capabilities.has_isolated_cpus else 'No'}")
            print(f"Huge Pages: {'Yes' if capabilities.has_huge_pages else 'No'}")
            
        print(f"\nPerformance Estimate: {capabilities.estimated_chart_latency_ms:.2f}ms")
        print(f"Performance Tier: {capabilities.performance_tier}")
        print(f"Max Estimated FPS: {capabilities.max_estimated_fps}")
        
        return capabilities
        
    except Exception as e:
        print(f"❌ System capability detection failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_available_implementations():
    """Test which chart implementations are available"""
    print("\n" + "="*60)
    print("AVAILABLE CHART IMPLEMENTATIONS")
    print("="*60)
    
    try:
        from components.chart_acceleration import get_available_implementations
        
        implementations = get_available_implementations()
        
        for name, caps in implementations:
            print(f"\n📊 {name}")
            print(f"   GPU Support: {'Yes' if caps.supports_gpu else 'No'}")
            print(f"   CPU Threading: {'Yes' if caps.supports_cpu_threading else 'No'}")
            print(f"   Hardware Accelerated: {'Yes' if caps.hardware_accelerated else 'No'}")
            print(f"   Max FPS: {caps.max_fps}")
            print(f"   Memory Efficient: {'Yes' if caps.memory_efficient else 'No'}")
            
        return implementations
        
    except Exception as e:
        print(f"❌ Implementation detection failed: {e}")
        import traceback
        traceback.print_exc()
        return []

def test_chart_creation_and_performance():
    """Test chart creation and measure performance"""
    print("\n" + "="*60)
    print("CHART PERFORMANCE TESTING")
    print("="*60)
    
    test_results = {}
    sample_data = generate_sample_data(100)
    
    # Test cases with different performance targets
    test_cases = [
        ("High Performance", 60, True),   # GPU target
        ("Medium Performance", 20, True), # CPU target  
        ("Basic Performance", 5, False),  # Fallback target
    ]
    
    for case_name, target_fps, prefer_hardware in test_cases:
        print(f"\n🧪 Testing {case_name} (target: {target_fps} FPS, hardware: {prefer_hardware})")
        
        try:
            from components.chart_acceleration import create_optimal_chart
            
            # Create chart
            chart_start = time.perf_counter()
            chart = create_optimal_chart("BTC-USD", target_fps=target_fps, prefer_hardware=prefer_hardware)
            creation_time = (time.perf_counter() - chart_start) * 1000
            
            print(f"   ✅ Chart created: {chart.__class__.__name__} ({creation_time:.2f}ms)")
            
            # Add sample data
            data_start = time.perf_counter()
            for candle in sample_data:
                chart.add_candle(candle)
            data_time = (time.perf_counter() - data_start) * 1000
            
            print(f"   ✅ Data loaded: {len(sample_data)} candles ({data_time:.2f}ms)")
            
            # Test rendering performance
            render_times = []
            for i in range(10):  # 10 render cycles
                render_start = time.perf_counter()
                result = chart.render()
                render_time = (time.perf_counter() - render_start) * 1000
                render_times.append(render_time)
                
                # Update with new price for dynamic testing
                chart.update_price(50000 + (i * 100))
                
            avg_render_time = sum(render_times) / len(render_times)
            min_render_time = min(render_times)
            max_render_time = max(render_times)
            
            print(f"   ✅ Rendering: avg={avg_render_time:.2f}ms, min={min_render_time:.2f}ms, max={max_render_time:.2f}ms")
            
            # Test Dash component creation
            component_start = time.perf_counter()
            dash_component = chart.get_dash_component()
            component_time = (time.perf_counter() - component_start) * 1000
            
            print(f"   ✅ Dash component: {component_time:.2f}ms")
            
            # Get performance stats
            stats = chart.get_performance_stats()
            print(f"   📊 Stats: FPS={stats.get('fps', 0):.1f}, Type={stats.get('chart_type', 'Unknown')}")
            
            # Store results
            test_results[case_name] = {
                'chart_type': chart.__class__.__name__,
                'creation_time_ms': creation_time,
                'data_load_time_ms': data_time,
                'avg_render_time_ms': avg_render_time,
                'min_render_time_ms': min_render_time,
                'max_render_time_ms': max_render_time,
                'component_time_ms': component_time,
                'stats': stats
            }
            
            # Cleanup
            chart.cleanup()
            
        except Exception as e:
            print(f"   ❌ Test failed: {e}")
            import traceback
            traceback.print_exc()
            
    return test_results

def test_dependency_installation():
    """Test if all required dependencies can be imported"""
    print("\n" + "="*60)
    print("DEPENDENCY TESTING")
    print("="*60)
    
    dependencies = {
        'numpy': 'NumPy (SIMD operations)',
        'moderngl': 'ModernGL (GPU rendering)',
        'pygame': 'Pygame (OpenGL context)',  
        'PIL': 'Pillow (Image processing)',
        'cupy': 'CuPy (CUDA acceleration)',
        'dash': 'Dash (Web framework)',
        # 'plotly': 'Plotly (Not used directly)',
        'psutil': 'PSUtil (System monitoring)'
    }
    
    results = {}
    
    for module, description in dependencies.items():
        try:
            if module == 'PIL':
                import PIL
            else:
                __import__(module)
            print(f"✅ {description}: Available")
            results[module] = True
        except ImportError:
            print(f"❌ {description}: Not available")
            results[module] = False
            
    return results

def performance_summary(test_results: Dict, capabilities):
    """Print performance summary and recommendations"""
    print("\n" + "="*60)
    print("PERFORMANCE SUMMARY & RECOMMENDATIONS")
    print("="*60)
    
    if not test_results:
        print("❌ No test results available")
        return
        
    # Previous baseline (when using Plotly)
    baseline_ms = 390.0
    
    print(f"📊 Previous Baseline (Plotly): {baseline_ms}ms")
    print()
    
    for test_name, results in test_results.items():
        avg_render = results['avg_render_time_ms']
        improvement = baseline_ms / avg_render if avg_render > 0 else 0
        
        print(f"🚀 {test_name}:")
        print(f"   Implementation: {results['chart_type']}")
        print(f"   Render Time: {avg_render:.2f}ms (range: {results['min_render_time_ms']:.2f}-{results['max_render_time_ms']:.2f}ms)")
        print(f"   Improvement: {improvement:.1f}x faster")
        print(f"   Component Time: {results['component_time_ms']:.2f}ms")
        print()
        
    # Recommendations based on capabilities
    print("💡 RECOMMENDATIONS:")
    
    if capabilities:
        if capabilities.is_linux and capabilities.has_nvidia_gpu:
            if "2080" in str(capabilities.gpu_compute_capability or ""):
                print("   🔥 EXTREME PERFORMANCE: RTX 2080 Super detected!")
                print("   🐧 Linux + RTX 2080 Super: Target 0.1-0.5ms (780-3900x improvement)")
                print("   ⚡ Enable: CPU isolation, real-time kernel, huge pages")
            else:
                print("   🚀 HIGH PERFORMANCE: NVIDIA GPU + Linux detected")
                print("   📈 Expected: 1-10ms rendering (39-390x improvement)")
                
        elif capabilities.cpu_threads >= 8:
            print("   ⚡ MEDIUM PERFORMANCE: Multi-core CPU available")
            print("   📈 Expected: 10-50ms rendering (8-39x improvement)")
        else:
            print("   📊 STANDARD PERFORMANCE: Using CPU optimized renderer")
            print("   💡 Consider: Upgrading hardware for better performance")
            
        # Linux-specific recommendations
        if capabilities.is_linux:
            optimizations = []
            if not capabilities.has_real_time_kernel:
                optimizations.append("Install real-time kernel: sudo apt install linux-image-rt-amd64")
            if not capabilities.has_isolated_cpus:
                optimizations.append("Add CPU isolation to GRUB: isolcpus=4-7")
            if not capabilities.has_huge_pages:
                optimizations.append("Enable huge pages: echo 1024 > /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages")
                
            if optimizations:
                print("   🔧 Linux Optimizations Available:")
                for opt in optimizations:
                    print(f"      • {opt}")

def main():
    """Main test function"""
    print("🚀 CHART ACCELERATION TEST SUITE")
    print("=" * 60)
    print("Testing chart acceleration system on Linux")
    print(f"Time: {datetime.now()}")
    
    # Run all tests
    capabilities = test_system_capabilities()
    implementations = test_available_implementations()
    dependencies = test_dependency_installation()
    test_results = test_chart_creation_and_performance()
    
    # Print summary
    performance_summary(test_results, capabilities)
    
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)
    
    # Exit code based on results
    if test_results and any(r['avg_render_time_ms'] < 100 for r in test_results.values()):
        print("✅ SUCCESS: Chart acceleration working!")
        return 0
    else:
        print("⚠️  WARNING: No significant acceleration achieved")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
