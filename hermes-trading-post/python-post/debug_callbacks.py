#!/usr/bin/env python3
"""
Debug callback registration and execution
"""
import sys
import os

# Patch the chart factory directly
def patch_chart_factory():
    from components.chart_acceleration import base_chart
    
    @staticmethod
    def force_cpu_chart(symbol, width=800, height=600, target_fps=20, prefer_hardware=True):
        from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
        return CPUOptimizedChart(symbol, width, height)
    
    base_chart.ChartFactory.create_optimal_chart = force_cpu_chart
    print("[PATCH] Chart factory patched to use CPU charts only")

patch_chart_factory()

from dash_app import app
import json

print("Checking callback registration...")
print("\nAll registered callbacks:")

# Get all callbacks
callback_count = 0
btc_chart_callbacks = []

for key, callback in app.callback_map.items():
    callback_count += 1
    key_str = str(key)
    
    # Look for btc-chart related callbacks
    if 'btc-chart' in key_str:
        btc_chart_callbacks.append({
            'key': key_str,
            'outputs': [str(o) for o in callback['outputs']],
            'inputs': [str(i) for i in callback['inputs']]
        })

print(f"Total callbacks: {callback_count}")
print(f"\nBTC Chart callbacks: {len(btc_chart_callbacks)}")

for cb in btc_chart_callbacks:
    print(f"\nCallback: {cb['key']}")
    print(f"  Outputs: {cb['outputs']}")
    print(f"  Inputs: {cb['inputs']}")

# Check specific important callbacks
print("\n\nChecking for critical callbacks:")

# Should have a callback that updates btc-chart-chart based on btc-chart-data-store
found_chart_update = False
found_data_store_update = False

for key, callback in app.callback_map.items():
    outputs = [str(o) for o in callback['outputs']]
    inputs = [str(i) for i in callback['inputs']]
    
    # Check for data store update callback
    if any('btc-chart-data-store.data' in o for o in outputs):
        found_data_store_update = True
        print(f"\n✓ Found data store update callback:")
        print(f"  Inputs: {inputs}")
        
    # Check for chart update callback
    if any('btc-chart-chart.children' in o for o in outputs):
        found_chart_update = True
        print(f"\n✓ Found chart update callback:")
        print(f"  Inputs: {inputs}")
        # Check if it listens to data store
        if any('btc-chart-data-store.data' in i for i in inputs):
            print("  ✓ Listens to data store changes")
        else:
            print("  ✗ Does NOT listen to data store changes!")

if not found_data_store_update:
    print("\n✗ Missing data store update callback!")
    
if not found_chart_update:
    print("\n✗ Missing chart update callback!")

print("\n\nDone.")