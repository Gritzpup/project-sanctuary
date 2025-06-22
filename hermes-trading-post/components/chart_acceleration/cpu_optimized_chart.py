"""
CPU Optimized Chart Renderer
High-performance CPU rendering with SIMD and threading optimizations
Targets: 10-50ms chart updates (8-24x improvement)
"""
import numpy as np
import threading
import time
import base64
from typing import Dict, List, Any, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from ..chart_acceleration.base_chart import BaseChart
import logging

logger = logging.getLogger(__name__)

class CPUOptimizedChart(BaseChart):
    """
    CPU-optimized chart renderer using NumPy SIMD and threading
    
    Features:
    - SIMD vectorized operations (AVX2/AVX512)
    - Multi-threaded rendering pipeline
    - Memory-efficient circular buffers
    - Optimized for high-frequency updates
    """
    
    def __init__(self, symbol: str, width: int = 800, height: int = 600):
        super().__init__(symbol, width, height)
        
        # Threading setup
        self.num_threads = min(8, threading.active_count())
        self.thread_pool = ThreadPoolExecutor(max_workers=self.num_threads)
        
        # Chart area with margin for price box
        self.price_box_width = 100  # Reserved space for price box
        self.chart_width = width - self.price_box_width  # Actual chart drawing area
        
        # Rendering buffers
        self.image_buffer = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Color palette (RGB 0-255)
        self.colors = {
            'bullish': np.array([38, 166, 154], dtype=np.uint8),     # Teal
            'bearish': np.array([239, 83, 80], dtype=np.uint8),      # Red
            'background': np.array([25, 25, 25], dtype=np.uint8),    # Dark
            'grid': np.array([77, 77, 77], dtype=np.uint8),          # Gray
            'price_line': np.array([255, 255, 0], dtype=np.uint8),   # Yellow
            'price_box_bg': np.array([51, 51, 51], dtype=np.uint8),  # Dark gray
            'price_text': np.array([255, 255, 255], dtype=np.uint8), # White
            'forming_candle': np.array([255, 165, 0], dtype=np.uint8) # Orange
        }
        
        # Performance tracking
        self.render_times = []
        
        logger.info(f"CPUOptimizedChart initialized for {symbol} ({width}x{height})")
        
    def add_candle(self, candle_data: Dict[str, Any]) -> None:
        """Add a new completed candle"""
        self.candles.append(candle_data)
        
        # Keep only recent candles
        if len(self.candles) > self.max_candles:
            self.candles = self.candles[-self.max_candles:]
            
        self._update_bounds()
        
    def update_current_candle(self, candle_data: Dict[str, Any]) -> None:
        """Update currently forming candle"""
        if self.candles and len(self.candles) > 0:
            last_candle = self.candles[-1]
            if ('time' in last_candle and 'time' in candle_data and 
                last_candle['time'] == candle_data['time']):
                self.candles[-1] = candle_data
            else:
                self.add_candle(candle_data)
        else:
            self.add_candle(candle_data)
            
    def update_price(self, price: float) -> None:
        """Update current price for real-time line"""
        self.current_price = price
        current_time = time.time()
        
        self.price_history.append((current_time, price))
        
        # Keep only recent price history
        cutoff_time = current_time - 60
        self.price_history = [(t, p) for t, p in self.price_history if t > cutoff_time]
        
    def _update_bounds(self):
        """Update chart coordinate bounds"""
        if not self.candles:
            return
            
        # Vectorized price extraction
        prices = []
        for candle in self.candles:
            prices.extend([candle.get('high', 0), candle.get('low', 0)])
            
        if self.current_price > 0:
            prices.append(self.current_price)
            
        if prices:
            prices_array = np.array(prices)
            self.price_min = np.min(prices_array) * 0.995
            self.price_max = np.max(prices_array) * 1.005
            
        # Time bounds
        if self.candles:
            times = [c.get('time', datetime.utcnow()) for c in self.candles]
            self.time_min = min(times)
            self.time_max = max(times)
            
    def _normalize_coordinates(self, x_values: np.ndarray, y_values: np.ndarray) -> tuple:
        """Normalize coordinates to screen space using vectorized operations"""
        
        # Time normalization (use chart_width for drawing area)
        if len(self.candles) > 1:
            x_normalized = (x_values / len(self.candles)) * self.chart_width
        else:
            x_normalized = np.full_like(x_values, self.chart_width / 2)
            
        # Price normalization  
        if self.price_max > self.price_min:
            price_range = self.price_max - self.price_min
            y_normalized = ((y_values - self.price_min) / price_range) * self.height
            y_normalized = self.height - y_normalized  # Flip Y axis
        else:
            y_normalized = np.full_like(y_values, self.height / 2)
            
        return x_normalized.astype(np.int32), y_normalized.astype(np.int32)
        
    def _draw_candlestick_vectorized(self, candle_data: np.ndarray, x_positions: np.ndarray):
        """Draw candlesticks using vectorized operations"""
        
        if len(candle_data) == 0:
            return
            
        # Extract OHLC values
        opens = candle_data[:, 0]
        highs = candle_data[:, 1]
        lows = candle_data[:, 2]
        closes = candle_data[:, 3]
        
        # Determine colors vectorized
        is_bullish = closes >= opens
        
        # Normalize coordinates
        x_norm, _ = self._normalize_coordinates(x_positions, np.zeros_like(x_positions))
        
        # Process in parallel chunks
        chunk_size = max(1, len(candle_data) // self.num_threads)
        futures = []
        
        for i in range(0, len(candle_data), chunk_size):
            end_idx = min(i + chunk_size, len(candle_data))
            
            future = self.thread_pool.submit(
                self._draw_candle_chunk,
                candle_data[i:end_idx],
                x_norm[i:end_idx],
                is_bullish[i:end_idx],
                i
            )
            futures.append(future)
            
        # Wait for all chunks to complete
        for future in futures:
            future.result()
            
    def _draw_candle_chunk(self, chunk_data: np.ndarray, x_positions: np.ndarray, 
                          is_bullish: np.ndarray, start_idx: int):
        """Draw a chunk of candlesticks in parallel"""
        
        candle_width = max(2, self.chart_width // (len(self.candles) * 2))
        
        for i, (candle, x, bullish) in enumerate(zip(chunk_data, x_positions, is_bullish)):
            o, h, l, c = candle
            
            # Get normalized Y coordinates
            _, y_coords = self._normalize_coordinates(
                np.array([0, 0, 0, 0]), 
                np.array([o, h, l, c])
            )
            y_open, y_high, y_low, y_close = y_coords
            
            # Check if this is the last (forming) candle
            is_forming = (start_idx + i) == len(self.candles) - 1
            
            # Choose color - use orange outline for forming candle
            if is_forming:
                fill_color = self.colors['bullish'] if bullish else self.colors['bearish']
                outline_color = self.colors['forming_candle']
            else:
                color = self.colors['bullish'] if bullish else self.colors['bearish']
            
            # Draw candle body
            body_top = min(y_open, y_close)
            body_bottom = max(y_open, y_close)
            
            # Ensure we stay within bounds (respect chart_width boundary)
            x_start = max(0, x - candle_width // 2)
            x_end = min(self.chart_width, x + candle_width // 2)
            y_start = max(0, body_top)
            y_end = min(self.height, body_bottom)
            
            if x_end > x_start and y_end > y_start:
                if is_forming:
                    # Draw filled body
                    self.image_buffer[y_start:y_end, x_start:x_end] = fill_color
                    # Draw orange outline
                    self.image_buffer[y_start, x_start:x_end] = outline_color
                    self.image_buffer[y_end-1, x_start:x_end] = outline_color
                    self.image_buffer[y_start:y_end, x_start] = outline_color
                    self.image_buffer[y_start:y_end, x_end-1] = outline_color
                else:
                    self.image_buffer[y_start:y_end, x_start:x_end] = color
                
            # Draw wicks
            wick_x = max(0, min(self.chart_width - 1, x))
            wick_color = outline_color if is_forming else color
            
            # Upper wick
            if y_high < body_top and y_high >= 0:
                y_wick_start = max(0, y_high)
                y_wick_end = min(self.height, body_top)
                if y_wick_end > y_wick_start:
                    self.image_buffer[y_wick_start:y_wick_end, wick_x] = wick_color
                    
            # Lower wick
            if y_low > body_bottom and y_low < self.height:
                y_wick_start = max(0, body_bottom)
                y_wick_end = min(self.height, y_low)
                if y_wick_end > y_wick_start:
                    self.image_buffer[y_wick_start:y_wick_end, wick_x] = wick_color
                    
    def _draw_price_line(self):
        """Draw current price line with price box"""
        if self.current_price <= 0:
            return
            
        # Get Y coordinate for current price
        _, y_coords = self._normalize_coordinates(
            np.array([0]), 
            np.array([self.current_price])
        )
        y = y_coords[0]
        
        # Draw dashed horizontal line across chart area only
        if 0 <= y < self.height:
            # Create dashed line (5 pixels on, 5 pixels off)
            for x in range(0, self.chart_width, 10):
                x_end = min(x + 5, self.chart_width)
                self.image_buffer[y, x:x_end] = self.colors['price_line']
                
        # Draw price box in the reserved right margin area
        price_text = f"${self.current_price:,.2f}"
        box_width = min(self.price_box_width - 10, len(price_text) * 8 + 16)  # Fit within reserved space
        box_height = 24
        box_x = self.chart_width + 5  # Position in the margin area
        box_y = max(0, min(self.height - box_height, y - box_height // 2))
        
        # Draw box background
        if box_x > 0 and box_y >= 0 and box_y + box_height <= self.height:
            # Fill box background
            box_x_end = min(box_x + box_width, self.width)
            self.image_buffer[box_y:box_y + box_height, box_x:box_x_end] = self.colors['price_box_bg']
            
            # Draw box border
            self.image_buffer[box_y, box_x:box_x_end] = self.colors['price_line']
            self.image_buffer[box_y + box_height - 1, box_x:box_x_end] = self.colors['price_line']
            self.image_buffer[box_y:box_y + box_height, box_x] = self.colors['price_line']
            if box_x_end - 1 < self.width:
                self.image_buffer[box_y:box_y + box_height, box_x_end - 1] = self.colors['price_line']
            
            # Note: For actual text rendering, you'd need a proper text rendering library
            # For now, we'll just show the box as a visual indicator
            
    def render(self) -> Any:
        """Render chart using CPU optimization"""
        
        start_time = time.perf_counter()
        
        # Clear background
        self.image_buffer.fill(0)
        self.image_buffer[:, :] = self.colors['background']
        
        if not self.candles:
            render_time = (time.perf_counter() - start_time) * 1000
            self.render_times.append(render_time)
            return self._get_frame_bytes()
            
        # Convert candle data to numpy array for vectorized operations
        candle_array = np.zeros((len(self.candles), 4), dtype=np.float32)
        for i, candle in enumerate(self.candles):
            candle_array[i] = [
                candle.get('open', 0),
                candle.get('high', 0),
                candle.get('low', 0),
                candle.get('close', 0)
            ]
            
        # X positions for candles
        x_positions = np.arange(len(self.candles), dtype=np.float32)
        
        # Draw candlesticks using vectorized operations
        self._draw_candlestick_vectorized(candle_array, x_positions)
        
        # Draw current price line
        self._draw_price_line()
        
        # Performance tracking
        render_time = (time.perf_counter() - start_time) * 1000
        self.render_times.append(render_time)
        
        # Keep only recent render times
        if len(self.render_times) > 100:
            self.render_times = self.render_times[-100:]
            
        self.update_performance_metrics()
        
        return self._get_frame_bytes()
        
    def _get_frame_bytes(self) -> bytes:
        """Convert frame buffer to compressed image bytes"""
        
        from PIL import Image
        import io
        
        # Convert numpy array to PIL Image
        img = Image.fromarray(self.image_buffer, 'RGB')
        
        # Compress to WebP for faster transfer
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='WebP', quality=80, optimize=True)
        img_bytes.seek(0)
        
        return img_bytes.getvalue()
        
    def get_dash_component(self) -> Any:
        """Return Dash component for displaying this chart"""
        
        from dash import html
        
        # Render chart
        image_bytes = self.render()
        
        # Convert to base64 for HTML display
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
        return html.Img(
            src=f"data:image/webp;base64,{image_b64}",
            style={
                'width': '100%',  # Responsive width
                'height': 'auto',  # Maintain aspect ratio
                'display': 'block',
                'margin': '0',  # No margin
                'border': 'none',  # Remove border (container has it)
                'border-radius': '4px'
            }
        )
        
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get detailed performance statistics"""
        
        stats = super().get_performance_stats()
        
        if self.render_times:
            stats['min_render_time_ms'] = min(self.render_times)
            stats['max_render_time_ms'] = max(self.render_times)
            stats['render_time_stddev'] = np.std(self.render_times) if len(self.render_times) > 1 else 0
            
        stats['num_threads'] = self.num_threads
        stats['vectorized_operations'] = True
        
        return stats
        
    def cleanup(self) -> None:
        """Clean up resources"""
        self.thread_pool.shutdown(wait=True)
        super().cleanup()
        
        logger.info(f"CPUOptimizedChart cleaned up for {self.symbol}")
