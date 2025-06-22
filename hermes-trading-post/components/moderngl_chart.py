"""
ModernGL GPU-Accelerated Candlestick Chart
High-performance real-time trading chart for multiple bot support
"""
import moderngl
import numpy as np
import pygame
from datetime import datetime, timedelta
import json
import base64
from typing import List, Dict, Tuple
import threading
import time

class GPUCandlestickChart:
    """
    Hardware-accelerated candlestick chart using ModernGL
    Designed for high-frequency trading with multiple simultaneous charts
    """
    
    def __init__(self, width=800, height=600, symbol="BTC-USD"):
        self.width = width
        self.height = height
        self.symbol = symbol
        
        # Initialize pygame for OpenGL context
        pygame.init()
        pygame.display.set_mode((width, height), pygame.OPENGL | pygame.DOUBLEBUF | pygame.HIDDEN)
        
        # Create ModernGL context
        self.ctx = moderngl.create_context()
        
        # Chart data
        self.candles = []  # List of candle dictionaries
        self.current_price = 0.0
        self.price_history = []  # For real-time price line
        self.max_candles = 100  # Keep last N candles for performance
        
        # Chart bounds
        self.price_min = 0
        self.price_max = 0
        self.time_min = datetime.utcnow()
        self.time_max = datetime.utcnow()
        
        # Initialize shaders and buffers
        self._init_shaders()
        self._init_buffers()
        
        # Colors (RGB normalized)
        self.colors = {
            'bullish': (0.15, 0.65, 0.6),    # #26a69a
            'bearish': (0.94, 0.33, 0.31),   # #ef5350
            'background': (0.1, 0.1, 0.1),   # Dark background
            'grid': (0.3, 0.3, 0.3),         # Grid lines
            'price_line': (1.0, 1.0, 0.0)    # Yellow price line
        }
        
        # Performance tracking
        self.last_update = time.time()
        self.frame_count = 0
        self.fps = 0
        
    def _init_shaders(self):
        """Initialize GPU shaders for rendering"""
        
        # Vertex shader for candlesticks
        candlestick_vertex_shader = """
        #version 330 core
        
        layout (location = 0) in vec2 position;
        layout (location = 1) in vec3 color;
        
        uniform mat4 projection;
        out vec3 fragColor;
        
        void main() {
            gl_Position = projection * vec4(position, 0.0, 1.0);
            fragColor = color;
        }
        """
        
        # Fragment shader
        fragment_shader = """
        #version 330 core
        
        in vec3 fragColor;
        out vec4 color;
        
        void main() {
            color = vec4(fragColor, 1.0);
        }
        """
        
        # Line vertex shader for price line and grid
        line_vertex_shader = """
        #version 330 core
        
        layout (location = 0) in vec2 position;
        
        uniform mat4 projection;
        uniform vec3 lineColor;
        out vec3 fragColor;
        
        void main() {
            gl_Position = projection * vec4(position, 0.0, 1.0);
            fragColor = lineColor;
        }
        """
        
        # Create shader programs
        self.candlestick_program = self.ctx.program(
            vertex_shader=candlestick_vertex_shader,
            fragment_shader=fragment_shader
        )
        
        self.line_program = self.ctx.program(
            vertex_shader=line_vertex_shader,
            fragment_shader=fragment_shader
        )
        
    def _init_buffers(self):
        """Initialize GPU buffers"""
        
        # Candlestick vertex buffer (will be updated dynamically)
        self.candlestick_vbo = self.ctx.buffer(reserve=10000 * 4 * 2 * 4)  # Reserve space for vertices
        self.candlestick_color_vbo = self.ctx.buffer(reserve=10000 * 4 * 3 * 4)  # Reserve space for colors
        
        # Price line vertex buffer
        self.price_line_vbo = self.ctx.buffer(reserve=1000 * 2 * 4)  # Reserve space for price line
        
        # Grid lines buffer
        self.grid_vbo = self.ctx.buffer(reserve=100 * 2 * 2 * 4)  # Reserve space for grid
        
        # Create vertex arrays
        self.candlestick_vao = self.ctx.vertex_array(
            self.candlestick_program,
            [(self.candlestick_vbo, '2f', 'position'),
             (self.candlestick_color_vbo, '3f', 'color')]
        )
        
        self.price_line_vao = self.ctx.vertex_array(
            self.line_program,
            [(self.price_line_vbo, '2f', 'position')]
        )
        
        self.grid_vao = self.ctx.vertex_array(
            self.line_program,
            [(self.grid_vbo, '2f', 'position')]
        )
        
    def add_candle(self, candle_data: Dict):
        """Add a new candle to the chart"""
        self.candles.append(candle_data)
        
        # Keep only recent candles for performance
        if len(self.candles) > self.max_candles:
            self.candles = self.candles[-self.max_candles:]
        
        self._update_bounds()
        
    def update_current_candle(self, candle_data: Dict):
        """Update the current forming candle"""
        if self.candles:
            # Replace last candle if it's the same timestamp
            if self.candles[-1]['time'] == candle_data['time']:
                self.candles[-1] = candle_data
            else:
                self.add_candle(candle_data)
        else:
            self.add_candle(candle_data)
            
    def update_price(self, price: float):
        """Update current price for real-time line"""
        self.current_price = price
        
        # Add to price history with timestamp
        current_time = time.time()
        self.price_history.append((current_time, price))
        
        # Keep only recent price history (last 60 seconds)
        cutoff_time = current_time - 60
        self.price_history = [(t, p) for t, p in self.price_history if t > cutoff_time]
        
    def _update_bounds(self):
        """Update chart bounds based on current data"""
        if not self.candles:
            return
            
        # Time bounds
        times = [c['time'] for c in self.candles]
        self.time_min = min(times)
        self.time_max = max(times)
        
        # Price bounds with padding
        all_prices = []
        for candle in self.candles:
            all_prices.extend([candle['high'], candle['low']])
            
        if self.current_price > 0:
            all_prices.append(self.current_price)
            
        if all_prices:
            self.price_min = min(all_prices) * 0.995  # 0.5% padding
            self.price_max = max(all_prices) * 1.005
            
    def _create_projection_matrix(self) -> np.ndarray:
        """Create orthographic projection matrix for chart coordinates"""
        if not self.candles:
            return np.eye(4, dtype=np.float32)
            
        # Convert time to seconds for easier math
        time_span = (self.time_max - self.time_min).total_seconds()
        if time_span == 0:
            time_span = 1
            
        # Create orthographic projection
        left = 0
        right = time_span
        bottom = self.price_min
        top = self.price_max
        
        # Orthographic projection matrix
        matrix = np.array([
            [2.0 / (right - left), 0, 0, -(right + left) / (right - left)],
            [0, 2.0 / (top - bottom), 0, -(top + bottom) / (top - bottom)],
            [0, 0, -1, 0],
            [0, 0, 0, 1]
        ], dtype=np.float32)
        
        return matrix
        
    def _generate_candlestick_vertices(self) -> Tuple[np.ndarray, np.ndarray]:
        """Generate vertices and colors for candlesticks"""
        if not self.candles:
            return np.array([], dtype=np.float32), np.array([], dtype=np.float32)
            
        vertices = []
        colors = []
        
        candle_width = 0.8  # Width of each candle relative to time span
        time_span = (self.time_max - self.time_min).total_seconds()
        if time_span == 0:
            time_span = 1
            
        for i, candle in enumerate(self.candles):
            # Convert time to x coordinate
            time_offset = (candle['time'] - self.time_min).total_seconds()
            x = time_offset
            
            # Determine color
            is_bullish = candle['close'] >= candle['open']
            color = self.colors['bullish'] if is_bullish else self.colors['bearish']
            
            # Candlestick body (rectangle)
            body_top = max(candle['open'], candle['close'])
            body_bottom = min(candle['open'], candle['close'])
            
            # Body vertices (rectangle)
            half_width = candle_width / 2
            body_vertices = [
                [x - half_width, body_bottom],  # Bottom left
                [x + half_width, body_bottom],  # Bottom right
                [x + half_width, body_top],     # Top right
                [x - half_width, body_top],     # Top left
            ]
            
            # Add body as two triangles
            vertices.extend([
                body_vertices[0], body_vertices[1], body_vertices[2],  # Triangle 1
                body_vertices[0], body_vertices[2], body_vertices[3],  # Triangle 2
            ])
            
            # Add colors for body vertices
            for _ in range(6):  # 6 vertices (2 triangles)
                colors.extend(color)
                
            # Wick lines (high-low)
            thin_width = candle_width / 8
            
            # Upper wick
            if candle['high'] > body_top:
                wick_vertices = [
                    [x - thin_width, body_top],
                    [x + thin_width, body_top],
                    [x + thin_width, candle['high']],
                    [x - thin_width, candle['high']],
                ]
                
                vertices.extend([
                    wick_vertices[0], wick_vertices[1], wick_vertices[2],
                    wick_vertices[0], wick_vertices[2], wick_vertices[3],
                ])
                
                for _ in range(6):
                    colors.extend(color)
                    
            # Lower wick
            if candle['low'] < body_bottom:
                wick_vertices = [
                    [x - thin_width, candle['low']],
                    [x + thin_width, candle['low']],
                    [x + thin_width, body_bottom],
                    [x - thin_width, body_bottom],
                ]
                
                vertices.extend([
                    wick_vertices[0], wick_vertices[1], wick_vertices[2],
                    wick_vertices[0], wick_vertices[2], wick_vertices[3],
                ])
                
                for _ in range(6):
                    colors.extend(color)
                    
        return np.array(vertices, dtype=np.float32).flatten(), np.array(colors, dtype=np.float32).flatten()
        
    def _generate_price_line_vertices(self) -> np.ndarray:
        """Generate vertices for current price line"""
        if self.current_price == 0 or not self.candles:
            return np.array([], dtype=np.float32)
            
        # Horizontal line across the chart
        time_span = (self.time_max - self.time_min).total_seconds()
        vertices = [
            [0, self.current_price],
            [time_span, self.current_price]
        ]
        
        return np.array(vertices, dtype=np.float32).flatten()
        
    def render(self) -> bytes:
        """Render the chart and return as PNG bytes"""
        
        # Clear the screen
        self.ctx.clear(*self.colors['background'])
        self.ctx.enable(moderngl.BLEND)
        self.ctx.blend_func = moderngl.SRC_ALPHA, moderngl.ONE_MINUS_SRC_ALPHA
        
        if not self.candles:
            # Return empty chart
            return self._get_frame_bytes()
            
        # Create projection matrix
        projection = self._create_projection_matrix()
        
        # Render candlesticks
        vertices, colors = self._generate_candlestick_vertices()
        if len(vertices) > 0:
            self.candlestick_vbo.write(vertices.tobytes())
            self.candlestick_color_vbo.write(colors.tobytes())
            
            self.candlestick_program['projection'] = projection.T  # Transpose for OpenGL
            self.candlestick_vao.render()
            
        # Render current price line
        price_vertices = self._generate_price_line_vertices()
        if len(price_vertices) > 0:
            self.price_line_vbo.write(price_vertices.tobytes())
            
            self.line_program['projection'] = projection.T
            self.line_program['lineColor'] = self.colors['price_line']
            
            # Render as line
            self.ctx.line_width = 2.0
            self.price_line_vao.render(moderngl.LINES)
            
        # Update performance metrics
        self.frame_count += 1
        current_time = time.time()
        if current_time - self.last_update >= 1.0:
            self.fps = self.frame_count / (current_time - self.last_update)
            self.frame_count = 0
            self.last_update = current_time
            
        return self._get_frame_bytes()
        
    def _get_frame_bytes(self) -> bytes:
        """Get current frame as PNG bytes for web display"""
        
        # Read pixels from framebuffer
        pixels = self.ctx.read(components=3)  # RGB
        
        # Convert to PIL Image
        from PIL import Image
        import io
        
        # OpenGL pixels are upside down, flip them
        img = Image.frombytes('RGB', (self.width, self.height), pixels)
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
        
        # Convert to PNG bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        return img_bytes.getvalue()
        
    def get_base64_image(self) -> str:
        """Get chart as base64 encoded image for HTML display"""
        png_bytes = self.render()
        return base64.b64encode(png_bytes).decode('utf-8')
        
    def cleanup(self):
        """Clean up GPU resources"""
        self.ctx.release()
        pygame.quit()


class MultiChartRenderer:
    """
    Manager for multiple GPU-accelerated charts
    Designed for multi-bot trading platforms
    """
    
    def __init__(self):
        self.charts = {}  # symbol -> GPUCandlestickChart
        self.rendering_thread = None
        self.is_running = False
        
    def add_chart(self, symbol: str, width=800, height=600) -> GPUCandlestickChart:
        """Add a new chart for a trading symbol"""
        chart = GPUCandlestickChart(width, height, symbol)
        self.charts[symbol] = chart
        return chart
        
    def remove_chart(self, symbol: str):
        """Remove a chart and clean up resources"""
        if symbol in self.charts:
            self.charts[symbol].cleanup()
            del self.charts[symbol]
            
    def update_candle(self, symbol: str, candle_data: Dict):
        """Update candle data for a specific chart"""
        if symbol in self.charts:
            self.charts[symbol].add_candle(candle_data)
            
    def update_price(self, symbol: str, price: float):
        """Update current price for a specific chart"""
        if symbol in self.charts:
            self.charts[symbol].update_price(price)
            
    def get_chart_image(self, symbol: str) -> str:
        """Get base64 image for a specific chart"""
        if symbol in self.charts:
            return self.charts[symbol].get_base64_image()
        return ""
        
    def start_rendering_loop(self, fps=60):
        """Start background rendering loop for all charts"""
        self.is_running = True
        
        def render_loop():
            frame_time = 1.0 / fps
            
            while self.is_running:
                start_time = time.time()
                
                # Render all charts
                for chart in self.charts.values():
                    chart.render()
                    
                # Maintain target FPS
                elapsed = time.time() - start_time
                sleep_time = max(0, frame_time - elapsed)
                time.sleep(sleep_time)
                
        self.rendering_thread = threading.Thread(target=render_loop, daemon=True)
        self.rendering_thread.start()
        
    def stop_rendering_loop(self):
        """Stop background rendering loop"""
        self.is_running = False
        if self.rendering_thread:
            self.rendering_thread.join()
            
    def cleanup_all(self):
        """Clean up all charts and resources"""
        self.stop_rendering_loop()
        for chart in self.charts.values():
            chart.cleanup()
        self.charts.clear()


# Global chart manager instance
chart_manager = MultiChartRenderer()
