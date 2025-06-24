"""
Linux GPU Chart Renderer - Extreme Performance Implementation
Targets: 0.1-0.5ms chart updates on Linux + RTX 2080 Super (780-3900x improvement)
"""
import moderngl
import numpy as np
import os
import time
import base64
import threading
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..chart_acceleration.base_chart import BaseChart
import logging
import redis
import json

# Conditional imports for performance features
try:
    import cupy as cp
    HAS_CUPY = True
except ImportError:
    HAS_CUPY = False
    
try:
    import pygame
    HAS_PYGAME = True
except ImportError:
    HAS_PYGAME = False

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)

# Global lock for OpenGL context initialization
_opengl_init_lock = threading.Lock()
_pygame_initialized = False
_pygame_display_created = False

class LinuxGPUChart(BaseChart):
    """
    Ultra-high performance GPU chart for Linux + RTX 2080 Super
    
    Features:
    - CUDA acceleration with CuPy
    - Linux-specific optimizations (CPU pinning, huge pages)
    - Zero-copy memory pipeline
    - Hardware-accelerated rendering
    - Target: 0.1-0.5ms chart updates
    """
    
    def __init__(self, symbol: str, width: int = 800, height: int = 600):
        super().__init__(symbol, width, height)
        
        # Add max visible candles for 1-hour timeframe
        self.max_visible_candles = 60  # 60 candles for 1-hour view
        self.prev_price = None  # Track previous price for color changes
        self._context_initialized = False  # Track OpenGL context state
        
        # Linux optimizations
        self._setup_linux_optimizations()
        
        # Initialize OpenGL context
        self._init_opengl_context()
        
        # Initialize CUDA if available
        self._init_cuda()
        
        # Initialize rendering pipeline
        self._init_shaders()
        self._init_buffers()
        
        # Performance tracking
        self.render_times = []
        self.cuda_times = []
        
        logger.info(f"LinuxGPUChart initialized for {symbol} ({width}x{height})")
        
        # Track instance for debugging shutdown issues
        import atexit
        atexit.register(self._on_exit)
    
    def _on_exit(self):
        """Called when the process is exiting"""
        logger.info(f"LinuxGPUChart process exiting for {self.symbol}")
        # Don't call cleanup here - it might cause issues
        
    def _setup_linux_optimizations(self):
        """Setup Linux-specific performance optimizations"""
        
        # Try to pin process to isolated CPU cores (4-7 as per documentation)
        try:
            isolated_cores = {4, 5, 6, 7}  # Chart rendering cores
            current_affinity = os.sched_getaffinity(0)
            
            # Use isolated cores if available, otherwise use available cores
            preferred_cores = isolated_cores.intersection(current_affinity)
            if preferred_cores:
                os.sched_setaffinity(0, preferred_cores)
                logger.info(f"Process pinned to CPU cores: {preferred_cores}")
            else:
                logger.warning("Isolated CPU cores not available, using default affinity")
        except Exception as e:
            logger.debug(f"CPU affinity setting failed: {e}")
            
        # Try to set high process priority
        try:
            os.nice(-10)  # Higher priority (requires privileges)
        except Exception as e:
            logger.debug(f"Process priority setting failed: {e}")
            
    def _init_opengl_context(self):
        """Initialize OpenGL context with Linux optimizations"""
        
        global _pygame_initialized, _pygame_display_created
        
        if HAS_PYGAME:
            try:
                with _opengl_init_lock:
                    # Initialize pygame with Linux-optimized settings
                    # Check if pygame is already initialized to avoid multiple inits
                    if not _pygame_initialized and not pygame.get_init():
                        pygame.init()
                        _pygame_initialized = True
                        logger.info("Pygame initialized for GPU chart")
                    else:
                        logger.debug("Pygame already initialized")
                    
                    # Request hardware acceleration and double buffering
                    # Only create display if one doesn't exist
                    if not _pygame_display_created and pygame.display.get_surface() is None:
                        pygame.display.set_mode(
                            (self.width, self.height),
                            pygame.OPENGL | pygame.DOUBLEBUF | pygame.HIDDEN
                        )
                        _pygame_display_created = True
                        logger.info("Created pygame display")
                    else:
                        logger.debug("Pygame display already exists")
                
                # Create ModernGL context (this can be done per instance)
                self.ctx = moderngl.create_context()
                
                # Enable GPU optimizations
                self.ctx.enable(moderngl.BLEND)
                self.ctx.blend_func = moderngl.SRC_ALPHA, moderngl.ONE_MINUS_SRC_ALPHA
                
                # Log OpenGL info
                logger.info(f"OpenGL context initialized: {self.ctx.info}")
                logger.info(f"OpenGL version: {self.ctx.info.get('GL_VERSION', 'Unknown')}")
                logger.info(f"GPU Renderer: {self.ctx.info.get('GL_RENDERER', 'Unknown')}")
                
                self._context_initialized = True
                
            except Exception as e:
                logger.error(f"Failed to initialize OpenGL context: {e}")
                raise RuntimeError(f"OpenGL initialization failed: {e}")
        else:
            raise RuntimeError("Pygame not available - required for OpenGL context")
            
    def _init_cuda(self):
        """Initialize CUDA acceleration if available"""
        
        if HAS_CUPY:
            try:
                # Create CUDA context
                self.cuda_device = cp.cuda.Device(0)
                self.cuda_context = self.cuda_device.use()
                
                # Pre-allocate GPU memory pools for zero-allocation rendering
                # Pool for chart textures (16 slots for multi-frame buffering)
                self.chart_texture_pool = cp.zeros((16, self.height, self.width, 4), dtype=cp.uint8)
                
                # Pool for OHLC data (50k candles should be enough)
                self.ohlc_gpu_buffer = cp.zeros((50000, 4), dtype=cp.float32)
                
                # Pool for computed vertices
                self.vertex_gpu_buffer = cp.zeros((200000, 2), dtype=cp.float32)
                
                # Current pool indices
                self.current_texture_idx = 0
                
                self.has_cuda = True
                logger.info("CUDA acceleration enabled with pre-allocated memory pools")
                
            except Exception as e:
                logger.warning(f"CUDA initialization failed: {e}")
                self.has_cuda = False
        else:
            self.has_cuda = False
            logger.info("CUDA not available, using CPU+GPU pipeline")
            
    def _init_shaders(self):
        """Initialize optimized GPU shaders"""
        
        # High-performance vertex shader for candlesticks
        candlestick_vertex_shader = """
        #version 330 core
        
        layout (location = 0) in vec2 position;
        layout (location = 1) in vec3 color;
        
        uniform mat4 projection;
        uniform float point_size;
        
        out vec3 fragColor;
        
        void main() {
            gl_Position = projection * vec4(position, 0.0, 1.0);
            gl_PointSize = point_size;
            fragColor = color;
        }
        """
        
        # Optimized fragment shader
        fragment_shader = """
        #version 330 core
        
        in vec3 fragColor;
        out vec4 color;
        
        void main() {
            color = vec4(fragColor, 1.0);
        }
        """
        
        # Create shader programs
        self.candlestick_program = self.ctx.program(
            vertex_shader=candlestick_vertex_shader,
            fragment_shader=fragment_shader
        )
        
        # Colors optimized for dark theme
        self.colors = {
            'bullish': np.array([0.15, 0.65, 0.6], dtype=np.float32),    # Teal
            'bearish': np.array([0.94, 0.33, 0.31], dtype=np.float32),   # Red  
            'background': np.array([0.1, 0.1, 0.1], dtype=np.float32),   # Dark
            'grid': np.array([0.3, 0.3, 0.3], dtype=np.float32),         # Gray
            'price_line': np.array([1.0, 1.0, 0.0], dtype=np.float32),   # Yellow (deprecated)
            'price_line_bullish': np.array([0.15, 0.65, 0.6], dtype=np.float32),  # Teal
            'price_line_bearish': np.array([0.94, 0.33, 0.31], dtype=np.float32), # Red
            'price_line_neutral': np.array([0.63, 0.63, 0.63], dtype=np.float32)  # Gray
        }
        
        # Reserve space for timeline at bottom
        self.timeline_height = 30  # pixels reserved for timeline
        # Reserve space for price label on right
        self.price_label_width = 90  # pixels reserved for price label
        
    def _init_buffers(self):
        """Initialize GPU vertex buffers with optimal sizing"""
        
        # Large pre-allocated buffers for zero-allocation updates
        max_vertices = 100000  # Enough for complex charts
        
        self.vertex_buffer = self.ctx.buffer(reserve=max_vertices * 2 * 4)  # vec2 positions
        self.color_buffer = self.ctx.buffer(reserve=max_vertices * 3 * 4)   # vec3 colors
        
        # Create vertex array object
        self.vao = self.ctx.vertex_array(
            self.candlestick_program,
            [(self.vertex_buffer, '2f', 'position'),
             (self.color_buffer, '3f', 'color')]
        )
        
        # Framebuffer for off-screen rendering
        self.framebuffer = self.ctx.framebuffer(
            color_attachments=[self.ctx.texture((self.width, self.height), 4)]
        )
        
    def add_candle(self, candle_data: Dict[str, Any]) -> None:
        """Add a new completed candle"""
        
        self.candles.append(candle_data)
        
        # Keep only recent candles for performance and visibility
        max_to_keep = min(self.max_candles, self.max_visible_candles)
        if len(self.candles) > max_to_keep:
            self.candles = self.candles[-max_to_keep:]
            
        self._update_bounds()
        
    def update_current_candle(self, candle_data: Dict[str, Any]) -> None:
        """Update currently forming candle - always keep it at the rightmost position. Data should come from dashboard websocket only."""
        
        if self.candles and len(self.candles) > 0:
            # Check if same timestamp
            last_candle = self.candles[-1]
            if ('time' in last_candle and 'time' in candle_data and 
                last_candle['time'] == candle_data['time']):
                # Update the forming candle in-place
                self.candles[-1] = candle_data
            else:
                # New candle started - add it and auto-scroll
                self.add_candle(candle_data)
        else:
            self.add_candle(candle_data)
        
        self._update_bounds()
            
    def update_price(self, price: float) -> None:
        """Update current price for real-time line. Data should come from dashboard websocket only."""
        
        self.prev_price = self.current_price if self.current_price > 0 else price
        self.current_price = price
        logger.debug(f"LinuxGPUChart: Updated price to ${price:.2f}")
        current_time = time.time()
        
        # Add to price history
        self.price_history.append((current_time, price))
        
        # Keep only recent price history (last 60 seconds)
        cutoff_time = current_time - 60
        self.price_history = [(t, p) for t, p in self.price_history if t > cutoff_time]
        
        # --- Redis publish for Dash UI ---
        try:
            redis_client = redis.Redis(host='localhost', port=6379, db=0)
            redis_client.set('latest_price', json.dumps({'price': price}))
        except Exception as e:
            logger.warning(f"Redis publish error: {e}")
        
    def update_current_candle(self, candle_data: Dict[str, Any]) -> None:
        """Update the currently forming candle from WebSocket data and publish to Redis for Dash UI"""
        logger.debug(f"LinuxGPUChart: Updating current candle: {candle_data}")
        
        if not candle_data:
            return
            
        # Find if we have a candle for the current minute
        candle_time = candle_data.get('time')
        if not candle_time:
            return
            
        # Check if this is a new candle or update to existing
        if self.candles:
            last_candle = self.candles[-1]
            last_time = last_candle.get('time')
            
            # If times match, update the last candle
            if last_time and last_time == candle_time:
                self.candles[-1] = candle_data
                logger.debug(f"Updated existing candle at {candle_time}")
            else:
                # This is a new candle
                self.add_candle(candle_data)
                logger.debug(f"Added new current candle at {candle_time}")
        else:
            # No candles yet, add this one
            self.add_candle(candle_data)
            logger.debug(f"Added first current candle at {candle_time}")
        
        # --- Redis publish for Dash UI ---
        try:
            import redis, json
            redis_client = redis.Redis(host='localhost', port=6379, db=0)
            # Ensure 'time' is an ISO string for Redis serialization
            candle_for_redis = dict(candle_data)
            if isinstance(candle_for_redis.get('time'), datetime):
                candle_for_redis['time'] = candle_for_redis['time'].isoformat()
            redis_client.set('latest_candle', json.dumps(candle_for_redis))
        except Exception as e:
            logger.warning(f"Redis publish error (candle): {e}")
        
        # Update bounds to include new candle data
        self._update_bounds()
        
    def _update_bounds(self):
        """Update chart coordinate bounds"""
        
        if not self.candles:
            return
            
        # Extract all prices for bounds calculation
        all_prices = []
        for candle in self.candles:
            all_prices.extend([candle.get('high', 0), candle.get('low', 0)])
            
        if self.current_price > 0:
            all_prices.append(self.current_price)
            
        if all_prices:
            self.price_min = min(all_prices) * 0.995  # 0.5% padding
            self.price_max = max(all_prices) * 1.005
            
        # Time bounds
        if self.candles:
            times = [c.get('time', datetime.utcnow()) for c in self.candles]
            self.time_min = min(times)
            self.time_max = max(times)
            
    def _generate_vertices_cuda(self) -> tuple:
        """Generate vertices using CUDA acceleration"""
        
        if not self.has_cuda or not self.candles:
            return self._generate_vertices_cpu()
            
        start_time = time.perf_counter()
        
        try:
            with self.cuda_context:
                # Convert candle data to GPU arrays
                n_candles = len(self.candles)
                logger.debug(f"Generating vertices for {n_candles} candles")
                
                candle_array = np.zeros((n_candles, 4), dtype=np.float32)
                
                for i, candle in enumerate(self.candles):
                    candle_array[i] = [
                        candle.get('open', 0),
                        candle.get('high', 0),
                        candle.get('low', 0),
                        candle.get('close', 0)
                    ]
                    
                # Upload to GPU
                gpu_candles = cp.asarray(candle_array)
                
                # GPU-accelerated vertex generation
                vertices, colors = self._cuda_generate_candlestick_geometry(gpu_candles)
                
                # Download results
                vertices_cpu = cp.asnumpy(vertices).flatten()
                colors_cpu = cp.asnumpy(colors).flatten()
                
                logger.debug(f"Generated {len(vertices_cpu)//2} vertices ({len(vertices_cpu)} floats)")
                
                cuda_time = (time.perf_counter() - start_time) * 1000
                self.cuda_times.append(cuda_time)
                
                return vertices_cpu.astype(np.float32), colors_cpu.astype(np.float32)
                
        except Exception as e:
            logger.warning(f"CUDA vertex generation failed: {e}")
            return self._generate_vertices_cpu()
            
    def _cuda_generate_candlestick_geometry(self, gpu_candles):
        """CUDA kernel for parallel candlestick geometry generation"""
        
        n_candles = gpu_candles.shape[0]
        
        # Pre-allocate result arrays
        max_vertices_per_candle = 24  # 4 triangles * 6 vertices (body + wicks)
        vertices = cp.zeros((n_candles * max_vertices_per_candle, 2), dtype=cp.float32)
        colors = cp.zeros((n_candles * max_vertices_per_candle, 3), dtype=cp.float32)
        
        # CUDA kernel implementation using CuPy
        candle_width = 0.8
        vertex_idx = 0
        
        # Check if last candle is the current forming candle
        from datetime import datetime, timezone
        current_minute = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        
        for i in range(n_candles):
            candle = gpu_candles[i]
            
            # Time coordinate - use candle index directly for proper projection
            x = float(i)
            
            # Price coordinates
            o, h, l, c = candle[0], candle[1], candle[2], candle[3]
            
            # Color determination
            is_bullish = c >= o
            
            # Check if this is the current forming candle
            is_current = (i == n_candles - 1 and 
                         self.candles[i].get('time') == current_minute)
            
            if is_current:
                # Make current candle more vibrant/distinct
                if is_bullish:
                    color = cp.array([0.2, 0.9, 0.8])  # Brighter cyan for current bullish
                else:
                    color = cp.array([1.0, 0.4, 0.4])  # Brighter red for current bearish
            else:
                color = cp.array([0.15, 0.65, 0.6] if is_bullish else [0.94, 0.33, 0.31])
            
            # Candlestick body
            body_top = max(o, c)
            body_bottom = min(o, c)
            half_width = candle_width / 2
            
            # Body rectangle (2 triangles = 6 vertices)
            body_verts = cp.array([
                [x - half_width, body_bottom],
                [x + half_width, body_bottom], 
                [x + half_width, body_top],
                [x - half_width, body_bottom],
                [x + half_width, body_top],
                [x - half_width, body_top]
            ])
            
            vertices[vertex_idx:vertex_idx+6] = body_verts
            colors[vertex_idx:vertex_idx+6] = cp.tile(color, (6, 1))
            vertex_idx += 6
            
            # Wicks (simplified as thin rectangles)
            thin_width = candle_width / 8
            
            # Upper wick
            if h > body_top:
                wick_verts = cp.array([
                    [x - thin_width, body_top],
                    [x + thin_width, body_top],
                    [x + thin_width, h],
                    [x - thin_width, body_top],
                    [x + thin_width, h],
                    [x - thin_width, h]
                ])
                vertices[vertex_idx:vertex_idx+6] = wick_verts
                colors[vertex_idx:vertex_idx+6] = cp.tile(color, (6, 1))
                vertex_idx += 6
                
            # Lower wick  
            if l < body_bottom:
                wick_verts = cp.array([
                    [x - thin_width, l],
                    [x + thin_width, l],
                    [x + thin_width, body_bottom],
                    [x - thin_width, l],
                    [x + thin_width, body_bottom],
                    [x - thin_width, body_bottom]
                ])
                vertices[vertex_idx:vertex_idx+6] = wick_verts
                colors[vertex_idx:vertex_idx+6] = cp.tile(color, (6, 1))
                vertex_idx += 6
                
        # Return only used vertices
        return vertices[:vertex_idx], colors[:vertex_idx]
        
    def _generate_vertices_cpu(self) -> tuple:
        """Fallback CPU vertex generation"""
        
        if not self.candles:
            return np.array([], dtype=np.float32), np.array([], dtype=np.float32)
            
        vertices = []
        colors = []
        n_candles = len(self.candles)
        
        for i, candle in enumerate(self.candles):
            # Use candle index directly for proper projection
            x = float(i)
            
            o = candle.get('open', 0)
            h = candle.get('high', 0)
            l = candle.get('low', 0)
            c = candle.get('close', 0)
            
            is_bullish = c >= o
            # Always treat the last candle as the live candle
            is_current = (i == n_candles - 1)
            if is_current:
                # Make current candle more vibrant/distinct
                if is_bullish:
                    color = [0.2, 0.9, 0.8]  # Brighter cyan for current bullish
                else:
                    color = [1.0, 0.4, 0.4]  # Brighter red for current bearish
            else:
                color = self.colors['bullish'] if is_bullish else self.colors['bearish']
            
            # Simplified body rectangle
            body_top = max(o, c)
            body_bottom = min(o, c)
            half_width = 0.4
            
            # Body vertices
            body_verts = [
                [x - half_width, body_bottom],
                [x + half_width, body_bottom],
                [x + half_width, body_top],
                [x - half_width, body_bottom],
                [x + half_width, body_top],
                [x - half_width, body_top]
            ]
            
            vertices.extend(body_verts)
            for _ in range(6):
                colors.extend(color)
                
        return np.array(vertices, dtype=np.float32).flatten(), np.array(colors, dtype=np.float32).flatten()
        
    def _draw_x_axis(self):
        """Draw moving x-axis/timeline with time labels"""
        if not self.candles:
            return
        try:
            # Create timeline shader if not exists
            if not hasattr(self, 'timeline_program'):
                timeline_vertex_shader = '''
                #version 330
                in vec2 position;
                uniform mat4 projection;
                void main() {
                    gl_Position = projection * vec4(position, 0.0, 1.0);
                }
                '''
                timeline_fragment_shader = '''
                #version 330
                out vec4 fragColor;
                uniform vec3 color;
                void main() {
                    fragColor = vec4(color, 1.0);
                }
                '''
                self.timeline_program = self.ctx.program(
                    vertex_shader=timeline_vertex_shader,
                    fragment_shader=timeline_fragment_shader
                )
            
            # Draw horizontal axis line at bottom
            axis_vertices = np.array([
                0, self.price_min,
                len(self.candles), self.price_min
            ], dtype=np.float32)
            
            axis_buffer = self.ctx.buffer(axis_vertices.tobytes())
            axis_vao = self.ctx.vertex_array(
                self.timeline_program,
                [(axis_buffer, '2f', 'position')]
            )
            
            # Set axis color (brighter than grid)
            self.timeline_program['color'] = (0.3, 0.3, 0.3)
            self.timeline_program['projection'] = self._create_projection_matrix().T.flatten()
            
            # Draw axis line
            self.ctx.line_width = 2.0
            axis_vao.render(mode=moderngl.LINES)
            
            axis_buffer.release()
            axis_vao.release()
            
            # Draw grid lines and ticks
            n_ticks = min(8, len(self.candles))
            if n_ticks < 2:
                return
                
            step = len(self.candles) / (n_ticks - 1)
            grid_vertices = []
            
            for i in range(n_ticks):
                x = int(i * step)
                if x < len(self.candles):
                    # Vertical grid line (subtle)
                    grid_vertices.extend([
                        x, self.price_min,
                        x, self.price_max
                    ])
            
            if grid_vertices:
                grid_buffer = self.ctx.buffer(np.array(grid_vertices, dtype=np.float32).tobytes())
                grid_vao = self.ctx.vertex_array(
                    self.timeline_program,
                    [(grid_buffer, '2f', 'position')]
                )
                
                # Set grid color (very subtle)
                self.timeline_program['color'] = (0.15, 0.15, 0.15)
                
                # Draw grid lines
                self.ctx.line_width = 1.0
                grid_vao.render(mode=moderngl.LINES)
                
                grid_buffer.release()
                grid_vao.release()
            
            # Draw time labels using pygame
            import pygame
            from pygame import freetype
            surface = pygame.display.get_surface()
            if surface is None:
                return
            
            # Mark that we need text overlay
            self._text_overlay_needed = True
            
            # Draw timeline background bar
            pygame.draw.rect(surface, (20, 20, 20), 
                           (0, self.height - self.timeline_height, self.width, self.timeline_height))
            
            # Draw timeline border
            pygame.draw.line(surface, (60, 60, 60), 
                           (0, self.height - self.timeline_height), 
                           (self.width, self.height - self.timeline_height), 1)
                
            font = freetype.SysFont('Arial', 12)
            
            # Calculate visible range
            visible_candles = min(len(self.candles), self.max_visible_candles)
            start_idx = max(0, len(self.candles) - visible_candles)
            
            # Draw time labels for visible candles
            visible_n_ticks = min(8, visible_candles)
            if visible_n_ticks >= 2:
                visible_step = visible_candles / (visible_n_ticks - 1)
                
                for i in range(visible_n_ticks):
                    # Calculate position within visible range
                    visible_pos = int(i * visible_step)
                    actual_idx = start_idx + visible_pos
                    
                    if actual_idx < len(self.candles):
                        candle = self.candles[actual_idx]
                        if 'time' in candle:
                            # Map to pixel position
                            x_pixel = int((visible_pos / visible_candles) * self.width)
                            y_pixel = self.height - 15  # 15 pixels from bottom
                            
                            # Format time as HH:MM
                            time_str = candle['time'].strftime('%H:%M')
                            
                            # Center the text
                            text_rect = font.get_rect(time_str)
                            x_pixel -= text_rect.width // 2
                            
                            # Ensure label stays within bounds
                            x_pixel = max(5, min(x_pixel, self.width - text_rect.width - 5))
                            
                            # Draw time label
                            font.render_to(surface, (x_pixel, y_pixel), time_str, (200, 200, 200))
                
        except Exception as e:
            logger.debug(f"Timeline rendering error: {e}")

    def _draw_price_label(self):
        """Draw price label at the end of the price line"""
        if not self.candles or self.current_price <= 0:
            logger.warning(f"Skipping price label: candles={len(self.candles) if self.candles else 0}, price={self.current_price}")
            return
        
        logger.info(f"Drawing price label at ${self.current_price:.2f}")
        try:
            import pygame
            from pygame import freetype
            
            # Mark that we need text overlay first
            self._text_overlay_needed = True
            
            # Get the existing pygame surface
            surface = pygame.display.get_surface()
            if surface is None:
                logger.warning("No pygame surface for price label")
                return
                
            font = freetype.SysFont('Arial', 14, bold=True)
            
            # Map price to y pixel
            price_range = self.price_max - self.price_min
            if price_range == 0:
                return
                
            # Adjust y coordinate to account for timeline
            y = int((self.height - self.timeline_height) - ((self.current_price - self.price_min) / price_range) * (self.height - self.timeline_height))
            
            label = f"${self.current_price:,.2f}"
            
            # Determine color based on price movement
            if hasattr(self, 'prev_price') and self.prev_price is not None:
                if self.current_price > self.prev_price:
                    bg_color = (0, 100, 80)  # Teal background
                    text_color = (200, 255, 200)  # Light green text
                elif self.current_price < self.prev_price:
                    bg_color = (100, 20, 20)  # Red background
                    text_color = (255, 200, 200)  # Light red text
                else:
                    bg_color = (50, 50, 50)  # Gray background
                    text_color = (220, 220, 220)  # Light gray text
            else:
                bg_color = (50, 50, 50)
                text_color = (220, 220, 220)
                
            # Draw background rectangle with border
            rect_x = self.width - self.price_label_width + 5
            rect_y = y - 12
            rect_width = self.price_label_width - 10
            rect_height = 24
            
            pygame.draw.rect(surface, bg_color, (rect_x, rect_y, rect_width, rect_height), border_radius=4)
            pygame.draw.rect(surface, text_color, (rect_x, rect_y, rect_width, rect_height), width=1, border_radius=4)
            
            # Draw price text centered
            text_rect = font.get_rect(label)
            text_x = rect_x + (rect_width - text_rect.width) // 2
            text_y = rect_y + (rect_height - text_rect.height) // 2
            font.render_to(surface, (text_x, text_y), label, text_color)
            
            # Mark that we need text overlay
            self._text_overlay_needed = True
            
        except Exception as e:
            logger.debug(f"Price label rendering error: {e}")

    def set_price_tag_value(self, price: float) -> None:
        """Efficiently update only the price value in the tag, erasing the old label before drawing the new one for real-time updates."""
        try:
            import pygame
            from pygame import freetype
            self.current_price = price
            surface = pygame.display.get_surface()
            if surface is None:
                return
            font = freetype.SysFont('Arial', 14, bold=True)
            price_range = self.price_max - self.price_min
            if price_range == 0:
                return
            y = int((self.height - self.timeline_height) - ((self.current_price - self.price_min) / price_range) * (self.height - self.timeline_height))
            label = f"${self.current_price:,.2f}"
            # Determine color based on price movement
            if hasattr(self, 'prev_price') and self.prev_price is not None:
                if self.current_price > self.prev_price:
                    bg_color = (0, 100, 80)
                    text_color = (200, 255, 200)
                elif self.current_price < self.prev_price:
                    bg_color = (100, 20, 20)
                    text_color = (255, 200, 200)
                else:
                    bg_color = (50, 50, 50)
                    text_color = (220, 220, 220)
            else:
                bg_color = (50, 50, 50)
                text_color = (220, 220, 220)
            rect_x = self.width - self.price_label_width + 5
            rect_y = y - 12
            rect_width = self.price_label_width - 10
            rect_height = 24
            # Erase the old label area by drawing a background rectangle (same as chart background)
            chart_bg = (26, 26, 26)  # RGB for dark background
            pygame.draw.rect(surface, chart_bg, (rect_x, rect_y, rect_width, rect_height), border_radius=4)
            # Draw new label background and border
            pygame.draw.rect(surface, bg_color, (rect_x, rect_y, rect_width, rect_height), border_radius=4)
            pygame.draw.rect(surface, text_color, (rect_x, rect_y, rect_width, rect_height), width=1, border_radius=4)
            text_rect = font.get_rect(label)
            text_x = rect_x + (rect_width - text_rect.width) // 2
            text_y = rect_y + (rect_height - text_rect.height) // 2
            font.render_to(surface, (text_x, text_y), label, text_color)
            self._text_overlay_needed = True
        except Exception as e:
            logger.debug(f"Efficient price tag update error: {e}")

    def render(self) -> Any:
        """Ultra-fast chart rendering with Linux optimizations"""
        
        try:
            start_time = time.perf_counter()
            
            # Debug log every frame: print all candles
            # print("[GPU CHART DEBUG] Candles to render:")
            # for i, candle in enumerate(self.candles):
            #     print(f"  Candle {i}: {candle}")
            
            # Debug log every 100 frames
            # if self.frame_count % 100 == 0:
            #     print(f"[GPU CHART RENDER] Frame {self.frame_count}: current_price=${self.current_price:.2f}, candles={len(self.candles)}")
            
            # Reset text overlay flag
            self._text_overlay_needed = False
            
            # Check if context is still valid
            if not self._context_initialized or not hasattr(self, 'ctx'):
                logger.error("OpenGL context lost during render")
                raise RuntimeError("OpenGL context not available")
            
            # Render to framebuffer for off-screen rendering
            self.framebuffer.use()
            
            # Clear with dark background
            self.ctx.clear(*self.colors['background'])
            
            if not self.candles:
                logger.debug(f"LinuxGPUChart: No candles to render")
                render_time = (time.perf_counter() - start_time) * 1000
                self.render_times.append(render_time)
                return self._get_frame_bytes()
            
            logger.debug(f"LinuxGPUChart: Rendering {len(self.candles)} candles, price range: {self.price_min:.2f} - {self.price_max:.2f}")
                
            # Generate vertices (CUDA accelerated if available)
            vertices, colors = self._generate_vertices_cuda()
            
            # Debug vertex generation occasionally (disabled to reduce spam)
            # if self.frame_count % 100 == 0:
            #     self.debug_candle_info()
            #     logger.debug(f"Generated {len(vertices)//2} vertices for rendering")
            
            if len(vertices) > 0:
                # Ensure vertex data is valid
                if len(vertices) % 2 != 0:
                    logger.error(f"Invalid vertex data length: {len(vertices)}")
                    return self._get_frame_bytes()
                    
                # Check buffer sizes
                vertex_bytes = vertices.tobytes()
                color_bytes = colors.tobytes()
                
                buffers_recreated = False
                
                if len(vertex_bytes) > self.vertex_buffer.size:
                    logger.warning(f"Vertex buffer overflow: {len(vertex_bytes)} > {self.vertex_buffer.size}")
                    # Recreate buffer with larger size
                    self.vertex_buffer.release()
                    self.vertex_buffer = self.ctx.buffer(vertex_bytes)
                    buffers_recreated = True
                else:
                    self.vertex_buffer.write(vertex_bytes)
                    
                if len(color_bytes) > self.color_buffer.size:
                    logger.warning(f"Color buffer overflow: {len(color_bytes)} > {self.color_buffer.size}")
                    # Recreate buffer with larger size
                    self.color_buffer.release()
                    self.color_buffer = self.ctx.buffer(color_bytes)
                    buffers_recreated = True
                else:
                    self.color_buffer.write(color_bytes)
                
                # Recreate VAO if buffers were recreated
                if buffers_recreated:
                    self.vao.release()
                    self.vao = self.ctx.vertex_array(
                        self.candlestick_program,
                        [(self.vertex_buffer, '2f', 'position'),
                         (self.color_buffer, '3f', 'color')]
                    )
                
                # Set projection matrix
                projection = self._create_projection_matrix()
                self.candlestick_program['projection'] = projection.T.flatten()
                
                # Render triangles
                vertex_count = len(vertices) // 2
                if vertex_count > 0 and vertex_count % 3 == 0:  # Ensure valid triangle count
                    self.vao.render(vertices=vertex_count)
                else:
                    logger.warning(f"Invalid vertex count for triangles: {vertex_count}")
                    
            # Draw price line if we have a current price
            logger.info(f"About to draw price line. Current price: ${self.current_price:.2f}")
            if self.current_price > 0:
                try:
                    self._draw_price_line()
                except Exception as e:
                    logger.error(f"Failed to draw price line: {e}", exc_info=True)
            # Draw x-axis/timeline
            self._draw_x_axis()
            # Draw price label
            self._draw_price_label()
            # Performance tracking
            render_time = (time.perf_counter() - start_time) * 1000
            self.render_times.append(render_time)
            
            # Keep only recent render times
            if len(self.render_times) > 100:
                self.render_times = self.render_times[-100:]
                
            self.update_performance_metrics()
            return self._get_frame_bytes()
            
        except Exception as e:
            logger.error(f"GPU chart render failed: {e}", exc_info=True)
            # Return empty frame on error
            try:
                self.ctx.clear(0.1, 0.1, 0.1)
                return self._get_frame_bytes()
            except:
                # Return a placeholder image if everything fails
                from PIL import Image
                import io
                img = Image.new('RGB', (self.width, self.height), color=(26, 26, 26))
                img_bytes = io.BytesIO()
                img.save(img_bytes, format='WebP', quality=85)
                img_bytes.seek(0)
                return img_bytes.getvalue()
        
    def _create_projection_matrix(self) -> np.ndarray:
        """Create optimized projection matrix with timeline space and price label margin"""
        
        if not self.candles:
            return np.eye(4, dtype=np.float32)
            
        # Orthographic projection for 2D chart
        # Always show the most recent candles (auto-scroll)
        visible_candles = min(len(self.candles), self.max_visible_candles)
        left = max(0, len(self.candles) - visible_candles)
        right = len(self.candles)
        
        # Adjust vertical space to account for timeline
        chart_height_ratio = (self.height - self.timeline_height) / self.height
        price_padding = (self.price_max - self.price_min) * 0.1 * chart_height_ratio
        bottom = self.price_min - price_padding
        top = self.price_max + price_padding
        
        # Adjust horizontal space to account for price label on right
        chart_width_ratio = (self.width - self.price_label_width) / self.width
        
        # Avoid division by zero
        if (right - left) == 0:
            right = left + 1
        if (top - bottom) == 0:
            top = bottom + 1
            
        # Scale the horizontal projection to fit within chart area (excluding price label)
        horizontal_scale = 2.0 / (right - left) * chart_width_ratio
        horizontal_offset = -(right + left) / (right - left) - (1.0 - chart_width_ratio)
            
        matrix = np.array([
            [horizontal_scale, 0, 0, horizontal_offset],
            [0, 2.0 / (top - bottom), 0, -(top + bottom) / (top - bottom)],
            [0, 0, -1, 0],
            [0, 0, 0, 1]
        ], dtype=np.float32)
        
        return matrix
        
    def _draw_price_line(self):
        """Draw the current price line with dynamic color using GPU"""
        
        logger.info(f"Drawing price line at ${self.current_price:.2f}, price range: {self.price_min:.2f}-{self.price_max:.2f}")
            
        try:
            # Create price line shader if not exists
            if not hasattr(self, 'price_line_program'):
                price_line_vertex_shader = '''
                #version 330
                in vec2 position;
                uniform mat4 projection;
                void main() {
                    gl_Position = projection * vec4(position, 0.0, 1.0);
                }
                '''
                price_line_fragment_shader = '''
                #version 330
                out vec4 fragColor;
                uniform vec3 color;
                void main() {
                    fragColor = vec4(color, 1.0);
                }
                '''
                self.price_line_program = self.ctx.program(
                    vertex_shader=price_line_vertex_shader,
                    fragment_shader=price_line_fragment_shader
                )
            
            # Determine price line color based on trend
            if self.prev_price is None:
                self.prev_price = self.current_price
                
            if self.current_price > self.prev_price:
                color = self.colors['price_line_bullish']
            elif self.current_price < self.prev_price:
                color = self.colors['price_line_bearish']
            else:
                color = self.colors['price_line_neutral']
                
            # Update previous price
            self.prev_price = self.current_price
            
            # Create line vertices - extend slightly beyond chart bounds for clean edges
            y = self.current_price
            line_vertices = np.array([
                [-1, y],
                [len(self.candles) + 1, y]
            ], dtype=np.float32).flatten()
            
            logger.info(f"Price line vertices: x=[{-1}, {len(self.candles) + 1}], y={y}")
            logger.info(f"Price line color: {color}")
            
            # Create buffer and VAO
            line_buffer = self.ctx.buffer(line_vertices.tobytes())
            line_vao = self.ctx.vertex_array(
                self.price_line_program,
                [(line_buffer, '2f', 'position')]
            )
            
            # Set uniforms
            self.price_line_program['color'] = color
            projection = self._create_projection_matrix()
            self.price_line_program['projection'] = projection.T.flatten()
            
            logger.info(f"Projection matrix:\n{projection}")
            
            # Draw the line with increased thickness
            self.ctx.line_width = 3.0
            line_vao.render(mode=moderngl.LINES)
            logger.info("Price line rendered successfully")
            
            # Cleanup
            line_buffer.release()
            line_vao.release()
            
        except Exception as e:
            logger.debug(f"Price line rendering error: {e}")
        
    def _get_frame_bytes(self) -> bytes:
        """Get rendered frame as compressed bytes with pygame overlay"""
        
        # Read pixels from framebuffer
        pixels = self.framebuffer.read(components=3)
        
        # Convert to PIL Image for compression
        from PIL import Image
        import io
        import pygame
        
        # Create image from OpenGL pixels (flip vertically)
        img = Image.frombytes('RGB', (self.width, self.height), pixels)
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
        
        # Get pygame surface if any text was drawn
        surface = pygame.display.get_surface()
        if surface and hasattr(self, '_text_overlay_needed') and self._text_overlay_needed:
            # Convert pygame surface to PIL Image
            pygame_string = pygame.image.tostring(surface, 'RGB')
            pygame_img = Image.frombytes('RGB', (self.width, self.height), pygame_string)
            
            # Composite the timeline area from pygame onto the OpenGL image
            # Only copy the bottom portion where timeline is drawn
            timeline_area = pygame_img.crop((0, self.height - self.timeline_height, 
                                            self.width, self.height))
            img.paste(timeline_area, (0, self.height - self.timeline_height))
            
            # Composite the price label area from pygame onto the OpenGL image
            # Only copy the right portion where price label is drawn
            price_label_area = pygame_img.crop((self.width - self.price_label_width, 0, 
                                               self.width, self.height - self.timeline_height))
            img.paste(price_label_area, (self.width - self.price_label_width, 0))
        
        # Compress to WebP for smaller size and faster transfer
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='WebP', quality=85, optimize=True)
        img_bytes.seek(0)
        
        return img_bytes.getvalue()
        
    def get_dash_component(self) -> Any:
        """Return Dash component for displaying this chart"""
        
        from dash import html
        
        try:
            # Check if context is still valid
            if not self._context_initialized or not hasattr(self, 'ctx'):
                logger.warning("OpenGL context not initialized, reinitializing...")
                self._init_opengl_context()
                self._init_shaders()
                self._init_buffers()
            
            # Render chart
            image_bytes = self.render()
            
            # Convert to base64 for HTML display
            image_b64 = base64.b64encode(image_bytes).decode('utf-8')
            
            return html.Img(
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
            logger.error(f"Failed to render GPU chart component: {e}", exc_info=True)
            # Return error placeholder
            return html.Div(
                f"GPU Chart Error: {str(e)}",
                style={
                    'width': '100%',
                    'height': f'{self.height}px',
                    'border': '1px solid #ff4444',
                    'border-radius': '4px',
                    'background-color': '#1a1a1a',
                    'color': '#ff6b6b',
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'padding': '20px',
                    'text-align': 'center',
                    'font-size': '14px'
                }
            )
        
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get detailed performance statistics"""
        
        stats = super().get_performance_stats()
        
        # Add Linux-specific stats
        if self.render_times:
            stats['min_render_time_ms'] = min(self.render_times)
            stats['max_render_time_ms'] = max(self.render_times)
            stats['render_time_stddev'] = np.std(self.render_times) if len(self.render_times) > 1 else 0
            
        if self.cuda_times:
            stats['avg_cuda_time_ms'] = sum(self.cuda_times) / len(self.cuda_times)
            stats['cuda_acceleration'] = True
        else:
            stats['cuda_acceleration'] = False
            
        stats['memory_usage_gb'] = self._get_memory_usage()
        
        return stats
        
    def _get_memory_usage(self) -> float:
        """Get current memory usage in GB"""
        
        try:
            import psutil
            process = psutil.Process()
            return process.memory_info().rss / (1024**3)
        except:
            return 0.0
            
    def cleanup(self) -> None:
        """Clean up GPU resources"""
        
        if hasattr(self, 'ctx'):
            try:
                self.ctx.release()
                logger.debug("Released ModernGL context")
            except Exception as e:
                logger.warning(f"Error releasing ModernGL context: {e}")
            
        # Don't quit pygame entirely - just clean up our surface
        # pygame.quit() would shut down the entire app
        if HAS_PYGAME and pygame.get_init():
            try:
                # Just release the display, don't quit pygame
                if pygame.display.get_surface() is not None:
                    pygame.display.quit()
                    logger.debug("Released pygame display")
            except Exception as e:
                logger.warning(f"Error releasing pygame display: {e}")
            
        super().cleanup()
        
        logger.info(f"LinuxGPUChart cleaned up for {self.symbol}")
        
    def set_max_visible_candles(self, max_candles: int):
        """Set the maximum number of visible candles"""
        self.max_visible_candles = max_candles
        logger.info(f"Set max visible candles to {max_candles}")
        
    def debug_candle_info(self):
        """Debug method to log candle information"""
        logger.info(f"=== GPU Chart Debug Info ===")
        logger.info(f"Total candles: {len(self.candles)}")
        logger.info(f"Max candles: {self.max_candles}")
        logger.info(f"Max visible candles: {self.max_visible_candles}")
        if self.candles:
            logger.info(f"First candle time: {self.candles[0].get('time', 'N/A')}")
            logger.info(f"Last candle time: {self.candles[-1].get('time', 'N/A')}")
            logger.info(f"Price range: {self.price_min:.2f} - {self.price_max:.2f}")
        logger.info(f"===========================")