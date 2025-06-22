"""
Dashboard Integration for Chart Acceleration - Fixed Version
Properly registers callbacks with Dash
"""
from dash import html, dcc, Input, Output, callback
import dash_bootstrap_components as dbc
import time
import base64
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
        """Get Dash layout with initial chart render"""
        
        capabilities = get_system_capabilities()
        
        # Initial chart render
        initial_chart = self._render_chart()
        
        return html.Div([
            # Main chart display
            html.Div(
                id=f'{self.chart_id}-container',
                children=[
                    # Chart with initial content
                    html.Div(
                        id=f'{self.chart_id}-chart',
                        children=initial_chart
                    )
                ],
                style={
                    'border': '1px solid #444',
                    'border-radius': '8px',
                    'padding': '0',  # Remove padding for full width
                    'background-color': '#1a1a1a',
                    'margin-bottom': '10px',
                    'overflow': 'hidden'  # Prevent overflow
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
                                html.Span(self.chart.__class__.__name__)
                            ], className="mb-2"),
                            
                            html.Div([
                                html.Strong("Performance: "),
                                html.Span(f"{capabilities.estimated_chart_latency_ms:.2f}ms estimated")
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
        
    def _render_chart(self):
        """Render the chart and return Dash component"""
        try:
            return self.chart.get_dash_component()
        except Exception as e:
            logger.error(f"Chart render failed: {e}")
            return html.Div(
                "Chart will appear here",
                style={'text-align': 'center', 'padding': '50px', 'color': '#666'}
            )
    
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
                linux_opts.append("CPU-isolated")
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


def create_bitcoin_chart(chart_id: str = "btc-chart", width: int = 800, height: int = 600) -> AcceleratedChartComponent:
    """Create accelerated Bitcoin chart component"""
    return AcceleratedChartComponent(chart_id, "BTC-USD", width, height, target_fps=20)


def get_system_performance_summary() -> Dict[str, Any]:
    """Get system performance summary for dashboard display"""
    
    capabilities = get_system_capabilities()
    
    # Calculate optimization score (0-100)
    score = 25  # Base score
    
    if capabilities.has_nvidia_gpu:
        score += 25
    if capabilities.cpu_threads >= 8:
        score += 15
    if capabilities.has_moderngl:
        score += 10
    if capabilities.is_linux:
        score += 10
    if capabilities.has_real_time_kernel:
        score += 5
    if capabilities.has_isolated_cpus:
        score += 5
    if capabilities.has_huge_pages:
        score += 5
        
    return {
        'performance_tier': capabilities.performance_tier,
        'estimated_latency_ms': capabilities.estimated_chart_latency_ms,
        'hardware_accelerated': capabilities.has_nvidia_gpu and capabilities.has_moderngl,
        'optimization_score': min(100, score),
        'capabilities': capabilities
    }
    
    
# Register callbacks at module level for proper Dash integration
def register_chart_callbacks(chart_id: str, chart_component: AcceleratedChartComponent):
    """Register callbacks for a chart component"""
    
    # Performance panel toggle
    @callback(
        Output(f'{chart_id}-performance-collapse', 'is_open'),
        Input(f'{chart_id}-performance-toggle', 'n_clicks'),
        prevent_initial_call=True
    )
    def toggle_performance_info(n_clicks):
        if n_clicks:
            return True
        return False
        
    # Chart refresh
    @callback(
        Output(f'{chart_id}-chart', 'children'),
        Output(f'{chart_id}-fps', 'children'),
        [Input(f'{chart_id}-interval', 'n_intervals'),
         Input(f'{chart_id}-refresh', 'n_clicks'),
         Input(f'{chart_id}-data-store', 'data')],
        prevent_initial_call=False
    )
    def update_chart_display(n_intervals, refresh_clicks, data_store):
        try:
            # Render chart
            start_time = time.perf_counter()
            chart_component_element = chart_component.chart.get_dash_component()
            render_time = (time.perf_counter() - start_time) * 1000
            
            # Update performance metrics
            stats = chart_component.chart.get_performance_stats()
            fps_text = f"{stats.get('fps', 0):.1f} FPS ({render_time:.1f}ms)"
            
            return chart_component_element, fps_text
            
        except Exception as e:
            logger.error(f"Chart update failed: {e}")
            
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