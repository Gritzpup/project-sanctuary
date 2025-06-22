"""
Dashboard Integration for Chart Acceleration
Seamless integration with existing Dash dashboard
"""
from dash import html, dcc, Input, Output, callback, clientside_callback
import dash_bootstrap_components as dbc
import time
import json
from typing import Dict, Any, Optional
import logging

from components.chart_acceleration import create_optimal_chart, get_system_capabilities

logger = logging.getLogger(__name__)

class AcceleratedChartComponent:
    """
    Drop-in replacement for existing chart components
    Automatically uses best available acceleration
    """
    
    def __init__(self, chart_id: str, symbol: str, width: int = 800, height: int = 600, 
                 target_fps: int = 20):
        self.chart_id = chart_id
        self.symbol = symbol
        self.width = width
        self.height = height
        self.target_fps = target_fps
        
        # Create optimal chart implementation
        self.chart = create_optimal_chart(
            symbol=symbol,
            width=width, 
            height=height,
            target_fps=target_fps,
            prefer_hardware=True
        )
        
        self.last_update = time.time()
        
        logger.info(f"AcceleratedChartComponent created for {symbol}: {self.chart.__class__.__name__}")
        
    def get_layout(self) -> html.Div:
        """Get Dash layout with performance monitoring"""
        
        capabilities = get_system_capabilities()
        
        return html.Div([
            # Main chart display
            html.Div(
                id=f'{self.chart_id}-container',
                children=[
                    # Chart will be rendered here
                    html.Div(id=f'{self.chart_id}-chart')
                ],
                style={
                    'border': '1px solid #444',
                    'border-radius': '8px',
                    'padding': '10px',
                    'background-color': '#1a1a1a',
                    'margin-bottom': '10px'
                }
            ),
            
            # Performance info panel
            dbc.Collapse([
                dbc.Card([
                    dbc.CardBody([
                        html.H6("Chart Performance", className="card-title"),
                        html.Div([
                            html.Div([
                                html.Strong("Implementation: "),
                                html.Span(id=f'{self.chart_id}-implementation', 
                                         children=self.chart.__class__.__name__)
                            ], className="mb-2"),
                            
                            html.Div([
                                html.Strong("Performance: "),
                                html.Span(id=f'{self.chart_id}-performance', 
                                         children=f"{capabilities.estimated_chart_latency_ms:.2f}ms estimated")
                            ], className="mb-2"),
                            
                            html.Div([
                                html.Strong("FPS: "),
                                html.Span(id=f'{self.chart_id}-fps', children="--")
                            ], className="mb-2"),
                            
                            html.Div([
                                html.Strong("Hardware: "),
                                html.Span(children=self._get_hardware_info(capabilities))
                            ])
                        ])
                    ])
                ], color="dark", outline=True)
            ], id=f'{self.chart_id}-performance-collapse', is_open=False),
            
            # Controls
            html.Div([
                dbc.Button(
                    "Performance Info",
                    id=f'{self.chart_id}-performance-toggle',
                    color="secondary",
                    size="sm",
                    outline=True
                ),
                
                dbc.Button(
                    "Refresh Chart",
                    id=f'{self.chart_id}-refresh',
                    color="primary", 
                    size="sm",
                    outline=True,
                    style={'margin-left': '10px'}
                )
            ], className="d-flex justify-content-end mb-2"),
            
            # Hidden data store for chart updates
            dcc.Store(id=f'{self.chart_id}-data-store'),
            
            # Update interval
            dcc.Interval(
                id=f'{self.chart_id}-interval',
                interval=1000 // self.target_fps,  # Convert FPS to milliseconds
                n_intervals=0
            )
        ])
        
    def _get_hardware_info(self, capabilities) -> str:
        """Get formatted hardware information"""
        
        hardware_parts = []
        
        if capabilities.has_nvidia_gpu:
            gpu_info = f"RTX GPU ({capabilities.gpu_memory_gb}GB)"
            if "2080" in str(capabilities.gpu_compute_capability or ""):
                gpu_info = f"RTX 2080 Super ({capabilities.gpu_memory_gb}GB) 🔥"
            hardware_parts.append(gpu_info)
            
        if capabilities.cpu_threads >= 16:
            hardware_parts.append(f"{capabilities.cpu_threads}-thread CPU")
        elif capabilities.cpu_threads >= 8:
            hardware_parts.append(f"{capabilities.cpu_threads}-core CPU")
            
        if capabilities.is_linux:
            linux_opts = []
            if capabilities.has_real_time_kernel:
                linux_opts.append("RT")
            if capabilities.has_isolated_cpus:
                linux_opts.append("Isolated")
            if capabilities.has_huge_pages:
                linux_opts.append("HugePages")
            
            if linux_opts:
                hardware_parts.append(f"Linux ({', '.join(linux_opts)})")
            else:
                hardware_parts.append("Linux")
                
        return " + ".join(hardware_parts) if hardware_parts else "Standard"
        
    def update_chart_data(self, candle_data: Dict[str, Any]):
        """Update chart with new candle data"""
        self.chart.add_candle(candle_data)
        
    def update_current_candle(self, candle_data: Dict[str, Any]):
        """Update currently forming candle"""
        self.chart.update_current_candle(candle_data)
        
    def update_price(self, price: float):
        """Update current price"""
        self.chart.update_price(price)
        
    def get_callbacks(self):
        """Get Dash callbacks for this component"""
        
        # Performance panel toggle
        @callback(
            Output(f'{self.chart_id}-performance-collapse', 'is_open'),
            Input(f'{self.chart_id}-performance-toggle', 'n_clicks'),
            prevent_initial_call=True
        )
        def toggle_performance_info(n_clicks):
            if n_clicks:
                return True
            return False
            
        # Chart refresh
        @callback(
            Output(f'{self.chart_id}-chart', 'children'),
            Output(f'{self.chart_id}-fps', 'children'),
            [Input(f'{self.chart_id}-interval', 'n_intervals'),
             Input(f'{self.chart_id}-refresh', 'n_clicks')],
            prevent_initial_call=True
        )
        def update_chart_display(n_intervals, refresh_clicks):
            try:
                # Render chart
                start_time = time.perf_counter()
                chart_component = self.chart.get_dash_component()
                render_time = (time.perf_counter() - start_time) * 1000
                
                # Update performance metrics
                stats = self.chart.get_performance_stats()
                fps_text = f"{stats.get('fps', 0):.1f} FPS ({render_time:.1f}ms)"
                
                return chart_component, fps_text
                
            except Exception as e:
                logger.error(f"Chart update failed for {self.symbol}: {e}")
                
                # Fallback display
                error_component = html.Div([
                    html.H5("Chart Error", style={'color': '#ff6b6b'}),
                    html.P(f"Failed to render chart: {str(e)}", style={'color': '#999'})
                ], style={
                    'text-align': 'center',
                    'padding': '50px',
                    'background-color': '#2a2a2a',
                    'border-radius': '4px'
                })
                
                return error_component, "Error"

def create_bitcoin_chart(chart_id: str = "btc-chart", width: int = 800, height: int = 600) -> AcceleratedChartComponent:
    """Create accelerated Bitcoin chart component (drop-in replacement)"""
    return AcceleratedChartComponent(chart_id, "BTC-USD", width, height, target_fps=20)

def create_multi_symbol_charts(symbols: list, base_id: str = "multi-chart") -> Dict[str, AcceleratedChartComponent]:
    """Create multiple accelerated charts for different symbols"""
    
    charts = {}
    
    for i, symbol in enumerate(symbols):
        chart_id = f"{base_id}-{symbol.lower().replace('-', '')}"
        
        # Adjust performance targets based on number of charts
        if len(symbols) <= 2:
            target_fps = 20  # High performance for few charts
        elif len(symbols) <= 4: 
            target_fps = 10  # Medium performance
        else:
            target_fps = 5   # Lower performance for many charts
            
        charts[symbol] = AcceleratedChartComponent(
            chart_id=chart_id,
            symbol=symbol,
            width=400 if len(symbols) > 2 else 600,  # Smaller charts for multi-display
            height=300 if len(symbols) > 2 else 400,
            target_fps=target_fps
        )
        
    logger.info(f"Created {len(charts)} accelerated charts for symbols: {symbols}")
    return charts

# Integration helper for existing dashboard
def upgrade_existing_chart_component(existing_layout, chart_id: str, symbol: str):
    """
    Helper to upgrade existing dcc.Graph components to accelerated charts
    
    Usage:
        # Replace this:
        dcc.Graph(id="btc-chart", figure=fig)
        
        # With this:
        upgrade_existing_chart_component(layout, "btc-chart", "BTC-USD")
    """
    
    try:
        # Create accelerated chart
        accelerated_chart = AcceleratedChartComponent(chart_id, symbol)
        
        # Get new layout
        new_layout = accelerated_chart.get_layout()
        
        # Register callbacks
        accelerated_chart.get_callbacks()
        
        logger.info(f"Successfully upgraded chart {chart_id} to accelerated version")
        return new_layout
        
    except Exception as e:
        logger.error(f"Failed to upgrade chart {chart_id}: {e}")
        
        # Return fallback
        return html.Div([
            html.H5("Chart Upgrade Failed", style={'color': '#ff6b6b'}),
            html.P(f"Using fallback for {symbol}", style={'color': '#999'})
        ])

# Performance monitoring utilities
def get_system_performance_summary() -> Dict[str, Any]:
    """Get system performance summary for dashboard display"""
    
    capabilities = get_system_capabilities()
    
    return {
        'performance_tier': capabilities.performance_tier,
        'estimated_latency_ms': capabilities.estimated_chart_latency_ms,
        'max_fps': capabilities.max_estimated_fps,
        'hardware_accelerated': capabilities.has_nvidia_gpu or capabilities.has_moderngl,
        'linux_optimized': capabilities.is_linux,
        'rtx_2080_detected': "2080" in str(capabilities.gpu_compute_capability or ""),
        'optimization_score': _calculate_optimization_score(capabilities)
    }

def _calculate_optimization_score(capabilities) -> int:
    """Calculate optimization score (0-100)"""
    
    score = 0
    
    # Base score for working system
    score += 20
    
    # Hardware acceleration
    if capabilities.has_nvidia_gpu:
        score += 30
        if "2080" in str(capabilities.gpu_compute_capability or ""):
            score += 20  # RTX 2080 Super bonus
            
    # CPU performance
    if capabilities.cpu_threads >= 16:
        score += 15
    elif capabilities.cpu_threads >= 8:
        score += 10
        
    # Linux optimizations
    if capabilities.is_linux:
        score += 5
        if capabilities.has_real_time_kernel:
            score += 5
        if capabilities.has_isolated_cpus:
            score += 5
        if capabilities.has_huge_pages:
            score += 5
            
    return min(100, score)
