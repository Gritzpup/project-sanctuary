"""
Threaded GPU Renderer - Dual CPU/GPU Architecture
Dedicates one thread to GPU rendering while allowing multi-threaded CPU operations
"""

import threading
import queue
import time
import logging
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)  # Set logger to WARNING level

class RenderCommand(Enum):
    """Commands for the GPU rendering thread"""
    RENDER = "render"
    UPDATE_DATA = "update_data"
    UPDATE_PRICE = "update_price"
    UPDATE_CURRENT_CANDLE = "update_current_candle"
    SHUTDOWN = "shutdown"
    GET_STATS = "get_stats"

@dataclass
class RenderRequest:
    """Request to be processed by GPU thread"""
    command: RenderCommand
    data: Optional[Dict[str, Any]] = None
    callback: Optional[Callable] = None
    event: Optional[threading.Event] = None
    result: Optional[Any] = None

class ThreadedGPURenderer:
    """
    Manages GPU rendering in a dedicated thread
    Allows Dash to run multi-threaded while keeping OpenGL single-threaded
    """
    
    def __init__(self, chart_class, symbol: str, width: int = 800, height: int = 600):
        self.chart_class = chart_class
        self.symbol = symbol
        self.width = width
        self.height = height
        
        # Thread-safe communication - increased queue size for batch updates
        self.render_queue = queue.Queue(maxsize=1000)
        self.gpu_thread = None
        self.chart_instance = None
        self.running = False
        self.initialization_error = None
        
        # Performance tracking
        self.render_count = 0
        self.total_render_time = 0
        self.last_render_time = 0
        
        # Cache for latest render
        self.latest_render = None
        self.render_lock = threading.Lock()
        
        logger.info(f"ThreadedGPURenderer initialized for {symbol}")
        
    def start(self):
        """Start the GPU rendering thread"""
        if self.gpu_thread and self.gpu_thread.is_alive():
            logger.warning("GPU thread already running")
            return
            
        self.running = True
        self.gpu_thread = threading.Thread(
            target=self._gpu_thread_loop,
            name=f"GPU-Renderer-{self.symbol}",
            daemon=True
        )
        self.gpu_thread.start()
        
        # Wait for initialization
        init_event = threading.Event()
        self.render_queue.put(RenderRequest(
            command=RenderCommand.RENDER,
            event=init_event
        ))
        init_event.wait(timeout=5.0)
        
        logger.info(f"GPU rendering thread started for {self.symbol}")
        
        # Wait a bit for initialization
        time.sleep(0.5)
        
        # Check for initialization errors
        if self.initialization_error:
            logger.error(f"GPU thread initialization failed: {self.initialization_error}")
            raise RuntimeError(f"GPU initialization failed: {self.initialization_error}")
        
        # Trigger initial render
        self.render_queue.put(RenderRequest(command=RenderCommand.RENDER))
        
    def stop(self):
        """Stop the GPU rendering thread"""
        if not self.running:
            return
            
        logger.info("Stopping GPU rendering thread...")
        self.running = False
        
        # Send shutdown command
        shutdown_event = threading.Event()
        self.render_queue.put(RenderRequest(
            command=RenderCommand.SHUTDOWN,
            event=shutdown_event
        ))
        
        # Wait for thread to finish
        if self.gpu_thread:
            self.gpu_thread.join(timeout=2.0)
            
        logger.info("GPU rendering thread stopped")
        
    def _gpu_thread_loop(self):
        """Main loop for GPU rendering thread - owns OpenGL context"""
        try:
            # Initialize pygame and OpenGL context in this thread
            import pygame
            
            # Set thread affinity to isolated GPU cores if available
            try:
                import os
                gpu_cores = {4, 5}  # GPU-dedicated cores from your setup
                os.sched_setaffinity(0, gpu_cores)
                logger.info(f"GPU thread pinned to cores: {gpu_cores}")
            except:
                pass
            
            # Create chart instance in GPU thread (owns OpenGL context)
            logger.info(f"Creating chart instance in GPU thread {threading.get_ident()}")
            self.chart_instance = self.chart_class(
                symbol=self.symbol,
                width=self.width,
                height=self.height
            )
            
            # Main rendering loop
            while self.running:
                try:
                    # Get next request (timeout prevents hanging)
                    request = self.render_queue.get(timeout=0.1)
                    
                    if request.command == RenderCommand.SHUTDOWN:
                        logger.info("GPU thread received shutdown command")
                        if request.event:
                            request.event.set()
                        break
                        
                    elif request.command == RenderCommand.RENDER:
                        # Perform GPU rendering
                        logger.debug(f"[THREADED GPU] Processing RENDER command (render #{self.render_count + 1})")
                        start_time = time.perf_counter()
                        
                        try:
                            render_result = self.chart_instance.render()
                            
                            # Update cached result
                            with self.render_lock:
                                self.latest_render = render_result
                                
                            # Track performance
                            render_time = time.perf_counter() - start_time
                            self.render_count += 1
                            self.total_render_time += render_time
                            self.last_render_time = render_time
                            
                            if request.callback:
                                request.callback(render_result)
                                
                        except Exception as e:
                            logger.error(f"GPU render failed: {e}")
                            
                        if request.event:
                            request.event.set()
                            
                    elif request.command == RenderCommand.UPDATE_DATA:
                        # Update chart data
                        if request.data:
                            # Always use add_candle for now to ensure data is added
                            self.chart_instance.add_candle(request.data)
                            # Don't auto-render here - let the interval callback handle rendering
                            
                    elif request.command == RenderCommand.UPDATE_PRICE:
                        # Update current price
                        if request.data and 'price' in request.data:
                            logger.info(f"[THREADED GPU] Processing UPDATE_PRICE command: ${request.data['price']:,.2f}")
                            self.chart_instance.update_price(request.data['price'])
                            
                    elif request.command == RenderCommand.UPDATE_CURRENT_CANDLE:
                        # Update currently forming candle
                        if request.data:
                            logger.info(f"[THREADED GPU] Processing UPDATE_CURRENT_CANDLE command")
                            self.chart_instance.update_current_candle(request.data)
                            
                    elif request.command == RenderCommand.GET_STATS:
                        # Return performance stats
                        stats = self.chart_instance.get_performance_stats()
                        stats.update({
                            'gpu_thread_id': threading.get_ident(),
                            'render_count': self.render_count,
                            'avg_render_time': (self.total_render_time / self.render_count) if self.render_count > 0 else 0,
                            'last_render_time': self.last_render_time
                        })
                        request.result = stats
                        if request.event:
                            request.event.set()
                        
                except queue.Empty:
                    # No requests, continue loop
                    continue
                except Exception as e:
                    logger.error(f"Error in GPU thread loop: {e}")
                    
        except Exception as e:
            logger.error(f"Fatal error in GPU thread: {e}", exc_info=True)
            # Set a flag to indicate initialization failure
            self.initialization_error = str(e)
        finally:
            # Cleanup
            if self.chart_instance and hasattr(self.chart_instance, 'cleanup'):
                try:
                    self.chart_instance.cleanup()
                except:
                    pass
                    
            logger.info("GPU thread exiting")
            
    def render_async(self, callback: Optional[Callable] = None) -> Optional[Any]:
        """
        Request a render from any thread (non-blocking)
        Returns cached result immediately, triggers new render in background
        """
        if not self.running:
            return None
            
        # Return cached result immediately
        with self.render_lock:
            cached_result = self.latest_render
            
        # Queue new render request (non-blocking)
        try:
            self.render_queue.put_nowait(RenderRequest(
                command=RenderCommand.RENDER,
                callback=callback
            ))
            logger.debug("[THREADED GPU] Queued RENDER command")
        except queue.Full:
            logger.warning("Render queue full, skipping frame")
            
        return cached_result
        
    def render_sync(self, timeout: float = 0.1) -> Optional[Any]:
        """
        Request a render and wait for result (blocking)
        Used for initial renders or when fresh data is required
        """
        if not self.running:
            return None
            
        event = threading.Event()
        request = RenderRequest(
            command=RenderCommand.RENDER,
            event=event
        )
        
        try:
            self.render_queue.put(request, timeout=timeout)
            if event.wait(timeout=timeout):
                with self.render_lock:
                    return self.latest_render
        except queue.Full:
            logger.warning("Render queue full")
            
        return None
        
    def update_data(self, candle_data: Dict[str, Any]):
        """Update chart data (thread-safe)"""
        try:
            self.render_queue.put_nowait(RenderRequest(
                command=RenderCommand.UPDATE_DATA,
                data=candle_data
            ))
        except queue.Full:
            logger.warning("Update queue full, dropping data update")
    
    def add_candle(self, candle_data: Dict[str, Any]):
        """Alias for update_data for compatibility"""
        self.update_data(candle_data)
    
    def update_current_candle(self, candle_data: Dict[str, Any]):
        """Update currently forming candle (thread-safe)"""
        logger.info(f"[THREADED GPU] update_current_candle called with data: {candle_data}")
        try:
            self.render_queue.put_nowait(RenderRequest(
                command=RenderCommand.UPDATE_CURRENT_CANDLE,
                data=candle_data
            ))
            logger.info(f"[THREADED GPU] UPDATE_CURRENT_CANDLE command queued successfully")
        except queue.Full:
            logger.warning("Update queue full, dropping current candle update")
            
    def update_price(self, price: float):
        """Update current price (thread-safe)"""
        try:
            self.render_queue.put_nowait(RenderRequest(
                command=RenderCommand.UPDATE_PRICE,
                data={'price': price}
            ))
        except queue.Full:
            # Price updates are less critical, okay to drop
            pass
            
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics from GPU thread"""
        event = threading.Event()
        request = RenderRequest(
            command=RenderCommand.GET_STATS,
            event=event
        )
        
        try:
            self.render_queue.put(request, timeout=0.1)
            if event.wait(timeout=0.5):
                return request.result or {}
        except:
            pass
            
        return {
            'render_count': self.render_count,
            'avg_render_time': (self.total_render_time / self.render_count) if self.render_count > 0 else 0
        }
        
    def get_dash_component(self):
        """Get Dash component with latest render"""
        # This can be called from any thread safely
        logger.debug(f"[THREADED GPU] get_dash_component called, render_count={self.render_count}")
        try:
            render_data = self.render_async()
        except Exception as e:
            logger.error(f"[THREADED GPU] Error in render_async: {e}")
            render_data = None
        
        if render_data:
            try:
                # Convert render data to Dash component
                # This part runs in the request thread, not GPU thread
                import base64
                from dash import html
                
                if isinstance(render_data, bytes):
                    logger.debug(f"[THREADED GPU] Creating Img component from {len(render_data)} bytes")
                    img_base64 = base64.b64encode(render_data).decode()
                    return html.Img(
                        src=f"data:image/webp;base64,{img_base64}",
                        style={'width': '100%', 'height': '100%', 'display': 'block', 'objectFit': 'contain'}
                    )
            except Exception as e:
                logger.error(f"[THREADED GPU] Error creating Dash component: {e}")
                
        # Fallback
        logger.debug("[THREADED GPU] Using fallback Div component")
        try:
            from dash import html
            return html.Div(
                "Chart loading...",
                style={
                    'width': f'{self.width}px',
                    'height': f'{self.height}px',
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'background': '#1a1a1a',
                    'color': '#666'
                }
            )
        except Exception as e:
            logger.error(f"[THREADED GPU] Error creating fallback component: {e}")
            return None
    
    def stop(self):
        """Stop the GPU rendering thread gracefully"""
        if not self.running:
            return
            
        logger.info(f"Stopping GPU thread for {self.symbol}")
        self.running = False
        
        # Send shutdown command to thread
        try:
            shutdown_event = threading.Event()
            self.render_queue.put(RenderRequest(
                command=RenderCommand.SHUTDOWN,
                event=shutdown_event
            ), timeout=0.5)
            
            # Wait for shutdown to be acknowledged
            if not shutdown_event.wait(timeout=1.0):
                logger.warning("GPU thread did not acknowledge shutdown")
        except Exception as e:
            logger.warning(f"Error sending shutdown command: {e}")
            
        # Clear the queue to unblock the thread
        try:
            while not self.render_queue.empty():
                self.render_queue.get_nowait()
        except:
            pass
            
        # Wait for thread to finish
        if self.gpu_thread and self.gpu_thread.is_alive():
            self.gpu_thread.join(timeout=2.0)
            if self.gpu_thread.is_alive():
                logger.error(f"GPU thread for {self.symbol} did not stop gracefully - may cause issues")
                    
    def cleanup(self):
        """Clean up resources"""
        self.stop()
        
    def __del__(self):
        """Ensure cleanup on deletion"""
        try:
            self.cleanup()
        except:
            pass