#!/usr/bin/env python3
"""Quick GPU Performance Benchmark"""
import time
from components.chart_acceleration import create_optimal_chart
import numpy as np

print("🚀 GPU Chart Performance Benchmark")
print("=" * 50)

# Create GPU chart
print("\n📊 Creating GPU-accelerated chart...")
chart = create_optimal_chart("BTC-USD", target_fps=120, prefer_hardware=True)
print(f"✅ Using: {chart.__class__.__name__}")

# Add test data
print("\n📈 Adding test data...")
for i in range(100):
    chart.add_candle({
        'time': f'2025-01-01T{i:02d}:00:00Z',
        'open': 50000 + i * 10,
        'high': 50100 + i * 10,
        'low': 49900 + i * 10,
        'close': 50050 + i * 10,
        'volume': 1000 + i
    })

# Benchmark rendering
print("\n⚡ Benchmarking rendering performance...")
render_times = []
for i in range(50):
    start = time.perf_counter()
    chart.render()
    chart.update_price(50000 + i)
    end = time.perf_counter()
    render_times.append((end - start) * 1000)

# Results
avg_time = np.mean(render_times)
min_time = np.min(render_times)
max_time = np.max(render_times)

print("\n" + "=" * 50)
print("📊 PERFORMANCE RESULTS")
print("=" * 50)
print(f"Chart Type:     {chart.__class__.__name__}")
print(f"Average:        {avg_time:.2f}ms")
print(f"Minimum:        {min_time:.2f}ms")
print(f"Maximum:        {max_time:.2f}ms")
print(f"FPS Potential:  {1000/avg_time:.1f} FPS")
print("=" * 50)

# Compare to baseline
baseline = 390.0
improvement = baseline / avg_time
print(f"\n🔥 Performance vs Plotly baseline (390ms):")
print(f"   {improvement:.1f}x FASTER!")

# Cleanup
chart.cleanup()
print("\n✅ Benchmark complete!")