"""
Test GPU chart integration with your existing Bitcoin dashboard
"""
import sys
import os

# Add components directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def test_gpu_charts():
    """Test if GPU charts can be initialized"""
    print("Testing GPU chart initialization...")
    
    try:
        from components.moderngl_chart import GPUCandlestickChart, chart_manager
        print("✅ ModernGL chart classes imported successfully")
        
        # Test basic chart creation
        chart = GPUCandlestickChart(800, 600, "BTC-USD")
        print("✅ GPU chart created successfully")
        
        # Test adding sample data
        from datetime import datetime
        sample_candle = {
            'time': datetime.utcnow(),
            'open': 50000.0,
            'high': 50500.0,
            'low': 49800.0,
            'close': 50200.0,
            'volume': 1000.0
        }
        
        chart.add_candle(sample_candle)
        chart.update_price(50200.0)
        print("✅ Sample data added successfully")
        
        # Test rendering
        image_b64 = chart.get_base64_image()
        print(f"✅ Chart rendered successfully (image size: {len(image_b64)} bytes)")
        
        # Cleanup
        chart.cleanup()
        print("✅ Chart cleanup successful")
        
        return True
        
    except Exception as e:
        print(f"❌ GPU chart test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_dash_integration():
    """Test Dash component integration"""
    print("\nTesting Dash integration...")
    
    try:
        from components.dash_gpu_chart import DashGPUChart, create_gpu_chart
        print("✅ Dash GPU chart components imported successfully")
        
        # Test creating Dash component
        dash_chart = create_gpu_chart("test-chart", "BTC-USD", width=400, height=300)
        print("✅ Dash GPU chart created successfully")
        
        # Test layout generation
        layout = dash_chart.get_layout()
        print("✅ Dash layout generated successfully")
        
        # Test data updates
        from datetime import datetime
        sample_candle = {
            'time': datetime.utcnow(),
            'open': 45000.0,
            'high': 45500.0,
            'low': 44800.0,
            'close': 45200.0,
            'volume': 800.0
        }
        
        dash_chart.update_candle(sample_candle)
        dash_chart.update_price(45200.0)
        print("✅ Dash chart data updates successful")
        
        # Cleanup
        dash_chart.cleanup()
        print("✅ Dash chart cleanup successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Dash integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 GPU Chart Integration Test")
    print("=" * 50)
    
    # Test basic GPU charts
    gpu_test_passed = test_gpu_charts()
    
    # Test Dash integration
    dash_test_passed = test_dash_integration()
    
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    print(f"GPU Charts: {'✅ PASS' if gpu_test_passed else '❌ FAIL'}")
    print(f"Dash Integration: {'✅ PASS' if dash_test_passed else '❌ FAIL'}")
    
    if gpu_test_passed and dash_test_passed:
        print("\n🎉 All tests passed! GPU charts are ready for integration.")
        print("\nNext steps:")
        print("1. Update your dashboard.py to use GPU charts")
        print("2. Test with live WebSocket data")
        print("3. Add multiple charts for different trading pairs")
    else:
        print("\n⚠️  Some tests failed. Check the error messages above.")
        print("You may need to install additional dependencies or check your GPU drivers.")
