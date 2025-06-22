"""
Backtesting Page - Strategy Testing with Historical Data
Enhanced backtesting with Coinbase historical data
"""

import dash
from dash import html, dcc, callback, Input, Output, State
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
from datetime import datetime, timedelta

# Register this page with Dash
dash.register_page(__name__, path="/backtesting", title="Backtesting", name="Backtesting", order=2)

def create_strategy_selection_card():
    """Create strategy selection card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("⚡ Strategy Configuration", className="mb-0")
        ]),
        dbc.CardBody([
            dbc.Row([
                dbc.Col([
                    dbc.Label("Strategy Type"),
                    dcc.Dropdown(
                        id="strategy-dropdown",
                        options=[
                            {"label": "Moving Average Crossover", "value": "ma_crossover"},
                            {"label": "RSI Mean Reversion", "value": "rsi_reversion"},
                            {"label": "Bollinger Bands", "value": "bollinger"},
                            {"label": "MACD Strategy", "value": "macd"},
                            {"label": "Always Gain", "value": "always_gain"}
                        ],
                        value="ma_crossover"
                    )
                ], width=6),
                dbc.Col([
                    dbc.Label("Trading Pair"),
                    dcc.Dropdown(
                        id="backtest-symbol",
                        options=[
                            {"label": "BTC-USD", "value": "BTC-USD"},
                            {"label": "ETH-USD", "value": "ETH-USD"},
                            {"label": "SOL-USD", "value": "SOL-USD"},
                            {"label": "ADA-USD", "value": "ADA-USD"},
                            {"label": "AVAX-USD", "value": "AVAX-USD"},
                            {"label": "DOT-USD", "value": "DOT-USD"},
                            {"label": "LINK-USD", "value": "LINK-USD"},
                            {"label": "MATIC-USD", "value": "MATIC-USD"}
                        ],
                        value="BTC-USD"
                    )
                ], width=6)
            ], className="mb-3"),
            
            dbc.Row([
                dbc.Col([
                    dbc.Label("Start Date"),
                    dcc.DatePickerSingle(
                        id="backtest-start-date",
                        date=datetime.now() - timedelta(days=365),
                        display_format="YYYY-MM-DD"
                    )
                ], width=4),
                dbc.Col([
                    dbc.Label("End Date"),
                    dcc.DatePickerSingle(
                        id="backtest-end-date",
                        date=datetime.now(),
                        display_format="YYYY-MM-DD"
                    )
                ], width=4),
                dbc.Col([
                    dbc.Label("Initial Capital"),
                    dbc.Input(
                        id="initial-capital",
                        type="number",
                        value=10000,
                        step=1000
                    )
                ], width=4)
            ], className="mb-3"),
            
            # Strategy-specific parameters
            html.Div(id="strategy-parameters"),
            
            dbc.Row([
                dbc.Col([
                    dbc.Button(
                        "🚀 Run Backtest",
                        id="run-backtest-btn",
                        color="primary",
                        size="lg",
                        className="w-100"
                    )
                ], width=12)
            ])
        ])
    ], className="mb-4")

def create_results_overview_card():
    """Create backtest results overview card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("📊 Backtest Results", className="mb-0"),
            dbc.Badge("Ready", color="secondary", id="backtest-status", className="ms-2")
        ]),
        dbc.CardBody([
            html.Div(id="backtest-results-content", children=[
                html.P("Configure your strategy and click 'Run Backtest' to see results.", 
                      className="text-muted text-center py-4")
            ])
        ])
    ], className="mb-4")

def create_performance_chart_card():
    """Create performance chart card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("📈 Performance Chart", className="mb-0"),
            dbc.ButtonGroup([
                dbc.Button("Portfolio", size="sm", outline=True, color="primary", id="chart-portfolio-btn", active=True),
                dbc.Button("Trades", size="sm", outline=True, color="primary", id="chart-trades-btn"),
                dbc.Button("Drawdown", size="sm", outline=True, color="primary", id="chart-drawdown-btn"),
            ], className="ms-auto")
        ]),
        dbc.CardBody([
            dcc.Graph(
                id="backtest-performance-chart",
                style={"height": "500px"}
            )
        ])
    ], className="mb-4")

def create_trade_analysis_card():
    """Create trade analysis card"""
    return dbc.Card([
        dbc.CardHeader([
            html.H4("💹 Trade Analysis", className="mb-0")
        ]),
        dbc.CardBody([
            html.Div(id="trade-analysis-content")
        ])
    ], className="mb-4")

# Main layout for the backtesting page
layout = dbc.Container([
    # Page header
    dbc.Row([
        dbc.Col([
            html.H1("📊 Strategy Backtesting", className="mb-0"),
            html.P("Test your trading strategies with 5+ years of Coinbase historical data", className="text-muted")
        ])
    ], className="mb-4"),
    
    # Strategy configuration
    dbc.Row([
        dbc.Col([
            create_strategy_selection_card()
        ], width=12)
    ]),
    
    # Results overview
    dbc.Row([
        dbc.Col([
            create_results_overview_card()
        ], width=12)
    ]),
    
    # Performance chart
    dbc.Row([
        dbc.Col([
            create_performance_chart_card()
        ], width=8),
        dbc.Col([
            create_trade_analysis_card()
        ], width=4)
    ])
], fluid=True)

# Callbacks for backtesting functionality

@callback(
    Output('strategy-parameters', 'children'),
    Input('strategy-dropdown', 'value')
)
def update_strategy_parameters(strategy):
    """Update strategy-specific parameters based on selection"""
    if strategy == "ma_crossover":
        return dbc.Row([
            dbc.Col([
                dbc.Label("Fast MA Period"),
                dbc.Input(id="fast-ma", type="number", value=10, min=1, max=100)
            ], width=6),
            dbc.Col([
                dbc.Label("Slow MA Period"),
                dbc.Input(id="slow-ma", type="number", value=30, min=1, max=200)
            ], width=6)
        ], className="mb-3")
    
    elif strategy == "rsi_reversion":
        return dbc.Row([
            dbc.Col([
                dbc.Label("RSI Period"),
                dbc.Input(id="rsi-period", type="number", value=14, min=1, max=50)
            ], width=4),
            dbc.Col([
                dbc.Label("Oversold Level"),
                dbc.Input(id="rsi-oversold", type="number", value=30, min=1, max=49)
            ], width=4),
            dbc.Col([
                dbc.Label("Overbought Level"),
                dbc.Input(id="rsi-overbought", type="number", value=70, min=51, max=99)
            ], width=4)
        ], className="mb-3")
    
    elif strategy == "bollinger":
        return dbc.Row([
            dbc.Col([
                dbc.Label("Period"),
                dbc.Input(id="bb-period", type="number", value=20, min=1, max=100)
            ], width=6),
            dbc.Col([
                dbc.Label("Standard Deviations"),
                dbc.Input(id="bb-std", type="number", value=2, min=0.5, max=3, step=0.1)
            ], width=6)
        ], className="mb-3")
    
    elif strategy == "macd":
        return dbc.Row([
            dbc.Col([
                dbc.Label("Fast Period"),
                dbc.Input(id="macd-fast", type="number", value=12, min=1, max=50)
            ], width=4),
            dbc.Col([
                dbc.Label("Slow Period"),
                dbc.Input(id="macd-slow", type="number", value=26, min=1, max=100)
            ], width=4),
            dbc.Col([
                dbc.Label("Signal Period"),
                dbc.Input(id="macd-signal", type="number", value=9, min=1, max=50)
            ], width=4)
        ], className="mb-3")
    
    else:  # always_gain or default
        return dbc.Row([
            dbc.Col([
                dbc.Label("Target Return (%)"),
                dbc.Input(id="target-return", type="number", value=1.0, min=0.1, max=10, step=0.1)
            ], width=6),
            dbc.Col([
                dbc.Label("Stop Loss (%)"),
                dbc.Input(id="stop-loss", type="number", value=2.0, min=0.1, max=10, step=0.1)
            ], width=6)
        ], className="mb-3")

@callback(
    [Output('backtest-results-content', 'children'),
     Output('backtest-status', 'children'),
     Output('backtest-status', 'color')],
    Input('run-backtest-btn', 'n_clicks'),
    [State('strategy-dropdown', 'value'),
     State('backtest-symbol', 'value'),
     State('backtest-start-date', 'date'),
     State('backtest-end-date', 'date'),
     State('initial-capital', 'value')],
    prevent_initial_call=True
)
def run_backtest(n_clicks, strategy, symbol, start_date, end_date, initial_capital):
    """Run backtest with selected parameters"""
    if not n_clicks:
        return dash.no_update, dash.no_update, dash.no_update
    
    # TODO: Implement actual backtesting logic with Coinbase historical data
    # For now, generate dummy results
    
    # Simulate backtest running
    import time
    
    # Calculate dummy metrics
    final_value = initial_capital * 1.15  # 15% return
    total_return = (final_value - initial_capital) / initial_capital * 100
    max_drawdown = -8.5
    sharpe_ratio = 1.23
    total_trades = 45
    win_rate = 68.9
    
    results_content = dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardBody([
                    html.H4(f"${final_value:,.2f}", className="text-success mb-0"),
                    html.P("Final Portfolio Value", className="text-muted mb-0")
                ])
            ], className="text-center")
        ], width=3),
        dbc.Col([
            dbc.Card([
                dbc.CardBody([
                    html.H4(f"+{total_return:.1f}%", className="text-success mb-0"),
                    html.P("Total Return", className="text-muted mb-0")
                ])
            ], className="text-center")
        ], width=3),
        dbc.Col([
            dbc.Card([
                dbc.CardBody([
                    html.H4(f"{max_drawdown:.1f}%", className="text-danger mb-0"),
                    html.P("Max Drawdown", className="text-muted mb-0")
                ])
            ], className="text-center")
        ], width=3),
        dbc.Col([
            dbc.Card([
                dbc.CardBody([
                    html.H4(f"{sharpe_ratio:.2f}", className="text-info mb-0"),
                    html.P("Sharpe Ratio", className="text-muted mb-0")
                ])
            ], className="text-center")
        ], width=3)
    ])
    
    return results_content, "Completed", "success"

@callback(
    Output('backtest-performance-chart', 'figure'),
    [Input('run-backtest-btn', 'n_clicks'),
     Input('chart-portfolio-btn', 'n_clicks'),
     Input('chart-trades-btn', 'n_clicks'),
     Input('chart-drawdown-btn', 'n_clicks')],
    prevent_initial_call=True
)
def update_performance_chart(backtest_clicks, portfolio_clicks, trades_clicks, drawdown_clicks):
    """Update performance chart based on backtest results and chart type"""
    
    # Determine which chart type to show
    ctx = dash.callback_context
    if not ctx.triggered:
        chart_type = "portfolio"
    else:
        button_id = ctx.triggered[0]['prop_id'].split('.')[0]
        if 'trades' in button_id:
            chart_type = "trades"
        elif 'drawdown' in button_id:
            chart_type = "drawdown"
        else:
            chart_type = "portfolio"
    
    # Generate dummy data for demonstration
    dates = pd.date_range(start=datetime.now() - timedelta(days=365), end=datetime.now(), freq='D')
    
    if chart_type == "portfolio":
        # Portfolio value over time
        portfolio_values = []
        initial_value = 10000
        for i, date in enumerate(dates):
            # Simulate portfolio growth with some volatility
            trend = initial_value * (1 + (i / len(dates)) * 0.15)  # 15% annual growth
            noise = (hash(str(date)) % 1000 - 500) * 5  # Random volatility
            portfolio_values.append(max(trend + noise, initial_value * 0.8))
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=dates,
            y=portfolio_values,
            mode='lines',
            name='Portfolio Value',
            line=dict(color='green', width=2)
        ))
        
        # Add buy/sell signals
        buy_dates = dates[::30]  # Every 30 days
        buy_values = [portfolio_values[i] for i in range(0, len(portfolio_values), 30)]
        
        fig.add_trace(go.Scatter(
            x=buy_dates,
            y=buy_values,
            mode='markers',
            name='Buy Signal',
            marker=dict(color='green', size=8, symbol='triangle-up')
        ))
        
        fig.update_layout(
            title="Portfolio Performance Over Time",
            xaxis_title="Date",
            yaxis_title="Portfolio Value ($)",
            height=500
        )
    
    elif chart_type == "trades":
        # Trade P&L distribution
        num_trades = 45
        trade_pnl = [(hash(f"trade_{i}") % 1000 - 400) for i in range(num_trades)]
        
        fig = go.Figure()
        fig.add_trace(go.Histogram(
            x=trade_pnl,
            name='Trade P&L',
            marker_color='lightblue',
            opacity=0.7
        ))
        
        fig.update_layout(
            title="Trade P&L Distribution",
            xaxis_title="Trade P&L ($)",
            yaxis_title="Number of Trades",
            height=500
        )
    
    else:  # drawdown
        # Drawdown chart
        drawdown_values = []
        peak = 10000
        for value in [10000 + (hash(str(date)) % 2000 - 1000) for date in dates]:
            if value > peak:
                peak = value
            drawdown = (value - peak) / peak * 100
            drawdown_values.append(drawdown)
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=dates,
            y=drawdown_values,
            mode='lines',
            name='Drawdown',
            line=dict(color='red', width=2),
            fill='tonexty',
            fillcolor='rgba(255,0,0,0.1)'
        ))
        
        fig.update_layout(
            title="Portfolio Drawdown Over Time",
            xaxis_title="Date",
            yaxis_title="Drawdown (%)",
            height=500
        )
    
    return fig

@callback(
    Output('trade-analysis-content', 'children'),
    Input('run-backtest-btn', 'n_clicks'),
    prevent_initial_call=True
)
def update_trade_analysis(n_clicks):
    """Update trade analysis metrics"""
    if not n_clicks:
        return html.P("Run a backtest to see trade analysis", className="text-muted")
    
    # TODO: Calculate actual trade statistics from backtest results
    # For now, show dummy metrics
    
    metrics = [
        {"label": "Total Trades", "value": "45", "color": "primary"},
        {"label": "Win Rate", "value": "68.9%", "color": "success"},
        {"label": "Avg Win", "value": "+$234", "color": "success"},
        {"label": "Avg Loss", "value": "-$156", "color": "danger"},
        {"label": "Profit Factor", "value": "1.67", "color": "info"},
        {"label": "Max Consecutive Wins", "value": "7", "color": "success"},
        {"label": "Max Consecutive Losses", "value": "4", "color": "danger"},
        {"label": "Largest Win", "value": "+$567", "color": "success"},
        {"label": "Largest Loss", "value": "-$345", "color": "danger"}
    ]
    
    cards = []
    for metric in metrics:
        card = dbc.Card([
            dbc.CardBody([
                html.H6(metric["label"], className="card-title mb-1"),
                html.H5(metric["value"], className=f"text-{metric['color']} mb-0")
            ])
        ], className="mb-2")
        cards.append(card)
    
    return cards
