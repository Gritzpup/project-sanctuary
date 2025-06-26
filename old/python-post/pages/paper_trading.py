"""
Paper Trading Page - Practice Trading with Virtual Money
Includes both strategy-based trading and LLM autonomous trading
"""

import dash
from dash import html, dcc, callback, Input, Output, State, dash_table
import dash_bootstrap_components as dbc
import plotly.graph_objs as go
import pandas as pd
from datetime import datetime, timedelta
import numpy as np

# Register this page with Dash
dash.register_page(__name__, path="/paper-trading", name="Paper Trading", order=3)

def layout():
    """Paper Trading page layout"""
    return dbc.Container([
        dbc.Row([
            dbc.Col([
                html.H1("📊 Paper Trading Simulator", className="text-primary mb-4"),
                html.P("Practice trading with virtual money using real market data", className="lead mb-4"),
                
                # Trading Mode Selector
                dbc.Card([
                    dbc.CardHeader([
                        html.H5("🎯 Trading Mode Selection", className="mb-0")
                    ]),
                    dbc.CardBody([
                        dbc.ButtonGroup([
                            dbc.Button("💡 Strategy Trading", id="strategy-mode-btn", color="primary", outline=True, active=True),
                            dbc.Button("🤖 LLM Auto Trading", id="llm-mode-btn", color="success", outline=True),
                            dbc.Button("🎮 Manual Trading", id="manual-mode-btn", color="info", outline=True),
                        ], className="w-100 mb-3"),
                        html.Div(id="mode-description", className="text-muted")
                    ])
                ], className="mb-4"),
                
                # Portfolio Status
                dbc.Row([
                    dbc.Col([
                        dbc.Card([
                            dbc.CardBody([
                                html.H6("💰 Portfolio Value", className="card-title"),
                                html.H3("$10,000.00", id="portfolio-value", className="text-success"),
                                html.Small("Starting Balance: $10,000", className="text-muted")
                            ])
                        ])
                    ], width=3),
                    dbc.Col([
                        dbc.Card([
                            dbc.CardBody([
                                html.H6("📈 P&L Today", className="card-title"),
                                html.H3("+$0.00", id="pnl-today", className="text-success"),
                                html.Small("0.00%", className="text-muted")
                            ])
                        ])
                    ], width=3),
                    dbc.Col([
                        dbc.Card([
                            dbc.CardBody([
                                html.H6("🔄 Active Trades", className="card-title"),
                                html.H3("0", id="active-trades", className="text-info"),
                                html.Small("Open Positions", className="text-muted")
                            ])
                        ])
                    ], width=3),
                    dbc.Col([
                        dbc.Card([
                            dbc.CardBody([
                                html.H6("🎯 Win Rate", className="card-title"),
                                html.H3("--", id="win-rate", className="text-warning"),
                                html.Small("No trades yet", className="text-muted")
                            ])
                        ])
                    ], width=3),
                ], className="mb-4"),
                
                # Trading Interface (changes based on mode)
                html.Div(id="trading-interface"),
                
                # Performance Charts
                dbc.Row([
                    dbc.Col([
                        dbc.Card([
                            dbc.CardHeader([
                                html.H5("📊 Portfolio Performance", className="mb-0")
                            ]),
                            dbc.CardBody([
                                dcc.Graph(id="portfolio-chart", style={'height': '300px'})
                            ])
                        ])
                    ], width=8),
                    dbc.Col([
                        dbc.Card([
                            dbc.CardHeader([
                                html.H5("🏆 Trade History", className="mb-0")
                            ]),
                            dbc.CardBody([
                                html.Div("No trades yet. Start trading to see history here.", 
                                        id="trade-history", className="text-muted text-center p-4")
                            ])
                        ])
                    ], width=4),
                ], className="mb-4"),
                
            ], width=12)
        ])
    ], fluid=True)

# Trading Mode Selection Callback
@callback(
    [Output("mode-description", "children"),
     Output("trading-interface", "children"),
     Output("strategy-mode-btn", "active"),
     Output("llm-mode-btn", "active"),
     Output("manual-mode-btn", "active")],
    [Input("strategy-mode-btn", "n_clicks"),
     Input("llm-mode-btn", "n_clicks"),
     Input("manual-mode-btn", "n_clicks")]
)
def update_trading_mode(strategy_clicks, llm_clicks, manual_clicks):
    """Update the trading interface based on selected mode"""
    ctx = dash.callback_context
    
    if not ctx.triggered:
        # Default to strategy mode
        return get_strategy_mode_content()
    
    button_id = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if button_id == "llm-mode-btn":
        return get_llm_mode_content()
    elif button_id == "manual-mode-btn":
        return get_manual_mode_content()
    else:
        return get_strategy_mode_content()

def get_strategy_mode_content():
    """Strategy-based trading interface"""
    description = "Use proven backtesting strategies to execute trades automatically with real market data."
    
    interface = dbc.Card([
        dbc.CardHeader([
            html.H5("💡 Strategy Trading Configuration", className="mb-0")
        ]),
        dbc.CardBody([
            dbc.Row([
                dbc.Col([
                    html.Label("Select Strategy:", className="fw-bold"),
                    dcc.Dropdown(
                        id="strategy-selector",
                        options=[
                            {"label": "🚀 Always Gain BTC", "value": "always_gain"},
                            {"label": "📊 MA Crossover", "value": "ma_crossover"},
                            {"label": "🎯 RSI Momentum", "value": "rsi_momentum"},
                            {"label": "⚡ DCA Strategy", "value": "dca"},
                        ],
                        value="always_gain",
                        clearable=False
                    )
                ], width=4),
                dbc.Col([
                    html.Label("Risk Level:", className="fw-bold"),
                    dcc.Dropdown(
                        id="risk-level",
                        options=[
                            {"label": "🟢 Conservative (1-2%)", "value": "conservative"},
                            {"label": "🟡 Moderate (3-5%)", "value": "moderate"},
                            {"label": "🔴 Aggressive (5-10%)", "value": "aggressive"},
                        ],
                        value="moderate",
                        clearable=False
                    )
                ], width=4),
                dbc.Col([
                    html.Label("Position Size:", className="fw-bold"),
                    dcc.Dropdown(
                        id="position-size",
                        options=[
                            {"label": "$100 per trade", "value": 100},
                            {"label": "$250 per trade", "value": 250},
                            {"label": "$500 per trade", "value": 500},
                            {"label": "$1000 per trade", "value": 1000},
                        ],
                        value=250,
                        clearable=False
                    )
                ], width=4),
            ], className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    dbc.ButtonGroup([
                        dbc.Button("▶️ Start Strategy", color="success", id="start-strategy-btn"),
                        dbc.Button("⏸️ Pause", color="warning", id="pause-strategy-btn", disabled=True),
                        dbc.Button("⏹️ Stop", color="danger", id="stop-strategy-btn", disabled=True),
                    ])
                ], width=6),
                dbc.Col([
                    html.Div([
                        html.Strong("Status: "),
                        html.Span("Ready to Start", id="strategy-status", className="text-muted")
                    ])
                ], width=6, className="d-flex align-items-center")
            ])
        ])
    ])
    
    return description, interface, True, False, False

def get_llm_mode_content():
    """LLM autonomous trading interface"""
    description = "Let an AI Large Language Model analyze market conditions and make trading decisions autonomously."
    
    interface = dbc.Card([
        dbc.CardHeader([
            html.H5("🤖 LLM Autonomous Trading", className="mb-0")
        ]),
        dbc.CardBody([
            dbc.Alert([
                html.I(className="fas fa-robot me-2"),
                "The AI trader will analyze real-time market data, news, and technical indicators to make autonomous trading decisions."
            ], color="info", className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    html.Label("AI Model:", className="fw-bold"),
                    dcc.Dropdown(
                        id="ai-model",
                        options=[
                            {"label": "🧠 GPT-4 Trader", "value": "gpt4"},
                            {"label": "🔮 Claude Trader", "value": "claude"},
                            {"label": "⚡ Llama Trader", "value": "llama"},
                        ],
                        value="gpt4",
                        clearable=False
                    )
                ], width=4),
                dbc.Col([
                    html.Label("Trading Style:", className="fw-bold"),
                    dcc.Dropdown(
                        id="ai-style",
                        options=[
                            {"label": "🐌 Conservative", "value": "conservative"},
                            {"label": "⚖️ Balanced", "value": "balanced"},
                            {"label": "⚡ Aggressive", "value": "aggressive"},
                            {"label": "🚀 YOLO Mode", "value": "yolo"},
                        ],
                        value="balanced",
                        clearable=False
                    )
                ], width=4),
                dbc.Col([
                    html.Label("Max Trade Size:", className="fw-bold"),
                    dcc.Dropdown(
                        id="ai-max-trade",
                        options=[
                            {"label": "5% of portfolio", "value": 0.05},
                            {"label": "10% of portfolio", "value": 0.10},
                            {"label": "25% of portfolio", "value": 0.25},
                            {"label": "50% of portfolio", "value": 0.50},
                        ],
                        value=0.10,
                        clearable=False
                    )
                ], width=4),
            ], className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    html.Label("AI Reasoning Window:", className="fw-bold"),
                    dcc.Textarea(
                        id="ai-reasoning",
                        placeholder="AI thinking process will appear here...",
                        style={'height': '100px', 'resize': 'none'},
                        disabled=True,
                        value="🤖 AI is ready to analyze market conditions and make trading decisions."
                    )
                ], width=12)
            ], className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    dbc.ButtonGroup([
                        dbc.Button("🧠 Start AI Trader", color="success", id="start-ai-btn"),
                        dbc.Button("⏸️ Pause AI", color="warning", id="pause-ai-btn", disabled=True),
                        dbc.Button("🛑 Stop AI", color="danger", id="stop-ai-btn", disabled=True),
                    ])
                ], width=6),
                dbc.Col([
                    html.Div([
                        html.Strong("AI Status: "),
                        html.Span("Standby", id="ai-status", className="text-muted")
                    ])
                ], width=6, className="d-flex align-items-center")
            ])
        ])
    ])
    
    return description, interface, False, True, False

def get_manual_mode_content():
    """Manual trading interface"""
    description = "Execute trades manually while viewing real-time market data and analysis tools."
    
    interface = dbc.Card([
        dbc.CardHeader([
            html.H5("🎮 Manual Trading Interface", className="mb-0")
        ]),
        dbc.CardBody([
            dbc.Row([
                dbc.Col([
                    html.Label("Select Crypto:", className="fw-bold"),
                    dcc.Dropdown(
                        id="crypto-selector",
                        options=[
                            {"label": "₿ Bitcoin (BTC)", "value": "BTC-USD"},
                            {"label": "Ξ Ethereum (ETH)", "value": "ETH-USD"},
                            {"label": "◎ Solana (SOL)", "value": "SOL-USD"},
                            {"label": "🔸 Cardano (ADA)", "value": "ADA-USD"},
                            {"label": "🐕 Dogecoin (DOGE)", "value": "DOGE-USD"},
                        ],
                        value="BTC-USD",
                        clearable=False
                    )
                ], width=4),
                dbc.Col([
                    html.Label("Order Type:", className="fw-bold"),
                    dcc.Dropdown(
                        id="order-type",
                        options=[
                            {"label": "🎯 Market Order", "value": "market"},
                            {"label": "📌 Limit Order", "value": "limit"},
                            {"label": "🛑 Stop Loss", "value": "stop_loss"},
                        ],
                        value="market",
                        clearable=False
                    )
                ], width=4),
                dbc.Col([
                    html.Label("Trade Amount:", className="fw-bold"),
                    dbc.InputGroup([
                        dbc.InputGroupText("$"),
                        dbc.Input(id="trade-amount", type="number", value=100, min=1, max=10000),
                    ])
                ], width=4),
            ], className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    html.Label("Current Price:", className="fw-bold"),
                    html.H4("$97,245.67", id="current-price", className="text-info")
                ], width=4),
                dbc.Col([
                    dbc.ButtonGroup([
                        dbc.Button("🟢 BUY", color="success", size="lg", id="buy-btn"),
                        dbc.Button("🔴 SELL", color="danger", size="lg", id="sell-btn"),
                    ], className="w-100")
                ], width=8)
            ])
        ])
    ])
    
    return description, interface, False, False, True

# Portfolio Chart Callback
@callback(
    Output("portfolio-chart", "figure"),
    Input("portfolio-chart", "id")  # Dummy input to trigger on page load
)
def update_portfolio_chart(_):
    """Create portfolio performance chart"""
    # Generate sample portfolio data
    dates = pd.date_range(start=datetime.now() - timedelta(days=30), end=datetime.now(), freq='H')
    
    # Simulate portfolio growth starting at $10,000
    np.random.seed(42)  # For reproducible results
    returns = np.random.normal(0.001, 0.02, len(dates))  # Small positive bias
    portfolio_values = [10000]
    
    for ret in returns:
        new_value = portfolio_values[-1] * (1 + ret)
        portfolio_values.append(max(new_value, 1000))  # Don't go below $1000
    
    portfolio_values = portfolio_values[:-1]  # Remove extra value
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=dates,
        y=portfolio_values,
        mode='lines',
        name='Portfolio Value',
        line=dict(color='#00d4aa', width=3),
        fill='tonexty',
        fillcolor='rgba(0, 212, 170, 0.1)',
        hovertemplate='<b>%{x}</b><br>Portfolio: $%{y:,.2f}<extra></extra>'
    ))
    
    # Add starting line
    fig.add_hline(y=10000, line_dash="dash", line_color="gray", annotation_text="Starting Balance")
    
    fig.update_layout(
        title="📈 Paper Trading Portfolio Performance",
        xaxis_title="Time",
        yaxis_title="Portfolio Value (USD)",
        height=300,
        showlegend=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(l=50, r=20, t=40, b=40),
        xaxis=dict(showgrid=True, gridwidth=1, gridcolor='rgba(128,128,128,0.2)'),
        yaxis=dict(showgrid=True, gridwidth=1, gridcolor='rgba(128,128,128,0.2)'),
        hovermode='x unified'
    )
    
    return fig

# Placeholder callbacks for buttons (to prevent errors)
@callback(
    Output("strategy-status", "children"),
    [Input("start-strategy-btn", "n_clicks"),
     Input("pause-strategy-btn", "n_clicks"),
     Input("stop-strategy-btn", "n_clicks")]
)
def handle_strategy_buttons(start_clicks, pause_clicks, stop_clicks):
    """Handle strategy trading buttons"""
    ctx = dash.callback_context
    if not ctx.triggered:
        return "Ready to Start"
    
    button_id = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if button_id == "start-strategy-btn":
        return "🟢 Strategy Running"
    elif button_id == "pause-strategy-btn":
        return "🟡 Strategy Paused"
    elif button_id == "stop-strategy-btn":
        return "🔴 Strategy Stopped"
    
    return "Ready to Start"

@callback(
    Output("ai-status", "children"),
    [Input("start-ai-btn", "n_clicks"),
     Input("pause-ai-btn", "n_clicks"),
     Input("stop-ai-btn", "n_clicks")]
)
def handle_ai_buttons(start_clicks, pause_clicks, stop_clicks):
    """Handle AI trading buttons"""
    ctx = dash.callback_context
    if not ctx.triggered:
        return "Standby"
    
    button_id = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if button_id == "start-ai-btn":
        return "🧠 AI Analyzing Markets"
    elif button_id == "pause-ai-btn":
        return "⏸️ AI Paused"
    elif button_id == "stop-ai-btn":
        return "🛑 AI Stopped"
    
    return "Standby"

@callback(
    Output("ai-reasoning", "value"),
    Input("start-ai-btn", "n_clicks")
)
def update_ai_reasoning(n_clicks):
    """Update AI reasoning display"""
    if n_clicks:
        return """🤖 AI Analysis:
• Market sentiment: Bullish trend detected
• Technical indicators: RSI oversold, MACD bullish crossover
• News analysis: Positive crypto adoption news
• Risk assessment: Low volatility environment
• Recommendation: Consider long position in BTC with 2% portfolio allocation"""
    
    return "🤖 AI is ready to analyze market conditions and make trading decisions."
