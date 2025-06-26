"""
Real-Time GPU Renderer - Single-Item Buffer Architecture
No queues, no lag - always renders the latest state
"""

import threading
import time
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class ChartState:
    """Current chart state - single buffer, always latest"""
    current_price: float = 0.0
    current_candle: Optional[Dict[str, Any]] = None
    candles: list = None
    timestamp: float = 0.0
    
    def __post_init__(self):
        if self.candles is None:
            self.candles = []

class RealtimeGPURenderer:
    """
    Real-time GPU renderer with single-item buffer
    - No queues, no backlog
    - Always renders latest state
    - GPU thread runs at its own pace
    """
    
    def __init__(self, chart_class, symbol: str, width: int = 800, height: int = 600, target_fps: int = 60):
        self.chart_class = chart_class
        self.symbol = symbol
        self.width = width
        self.height = height
        self.target_fps = target_fps
        
        # Single-item buffer for latest state
        self.state_lock = threading.RLock()
        self.latest_state = ChartState()
        
        # GPU thread control
        self.running = False
        self.gpu_thread = None
        self.chart_instance = None
        
        # Performance tracking
        self.render_count = 0
        self.fps_actual = 0.0
        self.last_fps_time = time.time()
        self.last_fps_count = 0
        
        # Cached render result
        self.render_lock = threading.Lock()
        self.cached_render = None
        
        logger.info(f"RealtimeGPURenderer created for {symbol} @ {target_fps}fps")
        
    def start(self):
        """Start the GPU rendering thread"""
        if self.running:
            return
            
        self.running = True
        self.gpu_thread = threading.Thread(target=self._gpu_render_loop, name=f"GPU-{self.symbol}")
        self.gpu_thread.daemon = True
        self.gpu_thread.start()
        
        # Wait for initialization
        time.sleep(0.2)
        logger.info(f"GPU rendering thread started for {self.symbol}")
        
    def stop(self):
        """Stop the GPU rendering thread"""
        if not self.running:
            return
            
        logger.info("Stopping GPU rendering thread...")
        self.running = False
        
        if self.gpu_thread:
            self.gpu_thread.join(timeout=2.0)
            
        logger.info("GPU rendering thread stopped")
        
    def _gpu_render_loop(self):
        """Main GPU rendering loop - runs at target FPS"""
        try:
            # Initialize chart in GPU thread (owns OpenGL context)
            logger.info(f"Initializing chart in GPU thread {threading.get_ident()}")
            self.chart_instance = self.chart_class(
                symbol=self.symbol,
                width=self.width,
                height=self.height
            )
            
            # Frame timing
            frame_time = 1.0 / self.target_fps
            next_frame = time.time()
            
            while self.running:
                current_time = time.time()
                
                # Skip frame if we're behind
                if current_time < next_frame:
                    time.sleep(next_frame - current_time)
                    current_time = time.time()
                
                # Get latest state (quick lock)
                with self.state_lock:
                    state_snapshot = ChartState(
                        current_price=self.latest_state.current_price,
                        current_candle=self.latest_state.current_candle.copy() if self.latest_state.current_candle else None,
                        candles=self.latest_state.candles.copy(),
                        timestamp=self.latest_state.timestamp
                    )
                
                # Apply state to chart (outside lock)
                if state_snapshot.timestamp > 0:
                    # Update chart with latest data
                    if state_snapshot.current_price > 0:
                        self.chart_instance.update_price(state_snapshot.current_price)
                    
                    if state_snapshot.current_candle:
                        self.chart_instance.update_current_candle(state_snapshot.current_candle)
                    
                    # Sync candles if needed
                    if len(state_snapshot.candles) != len(self.chart_instance.candles):
                        self.chart_instance.candles = state_snapshot.candles.copy()
                
                # Render (this is the expensive operation)
                try:
                    rendered = self.chart_instance.render()
                    
                    # Cache the result
                    with self.render_lock:
                        self.cached_render = rendered
                    
                    self.render_count += 1
                    
                except Exception as e:
                    logger.error(f"Render error: {e}")
                
                # Calculate actual FPS
                if current_time - self.last_fps_time >= 1.0:
                    self.fps_actual = (self.render_count - self.last_fps_count) / (current_time - self.last_fps_time)
                    self.last_fps_count = self.render_count
                    self.last_fps_time = current_time
                    
                    if self.render_count % 60 == 0:  # Log every 60 frames
                        logger.info(f"GPU Renderer: {self.fps_actual:.1f} FPS actual (target: {self.target_fps})")
                
                # Schedule next frame
                next_frame = current_time + frame_time
                
        except Exception as e:
            logger.error(f"Fatal error in GPU thread: {e}", exc_info=True)
        finally:
            # Cleanup
            if self.chart_instance and hasattr(self.chart_instance, 'cleanup'):
                try:
                    self.chart_instance.cleanup()
                except:
                    pass
                    
            logger.info("GPU thread exiting")
    
    # WebSocket update methods (called from main thread)
    
    def update_price(self, price: float) -> None:
        """Update current price - overwrites previous value"""
        with self.state_lock:
            self.latest_state.current_price = price
            self.latest_state.timestamp = time.time()
    
    def update_current_candle(self, candle_data: Dict[str, Any]) -> None:
        """Update current forming candle - overwrites previous value"""
        with self.state_lock:
            self.latest_state.current_candle = candle_data
            self.latest_state.timestamp = time.time()
    
    def add_candle(self, candle_data: Dict[str, Any]) -> None:
        """Add completed candle to history"""
        with self.state_lock:
            self.latest_state.candles.append(candle_data)
            # Keep reasonable history
            if len(self.latest_state.candles) > 500:
                self.latest_state.candles = self.latest_state.candles[-500:]
            self.latest_state.timestamp = time.time()
    
    def get_dash_component(self) -> Any:
        """Get current render as Dash component"""
        from dash import html
        import base64
        import uuid
        
        # Get cached render
        with self.render_lock:
            render_data = self.cached_render
            
        if not render_data:
            # No render yet
            return html.Div(
                "Initializing GPU renderer...",
                style={'text-align': 'center', 'padding': '50px', 'color': '#666'}
            )
            
        # Convert to base64 image
        try:
            image_b64 = base64.b64encode(render_data).decode('utf-8')
            
            return html.Img(
                id={'type': 'gpu-chart', 'index': str(uuid.uuid4())},
                src=f"data:image/webp;base64,{image_b64}",
                style={
                    'width': '100%',
                    'height': 'auto',
                    'display': 'block',
                    'margin': '0',
                    'border': 'none',
                    'border-radius': '4px'
                }
            )
        except Exception as e:
            logger.error(f"Failed to create Dash component: {e}")
            return html.Div(f"Render error: {str(e)}")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return {
            'fps_target': self.target_fps,
            'fps_actual': self.fps_actual,
            'render_count': self.render_count,
            'chart_type': self.chart_instance.__class__.__name__ if self.chart_instance else 'Not initialized'
        }