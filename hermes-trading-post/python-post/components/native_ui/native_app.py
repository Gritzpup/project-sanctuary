"""
Native Chart Application - Framework Agnostic
GPU-accelerated native application to replace browser-based Dash
Target: 0.08ms total latency (7,188x improvement from 575ms baseline)
"""

import os
import sys
import time
import threading
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum

# Framework detection and imports
try:
    import tkinter as tk
    from tkinter import ttk
    TKINTER_AVAILABLE = True
except ImportError:
    TKINTER_AVAILABLE = False

try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False

try:
    from PyQt6.QtWidgets import QApplication, QMainWindow
    from PyQt6.QtCore import QTimer
    PYQT_AVAILABLE = True
except ImportError:
    try:
        from PyQt5.QtWidgets import QApplication, QMainWindow
        from PyQt5.QtCore import QTimer
        PYQT_AVAILABLE = True
    except ImportError:
        PYQT_AVAILABLE = False

class UIFramework(Enum):
    AUTO = "auto"
    TKINTER = "tkinter"
    PYGAME = "pygame"
    PYQT = "pyqt"

@dataclass
class WindowConfig:
    title: str = "Bitcoin Trading Dashboard"
    width: int = 1920
    height: int = 1080
    resizable: bool = True
    vsync: bool = False  # Disable for maximum performance
    full_screen: bool = False

class NativeChartApp:
    """
    Framework-agnostic native application for ultra-fast chart rendering
    Automatically detects and uses the best available UI framework
    """
    
    def __init__(self, 
                 config: WindowConfig = None,
                 framework: UIFramework = UIFramework.AUTO,
                 gpu_acceleration: bool = True):
        self.config = config or WindowConfig()
        self.framework = self._detect_framework(framework)
        self.gpu_acceleration = gpu_acceleration
        
        # Performance optimization: Pin to isolated cores
        self._optimize_process()
        
        # Initialize the native application
        self.app = None
        self.window = None
        self.chart_renderer = None
        self.is_running = False
        
        # Performance monitoring
        from ..optimization.performance_monitor import AdvancedPerformanceMonitor
        self.perf_monitor = AdvancedPerformanceMonitor()
        
        print(f"🚀 Initializing Native Chart App with {self.framework.value}")
        self._initialize_framework()
    
    def _detect_framework(self, preferred: UIFramework) -> UIFramework:
        """Auto-detect the best available UI framework"""
        if preferred != UIFramework.AUTO:
            return preferred
        
        # Priority order: PyQt > tkinter > pygame
        if PYQT_AVAILABLE:
            return UIFramework.PYQT
        elif TKINTER_AVAILABLE:
            return UIFramework.TKINTER
        elif PYGAME_AVAILABLE:
            return UIFramework.PYGAME
        else:
            raise RuntimeError("No supported UI framework found. Install PyQt6, tkinter, or pygame.")
    
    def _optimize_process(self):
        """Optimize process for maximum performance"""
        try:
            # Pin to isolated cores (4-7 as configured in Ubuntu)
            if hasattr(os, 'sched_setaffinity'):
                os.sched_setaffinity(0, {4, 5, 6, 7})
            
            # Set high priority
            if hasattr(os, 'nice'):
                os.nice(-10)  # High priority but not real-time
                
            print("⚡ Process optimized: CPU affinity and priority set")
        except Exception as e:
            print(f"⚠️ Process optimization failed: {e}")
    
    def _initialize_framework(self):
        """Initialize the selected UI framework"""
        if self.framework == UIFramework.PYQT:
            self._init_pyqt()
        elif self.framework == UIFramework.TKINTER:
            self._init_tkinter()
        elif self.framework == UIFramework.PYGAME:
            self._init_pygame()
        else:
            raise RuntimeError(f"Framework {self.framework.value} not implemented")
    
    def _init_pyqt(self):
        """Initialize PyQt application"""
        if not PYQT_AVAILABLE:
            raise RuntimeError("PyQt not available")
        
        self.app = QApplication(sys.argv)
        self.window = QMainWindow()
        self.window.setWindowTitle(self.config.title)
        self.window.resize(self.config.width, self.config.height)
        
        # Initialize GPU-accelerated chart widget
        if self.gpu_acceleration:
            from ..chart_acceleration.native_gpu_renderer import GPUChartWidget
            self.chart_renderer = GPUChartWidget(self.window)
            self.window.setCentralWidget(self.chart_renderer)
        
        print("✅ PyQt application initialized")
    
    def _init_tkinter(self):
        """Initialize tkinter application"""
        if not TKINTER_AVAILABLE:
            raise RuntimeError("tkinter not available")
        
        self.app = tk.Tk()
        self.app.title(self.config.title)
        self.app.geometry(f"{self.config.width}x{self.config.height}")
        
        # Initialize GPU-accelerated chart canvas
        if self.gpu_acceleration:
            from ..chart_acceleration.native_gpu_renderer import GPUChartCanvas
            self.chart_renderer = GPUChartCanvas(self.app)
            self.chart_renderer.pack(fill=tk.BOTH, expand=True)
        
        print("✅ tkinter application initialized")
    
    def _init_pygame(self):
        """Initialize pygame application"""
        if not PYGAME_AVAILABLE:
            raise RuntimeError("pygame not available")
        
        pygame.init()
        
        # Set up display with optimizations
        flags = pygame.DOUBLEBUF | pygame.HWSURFACE
        if self.config.full_screen:
            flags |= pygame.FULLSCREEN
        
        self.app = pygame.display.set_mode(
            (self.config.width, self.config.height), 
            flags
        )
        pygame.display.set_caption(self.config.title)
        
        # Initialize GPU-accelerated chart surface
        if self.gpu_acceleration:
            from ..chart_acceleration.native_gpu_renderer import GPUChartSurface
            self.chart_renderer = GPUChartSurface(self.app)
        
        print("✅ pygame application initialized")
    
    def set_chart_data(self, ohlc_data: list, symbol: str = "BTC-USD"):
        """Update chart data with GPU acceleration"""
        if not self.chart_renderer:
            print("⚠️ Chart renderer not initialized")
            return
        
        # Measure performance
        def update_chart():
            return self.chart_renderer.update_data(ohlc_data, symbol)
        
        result = self.perf_monitor.measure_latency(update_chart)
        return result
    
    def start_real_time_updates(self, websocket_service):
        """Start real-time chart updates from WebSocket"""
        def data_callback(data):
            """Callback for WebSocket data updates"""
            self.set_chart_data(data.get('ohlc', []), data.get('symbol', 'BTC-USD'))
        
        # Connect WebSocket service
        websocket_service.add_data_callback(data_callback)
        websocket_service.start()
        
        print("🔄 Real-time updates started")
    
    def run(self):
        """Start the native application main loop"""
        self.is_running = True
        
        try:
            if self.framework == UIFramework.PYQT:
                self.window.show()
                sys.exit(self.app.exec())
            elif self.framework == UIFramework.TKINTER:
                self.app.mainloop()
            elif self.framework == UIFramework.PYGAME:
                self._pygame_main_loop()
        except KeyboardInterrupt:
            print("\n🛑 Application stopped by user")
        finally:
            self.cleanup()
    
    def _pygame_main_loop(self):
        """Main loop for pygame application"""
        clock = pygame.time.Clock()
        
        while self.is_running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.is_running = False
            
            # Render chart
            if self.chart_renderer:
                self.chart_renderer.render()
            
            pygame.display.flip()
            
            # Target: 1000 FPS for sub-millisecond updates
            clock.tick(1000)
    
    def cleanup(self):
        """Clean up resources"""
        self.is_running = False
        
        if self.chart_renderer:
            self.chart_renderer.cleanup()
        
        if self.framework == UIFramework.PYGAME and pygame.get_init():
            pygame.quit()
        
        print("🧹 Application cleanup completed")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get current performance statistics"""
        return self.perf_monitor.get_performance_stats()

def create_native_chart_app(symbol: str = "BTC-USD",
                           gpu_acceleration: bool = True,
                           ui_framework: str = "auto",
                           **kwargs) -> NativeChartApp:
    """
    Factory function to create a native chart application
    
    Args:
        symbol: Trading symbol (e.g., "BTC-USD")
        gpu_acceleration: Enable GPU acceleration
        ui_framework: UI framework ("auto", "pyqt", "tkinter", "pygame")
        **kwargs: Additional window configuration
    
    Returns:
        NativeChartApp instance
    """
    framework = UIFramework(ui_framework.lower())
    config = WindowConfig(**kwargs)
    
    app = NativeChartApp(
        config=config,
        framework=framework,
        gpu_acceleration=gpu_acceleration
    )
    
    return app

if __name__ == "__main__":
    # Example usage
    app = create_native_chart_app(
        symbol="BTC-USD",
        gpu_acceleration=True,
        ui_framework="auto",
        title="Ultra-Fast Bitcoin Chart",
        width=1920,
        height=1080
    )
    
    # Print performance stats before running
    print("🎯 Target: 0.08ms total latency (7,188x improvement)")
    print(f"📊 Using {app.framework.value} framework")
    
    app.run()
