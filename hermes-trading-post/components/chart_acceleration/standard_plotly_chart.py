"""
Standard Plotly Chart - Fallback Implementation
Compatible fallback using the existing Plotly system
"""
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..chart_acceleration.base_chart import BaseChart
import logging

logger = logging.getLogger(__name__)

class StandardPlotlyChart(BaseChart):
    """
    Standard Plotly chart implementation - reliable fallback
    
    Features:
    - Uses existing Plotly infrastructure
    - Compatible with all systems
    - Reliable fallback when acceleration fails
    """
    
    def __init__(self, symbol: str, width: int = 800, height: int = 600):
        super().__init__(symbol, width, height)
        
        # Plotly figure
        self.fig = make_subplots(
            rows=1, cols=1,
            subplot_titles=[f"{symbol} Chart"]
        )
        
        # Configure layout
        self._setup_layout()
        
        logger.info(f"StandardPlotlyChart initialized for {symbol} ({width}x{height})")
        
    def _setup_layout(self):
        """Setup chart layout and styling"""
        
        self.fig.update_layout(
            width=self.width,
            height=self.height,
            template='plotly_dark',
            showlegend=False,
            margin=dict(l=40, r=40, t=40, b=40),
            xaxis=dict(
                title="Time",
                showgrid=True,
                gridcolor='#444',
                zeroline=False
            ),
            yaxis=dict(
                title="Price",
                showgrid=True,
                gridcolor='#444',
                zeroline=False
            ),
            plot_bgcolor='#1a1a1a',
            paper_bgcolor='#1a1a1a'
        )
        
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
            
        # Price bounds
        all_prices = []
        for candle in self.candles:
            all_prices.extend([candle.get('high', 0), candle.get('low', 0)])
            
        if self.current_price > 0:
            all_prices.append(self.current_price)
            
        if all_prices:
            self.price_min = min(all_prices) * 0.995
            self.price_max = max(all_prices) * 1.005
            
        # Time bounds
        if self.candles:
            times = [c.get('time', datetime.utcnow()) for c in self.candles]
            self.time_min = min(times)
            self.time_max = max(times)
            
    def render(self) -> Any:
        """Render chart using Plotly"""
        
        start_time = time.perf_counter()
        
        # Clear existing traces
        self.fig.data = []
        
        if not self.candles:
            render_time = (time.perf_counter() - start_time) * 1000
            self.render_times.append(render_time)
            return self.fig
            
        # Prepare candlestick data
        times = []
        opens = []
        highs = []
        lows = []
        closes = []
        
        for candle in self.candles:
            times.append(candle.get('time', datetime.utcnow()))
            opens.append(candle.get('open', 0))
            highs.append(candle.get('high', 0))
            lows.append(candle.get('low', 0))
            closes.append(candle.get('close', 0))
            
        # Add candlestick trace
        candlestick = go.Candlestick(
            x=times,
            open=opens,
            high=highs,
            low=lows,
            close=closes,
            increasing_line_color='#26a69a',
            decreasing_line_color='#ef5350',
            name=self.symbol
        )
        
        self.fig.add_trace(candlestick)
        
        # Add current price line if available
        if self.current_price > 0 and times:
            price_line = go.Scatter(
                x=[times[0], times[-1]],
                y=[self.current_price, self.current_price],
                mode='lines',
                line=dict(color='yellow', width=2, dash='dash'),
                name='Current Price',
                showlegend=False
            )
            self.fig.add_trace(price_line)
            
        # Update layout with current bounds
        self.fig.update_layout(
            xaxis_range=[self.time_min, self.time_max],
            yaxis_range=[self.price_min, self.price_max]
        )
        
        # Performance tracking
        render_time = (time.perf_counter() - start_time) * 1000
        self.render_times.append(render_time)
        
        # Keep only recent render times
        if len(self.render_times) > 100:
            self.render_times = self.render_times[-100:]
            
        self.update_performance_metrics()
        
        return self.fig
        
    def get_dash_component(self) -> Any:
        """Return Dash component for displaying this chart"""
        
        from dash import dcc
        
        # Render chart
        fig = self.render()
        
        return dcc.Graph(
            figure=fig,
            style={
                'width': f'{self.width}px',
                'height': f'{self.height}px'
            },
            config={
                'displayModeBar': False,
                'staticPlot': False
            }
        )
        
    def cleanup(self) -> None:
        """Clean up resources"""
        super().cleanup()
        logger.info(f"StandardPlotlyChart cleaned up for {self.symbol}")
