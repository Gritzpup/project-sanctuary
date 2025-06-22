#!/usr/bin/env python3
"""Simple Performance Test"""
import time
from datetime import datetime, timedelta
from components.chart_acceleration import create_optimal_chart, get_system_capabilities

print("🚀 Chart Performance Test")
print("=" * 50)

# Check capabilities
caps = get_system_capabilities()
print(f"\n📊 System: {caps}")
print(f"Performance Tier: {caps.performance_tier}")

# Test both CPU and attempt GPU
for prefer_hw in [False, True]:
    print(f"\n{'='*50}")
    print(f"Testing with prefer_hardware={prefer_hw}")
    
    try:
        # Create chart
        chart = create_optimal_chart("BTC-USD", target_fps=60, prefer_hardware=prefer_hw)
        print(f"✅ Using: {chart.__class__.__name__}")
        
        # Add proper datetime data
        base_time = datetime.now()
        for i in range(50):
            chart.add_candle({
                'time': base_time + timedelta(minutes=i),
                'open': 50000 + i * 10,
                'high': 50100 + i * 10,
                'low': 49900 + i * 10,
                'close': 50050 + i * 10,
                'volume': 1000.0 + i
            })
        
        # Quick benchmark
        times = []
        for _ in range(10):
            start = time.perf_counter()
            result = chart.render()
            times.append((time.perf_counter() - start) * 1000)
        
        avg = sum(times) / len(times)
        print(f"⚡ Average render time: {avg:.2f}ms")
        print(f"🎯 Potential FPS: {1000/avg:.1f}")
        print(f"🔥 vs Plotly (390ms): {390/avg:.1f}x faster")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        
print("\n" + "="*50)
print("✅ Test complete!")