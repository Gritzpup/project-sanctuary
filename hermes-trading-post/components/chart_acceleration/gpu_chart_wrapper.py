"""
GPU Chart Wrapper to handle lifecycle and prevent shutdown issues
"""

import logging
import threading
from typing import Any, Dict, Optional
import atexit

logger = logging.getLogger(__name__)

# Global lock to prevent multiple pygame initializations
_pygame_lock = threading.Lock()
_pygame_initialized = False
_active_charts = set()

def _cleanup_all_charts():
    """Cleanup all active charts on exit"""
    logger.info(f"Cleaning up {len(_active_charts)} active charts")
    for chart in list(_active_charts):
        try:
            if hasattr(chart, 'cleanup'):
                chart.cleanup()
        except Exception as e:
            logger.error(f"Error cleaning up chart: {e}")
    _active_charts.clear()

# Register cleanup on exit
atexit.register(_cleanup_all_charts)

class SafeGPUChartWrapper:
    """
    Wrapper for GPU charts that handles lifecycle management
    and prevents pygame/OpenGL issues in Dash apps
    """
    
    def __init__(self, chart_instance):
        self.chart = chart_instance
        self._is_active = True
        _active_charts.add(self)
        logger.debug(f"SafeGPUChartWrapper created for {chart_instance.__class__.__name__}")
        
    def __getattr__(self, name):
        """Delegate all method calls to the wrapped chart"""
        if not self._is_active:
            logger.warning(f"Attempting to access {name} on inactive chart")
            return lambda *args, **kwargs: None
        return getattr(self.chart, name)
    
    def render(self) -> Any:
        """Safe render that catches exceptions"""
        if not self._is_active:
            logger.warning("Attempting to render inactive chart")
            return self._get_empty_frame()
            
        try:
            return self.chart.render()
        except Exception as e:
            logger.error(f"Chart render failed: {e}")
            return self._get_empty_frame()
    
    def get_dash_component(self) -> Any:
        """Safe Dash component getter"""
        if not self._is_active:
            return self._get_error_component()
            
        try:
            return self.chart.get_dash_component()
        except Exception as e:
            logger.error(f"Failed to get Dash component: {e}")
            return self._get_error_component()
    
    def cleanup(self):
        """Safe cleanup that doesn't quit pygame"""
        if not self._is_active:
            return
            
        self._is_active = False
        _active_charts.discard(self)
        
        # Don't call the chart's cleanup method if it would quit pygame
        # Just mark it as inactive
        logger.info(f"SafeGPUChartWrapper marked as inactive")
    
    def _get_empty_frame(self) -> bytes:
        """Get an empty frame for error cases"""
        try:
            from PIL import Image
            import io
            img = Image.new('RGB', (self.chart.width, self.chart.height), color=(26, 26, 26))
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='WebP', quality=85)
            img_bytes.seek(0)
            return img_bytes.getvalue()
        except:
            return b''
    
    def _get_error_component(self) -> Any:
        """Get error component for Dash"""
        from dash import html
        return html.Div(
            "Chart temporarily unavailable",
            style={
                'width': f'{self.chart.width}px',
                'height': f'{self.chart.height}px',
                'border': '1px solid #444',
                'border-radius': '4px',
                'background-color': '#1a1a1a',
                'color': '#666',
                'display': 'flex',
                'align-items': 'center',
                'justify-content': 'center'
            }
        )

def ensure_pygame_initialized():
    """Ensure pygame is initialized only once"""
    global _pygame_initialized
    
    with _pygame_lock:
        if not _pygame_initialized:
            try:
                import pygame
                if not pygame.get_init():
                    pygame.init()
                    _pygame_initialized = True
                    logger.info("Pygame initialized by wrapper")
            except Exception as e:
                logger.error(f"Failed to initialize pygame: {e}")
                raise