"""
High-Performance Plotly WebGL Charts for Trading
GPU-accelerated charts using Plotly's WebGL backend
"""
import plotly.graph_objects as go
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict

def create_webgl_candlestick_chart(candles: List[Dict], current_price: float = 0, 
                                   symbol: str = "BTC-USD", width: int = 800, height: int = 600) -> go.Figure:
    """
    Create a high-performance WebGL-accelerated chart
    Uses GPU rendering for better performance with real-time data
    """
    
    fig = go.Figure()
    
    if not candles:
        return fig
        
    # Extract candlestick data
    times = [c['time'] for c in candles]
    opens = [c['open'] for c in candles]
    highs = [c['high'] for c in candles]
    lows = [c['low'] for c in candles]
    closes = [c['close'] for c in candles]
    
    # Create OHLC lines using Scattergl (GPU-accelerated)
    # This is much faster than traditional candlesticks for real-time updates
    
    # High-Low lines (wicks)
    wick_x = []
    wick_y = []
    for i, time in enumerate(times):
        wick_x.extend([time, time, None])  # x, x, break
        wick_y.extend([lows[i], highs[i], None])  # low, high, break
        
    fig.add_trace(go.Scattergl(
        x=wick_x,
        y=wick_y,
        mode='lines',
        line=dict(color='#666666', width=1),
        name='Wicks',
        showlegend=False,
        hoverinfo='skip'
    ))
    
    # Open-Close bodies as colored markers
    for i, time in enumerate(times):
        is_bullish = closes[i] >= opens[i]
        color = '#26a69a' if is_bullish else '#ef5350'  # Green/Red
        
        # Body as a thick line from open to close
        fig.add_trace(go.Scattergl(
            x=[time, time],
            y=[opens[i], closes[i]],
            mode='lines',
            line=dict(color=color, width=8),
            name=f'Candle {i}',
            showlegend=False,
            hovertemplate=f'<b>{time}</b><br>Open: ${opens[i]:,.2f}<br>High: ${highs[i]:,.2f}<br>Low: ${lows[i]:,.2f}<br>Close: ${closes[i]:,.2f}<extra></extra>'
        ))
    
    # Real-time price line (WebGL accelerated)
    if current_price > 0 and times:
        # Extend price line across the chart
        start_time = times[0] - timedelta(minutes=1)
        end_time = times[-1] + timedelta(minutes=5)
        
        fig.add_trace(go.Scattergl(
            x=[start_time, end_time],
            y=[current_price, current_price],
            mode='lines',
            line=dict(color='#FFD700', width=2, dash='dot'),  # Gold dashed line
            name='Live Price',
            showlegend=False,
            hovertemplate=f'<b>Live Price: ${current_price:,.2f}</b><extra></extra>'
        ))
    
    # Layout optimized for performance
    fig.update_layout(
        title=f"{symbol} Live Chart - GPU Accelerated",
        xaxis_title="Time",
        yaxis_title="Price (USD)",
        height=height,
        width=width,
        template="plotly_dark",
        xaxis_rangeslider_visible=False,
        showlegend=False,
        margin=dict(l=50, r=100, t=50, b=50),
        # Performance optimizations
        dragmode='pan',
        uirevision='constant',  # Preserve zoom/pan state
        # Enable WebGL rendering
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)'
    )
    
    # Set axis ranges
    if times:
        x_range = [times[0] - timedelta(minutes=2), times[-1] + timedelta(minutes=5)]
        all_prices = highs + lows + ([current_price] if current_price > 0 else [])
        y_range = [min(all_prices) * 0.995, max(all_prices) * 1.005]
        
        fig.update_xaxes(range=x_range, type='date')
        fig.update_yaxes(range=y_range)
    
    return fig

def create_streaming_price_chart(prices: List[float], timestamps: List[datetime], 
                                symbol: str = "BTC-USD", max_points: int = 1000) -> go.Figure:
    """
    Create a pure price streaming chart for ultra-high frequency updates
    Perfect for seeing every price tick in real-time
    """
    
    fig = go.Figure()
    
    if not prices or not timestamps:
        return fig
    
    # Keep only recent data for performance
    if len(prices) > max_points:
        prices = prices[-max_points:]
        timestamps = timestamps[-max_points:]
    
    # Use Scattergl for GPU-accelerated rendering
    fig.add_trace(go.Scattergl(
        x=timestamps,
        y=prices,
        mode='lines',
        line=dict(color='#00FF88', width=2),  # Bright green
        name=f'{symbol} Price',
        showlegend=False,
        hovertemplate='<b>%{x}</b><br>Price: $%{y:,.2f}<extra></extra>'
    ))
    
    # Add markers for recent price points to show movement
    if len(prices) >= 2:
        recent_count = min(20, len(prices))
        recent_prices = prices[-recent_count:]
        recent_times = timestamps[-recent_count:]
        
        # Color markers based on price direction
        colors = []
        for i in range(len(recent_prices)):
            if i == 0:
                colors.append('#FFFF00')  # Yellow for first
            elif recent_prices[i] > recent_prices[i-1]:
                colors.append('#00FF00')  # Green for up
            else:
                colors.append('#FF0000')  # Red for down
        
        fig.add_trace(go.Scattergl(
            x=recent_times,
            y=recent_prices,
            mode='markers',
            marker=dict(
                color=colors,
                size=4,
                opacity=0.8
            ),
            name='Price Movement',
            showlegend=False,
            hoverinfo='skip'
        ))
    
    fig.update_layout(
        title=f"{symbol} Real-Time Price Stream - WebGL Accelerated",
        xaxis_title="Time",
        yaxis_title="Price (USD)",
        height=400,
        template="plotly_dark",
        showlegend=False,
        margin=dict(l=50, r=50, t=50, b=50),
        dragmode='pan',
        uirevision='constant'
    )
    
    return fig

def create_multi_symbol_dashboard(symbols_data: Dict[str, Dict]) -> go.Figure:
    """
    Create a multi-symbol dashboard for trading multiple cryptocurrencies
    Each symbol gets its own subplot for comparison
    """
    from plotly.subplots import make_subplots
    
    symbols = list(symbols_data.keys())
    rows = len(symbols)
    
    fig = make_subplots(
        rows=rows, cols=1,
        subplot_titles=symbols,
        vertical_spacing=0.05,
        shared_xaxes=True
    )
    
    for i, (symbol, data) in enumerate(symbols_data.items(), 1):
        prices = data.get('prices', [])
        times = data.get('times', [])
        current_price = data.get('current_price', 0)
        
        if prices and times:
            # Add price line for each symbol
            fig.add_trace(
                go.Scattergl(
                    x=times,
                    y=prices,
                    mode='lines',
                    name=symbol,
                    line=dict(width=2),
                    showlegend=False,
                    hovertemplate=f'<b>{symbol}</b><br>%{{x}}<br>Price: $%{{y:,.2f}}<extra></extra>'
                ),
                row=i, col=1
            )
            
            # Add current price indicator
            if current_price > 0:
                fig.add_hline(
                    y=current_price,
                    line_dash="dot",
                    line_color='gold',
                    row=i, col=1
                )
    
    fig.update_layout(
        title="Multi-Symbol Trading Dashboard",
        height=200 * rows,
        template="plotly_dark",
        showlegend=False,
        margin=dict(l=50, r=50, t=50, b=50)
    )
    
    return fig

# Performance comparison test
def benchmark_chart_types():
    """
    Benchmark different chart rendering approaches
    """
    import time
    from datetime import datetime, timedelta
    
    # Generate test data
    num_candles = 1000
    base_time = datetime.utcnow()
    base_price = 50000
    
    candles = []
    for i in range(num_candles):
        price_change = np.random.uniform(-100, 100)
        candle = {
            'time': base_time + timedelta(minutes=i),
            'open': base_price + price_change,
            'high': base_price + price_change + abs(np.random.uniform(0, 50)),
            'low': base_price + price_change - abs(np.random.uniform(0, 50)),
            'close': base_price + price_change + np.random.uniform(-25, 25),
            'volume': np.random.uniform(100, 1000)
        }
        candles.append(candle)
        base_price = candle['close']
    
    print("🔥 Chart Performance Benchmark")
    print("=" * 50)
    
    # Test WebGL candlestick chart
    start_time = time.time()
    webgl_fig = create_webgl_candlestick_chart(candles, 50000, "BTC-USD")
    webgl_time = time.time() - start_time
    print(f"WebGL Candlestick Chart: {webgl_time:.3f}s")
    
    # Test traditional Plotly candlestick
    start_time = time.time()
    traditional_fig = go.Figure()
    traditional_fig.add_trace(go.Candlestick(
        x=[c['time'] for c in candles],
        open=[c['open'] for c in candles],
        high=[c['high'] for c in candles],
        low=[c['low'] for c in candles],
        close=[c['close'] for c in candles]
    ))
    traditional_time = time.time() - start_time
    print(f"Traditional Candlestick Chart: {traditional_time:.3f}s")
    
    # Performance improvement
    improvement = traditional_time / webgl_time if webgl_time > 0 else float('inf')
    print(f"Performance Improvement: {improvement:.1f}x faster")
    
    return {
        'webgl_time': webgl_time,
        'traditional_time': traditional_time,
        'improvement': improvement
    }

if __name__ == "__main__":
    # Run performance benchmark
    results = benchmark_chart_types()
    print(f"\n🚀 WebGL charts are {results['improvement']:.1f}x faster!")
