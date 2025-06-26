#!/usr/bin/env python3
"""Test CPU-GPU Assisted Chart Integration"""

import sys
import time
from components.chart_acceleration import create_optimal_chart, get_available_implementations

def test_chart_creation():
    print("Testing CPU-GPU Assisted Chart Integration...")
    print("=" * 50)
    
    # List available implementations
    print("\nAvailable chart implementations:")
    for name, caps in get_available_implementations():
        print(f"  - {name}: {caps}")
    
    print("\n" + "=" * 50)
    
    # Try to create optimal chart
    print("\nCreating optimal chart for BTC-USD...")
    try:
        chart = create_optimal_chart(
            symbol="BTC-USD",
            width=1400,
            height=600,
            target_fps=60,
            prefer_hardware=True
        )
        
        print(f"✅ Successfully created: {type(chart).__name__}")
        
        # Test basic operations
        print("\nTesting basic operations...")
        
        # Update price
        chart.update_price(105000.50)
        print("✅ Price update successful")
        
        # Update current candle
        from datetime import datetime, timezone
        test_candle = {
            'time': datetime.now(timezone.utc),
            'open': 105000,
            'high': 105100,
            'low': 104900,
            'close': 105050,
            'volume': 123.45
        }
        chart.update_current_candle(test_candle)
        print("✅ Candle update successful")
        
        # Get performance stats
        time.sleep(0.5)  # Let it run for a bit
        stats = chart.get_performance_stats()
        print("\nPerformance stats:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
        
        # Get Dash component
        component = chart.get_dash_component()
        print(f"\n✅ Dash component ready: {type(component).__name__}")
        
        # Cleanup
        if hasattr(chart, 'cleanup'):
            chart.cleanup()
        print("\n✅ Cleanup successful")
        
    except Exception as e:
        print(f"\n❌ Error creating chart: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n✅ All tests passed!")
    return True

if __name__ == "__main__":
    success = test_chart_creation()
    sys.exit(0 if success else 1)