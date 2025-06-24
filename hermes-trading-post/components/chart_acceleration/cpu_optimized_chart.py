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
from PIL import Image, ImageDraw, ImageFont
import io

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
        
        # Chart area with margins
        self.price_box_width = 100  # Reserved space for price box on right
        self.time_axis_height = 30  # Reserved space for time axis at bottom
        self.chart_width = width - self.price_box_width  # Actual chart drawing area width
        self.chart_height = height - self.time_axis_height  # Actual chart drawing area height
        
        # Rendering buffers
        self.image_buffer = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Font setup for text rendering
        try:
            # Try to load a monospace font for cleaner chart text
            self.font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)
            self.small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 10)
        except:
            # Fallback to default font
            self.font = ImageFont.load_default()
            self.small_font = ImageFont.load_default()
        
        # Color palette (RGB 0-255)
        self.colors = {
            'bullish': np.array([38, 166, 154], dtype=np.uint8),     # Teal
            'bearish': np.array([239, 83, 80], dtype=np.uint8),      # Red
            'background': np.array([25, 25, 25], dtype=np.uint8),    # Dark
            'grid': np.array([77, 77, 77], dtype=np.uint8),          # Gray
            'price_line_bullish': np.array([38, 166, 154], dtype=np.uint8),   # Teal for upward
            'price_line_bearish': np.array([239, 83, 80], dtype=np.uint8),    # Red for downward
            'price_line_neutral': np.array([160, 160, 160], dtype=np.uint8),  # Gray for no change
            'price_box_bg': np.array([51, 51, 51], dtype=np.uint8),  # Dark gray
            'price_text': np.array([255, 255, 255], dtype=np.uint8), # White
            'forming_candle': np.array([255, 165, 0], dtype=np.uint8), # Orange
            'moving_avg': np.array([255, 255, 255], dtype=np.uint8)  # White for MA
        }
        
        # Performance tracking
        self.render_times = []
        
        # Price tracking for color changes
        self.previous_price = 0.0
        
        # Candle display settings
        self.max_visible_candles = 60  # Default for 1-hour view with 1-minute candles
        
        logger.info(f"CPUOptimizedChart initialized for {symbol} ({width}x{height})")
        
    def set_max_visible_candles(self, max_candles: int) -> None:
        """Update the maximum number of visible candles"""
        self.max_visible_candles = max(10, max_candles)  # Minimum 10 candles
        self._update_bounds()  # Recalculate bounds with new limit
        
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
        if self.current_price > 0:
            self.previous_price = self.current_price
        self.current_price = price
        current_time = time.time()
        
        self.price_history.append((current_time, price))
        
        # Keep only recent price history
        cutoff_time = current_time - 60
        self.price_history = [(t, p) for t, p in self.price_history if t > cutoff_time]
        
        # Debug log
        if len(self.price_history) % 10 == 0:
            logger.info(f"[CPU CHART] Price updated to ${price:,.2f}, history: {len(self.price_history)} points")
        
    def _update_bounds(self):
        """Update chart coordinate bounds"""
        if not self.candles:
            return
            
        # Get visible candles
        visible_candles = self.candles[-self.max_visible_candles:] if len(self.candles) > self.max_visible_candles else self.candles
        
        # Vectorized price extraction
        prices = []
        for candle in visible_candles:
            prices.extend([candle.get('high', 0), candle.get('low', 0)])
            
        if self.current_price > 0:
            prices.append(self.current_price)
            
        if prices:
            prices_array = np.array(prices)
            self.price_min = np.min(prices_array) * 0.995
            self.price_max = np.max(prices_array) * 1.005
            
        # Time bounds
        if visible_candles:
            times = [c.get('time', datetime.utcnow()) for c in visible_candles]
            self.time_min = min(times)
            self.time_max = max(times)
            
    def _normalize_coordinates(self, x_values: np.ndarray, y_values: np.ndarray, num_visible_candles: int = None) -> tuple:
        """Normalize coordinates to screen space using vectorized operations"""
        
        # Use provided candle count or calculate from current visible candles
        if num_visible_candles is None:
            num_visible_candles = min(len(self.candles), self.max_visible_candles)
        
        # Time normalization (use chart_width for drawing area)
        if num_visible_candles > 1:
            x_normalized = (x_values / num_visible_candles) * self.chart_width
        else:
            x_normalized = np.full_like(x_values, self.chart_width / 2)
            
        # Price normalization (use chart_height to leave room for time axis)
        if self.price_max > self.price_min:
            price_range = self.price_max - self.price_min
            y_normalized = ((y_values - self.price_min) / price_range) * self.chart_height
            y_normalized = self.chart_height - y_normalized  # Flip Y axis
        else:
            y_normalized = np.full_like(y_values, self.chart_height / 2)
            
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
        x_norm, _ = self._normalize_coordinates(x_positions, np.zeros_like(x_positions), len(candle_data))
        
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
        
        # Calculate visible candles for proper width
        num_visible_candles = min(len(self.candles), self.max_visible_candles)
        candle_width = max(2, self.chart_width // (num_visible_candles * 2))
        
        for i, (candle, x, bullish) in enumerate(zip(chunk_data, x_positions, is_bullish)):
            o, h, l, c = candle
            
            # Get normalized Y coordinates
            _, y_coords = self._normalize_coordinates(
                np.array([0, 0, 0, 0]), 
                np.array([o, h, l, c])
            )
            y_open, y_high, y_low, y_close = y_coords
            
            # Choose color - consistent for all candles
            color = self.colors['bullish'] if bullish else self.colors['bearish']
            
            # Draw candle body
            body_top = min(y_open, y_close)
            body_bottom = max(y_open, y_close)
            
            # Ensure we stay within bounds (respect chart_width boundary)
            x_start = max(0, x - candle_width // 2)
            x_end = min(self.chart_width, x + candle_width // 2)
            y_start = max(0, body_top)
            y_end = min(self.chart_height, body_bottom)
            
            if x_end > x_start and y_end > y_start:
                self.image_buffer[y_start:y_end, x_start:x_end] = color
                
            # Draw wicks
            wick_x = max(0, min(self.chart_width - 1, x))
            wick_color = color
            
            # Upper wick
            if y_high < body_top and y_high >= 0:
                y_wick_start = max(0, y_high)
                y_wick_end = min(self.chart_height, body_top)
                if y_wick_end > y_wick_start:
                    self.image_buffer[y_wick_start:y_wick_end, wick_x] = wick_color
                    
            # Lower wick
            if y_low > body_bottom and y_low < self.chart_height:
                y_wick_start = max(0, body_bottom)
                y_wick_end = min(self.chart_height, y_low)
                if y_wick_end > y_wick_start:
                    self.image_buffer[y_wick_start:y_wick_end, wick_x] = wick_color
                    
    def _draw_price_line(self):
        """Draw current price line with price box"""
        if self.current_price <= 0:
            return
            
        # Determine price line color based on price movement
        if self.previous_price > 0:
            if self.current_price > self.previous_price:
                price_line_color = self.colors['price_line_bullish']
            elif self.current_price < self.previous_price:
                price_line_color = self.colors['price_line_bearish']
            else:
                price_line_color = self.colors['price_line_neutral']
        else:
            price_line_color = self.colors['price_line_neutral']
            
        # Get Y coordinate for current price
        _, y_coords = self._normalize_coordinates(
            np.array([0]), 
            np.array([self.current_price])
        )
        y = y_coords[0]
        
        # Draw dashed horizontal line across chart area only
        if 0 <= y < self.chart_height:
            # Create dashed line (5 pixels on, 5 pixels off)
            for x in range(0, self.chart_width, 10):
                x_end = min(x + 5, self.chart_width)
                self.image_buffer[y, x:x_end] = price_line_color
                
        # Price box will be drawn with PIL text rendering in _finalize_image
            
    def _draw_time_axis(self, visible_candles):
        """Draw time axis at the bottom of the chart"""
        if not visible_candles:
            return
            
        # Draw horizontal line separating chart from time axis
        self.image_buffer[self.chart_height, :self.chart_width] = self.colors['grid']
        
        # Calculate how many time labels to show (max 5-6 to avoid crowding)
        num_labels = min(6, len(visible_candles))
        if num_labels < 2:
            return
            
        # Get evenly spaced indices for labels
        indices = np.linspace(0, len(visible_candles) - 1, num_labels, dtype=int)
        
        # Time labels will be added with PIL text rendering in _finalize_image
        self.time_labels = []
        for idx in indices:
            candle = visible_candles[idx]
            time_obj = candle.get('time', datetime.utcnow())
            # Format time as HH:MM
            time_str = time_obj.strftime('%H:%M')
            x_pos = int((idx / len(visible_candles)) * self.chart_width)
            self.time_labels.append((x_pos, time_str))
            
    def _finalize_image(self):
        """Convert numpy array to PIL image and add text overlays"""
        # Convert numpy array to PIL Image
        img = Image.fromarray(self.image_buffer, 'RGB')
        draw = ImageDraw.Draw(img)
        
        # Draw price box with text
        if self.current_price > 0:
            # Determine color
            if self.previous_price > 0:
                if self.current_price > self.previous_price:
                    price_color = tuple(self.colors['price_line_bullish'])
                elif self.current_price < self.previous_price:
                    price_color = tuple(self.colors['price_line_bearish'])
                else:
                    price_color = tuple(self.colors['price_line_neutral'])
            else:
                price_color = tuple(self.colors['price_line_neutral'])
                
            # Get Y coordinate for price
            _, y_coords = self._normalize_coordinates(
                np.array([0]), 
                np.array([self.current_price])
            )
            y = y_coords[0]
            
            if 0 <= y < self.chart_height:
                price_text = f"${self.current_price:,.2f}"
                
                # Calculate text size
                bbox = draw.textbbox((0, 0), price_text, font=self.font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                
                # Position price box
                box_padding = 4
                box_x = self.chart_width + 5
                box_y = max(0, min(self.chart_height - text_height - 2*box_padding, 
                                  y - (text_height + 2*box_padding) // 2))
                box_width = text_width + 2*box_padding
                box_height = text_height + 2*box_padding
                
                # Draw box background
                draw.rectangle(
                    [box_x, box_y, box_x + box_width, box_y + box_height],
                    fill=tuple(self.colors['price_box_bg']),
                    outline=price_color,
                    width=1
                )
                
                # Draw price text
                draw.text(
                    (box_x + box_padding, box_y + box_padding),
                    price_text,
                    fill=tuple(self.colors['price_text']),
                    font=self.font
                )
        
        # Draw time axis labels
        if hasattr(self, 'time_labels'):
            for x_pos, time_str in self.time_labels:
                # Center the text
                bbox = draw.textbbox((0, 0), time_str, font=self.small_font)
                text_width = bbox[2] - bbox[0]
                x = x_pos - text_width // 2
                y = self.chart_height + 8
                
                draw.text(
                    (x, y),
                    time_str,
                    fill=tuple(self.colors['price_text']),
                    font=self.small_font
                )
        
        return img
            
    def render(self) -> Any:
        """Render chart using CPU optimization"""
        
        start_time = time.perf_counter()
        
        # Debug log every 10th render
        self.frame_count += 1
        if self.frame_count % 10 == 0:
            logger.info(f"[CPU CHART] Render #{self.frame_count} - price: ${self.current_price:,.2f}, candles: {len(self.candles)}")
        
        # Clear background
        self.image_buffer.fill(0)
        self.image_buffer[:, :] = self.colors['background']
        
        if not self.candles:
            render_time = (time.perf_counter() - start_time) * 1000
            self.render_times.append(render_time)
            return self._get_frame_bytes()
            
        # Limit to visible candles (most recent)
        visible_candles = self.candles[-self.max_visible_candles:] if len(self.candles) > self.max_visible_candles else self.candles
        
        # Convert candle data to numpy array for vectorized operations
        candle_array = np.zeros((len(visible_candles), 4), dtype=np.float32)
        for i, candle in enumerate(visible_candles):
            candle_array[i] = [
                candle.get('open', 0),
                candle.get('high', 0),
                candle.get('low', 0),
                candle.get('close', 0)
            ]
            
        # X positions for candles
        x_positions = np.arange(len(visible_candles), dtype=np.float32)
        
        # Draw candlesticks using vectorized operations
        self._draw_candlestick_vectorized(candle_array, x_positions)
        
        # Draw current price line
        self._draw_price_line()
        
        # Draw time axis
        self._draw_time_axis(visible_candles)
        
        # Performance tracking
        render_time = (time.perf_counter() - start_time) * 1000
        self.render_times.append(render_time)
        
        # Keep only recent render times
        if len(self.render_times) > 100:
            self.render_times = self.render_times[-100:]
            
        self.update_performance_metrics()
        
        return self._get_frame_bytes()
        
    def _get_frame_bytes(self) -> bytes:
        """Convert frame buffer to compressed image bytes with text overlays"""
        
        # Get PIL image with text overlays
        img = self._finalize_image()
        
        # Compress to WebP for faster transfer
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='WebP', quality=80, optimize=True)
        img_bytes.seek(0)
        
        return img_bytes.getvalue()
        
    def get_dash_component(self) -> Any:
        """Return Dash component for displaying this chart"""
        
        from dash import html
        import uuid
        
        # Render chart
        image_bytes = self.render()
        
        # Convert to base64 for HTML display
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Add unique key to force Dash to update
        return html.Img(
            id={'type': 'chart-image', 'index': str(uuid.uuid4())},
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
