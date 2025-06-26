"""
Base Chart Interface - Abstract class for all chart acceleration implementations
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import time


class BaseChart(ABC):
    """
    Abstract base class for all chart implementations
    Provides common interface for GPU, CPU, WebGL, and Standard charts
    """
    
    def __init__(self, symbol: str, width: int = 800, height: int = 600):
        self.symbol = symbol
        self.width = width
        self.height = height
        
        # Performance tracking
        self.fps = 0.0
        self.frame_count = 0
        self.last_fps_update = time.time()
        self.render_times = []  # Track last 60 render times
        
        # Chart data
        self.candles = []
        self.current_price = 0.0
        self.price_history = []
        
        # Chart bounds
        self.price_min = 0.0
        self.price_max = 0.0
        self.time_min = datetime.utcnow()
        self.time_max = datetime.utcnow()
        
        # Configuration
        self.max_candles = 100
        self.max_price_history = 1000
        
    @abstractmethod
    def add_candle(self, candle_data: Dict[str, Any]) -> None:
        """Add a new completed candle to the chart"""
        pass
        
    @abstractmethod
    def update_current_candle(self, candle_data: Dict[str, Any]) -> None:
        """Update the currently forming candle"""
        pass
        
    @abstractmethod
    def update_price(self, price: float) -> None:
        """Update current price for real-time line"""
        pass
        
    @abstractmethod
    def render(self) -> Any:
        """Render the chart and return appropriate format for display"""
        pass
        
    @abstractmethod
    def get_dash_component(self) -> Any:
        """Return Dash component for displaying this chart"""
        pass
        
    def update_performance_metrics(self) -> None:
        """Update FPS and performance tracking"""
        current_time = time.time()
        
        # Update frame count
        self.frame_count += 1
        
        # Calculate FPS every second
        if current_time - self.last_fps_update >= 1.0:
            self.fps = self.frame_count / (current_time - self.last_fps_update)
            self.frame_count = 0
            self.last_fps_update = current_time
            
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get current performance statistics"""
        avg_render_time = sum(self.render_times) / len(self.render_times) if self.render_times else 0
        
        return {
            'fps': self.fps,
            'avg_render_time_ms': avg_render_time * 1000,
            'candle_count': len(self.candles),
            'price_history_count': len(self.price_history),
            'chart_type': self.__class__.__name__
        }
        
    def cleanup(self) -> None:
        """Clean up resources - override in subclasses if needed"""
        self.candles.clear()
        self.price_history.clear()
        
    def set_price_tag_value(self, price: float) -> None:
        """Efficiently update only the price value in the tag, without redrawing the whole tag/line (override in subclass if supported)"""
        pass


class ChartCapabilities:
    """Define capabilities that different chart implementations support"""
    
    def __init__(self):
        self.supports_gpu = False
        self.supports_cpu_threading = False
        self.supports_webgl = False
        self.supports_real_time = False
        self.max_fps = 0
        self.memory_efficient = False
        self.hardware_accelerated = False
        
    def __str__(self) -> str:
        capabilities = []
        if self.supports_gpu:
            capabilities.append("GPU")
        if self.supports_cpu_threading:
            capabilities.append("CPU-Threading")
        if self.supports_webgl:
            capabilities.append("WebGL")
        if self.supports_real_time:
            capabilities.append("Real-time")
        if self.hardware_accelerated:
            capabilities.append("Hardware-Accelerated")
            
        return f"ChartCapabilities({', '.join(capabilities)}, max_fps={self.max_fps})"


class ChartFactory:
    """Factory for creating optimal chart implementations based on capabilities"""
    
    @staticmethod
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
        from .acceleration_detector import AccelerationDetector
        import logging
        
        logger = logging.getLogger(__name__)
        detector = AccelerationDetector()
        capabilities = detector.detect_capabilities()
        
        logger.info(f"Creating chart for {symbol}: {capabilities}")
        
        # Try Linux GPU acceleration first (highest performance)
        if capabilities.is_linux and capabilities.has_nvidia_gpu and prefer_hardware:
            try:
                from .linux_gpu_chart import LinuxGPUChart
                from .threaded_gpu_renderer import ThreadedGPURenderer
                
                logger.info(f"Using ThreadedGPURenderer with LinuxGPUChart for {symbol} (target: {capabilities.estimated_chart_latency_ms:.2f}ms)")
                
                # IMPORTANT: The chart instance must only receive data from a CPU-side thread-safe buffer (e.g., Redis or LatestChartState),
                # never directly from WebSocket or network. All data processing/sorting must be done on the CPU.
                # The GPU chart only reads from the buffer and renders.
                renderer = ThreadedGPURenderer(LinuxGPUChart, symbol, width, height)
                renderer.start()
                
                return renderer
            except Exception as e:
                logger.warning(f"LinuxGPUChart failed for {symbol}: {e}")
                
        # Try CPU-optimized rendering for medium performance (now the fallback)
        try:
            from .cpu_optimized_chart import CPUOptimizedChart
            logger.info(f"Using CPUOptimizedChart for {symbol}")
            return CPUOptimizedChart(symbol, width, height)
        except Exception as e:
            logger.error(f"All chart implementations failed for {symbol}: {e}")
            raise RuntimeError(f"Cannot create chart for {symbol}: No working implementation found")
        
    @staticmethod
    def get_available_implementations() -> List[Tuple[str, ChartCapabilities]]:
        """Get list of all available chart implementations and their capabilities"""
        from .acceleration_detector import AccelerationDetector
        
        implementations = []
        detector = AccelerationDetector()
        capabilities = detector.detect_capabilities()
        
        # Test Linux GPU
        if capabilities.is_linux and capabilities.has_nvidia_gpu:
            try:
                from .linux_gpu_chart import LinuxGPUChart
                gpu_caps = ChartCapabilities()
                gpu_caps.supports_gpu = True
                gpu_caps.supports_real_time = True
                gpu_caps.max_fps = 120
                gpu_caps.hardware_accelerated = True
                gpu_caps.memory_efficient = True
                implementations.append(("Linux GPU (ModernGL + CUDA)", gpu_caps))
            except ImportError:
                pass
                
        # Test CPU optimization
        try:
            from .cpu_optimized_chart import CPUOptimizedChart
            cpu_caps = ChartCapabilities()
            cpu_caps.supports_cpu_threading = True
            cpu_caps.supports_real_time = True
            cpu_caps.max_fps = 30
            cpu_caps.memory_efficient = True
            implementations.append(("CPU Optimized (NumPy + Threading)", cpu_caps))
        except ImportError:
            pass
        
        return implementations