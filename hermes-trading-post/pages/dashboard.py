"""
Bitcoin WebSocket Dashboard with High-Performance Chart Acceleration
Automatically selects best rendering method: GPU (0.1-0.5ms) or CPU-optimized (10-50ms)
"""
import dash
from dash import html, dcc, Input, Output, State, callback
import dash_bootstrap_components as dbc
from datetime import datetime, timedelta
import websocket
import json
import threading
from typing import Any, Optional, Union

# Import our chart acceleration system
from components.chart_acceleration.dashboard_integration_fixed import (
    AcceleratedChartComponent,
    create_bitcoin_chart,
    get_system_performance_summary,
    register_chart_callbacks
)

# Check system capabilities on startup
try:
    from components.chart_acceleration import get_system_capabilities
    capabilities = get_system_capabilities()
    print(f"🚀 Chart Acceleration Ready: {capabilities}")
    print(f"   Performance Tier: {capabilities.performance_tier}")
    print(f"   Expected Latency: {capabilities.estimated_chart_latency_ms:.2f}ms")
except Exception as e:
    print(f"⚠️  Chart acceleration initialization warning: {e}")
    capabilities = None

# Enable debug prints for troubleshooting
import builtins
print = builtins.print

# Register this as the main page (safe import without app)
try:
    dash.register_page(__name__, path='/', title='Bitcoin Dashboard')
except Exception:
    pass

# WebSocket data storage
current_price = 0
previous_price = 0  # Track previous price for color changes
ws_connection = None
current_candle = None  # Current forming candle
candle_data = {}  # Store candles by timeframe: {timeframe_seconds: [candles...]}

# Initialize accelerated chart early so it's available for websocket functions
bitcoin_chart = create_bitcoin_chart(chart_id="btc-chart", width=1400, height=600)

def fetch_historical_candles():
    """Fetch initial historical candles via REST API to bootstrap the dashboard"""
    global candle_data
    try:
        import requests
        from datetime import datetime, timedelta
        end_time = datetime.utcnow().replace(second=0, microsecond=0)
        start_time = end_time - timedelta(minutes=60)
        start_iso = start_time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        end_iso = end_time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        print(f"[CANDLE FETCH] Requesting candles from {start_time} UTC to {end_time} UTC (local: {datetime.now()})")
        url = f"https://api.exchange.coinbase.com/products/BTC-USD/candles"
        params = {
            'start': start_iso,
            'end': end_iso,
            'granularity': 60
        }
        print(f"[CANDLE FETCH] Fetching historical candles from {start_time} to {end_time}")
        response = requests.get(url, params=params)
        print(f"[CANDLE FETCH] HTTP status: {response.status_code}")
        if response.status_code == 200:
            candles_raw = response.json()
            print(f"[CANDLE FETCH] Received {len(candles_raw)} historical candles from REST API")
            if 60 not in candle_data:
                candle_data[60] = []
            for candle_raw in candles_raw:
                timestamp, low, high, open_price, close, volume = candle_raw
                candle_obj = {
                    'time': datetime.utcfromtimestamp(timestamp),
                    'open': float(open_price),
                    'high': float(high),
                    'low': float(low),
                    'close': float(close),
                    'volume': float(volume)
                }
                candle_data[60].append(candle_obj)
            candle_data[60].sort(key=lambda x: x['time'])
            if len(candle_data[60]) > 60:
                candle_data[60] = candle_data[60][-60:]
            print(f"[CANDLE FETCH] Stored {len(candle_data[60])} historical candles, from {candle_data[60][0]['time'] if candle_data[60] else 'N/A'} to {candle_data[60][-1]['time'] if candle_data[60] else 'N/A'}")
            # --- PUSH HISTORICAL CANDLES TO CHART ---
            if bitcoin_chart:
                for candle in candle_data[60]:
                    bitcoin_chart.update_chart_data(candle)
            return True, None
        else:
            error_msg = f"[CANDLE FETCH] Failed to fetch historical candles: HTTP {response.status_code} - {response.text}"
            print(error_msg)
            return False, error_msg
    except Exception as e:
        error_msg = f"[CANDLE FETCH] Error fetching historical candles: {e}"
        print(error_msg)
        return False, error_msg

def start_websocket(set_error=None):
    """Start WebSocket connection to Coinbase"""
    global ws_connection, current_price
    # Prevent multiple connections
    if ws_connection is not None and hasattr(ws_connection, 'sock') and ws_connection.sock and ws_connection.sock.connected:
        print("[DASH] WebSocket already running, not starting another.")
        return
    print("[DASH] Fetching historical candles to bootstrap dashboard...")
    ok, error_msg = fetch_historical_candles()
    if not ok:
        print(f"[DASH] Candle fetch failed: {error_msg}")
        if set_error:
            set_error(error_msg)
    # WebSocket message handler
    def on_message(ws, message):
        global current_price, previous_price, current_candle, candle_data
        try:
            data = json.loads(message)
            # Handle ticker data for live price
            if data.get('type') == 'ticker' and data.get('product_id') == 'BTC-USD':
                price = float(data.get('price', 0))
                if current_price > 0:
                    previous_price = current_price
                current_price = price
                print(f"Updated price: ${price:,.2f}")
                now_min = datetime.utcnow().replace(second=0, microsecond=0)
                if current_candle is None or current_candle['time'] != now_min:
                    if current_candle is not None:
                        if 60 not in candle_data:
                            candle_data[60] = []
                        candle_data[60].append(current_candle)
                        print(f"Completed candle saved: {current_candle['time']} - O:{current_candle['open']} H:{current_candle['high']} L:{current_candle['low']} C:{current_candle['close']}")
                        if len(candle_data[60]) > 60:
                            candle_data[60] = candle_data[60][-60:]
                            print(f"Trimmed to last 60 historical candles")
                        # --- PUSH COMPLETED CANDLE TO CHART ---
                        if bitcoin_chart:
                            bitcoin_chart.update_chart_data(current_candle)
                    current_candle = {
                        'time': now_min,
                        'open': price,
                        'high': price,
                        'low': price,
                        'close': price,
                        'volume': 0
                    }
                    print(f"Started new candle at {now_min}: ${price}")
                else:
                    current_candle['high'] = max(current_candle['high'], price)
                    current_candle['low'] = min(current_candle['low'], price)
                    current_candle['close'] = price
        except Exception as e:
            print(f"WebSocket message error: {e}")
    def on_open(ws):
        print("WebSocket connected")
        # Subscribe to Bitcoin ticker only (we get historical data from REST API)
        subscribe_msg = {
            "type": "subscribe",
            "product_ids": ["BTC-USD"],
            "channels": ["ticker"]
        }
        print("Subscribing to WebSocket ticker for live price updates")
        ws.send(json.dumps(subscribe_msg))
        print("WebSocket subscription message sent")
    
    def on_error(ws, error):
        print(f"WebSocket error: {error}")
    
    def on_close(ws, close_status_code, close_msg):
        print("WebSocket closed")

    try:
        ws_connection = websocket.WebSocketApp(
            "wss://ws-feed.exchange.coinbase.com",
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )
        
        # Run WebSocket in background thread
        def run_ws():
            if ws_connection is not None:
                ws_connection.run_forever()
        
        ws_thread = threading.Thread(target=run_ws, daemon=True)
        ws_thread.start()
        return True
    except Exception as e:
        print(f"Failed to start WebSocket: {e}")
        return False

# Start WebSocket when module loads
start_websocket()

# Get system performance info
perf_summary = get_system_performance_summary()
print(f"📊 Chart Performance Summary:")
print(f"   Tier: {perf_summary['performance_tier']}")
print(f"   Hardware Accelerated: {'Yes' if perf_summary['hardware_accelerated'] else 'No'}")
print(f"   Optimization Score: {perf_summary['optimization_score']}/100")

# Register chart callbacks
register_chart_callbacks('btc-chart', bitcoin_chart)

# Dashboard layout
layout = dbc.Container([
    dcc.Store(id='candle-fetch-error', data=None),
    dbc.Row([
        dbc.Col([
            html.H1([
                "🚀 Bitcoin Live Candlestick Dashboard",
                html.Span(id="live-price", className="ms-3 text-success")
            ], className="mb-2"),
        ], width=12)
    ]),
    # Error message display
    html.Div(id='error-message', style={'color': 'red', 'fontWeight': 'bold', 'marginBottom': '10px'}),
    dbc.Card([
        dbc.CardHeader([
            dbc.ButtonGroup([
                dbc.Button('1m', id='btn-1m', size='sm', color='primary'),
                dbc.Button('5m', id='btn-5m', size='sm', outline=True, color='primary'),
                dbc.Button('15m', id='btn-15m', size='sm', outline=True, color='primary'),
                dbc.Button('1h', id='btn-1h', size='sm', outline=True, color='primary'),
                dbc.Button('6h', id='btn-6h', size='sm', outline=True, color='primary'),
                dbc.Button('1d', id='btn-1d', size='sm', outline=True, color='primary'),
            ], className='float-start')
        ]),
        dbc.CardBody([
            bitcoin_chart.get_layout()
        ]),
        dbc.CardFooter(
            dbc.ButtonGroup([
                dbc.Button('6M', id='range-6m', size='sm', outline=True, color='primary'),
                dbc.Button('3M', id='range-3m', size='sm', outline=True, color='primary'),
                dbc.Button('1M', id='range-1m', size='sm', outline=True, color='primary'),
                dbc.Button('5D', id='range-5d', size='sm', outline=True, color='primary'),
                dbc.Button('1D', id='range-1d', size='sm', outline=True, color='primary'),
                dbc.Button('4H', id='range-4h', size='sm', outline=True, color='primary'),
                dbc.Button('1H', id='range-1h', size='sm', color='primary'),
            ], className='float-start')
        ),
    ]),
    dcc.Store(id='selected-timeframe', data=60),
    dcc.Store(id='selected-range', data='1H'),
    dcc.Store(id='recommended-timeframe', data=60),
    dcc.Interval(id="price-update", interval=100, n_intervals=0),
    dcc.Interval(id="chart-update", interval=200, n_intervals=0),  # Update chart 5 times per second
    dcc.Interval(id="candle-update", interval=100, n_intervals=0),
], fluid=True, className="p-4")

# Handle timeframe button clicks
@callback(
    [Output('selected-timeframe', 'data'),
     Output('btn-1m', 'outline'), Output('btn-5m', 'outline'), Output('btn-15m', 'outline'),
     Output('btn-1h', 'outline'), Output('btn-6h', 'outline'), Output('btn-1d', 'outline')],
    [Input('btn-1m', 'n_clicks'), Input('btn-5m', 'n_clicks'), Input('btn-15m', 'n_clicks'),
     Input('btn-1h', 'n_clicks'), Input('btn-6h', 'n_clicks'), Input('btn-1d', 'n_clicks'),
     Input('recommended-timeframe', 'data')]  # Add recommended timeframe as input
)
def update_timeframe(n1m, n5m, n15m, n1h, n6h, n1d, recommended_tf):
    """Update selected timeframe and button states based on button clicks or range recommendations"""
    ctx = dash.callback_context
    
    # Map timeframe buttons to timeframe values (in seconds)
    timeframe_map = {
        'btn-1m': 60, 'btn-5m': 300, 'btn-15m': 900,
        'btn-1h': 3600, 'btn-6h': 21600, 'btn-1d': 86400
    }
    
    # Check if this callback was triggered by a recommended timeframe
    if ctx.triggered and ctx.triggered[0]['prop_id'] == 'recommended-timeframe.data':
        if recommended_tf is not None:
            # Use the recommended timeframe
            selected_tf = recommended_tf
            
            # Map timeframe value back to index for button state
            timeframe_seconds_to_index = {60: 0, 300: 1, 900: 2, 3600: 3, 21600: 4, 86400: 5}
            if selected_tf in timeframe_seconds_to_index:
                outlines = [True, True, True, True, True, True]  # All outline by default
                outlines[timeframe_seconds_to_index[selected_tf]] = False  # Active button
                return selected_tf, *outlines
              # If not a recommended timeframe or no recommendation, check for button clicks
    if ctx.triggered and ctx.triggered[0]['prop_id'] != 'recommended-timeframe.data':
        # Get which button was clicked
        button_id = ctx.triggered[0]['prop_id'].split('.')[0]
        selected_tf = timeframe_map.get(button_id, 300)
        
        # Set outline states (True = outline/inactive, False = filled/active)
        outlines = [True, True, True, True, True, True]  # All outline by default
        active_index = list(timeframe_map.keys()).index(button_id) if button_id in timeframe_map else 1
        outlines[active_index] = False  # Make selected button filled/active
        
        return selected_tf, *outlines
        
    # Default case (initial load or fallback)
    return 60, False, True, True, True, True, True  # Default to 1m active

# Handle range button clicks
@callback(
    [Output('selected-range', 'data'),
     Output('range-6m', 'outline'), Output('range-3m', 'outline'), Output('range-1m', 'outline'),
     Output('range-5d', 'outline'), Output('range-1d', 'outline'), Output('range-4h', 'outline'),
     Output('range-1h', 'outline'),
     Output('recommended-timeframe', 'data')],  # Output a recommended timeframe instead of directly setting it
    [Input('range-6m', 'n_clicks'), Input('range-3m', 'n_clicks'), Input('range-1m', 'n_clicks'),
     Input('range-5d', 'n_clicks'), Input('range-1d', 'n_clicks'), Input('range-4h', 'n_clicks'),
     Input('range-1h', 'n_clicks')]
)
def update_range(n6m, n3m, n1m, n5d, n1d, n4h, n1h):
    """Update selected range and button states"""
    ctx = dash.callback_context
    if not ctx.triggered:
        # Default: 1H range active, recommend 1m timeframe (60)
        return '1H', True, True, True, True, True, True, False, 60
    
    # Get which button was clicked
    button_id = ctx.triggered[0]['prop_id'].split('.')[0]
    
    # Map button to range
    range_map = {
        'range-6m': '6M', 'range-3m': '3M', 'range-1m': '1M',
        'range-5d': '5D', 'range-1d': '1D', 'range-4h': '4H',
        'range-1h': '1H'
    }
    
    selected_range = range_map.get(button_id, '1H')
    
    # Set range button outline states (True = outline/inactive, False = filled/active)
    range_outlines = [True, True, True, True, True, True, True]  # All outline by default
    active_index = list(range_map.keys()).index(button_id) if button_id in range_map else 6
    range_outlines[active_index] = False  # Make selected button filled/active
    
    # Recommended timeframe based on range
    recommended_timeframe = None  # Default: don't change the timeframe
    
    # Special case for 1H range - recommend 1m timeframe
    if button_id == 'range-1h':
        recommended_timeframe = 60  # 1m timeframe
    
    # Special case for 4H range - recommend 5m
    elif button_id == 'range-4h':
        recommended_timeframe = 300  # 5m timeframe
        
    # Special case for 1D range - recommend 15m
    elif button_id == 'range-1d':
        recommended_timeframe = 900  # 15m timeframe
    
    return (
        selected_range, 
        *range_outlines,
        recommended_timeframe
    )

# Update live price display
@callback(
    [Output('live-price', 'children'), Output('live-price', 'className')],
    Input('price-update', 'n_intervals')
)
def update_live_price(n):
    global current_price, previous_price
    # Default parent classes: margin and fallback text color
    default_class = "ms-3 text-muted"
    if current_price > 0:
        # Choose CSS class based on actual price movement
        if previous_price > 0:
            if current_price > previous_price:
                color_class = "price-bullish"  # green for price up
            elif current_price < previous_price:
                color_class = "price-bearish"  # red for price down
            else:
                color_class = "text-muted"  # gray for no change
        else:
            color_class = "text-muted"  # gray when no previous price
        # Update both displayed text and className of the span
        return f"${current_price:,.2f}", f"ms-3 {color_class}"
    # If not connected yet
    return "Connecting...", default_class

# High-frequency real-time price streaming
# Update accelerated chart with WebSocket data
@callback(
    Output('btc-chart-data-store', 'data'),
    Input('candle-update', 'n_intervals'),
    prevent_initial_call=True
)
def update_accelerated_chart(n):
    global current_price, current_candle
    
    # Update chart with latest price
    if current_price > 0:
        bitcoin_chart.update_price(current_price)
    
    # Update current candle if available
    if current_candle:
        bitcoin_chart.update_current_candle(current_candle)
    
    return {'updated': True}  # Trigger chart refresh

# Update error message display
@callback(
    Output('error-message', 'children'),
    Input('candle-fetch-error', 'data')
)
def display_error_message(error_data):
    if error_data:
        return error_data
    return ""

# WebSocket is already started when module loads (line 194)
# This callback was causing multiple connection attempts - removed