"""
Hermes Trading Post - High-Performance Trading Dashboard
Main entry point for the GPU-accelerated Dash application with sidebar navigation
"""

import dash
from dash import Dash, html, dcc, Input, Output, State, callback
import dash_bootstrap_components as dbc
from config.coinbase_config import coinbase_config
import logging
import os
import threading
import queue
import redis
import json

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Disable werkzeug request logging to reduce spam
logging.getLogger('werkzeug').setLevel(logging.WARNING)

# Check for debug mode from environment variable
DEBUG_MODE = os.environ.get('DASH_DEBUG', 'False').lower() == 'true'

print("🚀 Starting Alpaca Trader Dash App...")
print(f"📊 Dashboard: http://localhost:8050")
print(f"🔧 Debug mode: {DEBUG_MODE}")

# Initialize Dash app with Bootstrap theme and multi-page support
app = Dash(
    __name__,
    use_pages=True,
    external_stylesheets=[
        dbc.themes.BOOTSTRAP, 
        dbc.icons.BOOTSTRAP,
        "/assets/dark_mode.css"  # Include our dark mode CSS
    ],
    suppress_callback_exceptions=True,
    pages_folder="pages",
    assets_folder="assets"
)

app.title = "Alpaca Trader - Real-time Crypto Dashboard"
server = app.server

# Modern sidebar styling with collapsible support
SIDEBAR_STYLE = {
    "position": "fixed",
    "top": 0,
    "left": 0,
    "bottom": 0,
    "width": "16rem",
    "padding": "1rem",
    "background": "var(--bg-secondary)",
    "borderRight": "2px solid var(--border-color)",
    "zIndex": 1050,
    "transition": "all 0.3s ease"
}

SIDEBAR_COLLAPSED_STYLE = {
    "position": "fixed",
    "top": 0,
    "left": 0,  # Keep visible, just thinner
    "bottom": 0,
    "width": "4rem",  # Thin sidebar for icons only
    "padding": "0.5rem",
    "background": "var(--bg-secondary)",
    "borderRight": "2px solid var(--border-color)",
    "zIndex": 1050,
    "transition": "all 0.3s ease",
    "overflow": "hidden"  # Hide text when collapsed
}

CONTENT_STYLE = {
    "marginLeft": "18rem",
    "marginRight": "2rem",
    "padding": "2rem 1rem",
    "transition": "all 0.3s ease"
}

CONTENT_EXPANDED_STYLE = {
    "marginLeft": "5rem",  # Leave space for thin sidebar
    "marginRight": "2rem", 
    "padding": "2rem 1rem",
    "transition": "all 0.3s ease"
}

# Redis client for real-time price and candle sharing
redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_latest_price():
    try:
        data = redis_client.get('latest_price')
        if data:
            return json.loads(data).get('price')
    except Exception:
        return None

def get_latest_candle():
    try:
        data = redis_client.get('latest_candle')
        if data:
            return json.loads(data)
    except Exception:
        return None

# Define the modern collapsible sidebar navigation
sidebar = html.Div([
    # Sidebar Header with collapse button
    html.Div([
        dbc.Button(
            html.I(className="bi bi-list", style={"fontSize": "1.5rem"}),
            id="sidebar-toggle",
            className="btn-outline-primary border-0 p-2 mb-3",
            style={"position": "absolute", "top": "1rem", "right": "1rem"}
        ),        html.Div([
            html.H3([html.Span("🚀 Alpaca")], className="text-center mb-0", style={"fontWeight": "700"}),
            html.H5([html.Span("Trader")], className="text-center mb-2", style={"fontWeight": "300", "color": "var(--neon-blue)"}),
        ], style={"marginTop": "3rem"}),
        html.Hr(style={"borderColor": "var(--border-color)"}),
        html.P([html.Span("Real-time Crypto Trading")], className="text-center text-muted mb-4", style={"fontSize": "0.9rem"}),
    ]),
      # Navigation Links
    dbc.Nav([
        dbc.NavLink([
            html.I(className="bi bi-speedometer2 me-2"),
            html.Span("Dashboard")
        ], href="/", active="exact", className="mb-2 nav-link"),
        
        dbc.NavLink([
            html.I(className="bi bi-graph-up me-2"),
            html.Span("Backtesting")
        ], href="/backtesting", active="exact", className="mb-2 nav-link"),
        
        dbc.NavLink([
            html.I(className="bi bi-cash-coin me-2"),
            html.Span("Paper Trading")
        ], href="/paper-trading", active="exact", className="mb-2 nav-link"),
        
        dbc.NavLink([
            html.I(className="bi bi-currency-exchange me-2"),
            html.Span("Live Trading")
        ], href="/live-trading", active="exact", className="mb-2 nav-link"),
    ], vertical=True, pills=True, style={"flexGrow": "1"}),
      # Bottom section with dark mode toggle and settings
    html.Div([
        html.Hr(style={"borderColor": "var(--border-color)", "margin": "1rem 0"}),
        
        # Theme toggle and settings icons
        html.Div([
            # Dark/Light mode toggle button
            dbc.Button(
                html.I(id="theme-icon", className="bi bi-moon-fill", style={"fontSize": "1.4rem"}),
                id="theme-toggle-btn",
                color="link",
                className="p-2 me-2",
                style={
                    "border": "none",
                    "color": "var(--neon-blue)",
                    "background": "transparent"
                },
                title="Toggle Dark/Light Mode"
            ),
            
            # Settings button (for future use)
            dbc.Button(
                html.I(className="bi bi-gear-fill", style={"fontSize": "1.3rem"}),
                id="settings-btn",
                color="link", 
                className="p-2",
                style={
                    "border": "none",
                    "color": "var(--text-secondary)",
                    "background": "transparent"
                },
                title="Settings (Coming Soon)",
                disabled=True
            )
        ], className="d-flex justify-content-center align-items-center"),
        
        html.Small([html.Span(id="theme-label", children="Dark Mode")], className="text-muted text-center d-block mt-1")
    ], style={"position": "absolute", "bottom": "1rem", "left": "1rem", "right": "1rem"})
    
], id="sidebar", style=SIDEBAR_STYLE)

# Main layout with collapsible sidebar and page content
app.layout = html.Div([
    dcc.Location(id="url"),
    sidebar,
    html.Div(
        id="main-content",
        children=[dash.page_container],
        style=CONTENT_STYLE
    ),
    #html.H2(id="live-price", style={"marginTop": "2rem"}),  # Removed to avoid duplicate ID
    dcc.Interval(id="interval-component", interval=1000, n_intervals=0),
    dcc.Store(id="sidebar-collapsed", data=False),
    dcc.Store(id="theme-store", data="dark", storage_type="local"),
    dcc.Store(id="live-candle-store"),  # Store for live candle
], id="app-container")

# Track last price for up/down color
last_displayed_price = {"price": None}

#@app.callback(
#    [Output("live-price", "children"), Output("live-price", "className"), Output("live-candle-store", "data")],
#    Input("interval-component", "n_intervals")
#)
#def update_live_price_and_candle(n):
#    price = get_latest_price()
#    candle = get_latest_candle()
#    last_price = getattr(update_live_price_and_candle, "last_price", None)
#    if price is not None:
#        if last_price is not None:
#            if price > last_price:
#                class_name = "price-up"
#            elif price < last_price:
#                class_name = "price-down"
#            else:
#                class_name = "price-neutral"
#        else:
#            class_name = "price-neutral"
#        update_live_price_and_candle.last_price = price
#        return f"Live BTC-USD Price: ${price:.2f}", class_name, candle
#    return "Waiting for price...", "price-neutral", candle

# Callback for sidebar toggle functionality
@app.callback(
    [Output("sidebar", "style"),
     Output("main-content", "style"),
     Output("sidebar-collapsed", "data")],
    [Input("sidebar-toggle", "n_clicks")],
    [State("sidebar-collapsed", "data")]
)
def toggle_sidebar(n_clicks, collapsed):
    """Toggle sidebar visibility"""
    if n_clicks:
        collapsed = not collapsed
    
    if collapsed:
        sidebar_style = SIDEBAR_COLLAPSED_STYLE
        content_style = CONTENT_EXPANDED_STYLE
    else:
        sidebar_style = SIDEBAR_STYLE
        content_style = CONTENT_STYLE
    
    return sidebar_style, content_style, collapsed

# Callback for theme toggle with localStorage persistence
app.clientside_callback(
    """
    function(n_clicks, stored_theme) {
        // Get theme from localStorage or use stored theme or default to dark
        let currentTheme = localStorage.getItem('alpaca-trader-theme') || stored_theme || 'dark';
        
        // If button was clicked, toggle theme
        if (n_clicks && n_clicks > 0) {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            // Save to localStorage
            localStorage.setItem('alpaca-trader-theme', currentTheme);
        }
        
        // Apply theme to body
        if (currentTheme === 'dark') {
            document.body.classList.remove('light-mode');
        } else {
            document.body.classList.add('light-mode');
        }
        
        // Update icon and label based on current theme
        const isDark = currentTheme === 'dark';
        const iconClass = isDark ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
        const label = isDark ? 'Dark Mode' : 'Light Mode';
        const iconColor = isDark ? 'var(--neon-blue)' : 'var(--neon-orange)';
        
        return [
            iconClass,
            label, 
            currentTheme,
            {'fontSize': '1.4rem', 'color': iconColor, 'transition': 'all 0.3s ease'}
        ];
    }
    """,
    [
        Output("theme-icon", "className"),
        Output("theme-label", "children"), 
        Output("theme-store", "data"),
        Output("theme-icon", "style")
    ],
    [Input("theme-toggle-btn", "n_clicks")],
    [State("theme-store", "data")],
    prevent_initial_call=False
)

if __name__ == "__main__":
    # Run in single-threaded mode to avoid OpenGL thread safety issues
    # pygame/OpenGL contexts don't work well with Flask's multi-threading
    try:
        app.run_server(
            debug=DEBUG_MODE, 
            host='0.0.0.0', 
            port=8050, 
            use_reloader=DEBUG_MODE, 
            threaded=False,  # Single-threaded to avoid OpenGL crashes
            processes=1      # Single process
        )
    except OSError as e:
        if "Address already in use" in str(e):
            print("\n❌ ERROR: Port 8050 is already in use!")
            print("   Please stop the existing process or use a different port.")
            import sys
            sys.exit(1)
        else:
            raise