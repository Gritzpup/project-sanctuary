"""
Dash wrapper for ModernGL GPU-accelerated charts
Integrates high-performance ModernGL charts with Dash framework
"""
from dash import html, dcc, Input, Output, callback, clientside_callback
import dash_bootstrap_components as dbc
from .moderngl_chart import chart_manager, GPUCandlestickChart
import threading
import time
from typing import Dict, Any, Optional
import json

class DashGPUChart:
    """
    Dash component wrapper for ModernGL GPU charts
    Provides easy integration with existing Dash apps
    """
    
    def __init__(self, chart_id: str, symbol: str, width=800, height=600, responsive=True):
        self.chart_id = chart_id
        self.symbol = symbol
        self.width = width
        self.height = height
        self.responsive = responsive
        
        # Add chart to global manager
        self.gpu_chart = chart_manager.add_chart(symbol, width, height)
        
        # Update interval for chart refreshes
        self.update_interval = 50  # 50ms = 20 FPS
        
    def get_layout(self) -> html.Div:
        """Get Dash layout for the GPU chart"""
        img_style = {
            'width': '100%',
            'height': 'auto',
            'border': '1px solid #444',
            'borderRadius': '4px',
            'backgroundColor': '#1a1a1a',
            'display': 'block',
            'maxWidth': '100%',
            'objectFit': 'contain',
        } if self.responsive else {
            'width': f'{self.width}px',
            'height': f'{self.height}px',
            'border': '1px solid #444',
            'borderRadius': '4px',
            'backgroundColor': '#1a1a1a'
        }
        container_style = {
            'display': 'block',
            'margin': '10px auto',
            'padding': '10px',
            'backgroundColor': '#2a2a2a',
            'borderRadius': '8px',
            'boxShadow': '0 2px 10px rgba(0,0,0,0.3)',
            'width': '100%',
            'maxWidth': '1000px',
        } if self.responsive else {
            'display': 'inline-block',
            'margin': '10px',
            'padding': '10px',
            'backgroundColor': '#2a2a2a',
            'borderRadius': '8px',
            'boxShadow': '0 2px 10px rgba(0,0,0,0.3)'
        }
        return html.Div([
            # Chart image display
            html.Img(
                id=f'{self.chart_id}-image',
                style=img_style
            ),
            
            # Performance indicator
            html.Div([
                html.Span(id=f'{self.chart_id}-fps', children="FPS: --"),
                html.Span(" | ", style={'margin': '0 10px', 'color': '#666'}),
                html.Span(id=f'{self.chart_id}-symbol', children=f"Symbol: {self.symbol}"),
            ], style={
                'textAlign': 'center',
                'marginTop': '5px',
                'fontSize': '12px',
                'color': '#999'
            }),
            
            # Hidden interval for updates
            dcc.Interval(
                id=f'{self.chart_id}-update-interval',
                interval=self.update_interval,
                n_intervals=0
            ),
            
            # Data store for chart state
            dcc.Store(id=f'{self.chart_id}-data-store', data={
                'symbol': self.symbol,
                'last_update': 0,
                'candle_count': 0
            })
            
        ], id=f'{self.chart_id}-container', style=container_style)
        
    def register_callbacks(self, app):
        """Register Dash callbacks for the GPU chart"""
        
        @callback(
            [Output(f'{self.chart_id}-image', 'src'),
             Output(f'{self.chart_id}-fps', 'children'),
             Output(f'{self.chart_id}-data-store', 'data')],
            [Input(f'{self.chart_id}-update-interval', 'n_intervals'),
             Input(f'{self.chart_id}-data-store', 'data')]
        )
        def update_gpu_chart(n_intervals, current_data):
            """Update the GPU chart image"""
            
            try:
                # Get latest chart image
                image_b64 = chart_manager.get_chart_image(self.symbol)
                
                if image_b64:
                    src = f"data:image/png;base64,{image_b64}"
                else:
                    # Fallback placeholder
                    src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcgR1BVIENoYXJ0Li4uPC90ZXh0Pjwvc3ZnPg=="
                
                # Update FPS display
                fps_text = f"FPS: {self.gpu_chart.fps:.1f}" if hasattr(self.gpu_chart, 'fps') else "FPS: --"
                
                # Update data store
                updated_data = current_data.copy()
                updated_data['last_update'] = time.time()
                updated_data['candle_count'] = len(self.gpu_chart.candles)
                
                return src, fps_text, updated_data
                
            except Exception as e:
                print(f"Error updating GPU chart {self.chart_id}: {e}")
                # Return error placeholder
                error_src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI2VmNTM1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yIExvYWRpbmcgQ2hhcnQ8L3RleHQ+PC9zdmc+"
                return error_src, "FPS: ERROR", current_data
                
    def update_candle(self, candle_data: Dict):
        """Update chart with new candle data"""
        chart_manager.update_candle(self.symbol, candle_data)
        
    def update_price(self, price: float):
        """Update chart with new price"""
        chart_manager.update_price(self.symbol, price)
        
    def cleanup(self):
        """Clean up chart resources"""
        chart_manager.remove_chart(self.symbol)


class MultiGPUChartDashboard:
    """
    Dashboard component for managing multiple GPU charts
    Perfect for multi-bot trading platforms
    """
    
    def __init__(self, dashboard_id: str = "multi-gpu-dashboard"):
        self.dashboard_id = dashboard_id
        self.charts = {}  # chart_id -> DashGPUChart
        self.layout_grid = []  # Grid layout configuration
        
    def add_chart(self, chart_id: str, symbol: str, width=400, height=300) -> DashGPUChart:
        """Add a new GPU chart to the dashboard"""
        chart = DashGPUChart(chart_id, symbol, width, height)
        self.charts[chart_id] = chart
        return chart
        
    def remove_chart(self, chart_id: str):
        """Remove a chart from the dashboard"""
        if chart_id in self.charts:
            self.charts[chart_id].cleanup()
            del self.charts[chart_id]
            
    def set_grid_layout(self, rows: int, cols: int):
        """Set grid layout for charts"""
        self.layout_grid = []
        chart_ids = list(self.charts.keys())
        
        for row in range(rows):
            row_charts = []
            for col in range(cols):
                idx = row * cols + col
                if idx < len(chart_ids):
                    row_charts.append(chart_ids[idx])
                else:
                    row_charts.append(None)
            self.layout_grid.append(row_charts)
            
    def get_layout(self) -> html.Div:
        """Get complete dashboard layout"""
        
        if not self.charts:
            return html.Div([
                html.H3("GPU Chart Dashboard", style={'text-align': 'center', 'color': '#999'}),
                html.P("No charts configured", style={'text-align': 'center', 'color': '#666'})
            ])
            
        # Auto-arrange charts in grid if not manually set
        if not self.layout_grid:
            chart_count = len(self.charts)
            cols = min(3, chart_count)  # Max 3 columns
            rows = (chart_count + cols - 1) // cols
            self.set_grid_layout(rows, cols)
            
        # Build grid layout
        grid_rows = []
        for row_charts in self.layout_grid:
            row_components = []
            for chart_id in row_charts:
                if chart_id and chart_id in self.charts:
                    row_components.append(
                        dbc.Col(
                            self.charts[chart_id].get_layout(),
                            width=12 // len(row_charts)
                        )
                    )
            if row_components:
                grid_rows.append(dbc.Row(row_components, className="mb-3"))
                
        return html.Div([
            # Dashboard header
            dbc.Row([
                dbc.Col([
                    html.H2([
                        "🚀 GPU-Accelerated Trading Charts",
                        dbc.Badge(
                            f"{len(self.charts)} charts",
                            color="success",
                            className="ms-2"
                        )
                    ], className="mb-3"),
                ])
            ]),
            
            # Performance summary
            dbc.Row([
                dbc.Col([
                    dbc.Card([
                        dbc.CardBody([
                            html.H5("Performance", className="card-title"),
                            html.P(id=f"{self.dashboard_id}-performance-summary", 
                                   children="Initializing GPU charts...",
                                   className="card-text")
                        ])
                    ], color="dark", outline=True)
                ], width=12)
            ], className="mb-3"),
            
            # Chart grid
            html.Div(grid_rows, id=f"{self.dashboard_id}-chart-grid"),
            
            # Update interval for dashboard
            dcc.Interval(
                id=f"{self.dashboard_id}-update-interval",
                interval=1000,  # 1 second for dashboard updates
                n_intervals=0
            )
            
        ], id=self.dashboard_id)
        
    def register_callbacks(self, app):
        """Register all dashboard callbacks"""
        
        # Register individual chart callbacks
        for chart in self.charts.values():
            chart.register_callbacks(app)
            
        # Dashboard performance summary callback
        @callback(
            Output(f"{self.dashboard_id}-performance-summary", "children"),
            Input(f"{self.dashboard_id}-update-interval", "n_intervals")
        )
        def update_performance_summary(n_intervals):
            """Update overall performance summary"""
            
            if not self.charts:
                return "No charts active"
                
            total_fps = 0
            total_candles = 0
            active_charts = 0
            
            for chart in self.charts.values():
                if hasattr(chart.gpu_chart, 'fps'):
                    total_fps += chart.gpu_chart.fps
                    active_charts += 1
                total_candles += len(chart.gpu_chart.candles)
                
            avg_fps = total_fps / active_charts if active_charts > 0 else 0
            
            return html.Div([
                html.Span(f"Average FPS: {avg_fps:.1f}", className="me-3"),
                html.Span(f"Total Candles: {total_candles}", className="me-3"),
                html.Span(f"Active Charts: {len(self.charts)}")
            ])
            
    def update_all_charts(self, symbol: str, candle_data: Optional[Dict] = None, price: Optional[float] = None):
        """Update all charts for a specific symbol"""
        for chart in self.charts.values():
            if chart.symbol == symbol:
                if candle_data:
                    chart.update_candle(candle_data)
                if price is not None:
                    chart.update_price(price)
                    
    def cleanup_all(self):
        """Clean up all charts and resources"""
        for chart in self.charts.values():
            chart.cleanup()
        self.charts.clear()
        chart_manager.cleanup_all()


# Convenience function to create a simple single chart
def create_gpu_chart(chart_id: str, symbol: str, width=800, height=600) -> DashGPUChart:
    """Create a single GPU-accelerated chart"""
    return DashGPUChart(chart_id, symbol, width, height)

# Convenience function to create multi-chart dashboard
def create_multi_chart_dashboard(dashboard_id: str = "gpu-dashboard") -> MultiGPUChartDashboard:
    """Create a multi-chart GPU dashboard"""
    return MultiGPUChartDashboard(dashboard_id)
