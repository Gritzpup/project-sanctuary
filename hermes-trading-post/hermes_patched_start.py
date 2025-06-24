#!/usr/bin/env python3
import sys
import os

# Add the project to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Monkey patch the chart factory to always use CPU chart
def patch_chart_factory():
    from components.chart_acceleration import base_chart
    
    original_create = base_chart.ChartFactory.create_optimal_chart
    
    @staticmethod
    def force_cpu_chart(symbol, width=800, height=600, target_fps=20, prefer_hardware=True):
        """Force CPU chart to avoid GPU segfaults"""
        print(f"[PATCH] Using CPU chart for {symbol} (GPU disabled for stability)")
        
        try:
            from components.chart_acceleration.cpu_optimized_chart import CPUOptimizedChart
            return CPUOptimizedChart(symbol, width, height)
        except Exception as e:
            print(f"[PATCH] Failed to create CPU chart: {e}")
            raise
    
    # Replace the method
    base_chart.ChartFactory.create_optimal_chart = force_cpu_chart
    print("[PATCH] Chart factory patched to use CPU charts only")

# Apply the patch before importing dash_app
patch_chart_factory()

# Now import and run the app
from dash_app import app, server

if __name__ == "__main__":
    print("🚀 Starting Hermes Trading Post with CPU-only charts...")
    print("📊 Dashboard: http://localhost:8050")
    print("⚠️  GPU acceleration temporarily disabled for stability")
    app.run_server(debug=False, host='0.0.0.0', port=8050)
