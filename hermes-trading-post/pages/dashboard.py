"""
Bitcoin WebSocket Dashboard with High-Performance Chart Acceleration
Automatically selects best rendering method: GPU (0.1-0.5ms) or CPU-optimized (10-50ms)
"""
import dash
from dash import html, dcc, Input, Output, State, callback
import dash_bootstrap_components as dbc
from datetime import datetime, timedelta, timezone
import websocket
import json
import threading
import time
from typing import Any, Optional, Union
import redis
import logging

# Configure logging
logger = logging.getLogger(__name__)

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
    print(f"🚀 Chart Acceleration Ready - Performance Tier: {capabilities.performance_tier}, Expected Latency: {capabilities.estimated_chart_latency_ms:.2f}ms")
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

# --- Redis client for real-time candle sharing ---
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def get_latest_candle():
    try:
        data = redis_client.get('latest_candle')
        if data:
            # Defensive: ensure data is a string and not a coroutine/awaitable
            if not isinstance(data, str):
                # If it's awaitable, skip or log error
                if hasattr(data, '__await__'):
                    logger.error("[REDIS] Received awaitable from redis_client.get, skipping.")
                    return None
                # If it's bytes, decode
                if isinstance(data, bytes):
                    data = data.decode('utf-8')
                else:
                    data = str(data)
            import json
            from datetime import datetime
            candle = json.loads(data)
            # Convert 'time' from ISO string to datetime object if needed
            if candle and 'time' in candle and isinstance(candle['time'], str):
                try:
                    candle['time'] = datetime.fromisoformat(candle['time'])
                except Exception as e:
                    logger.debug(f"[REDIS] Error parsing candle time: {e}")
                    candle['time'] = None
            return candle
    except Exception as e:
        logger.error(f"[REDIS] Error reading latest candle: {e}")
        return None

# --- WebSocket data storage ---
# Only one WebSocket feed should be active for live price/candle data.
# Reduce console logs to only essential info and errors.

# WebSocket data storage
current_price = 0
previous_price = 0  # Track previous price
initial_price_set = False  # Track if we've set the initial price
ws_connection = None
current_candle = None  # Current forming candle
candle_data = {}  # Store candles by timeframe: {timeframe_seconds: [candles...]}

# WebSocket reconnection state
ws_reconnect_attempts = 0
ws_max_reconnect_attempts = 10
ws_reconnect_delay = 1.0  # Start with 1 second delay
ws_is_reconnecting = False
ws_connection_lock = threading.Lock()

# Initialize accelerated chart early so it's available for websocket functions
# Set to 60fps for real-time price updates
bitcoin_chart = None

def get_bitcoin_chart():
    """Get or create the bitcoin chart singleton"""
    global bitcoin_chart
    if bitcoin_chart is None:
        logger.debug("[CHART SINGLETON] Creating new AcceleratedChartComponent instance")
        bitcoin_chart = create_bitcoin_chart(chart_id="btc-chart", width=1400, height=600)
        bitcoin_chart.target_fps = 60  # Target 60fps for smooth realtime updates
    else:
        logger.debug("[CHART SINGLETON] Returning existing AcceleratedChartComponent instance")
    return bitcoin_chart

# Health check for chart process
import threading

def chart_health_check():
    chart = get_bitcoin_chart()
    try:
        # If the chart process has an 'is_alive' or similar, check it
        if hasattr(chart, 'chart') and hasattr(chart.chart, 'is_alive'):
            is_alive = getattr(chart.chart, 'is_alive', None)
            if callable(is_alive):
                if not is_alive():
                    logger.warning("[CHART HEALTH] Chart process not alive, restarting...")
                    # Re-create the chart instance
                    global bitcoin_chart
                    bitcoin_chart = None
                    get_bitcoin_chart()
        # Optionally, add more checks here
    except Exception as e:
        logger.error(f"[CHART HEALTH] Error during health check: {e}")
    # Schedule next check
    threading.Timer(10.0, chart_health_check).start()  # Check every 10 seconds

# Start health check on module load
chart_health_check()

def fetch_historical_candles():
    """Fetch initial historical candles via REST API to bootstrap the dashboard"""
    global candle_data
    try:
        import requests
        from datetime import datetime, timedelta, timezone
        end_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        start_time = end_time - timedelta(minutes=60)
        start_time = start_time.astimezone(timezone.utc)  # Ensure UTC timezone
        start_iso = start_time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        end_iso = end_time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        logger.debug(f"[CANDLE FETCH] Requesting candles from {start_time} UTC to {end_time} UTC")
        url = f"https://api.exchange.coinbase.com/products/BTC-USD/candles"
        params = {
            'start': start_iso,
            'end': end_iso,
            'granularity': 60
        }
        logger.info(f"[CANDLE FETCH] Fetching historical candles")
        response = requests.get(url, params=params)
        logger.debug(f"[CANDLE FETCH] HTTP status: {response.status_code}")
        if response.status_code == 200:
            candles_raw = response.json()
            logger.info(f"[CANDLE FETCH] Received {len(candles_raw)} historical candles")
            if 60 not in candle_data:
                candle_data[60] = []
            for candle_raw in candles_raw:
                timestamp, low, high, open_price, close, volume = candle_raw
                candle_obj = {
                    'time': datetime.fromtimestamp(timestamp, timezone.utc),
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
            logger.debug(f"[CANDLE FETCH] Stored {len(candle_data[60])} historical candles")
            # --- PUSH HISTORICAL CANDLES TO CHART ---
            chart = get_bitcoin_chart()
            if chart:
                logger.debug(f"[CANDLE FETCH] Pushing {len(candle_data[60])} historical candles to chart")
                # Add a small delay between candles to avoid overwhelming the queue
                for i, candle in enumerate(candle_data[60]):
                    chart.add_candle(candle)
                    if i % 10 == 0:  # Small delay every 10 candles
                        time.sleep(0.01)
                logger.debug(f"[CANDLE FETCH] Historical candles pushed to chart")
                # Trigger an initial render after loading historical data
                chart_obj = getattr(chart, 'chart', None)
                if chart_obj is not None:
                    render_sync = getattr(chart_obj, 'render_sync', None)
                    if callable(render_sync):
                        render_sync(timeout=2.0)  # Increased timeout for rendering
                    else:
                        logger.debug("[CHART] render_sync not available on chart.chart")
            return True, None
        else:
            error_msg = f"[CANDLE FETCH] Failed to fetch historical candles: HTTP {response.status_code} - {response.text}"
            logger.error(error_msg)
            return False, error_msg
    except Exception as e:
        error_msg = f"[CANDLE FETCH] Error fetching historical candles: {e}"
        logger.error(error_msg)
        return False, error_msg

def reconnect_websocket():
    """Attempt to reconnect WebSocket with exponential backoff"""
    global ws_reconnect_attempts, ws_reconnect_delay, ws_is_reconnecting, ws_connection
    
    with ws_connection_lock:
        # Check if already reconnecting
        if ws_is_reconnecting:
            logger.debug("[WEBSOCKET] Already attempting to reconnect, skipping...")
            return
        
        # Check if max attempts reached
        if ws_reconnect_attempts >= ws_max_reconnect_attempts:
            logger.warning(f"[WEBSOCKET] Max reconnection attempts ({ws_max_reconnect_attempts}) reached. Giving up.")
            return
        
        ws_is_reconnecting = True
    
    # Clean up existing connection
    if ws_connection:
        try:
            ws_connection.close()
        except:
            pass
        ws_connection = None
    
    # Calculate delay with exponential backoff
    delay = min(ws_reconnect_delay * (2 ** ws_reconnect_attempts), 30.0)  # Cap at 30 seconds
    ws_reconnect_attempts += 1
    
    logger.info(f"[WEBSOCKET] Reconnection attempt {ws_reconnect_attempts}/{ws_max_reconnect_attempts} in {delay:.1f} seconds...")
    
    # Schedule reconnection
    def delayed_reconnect():
        time.sleep(delay)
        with ws_connection_lock:
            ws_is_reconnecting = False
        logger.info(f"[WEBSOCKET] Attempting reconnection (attempt {ws_reconnect_attempts})...")
        start_websocket()
    
    reconnect_thread = threading.Thread(target=delayed_reconnect, daemon=True)
    reconnect_thread.start()

def start_websocket(set_error=None):
    """Start WebSocket connection to Coinbase (single instance only)"""
    global ws_connection, current_price, ws_reconnect_attempts, ws_reconnect_delay
    if ws_connection is not None and hasattr(ws_connection, 'sock') and ws_connection.sock and ws_connection.sock.connected:
        # Only log once if already running
        logger.debug("[DASH] WebSocket already running.")
        return
    logger.info("[DASH] Fetching historical candles to bootstrap dashboard...")
    ok, error_msg = fetch_historical_candles()
    if not ok:
        logger.error(f"[DASH] Candle fetch failed: {error_msg}")
        if set_error:
            set_error(error_msg)
    # WebSocket message handler
    def on_message(ws, message):
        global current_price, previous_price, current_candle, candle_data, initial_price_set
        try:
            data = json.loads(message)
            # Handle ticker data for live price
            if data.get('type') == 'ticker' and data.get('product_id') == 'BTC-USD':
                price = float(data.get('price', 0))
                if current_price > 0:
                    previous_price = current_price
                current_price = price
                
                # Ensure chart gets initial price immediately
                if not initial_price_set and price > 0:
                    initial_price_set = True
                    chart = get_bitcoin_chart()
                    if chart:
                        chart.update_price(price)
                        chart_obj = getattr(chart, 'chart', None)
                        if chart_obj is not None:
                            render_sync = getattr(chart_obj, 'render_sync', None)
                            if callable(render_sync):
                                render_sync(timeout=1.0)  # Increased timeout for initial price
                            else:
                                logger.debug("[CHART] render_sync not available on chart.chart")
                # print(f"Updated price: ${price:,.2f}")
                now_min = datetime.now(timezone.utc).replace(second=0, microsecond=0)
                if current_candle is None or current_candle['time'] != now_min:
                    if current_candle is not None:
                        if 60 not in candle_data:
                            candle_data[60] = []
                        candle_data[60].append(current_candle)
                        logger.debug(f"Completed candle saved: {current_candle['time']} - O:{current_candle['open']} H:{current_candle['high']} L:{current_candle['low']} C:{current_candle['close']}")
                        if len(candle_data[60]) > 60:
                            candle_data[60] = candle_data[60][-60:]
                            logger.debug(f"Trimmed to last 60 historical candles")
                        # --- PUSH COMPLETED CANDLE TO CHART ---
                        chart = get_bitcoin_chart()
                        if chart:
                            chart.add_candle(current_candle)
                    current_candle = {
                        'time': now_min,
                        'open': price,
                        'high': price,
                        'low': price,
                        'close': price,
                        'volume': 0
                    }
                    logger.debug(f"Started new candle at {now_min}: ${price}")
                else:
                    current_candle['high'] = max(current_candle['high'], price)
                    current_candle['low'] = min(current_candle['low'], price)
                    current_candle['close'] = price
                    # Update current candle in real-time on every price tick
                    chart = get_bitcoin_chart()
                    if chart:
                        try:
                            chart.update_current_candle(current_candle)
                            # Force a render after candle update
                            if hasattr(chart.chart, 'render_async'):
                                render_async = getattr(chart.chart, 'render_async', None)
                                if callable(render_async):
                                    render_async()
                                else:
                                    logger.debug("[CHART] render_async not available on chart.chart")
                        except Exception as e:
                            logger.error(f"Error updating current candle: {e}")
                # --- Write current candle to Redis for real-time UI updates ---
                try:
                    # Serialize datetime to ISO string for Redis
                    candle_for_redis = dict(current_candle)
                    if isinstance(candle_for_redis['time'], datetime):
                        candle_for_redis['time'] = candle_for_redis['time'].isoformat()
                    redis_client.set('latest_candle', json.dumps(candle_for_redis))
                except Exception as e:
                    print(f"[REDIS] Error writing current candle: {e}")
                # Update real-time price line on every tick
                chart = get_bitcoin_chart()
                if chart:
                    try:
                        if hasattr(chart.chart, 'set_price_tag_value'):
                            chart.chart.set_price_tag_value(price)
                        else:
                            chart.update_price(price)
                        # Only call render_sync if structure changes (not every price update)
                    except Exception as e:
                        print(f"Error updating price: {e}")
        except Exception as e:
            logger.error(f"WebSocket message error: {e}")
    def on_open(ws):
        global ws_reconnect_attempts, ws_reconnect_delay
        print("[WEBSOCKET] Connected.")
        
        # Reset reconnection state on successful connection
        ws_reconnect_attempts = 0
        ws_reconnect_delay = 1.0
        
        # Subscribe to Bitcoin ticker only (we get historical data from REST API)
        subscribe_msg = {
            "type": "subscribe",
            "product_ids": ["BTC-USD"],
            "channels": ["ticker"]
        }
        ws.send(json.dumps(subscribe_msg))
    
    def on_error(ws, error):
        logger.error(f"WebSocket error: {error}")
        # Trigger reconnection on error
        reconnect_websocket()
    
    def on_close(ws, close_status_code, close_msg):
        logger.info(f"WebSocket closed: {close_status_code}, {close_msg}")
        # Trigger reconnection on close
        reconnect_websocket()

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
            global ws_connection
            try:
                if ws_connection is not None:
                    ws_connection.run_forever()
            except Exception as e:
                logger.error(f"[WEBSOCKET] Error in WebSocket thread: {e}")
                # Trigger reconnection on thread error
                reconnect_websocket()
        
        ws_thread = threading.Thread(target=run_ws, daemon=True, name="WebSocket-Thread")
        ws_thread.start()
        logger.info(f"[WEBSOCKET] WebSocket thread started.")
        return True
    except Exception as e:
        logger.error(f"[WEBSOCKET] Failed to start WebSocket: {e}")
        # Attempt reconnection on startup failure
        reconnect_websocket()
        return False

# Start WebSocket immediately when dashboard loads
logger.info("[DASH] Starting WebSocket on module load...")
start_websocket()

# Get system performance info
perf_summary = get_system_performance_summary()
print(f"📊 Chart Performance Summary:")
print(f"   Tier: {perf_summary['performance_tier']}")
print(f"   Hardware Accelerated: {'Yes' if perf_summary['hardware_accelerated'] else 'No'}")
print(f"   Optimization Score: {perf_summary['optimization_score']}/100")

# Register chart callbacks
_chart_callbacks_registered = False
def register_callbacks():
    """Register callbacks for the chart (only once)"""
    global _chart_callbacks_registered
    if _chart_callbacks_registered:
        print("[DASHBOARD] Chart callbacks already registered, skipping.")
        return
    chart = get_bitcoin_chart()
    register_chart_callbacks('btc-chart', chart)
    _chart_callbacks_registered = True

# Dashboard layout
layout = dbc.Container([
    dcc.Store(id='candle-fetch-error', data=None),
    dcc.Store(id='websocket-started', data=False),
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
            get_bitcoin_chart().get_layout()
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
    dcc.Store(id='btc-chart-data-store', data=None),
    dcc.Interval(id="price-update", interval=250, n_intervals=0),  # 4fps for price updates
    dcc.Interval(id="chart-update", interval=250, n_intervals=0),  # 4fps for chart updates
    dcc.Interval(id="candle-update", interval=500, n_intervals=0),  # 1fps for candle updates
], fluid=True, className="p-4")

# Remove any duplicate price label from the layout (e.g., at the bottom or outside the chart)

# Add/repair live price update callback for the header
@callback(
    Output('live-price', 'children'),
    Input('price-update', 'n_intervals')
)
def update_live_price(n):
    # Removed debug print for performance
    if current_price > 0:
        return f"Live BTC-USD Price: ${current_price:,.2f}"
    return "Live BTC-USD Price: --"

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
    
    # Defensive: Only call set_max_visible_candles if bitcoin_chart is not None
    chart = bitcoin_chart if bitcoin_chart is not None else get_bitcoin_chart()
    
    # Special case for 1H range - recommend 1m timeframe
    if button_id == 'range-1h':
        recommended_timeframe = 60  # 1m timeframe
        if chart is not None and hasattr(chart, 'set_max_visible_candles'):
            chart.set_max_visible_candles(60)  # 60 1-minute candles
    # Special case for 4H range - recommend 5m
    elif button_id == 'range-4h':
        recommended_timeframe = 300  # 5m timeframe
        if chart is not None and hasattr(chart, 'set_max_visible_candles'):
            chart.set_max_visible_candles(48)  # 48 5-minute candles
    # Special case for 1D range - recommend 15m
    elif button_id == 'range-1d':
        recommended_timeframe = 900  # 15m timeframe
        if chart is not None and hasattr(chart, 'set_max_visible_candles'):
            chart.set_max_visible_candles(96)  # 96 15-minute candles
    # Special case for 5D range
    elif button_id == 'range-5d':
        if chart is not None and hasattr(chart, 'set_max_visible_candles'):
            chart.set_max_visible_candles(120)  # Adjust as needed
    # Special case for 1M range
    elif button_id == 'range-1m':
        if chart is not None and hasattr(chart, 'set_max_visible_candles'):
            chart.set_max_visible_candles(200)  # Adjust as needed
    
    return (
        selected_range, 
        *range_outlines,
        recommended_timeframe
    )

# Restore the callback to update btc-chart-data-store
@callback(
    Output('btc-chart-data-store', 'data'),
    Input('candle-update', 'n_intervals'),
    prevent_initial_call=False
)
def update_accelerated_chart(n):
    global current_price, current_candle
    chart = get_bitcoin_chart()
    # Always update current candle and price, even if not a new minute
    if current_candle:
        if hasattr(chart, 'update_current_candle'):
            chart.update_current_candle(current_candle)
    if current_price > 0:
        if hasattr(chart, 'update_price'):
            chart.update_price(current_price)
    # Always force update with a new timestamp to trigger chart re-render
    return {
        'updated': True,
        'timestamp': time.time(),
        'price': current_price,
        'n_intervals': n,
        'has_candle': current_candle is not None
    }

# Update error message display
@callback(
    Output('error-message', 'children'),
    Input('candle-fetch-error', 'data')
)
def display_error_message(error_data):
    if error_data:
        return error_data
    return ""

# WebSocket is already started when module loads
# This callback was causing multiple connection attempts - removed

# Chart callbacks are registered via register_chart_callbacks function
try:
    register_callbacks()
    print("[DASHBOARD] Chart callbacks registered successfully")
except Exception as e:
    print(f"[DASHBOARD] Error registering callbacks: {e}")

# Ensure all Redis candle serialization is safe (datetime to ISO string)
# (Already handled in on_message, but double-check any other Redis publish/set for candles)