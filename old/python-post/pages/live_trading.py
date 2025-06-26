"""
Live Trading Page - Real-time Paper Trading
Live crypto paper trading with Coinbase WebSocket integration
"""

import dash
from dash import html, dcc, callback, Input, Output, State
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
from datetime import datetime, timedelta
import pandas as pd

# Register this page with Dash
dash.register_page(__name__, path="/live-trading", title="Live Trading", name="Live Trading", order=4)

def create_trading_status_card():
    """Create trading status and controls card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("🎯 Live Trading Status", className="mb-0"),
            dbc.Badge("Paper Trading", color="warning", className="ms-2")
        ]),
        dbc.CardBody([
            dbc.Row([
                dbc.Col([
                    dbc.Button(
                        "🟢 Start Trading",
                        id="start-trading-btn",
                        color="success",
                        size="lg",
                        className="w-100"
                    )
                ], width=6),
                dbc.Col([
                    dbc.Button(
                        "🔴 Stop Trading",
                        id="stop-trading-btn",
                        color="danger",
                        size="lg",
                        className="w-100",
                        disabled=True
                    )
                ], width=6)
            ], className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    html.H6("Trading Mode", className="text-muted mb-1"),
                    dbc.ButtonGroup([
                        dbc.Button("Paper", color="warning", size="sm", active=True),
                        dbc.Button("Live", color="danger", size="sm", disabled=True)
                    ])
                ], width=6),
                dbc.Col([
                    html.H6("Auto-Trading", className="text-muted mb-1"),
                    dbc.Switch(
                        id="auto-trading-switch",
                        label="Enable Auto-Trading",
                        value=False
                    )
                ], width=6)
            ], className="mb-3"),
            
            html.Hr(),
            
            dbc.Row([
                dbc.Col([
                    html.P("Status", className="text-muted mb-1"),
                    html.H5("Idle", id="trading-status", className="text-secondary mb-0")
                ], width=4),
                dbc.Col([
                    html.P("Active Orders", className="text-muted mb-1"),
                    html.H5("0", id="active-orders-count", className="text-info mb-0")
                ], width=4),
                dbc.Col([
                    html.P("Today's Trades", className="text-muted mb-1"),
                    html.H5("0", id="todays-trades-count", className="text-primary mb-0")
                ], width=4)
            ])
        ])
    ], className="mb-4")

def create_live_chart_card():
    """Create real-time trading chart card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("📊 Live Market Chart", className="mb-0"),
            dbc.ButtonGroup([
                dbc.Button("1m", size="sm", outline=True, color="primary", active=True),
                dbc.Button("5m", size="sm", outline=True, color="primary"),
                dbc.Button("15m", size="sm", outline=True, color="primary"),
                dbc.Button("1h", size="sm", outline=True, color="primary"),
            ], className="ms-auto")
        ]),
        dbc.CardBody([
            dbc.Row([
                dbc.Col([
                    dcc.Dropdown(
                        id="live-chart-symbol",
                        options=[
                            {"label": "BTC-USD", "value": "BTC-USD"},
                            {"label": "ETH-USD", "value": "ETH-USD"},
                            {"label": "SOL-USD", "value": "SOL-USD"},
                            {"label": "ADA-USD", "value": "ADA-USD"},
                        ],
                        value="BTC-USD"
                    )
                ], width=4),
                dbc.Col([
                    html.Div([
                        html.Span("Current Price: ", className="text-muted"),
                        html.Span("$45,123.45", id="current-price", className="fw-bold text-success")
                    ])
                ], width=4),
                dbc.Col([
                    html.Div([
                        html.Span("24h Change: ", className="text-muted"),
                        html.Span("+2.34%", id="price-change", className="text-success")
                    ])
                ], width=4)
            ], className="mb-3"),
            
            dcc.Graph(
                id="live-trading-chart",
                style={"height": "600px"}
            )
        ])
    ], className="mb-4")

def create_order_book_card():
    """Create live order book card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("📖 Order Book", className="mb-0"),
            dbc.Badge("Live", color="success", className="ms-2")
        ]),
        dbc.CardBody([
            html.Div(id="order-book-content")
        ])
    ], className="mb-4")

def create_active_orders_card():
    """Create active orders management card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("📋 Active Orders", className="mb-0")
        ]),
        dbc.CardBody([
            html.Div(id="active-orders-content", children=[
                html.P("No active orders", className="text-muted text-center py-3")
            ])
        ])
    ], className="mb-4")

def create_quick_trade_card():
    """Create quick trade execution card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("⚡ Quick Trade", className="mb-0")
        ]),
        dbc.CardBody([
            dbc.Row([
                dbc.Col([
                    dbc.Label("Symbol"),
                    dcc.Dropdown(
                        id="quick-trade-symbol",
                        options=[
                            {"label": "BTC-USD", "value": "BTC-USD"},
                            {"label": "ETH-USD", "value": "ETH-USD"},
                            {"label": "SOL-USD", "value": "SOL-USD"},
                        ],
                        value="BTC-USD"
                    )
                ], width=12, className="mb-3")
            ]),
            
            dbc.Row([
                dbc.Col([
                    dbc.Label("Order Type"),
                    dbc.RadioItems(
                        id="quick-order-type",
                        options=[
                            {"label": "Market", "value": "market"},
                            {"label": "Limit", "value": "limit"},
                        ],
                        value="market",
                        inline=True
                    )
                ], width=12, className="mb-3")
            ]),
            
            dbc.Row([
                dbc.Col([
                    dbc.Label("Quantity"),
                    dbc.InputGroup([
                        dbc.Input(id="quick-quantity", type="number", value=0.01, step=0.001),
                        dbc.InputGroupText("BTC")
                    ])
                ], width=6),
                dbc.Col([
                    dbc.Label("Price (if limit)"),
                    dbc.InputGroup([
                        dbc.Input(id="quick-price", type="number", placeholder="Market"),
                        dbc.InputGroupText("USD")
                    ])
                ], width=6)
            ], className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    dbc.Label("Stop Loss %"),
                    dbc.Input(id="quick-stop-loss", type="number", value=2.0, step=0.1)
                ], width=6),
                dbc.Col([
                    dbc.Label("Take Profit %"),
                    dbc.Input(id="quick-take-profit", type="number", value=3.0, step=0.1)
                ], width=6)
            ], className="mb-4"),
            
            dbc.Row([
                dbc.Col([
                    dbc.Button(
                        "🟢 Buy",
                        id="quick-buy-btn",
                        color="success",
                        size="lg",
                        className="w-100"
                    )
                ], width=6),
                dbc.Col([
                    dbc.Button(
                        "🔴 Sell",
                        id="quick-sell-btn",
                        color="danger",
                        size="lg",
                        className="w-100"
                    )
                ], width=6)
            ])
        ])
    ], className="mb-4")

def create_trade_history_card():
    """Create trade history card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("📈 Today's Trades", className="mb-0")
        ]),
        dbc.CardBody([
            html.Div(id="trade-history-content")
        ])
    ], className="mb-4")

# Main layout for the live trading page
layout = dbc.Container([
    # Page header
    dbc.Row([
        dbc.Col([
            html.H1("⚡ Live Trading", className="mb-0"),
            html.P("Real-time crypto paper trading with Coinbase Advanced Trade API", className="text-muted")
        ], width=8),
        dbc.Col([
            html.Div([
                html.P("Market Status", className="text-muted mb-0"),
                html.P([
                    dbc.Badge("🟢 OPEN", color="success"),
                    html.Span(" | "),
                    html.Span(id="market-time")
                ], className="fw-bold mb-0")
            ], className="text-end")
        ], width=4)
    ], className="mb-4"),
    
    # Trading status row
    dbc.Row([
        dbc.Col([
            create_trading_status_card()
        ], width=12)
    ]),
    
    # Main trading interface
    dbc.Row([
        # Chart and order book
        dbc.Col([
            create_live_chart_card(),
            create_order_book_card()
        ], width=8),
        
        # Trading controls and info
        dbc.Col([
            create_quick_trade_card(),
            create_active_orders_card(),
            create_trade_history_card()
        ], width=4)
    ])
], fluid=True)

# Callbacks for live trading functionality

@callback(
    Output('market-time', 'children'),
    Input('global-interval', 'n_intervals')
)
def update_market_time(n_intervals):
    """Update market time display"""
    return datetime.now().strftime("%H:%M:%S UTC")

@callback(
    [Output('current-price', 'children'),
     Output('price-change', 'children'),
     Output('price-change', 'className')],
    [Input('live-chart-symbol', 'value'),
     Input('global-interval', 'n_intervals')]
)
def update_current_price(symbol, n_intervals):
    """Update current price and 24h change"""
    # TODO: Get real-time price from Coinbase WebSocket
    # For now, simulate price updates
    
    base_prices = {
        'BTC-USD': 45000,
        'ETH-USD': 3000,
        'SOL-USD': 100,
        'ADA-USD': 0.5
    }
    
    base_price = base_prices.get(symbol, 45000)
    # Simulate price movement
    price_offset = (hash(str(datetime.now().second)) % 1000 - 500)
    current_price = base_price + price_offset
    
    # Simulate 24h change
    change_percent = (hash(str(datetime.now().minute)) % 1000 - 500) / 100
    change_class = "text-success" if change_percent >= 0 else "text-danger"
    change_sign = "+" if change_percent >= 0 else ""
    
    return f"${current_price:,.2f}", f"{change_sign}{change_percent:.2f}%", change_class

@callback(
    [Output('start-trading-btn', 'disabled'),
     Output('stop-trading-btn', 'disabled'),
     Output('trading-status', 'children'),
     Output('trading-status', 'className')],
    [Input('start-trading-btn', 'n_clicks'),
     Input('stop-trading-btn', 'n_clicks')],
    prevent_initial_call=True
)
def toggle_trading_status(start_clicks, stop_clicks):
    """Toggle trading status between active and idle"""
    ctx = dash.callback_context
    if not ctx.triggered:
        return False, True, "Idle", "text-secondary"
    
    button_id = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if button_id == 'start-trading-btn':
        return True, False, "Active", "text-success"
    else:  # stop button
        return False, True, "Stopped", "text-danger"

@callback(
    Output('live-trading-chart', 'figure'),
    [Input('live-chart-symbol', 'value'),
     Input('global-interval', 'n_intervals')]
)
def update_live_chart(symbol, n_intervals):
    """Update live trading chart with real-time data"""
    # TODO: Connect to Coinbase WebSocket for real-time candlestick data
    # For now, generate simulated real-time data
    
    # Generate recent data (last 100 1-minute candles)
    now = datetime.now()
    dates = [now - timedelta(minutes=i) for i in range(100, 0, -1)]
    
    base_prices = {
        'BTC-USD': 45000,
        'ETH-USD': 3000,
        'SOL-USD': 100,
        'ADA-USD': 0.5
    }
    
    base_price = base_prices.get(symbol, 45000)
    
    # Generate OHLCV data
    data = []
    for i, date in enumerate(dates):
        price_factor = 1 + (hash(str(date)) % 200 - 100) / 10000  # Small price movements
        open_price = base_price * price_factor
        close_price = open_price * (1 + (hash(str(date + timedelta(seconds=30))) % 100 - 50) / 10000)
        high_price = max(open_price, close_price) * (1 + hash(str(date + timedelta(seconds=15))) % 50 / 20000)
        low_price = min(open_price, close_price) * (1 - hash(str(date + timedelta(seconds=45))) % 50 / 20000)
        volume = hash(str(date)) % 1000 + 100
        
        data.append({
            'Date': date,
            'Open': open_price,
            'High': high_price,
            'Low': low_price,
            'Close': close_price,
            'Volume': volume
        })
    
    df = pd.DataFrame(data)
    
    # Create candlestick chart
    fig = go.Figure()
    
    # Add candlestick trace
    fig.add_trace(go.Candlestick(
        x=df['Date'],
        open=df['Open'],
        high=df['High'],
        low=df['Low'],
        close=df['Close'],
        name=symbol,
        increasing_line_color='green',
        decreasing_line_color='red'
    ))
    
    # Add volume bar chart
    fig.add_trace(go.Bar(
        x=df['Date'],
        y=df['Volume'],
        name='Volume',
        yaxis='y2',
        opacity=0.3,
        marker_color='blue'
    ))
    
    # Update layout for dual y-axis
    fig.update_layout(
        title=f"{symbol} - Live 1-Minute Chart",
        yaxis=dict(title="Price (USD)", side="left"),
        yaxis2=dict(title="Volume", side="right", overlaying="y", showgrid=False),
        xaxis_title="Time",
        height=600,
        showlegend=False,
        xaxis_rangeslider_visible=False
    )
    
    return fig

@callback(
    Output('order-book-content', 'children'),
    [Input('live-chart-symbol', 'value'),
     Input('global-interval', 'n_intervals')]
)
def update_order_book(symbol, n_intervals):
    """Update live order book data"""
    # TODO: Connect to Coinbase WebSocket for real-time order book
    # For now, generate simulated order book data
    
    base_price = 45000 if symbol == 'BTC-USD' else 3000
    
    # Generate asks (sell orders) - above current price
    asks = []
    for i in range(10):
        price = base_price + (i + 1) * 10
        size = (hash(f"ask_{i}_{n_intervals}") % 500 + 100) / 1000
        asks.append({'price': price, 'size': size})
    
    # Generate bids (buy orders) - below current price
    bids = []
    for i in range(10):
        price = base_price - (i + 1) * 10
        size = (hash(f"bid_{i}_{n_intervals}") % 500 + 100) / 1000
        bids.append({'price': price, 'size': size})
    
    # Create order book table
    order_book_table = html.Div([
        # Asks (sells)
        html.Div([
            html.H6("Asks", className="text-danger mb-2"),
            dbc.Table([
                html.Thead([
                    html.Tr([
                        html.Th("Price", className="text-end"),
                        html.Th("Size", className="text-end"),
                        html.Th("Total", className="text-end")
                    ])
                ]),
                html.Tbody([
                    html.Tr([
                        html.Td(f"${ask['price']:,.2f}", className="text-end text-danger"),
                        html.Td(f"{ask['size']:.3f}", className="text-end"),
                        html.Td(f"${ask['price'] * ask['size']:,.2f}", className="text-end")
                    ]) for ask in reversed(asks[:5])  # Show top 5 asks
                ])
            ], size="sm", className="mb-2")
        ]),
        
        # Current price
        html.Div([
            html.H5(f"${base_price:,.2f}", className="text-center text-primary mb-2 p-2 bg-light rounded")
        ]),
        
        # Bids (buys)
        html.Div([
            html.H6("Bids", className="text-success mb-2"),
            dbc.Table([
                html.Thead([
                    html.Tr([
                        html.Th("Price", className="text-end"),
                        html.Th("Size", className="text-end"),
                        html.Th("Total", className="text-end")
                    ])
                ]),
                html.Tbody([
                    html.Tr([
                        html.Td(f"${bid['price']:,.2f}", className="text-end text-success"),
                        html.Td(f"{bid['size']:.3f}", className="text-end"),
                        html.Td(f"${bid['price'] * bid['size']:,.2f}", className="text-end")
                    ]) for bid in bids[:5]  # Show top 5 bids
                ])
            ], size="sm")
        ])
    ])
    
    return order_book_table

@callback(
    Output('trade-history-content', 'children'),
    Input('global-interval', 'n_intervals')
)
def update_trade_history(n_intervals):
    """Update today's trade history"""
    # TODO: Get actual trade history from database
    # For now, show placeholder
    
    if n_intervals % 30 == 0:  # Update every 30 seconds
        return dbc.Table([
            html.Thead([
                html.Tr([
                    html.Th("Time"),
                    html.Th("Symbol"),
                    html.Th("Side"),
                    html.Th("Qty"),
                    html.Th("Price"),
                    html.Th("P&L")
                ])
            ]),
            html.Tbody([
                html.Tr([
                    html.Td("14:23:45"),
                    html.Td("BTC-USD"),
                    html.Td(html.Span("BUY", className="text-success")),
                    html.Td("0.001"),
                    html.Td("$45,123"),
                    html.Td(html.Span("+$12.34", className="text-success"))
                ])
            ])
        ], size="sm", striped=True, hover=True)
    
    return html.P("No trades today", className="text-muted text-center py-3")

# Quick trade button callbacks
@callback(
    Output('quick-buy-btn', 'children'),
    Input('quick-buy-btn', 'n_clicks'),
    [State('quick-trade-symbol', 'value'),
     State('quick-quantity', 'value'),
     State('quick-order-type', 'value')],
    prevent_initial_call=True
)
def handle_quick_buy(n_clicks, symbol, quantity, order_type):
    """Handle quick buy order"""
    # TODO: Implement actual buy order with Coinbase API
    return "✅ Buy Order Sent!"

@callback(
    Output('quick-sell-btn', 'children'),
    Input('quick-sell-btn', 'n_clicks'),
    [State('quick-trade-symbol', 'value'),
     State('quick-quantity', 'value'),
     State('quick-order-type', 'value')],
    prevent_initial_call=True
)
def handle_quick_sell(n_clicks, symbol, quantity, order_type):
    """Handle quick sell order"""
    # TODO: Implement actual sell order with Coinbase API
    return "✅ Sell Order Sent!"
