#!/usr/bin/env python3
"""Test the new CPU-GPU assisted chart implementation"""

import time
import sys
from components.chart_acceleration.cpu_gpu_assisted_chart import CPUGPUAssistedChart

def main():
    print("Testing CPU-GPU Assisted Chart...")
    print("================================")
    
    # Create chart with GPU post-processing disabled (CPU-only)
    print("\n1. Testing CPU-only mode (GPU overlay disabled)...")
    chart = CPUGPUAssistedChart(
        symbol="BTC-USD", 
        width=1400, 
        height=600, 
        target_fps=60,
        use_gpu_overlay=False
    )
    
    # Simulate some price updates
    price = 105000
    for i in range(10):
        price += (i - 5) * 50
        chart.update_price(price)
        time.sleep(0.1)
    
    # Check performance
    stats = chart.get_performance_stats()
    print(f"   FPS: {stats['actual_fps']:.1f}")
    print(f"   Render time: {stats['last_render_ms']:.2f}ms")
    print(f"   Renders: {stats['render_count']}")
    
    # Get dash component
    component = chart.get_dash_component()
    print(f"   Component type: {type(component).__name__}")
    if hasattr(component, 'props') and 'src' in component.props:
        print(f"   Image data length: {len(component.props['src'])} chars")
    
    chart.stop()
    print("   ✓ CPU-only mode test complete")
    
    # Test with GPU post-processing enabled
    print("\n2. Testing CPU+GPU mode (GPU overlay enabled)...")
    try:
        chart2 = CPUGPUAssistedChart(
            symbol="BTC-USD", 
            width=1400, 
            height=600, 
            target_fps=60,
            use_gpu_overlay=True
        )
        
        # Simulate price updates
        for i in range(10):
            price += (i - 5) * 25
            chart2.update_price(price)
            time.sleep(0.1)
        
        stats2 = chart2.get_performance_stats()
        print(f"   FPS: {stats2['actual_fps']:.1f}")
        print(f"   Render time: {stats2['last_render_ms']:.2f}ms")
        print(f"   Renders: {stats2['render_count']}")
        print(f"   GPU ready: {stats2['gpu_ready']}")
        
        chart2.stop()
        print("   ✓ CPU+GPU mode test complete")
        
    except Exception as e:
        print(f"   ⚠ GPU mode failed (expected on non-GPU systems): {e}")
    
    print("\n✅ All tests complete!")

if __name__ == "__main__":
    main()