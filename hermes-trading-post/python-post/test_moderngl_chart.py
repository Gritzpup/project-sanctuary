#!/usr/bin/env python3
"""Test the ModernGL GPU chart implementation"""

import sys
import time
import logging

# Add the project directory to path
sys.path.insert(0, '/home/ubuntumain/Documents/Github/project-sanctuary/hermes-trading-post')

from components.chart_acceleration.cpu_gpu_assisted_chart import CPUGPUAssistedChart

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_moderngl_chart():
    """Test the ModernGL chart with simulated data"""
    print("Testing ModernGL GPU Chart...")
    
    try:
        # Create chart instance
        chart = CPUGPUAssistedChart(
            symbol="BTC-USD",
            width=1400,
            height=600,
            target_fps=60
        )
        
        print("Chart initialized successfully")
        
        # Simulate some price updates
        base_price = 105000
        for i in range(20):
            price = base_price + (i * 10)
            chart.update_price(price)
            time.sleep(0.1)
            
            if i % 5 == 0:
                # Add a candle
                candle = {
                    'open': price - 5,
                    'high': price + 10,
                    'low': price - 10,
                    'close': price,
                    'volume': 100 + i
                }
                chart.add_candle(candle)
                print(f"Added candle at price {price}")
        
        # Get performance stats
        stats = chart.get_performance_stats()
        print(f"\nPerformance Stats:")
        print(f"  FPS: {stats.get('actual_fps', 0):.1f}")
        print(f"  Render count: {stats.get('render_count', 0)}")
        print(f"  Last render: {stats.get('last_render_ms', 0):.2f}ms")
        print(f"  GPU ready: {stats.get('gpu_ready', False)}")
        
        # Check if rendering is working
        image = chart.render()
        if image:
            print(f"\nChart rendering successful! Image size: {image.size}")
        else:
            print("\nWarning: No rendered image available yet")
        
        # Run for a few more seconds
        print("\nRunning for 5 more seconds...")
        for i in range(50):
            price = base_price + (i * 5)
            chart.update_price(price)
            time.sleep(0.1)
        
        # Final stats
        stats = chart.get_performance_stats()
        print(f"\nFinal Performance Stats:")
        print(f"  FPS: {stats.get('actual_fps', 0):.1f}")
        print(f"  Render count: {stats.get('render_count', 0)}")
        print(f"  Last render: {stats.get('last_render_ms', 0):.2f}ms")
        
        print("\nTest completed successfully!")
        
    except Exception as e:
        print(f"\nError during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'chart' in locals():
            chart.stop()
            print("Chart stopped")

if __name__ == "__main__":
    test_moderngl_chart()