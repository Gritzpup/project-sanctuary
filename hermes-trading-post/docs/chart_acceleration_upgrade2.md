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

## Phase 4: System Integration

## Phase 5: Cutting-Edge Enhancements 🚀

### 5.1 Next-Gen GPU APIs
- **WebGPU Integration**
  - Future-proof GPU acceleration beyond WebGL
  - Better compute shader support for RTX 2080 Super
  - Native GPU memory management
  
- **Vulkan Backend**
  - Lower overhead than OpenGL
  - Better multi-threading support
  - More predictable performance

### 5.2 AI-Powered Acceleration
- **DLSS-Style Chart Upscaling**
  - Use RTX 2080 Super's Tensor cores
  - Render at lower resolution, AI upscale to 4K/8K
  - Maintain 0.1ms target at higher resolutions
  
- **Temporal Frame Generation**
  - AI-generate intermediate frames
  - Achieve 120+ FPS perceived smoothness
  - Only render 30-60 actual FPS

### 5.3 Advanced Caching & Prediction
- **ML-Based Predictive Rendering**
  - Predict user navigation patterns
  - Pre-render likely chart regions
  - Use idle GPU time for speculation
  - Near-zero latency for common operations

### 5.4 Hardware-Specific Features
- **NVENC Integration**
  - Zero-performance-impact session recording
  - Real-time chart streaming
  - Hardware-accelerated video encoding
  
- **Variable Rate Shading (VRS)**
  - Focus GPU power on important chart areas
  - Reduce rendering in static regions
  - Help consistently hit 0.1ms target
  
- **RTX Ray Tracing**
  - Advanced 3D volume visualizations
  - Photorealistic market depth rendering
  - Dynamic lighting for data emphasis

### 5.5 Modern GPU Features
- **Mesh Shaders**
  - Dynamic level-of-detail (LOD)
  - Adaptive chart complexity
  - More efficient than traditional pipelines
  
- **Direct Storage/GPU Direct**
  - Load data directly to GPU memory
  - Bypass CPU for historical data
  - Instant massive dataset loading

### 5.6 Hybrid Compute
- **WASM SIMD + WebGPU Compute**
  - Optimal CPU/GPU workload distribution
  - Future-proof for web deployment
  - Maximum performance utilization

### 5.7 Advanced Algorithms
- **Quantum-Inspired Optimization**
  - Chart layout optimization
  - Indicator placement algorithms
  - Visual clarity enhancement

## Implementation Priority

Based on your RTX 2080 Super and 0.1ms latency target:

1. **Immediate Impact** (Phase 5.1-5.2)
   - WebGPU/Vulkan for better GPU utilization
   - VRS for consistent sub-millisecond performance

2. **Medium-term Goals** (Phase 5.3-5.4)
   - ML predictive caching
   - NVENC recording capabilities

3. **Future Innovations** (Phase 5.5-5.7)
   - Ray tracing visualizations
   - Quantum-inspired algorithms