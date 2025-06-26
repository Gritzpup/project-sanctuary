"""
Chart Acceleration - High-Performance Trading Charts
Auto-detects and uses best available acceleration (GPU/CPU/Fallback)
Targets: 0.1-0.5ms chart updates on Linux + RTX 2080 Super
"""
from .acceleration_detector import AccelerationDetector
from .base_chart import BaseChart, ChartFactory

# Auto-detection factory - main entry point
def create_optimal_chart(symbol: str, width: int = 800, height: int = 600, 
                        target_fps: int = 20, prefer_hardware: bool = True) -> BaseChart:
    """
    Create the best available chart implementation for the current system
    
    Args:
        symbol: Trading symbol (e.g., "BTC-USD")
        width: Chart width in pixels  
        height: Chart height in pixels
        target_fps: Desired FPS (helps choose appropriate tier)
        prefer_hardware: Whether to prefer hardware acceleration
        
    Returns:
        Best available chart implementation
    """
    return ChartFactory.create_optimal_chart(symbol, width, height, target_fps, prefer_hardware)

# Detect system capabilities
def get_system_capabilities():
    """Get detailed system acceleration capabilities"""
    detector = AccelerationDetector()
    return detector.detect_capabilities()

# Get all available chart implementations
def get_available_implementations():
    """Get list of all available chart implementations and their capabilities"""
    return ChartFactory.get_available_implementations()

__version__ = "2.0.0"
__all__ = [
    "create_optimal_chart",
    "get_system_capabilities", 
    "get_available_implementations",
    "BaseChart",
    "AccelerationDetector"
]