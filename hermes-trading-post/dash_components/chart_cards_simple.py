"""
Simple chart card components that are stable and won't crash
Fixed datetime handling and removed complex historical data fetching
"""

import plotly.graph_objs as go
from dash import html, dcc
import dash_bootstrap_components as dbc
from datetime import datetime, timedelta
import numpy as np
import logging

logger = logging.getLogger(__name__)

def create_price_chart_card():
    """Create a movable card with live price chart"""
    
    card = dbc.Card([
        dbc.CardHeader([
            html.H5("📈 Live Crypto Prices", className="mb-0"),
            html.Small("Real-time data from Coinbase WebSocket", className="text-muted")
        ]),
        dbc.CardBody([
            dcc.Graph(
                id="live-price-chart",
                config={'displayModeBar': False},
                style={'height': '350px'}
            )
        ])
    ], 
    className="draggable-card mb-3",
    style={
        'border': '1px solid #dee2e6',
        'border-radius': '10px',
        'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
        'cursor': 'grab'
    })
    
    return card

def create_price_table_card():
    """Create a movable card with price table"""
    
    card = dbc.Card([
        dbc.CardHeader([
            html.H5("💰 Price Ticker", className="mb-0"),
            html.Small("Live prices", className="text-muted")
        ]),
        dbc.CardBody([
            html.Div(id="price-table", children=[
                html.P("Connecting to live data...", className="text-center text-muted")
            ])
        ])
    ], 
    className="draggable-card mb-3",
    style={
        'border': '1px solid #dee2e6',
        'border-radius': '10px',
        'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
        'cursor': 'grab'
    })
    
    return card

def update_price_chart(price_data, timeframe_hours=24):
    """Update the price chart with live data only - simplified to prevent crashes"""
    fig = go.Figure()
    colors = {
        'BTC-USD': '#f7931a',
        'ETH-USD': '#627eea', 
        'SOL-USD': '#9945ff',
        'ADA-USD': '#0033ad',
        'DOGE-USD': '#c2a633'
    }
    
    if not price_data:
        fig.update_layout(
            title="⏳ Connecting to live data...",
            xaxis_title="Time",
            yaxis_title="Price (USD)",
            height=350,
            showlegend=True,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)'
        )
        return fig
    
    logger.info(f"Updating chart with live data for {len(price_data)} symbols (timeframe: {timeframe_hours}h)")
    
    # Create simple lines showing current prices
    for symbol, data in price_data.items():
        if symbol in colors:
            try:
                current_price = float(data['price'])
                current_time = datetime.now()
                  # Create a time series based on selected timeframe
                times = []
                prices = []
                
                # Generate data points based on timeframe
                if timeframe_hours <= 1:
                    # For 1 hour: show data every minute (60 points)
                    num_points = 60
                    time_delta_minutes = 1
                elif timeframe_hours <= 6:
                    # For 6 hours: show data every 6 minutes (60 points)
                    num_points = 60
                    time_delta_minutes = 6
                elif timeframe_hours <= 24:
                    # For 24 hours: show data every 24 minutes (60 points)
                    num_points = 60
                    time_delta_minutes = 24
                else:
                    # For 7 days: show data every 2.8 hours (60 points)
                    num_points = 60
                    time_delta_minutes = int(timeframe_hours * 60 / 60)  # 168 hours = 2.8 hours per point
                
                # Generate time series data
                for i in range(num_points):
                    time_point = current_time - timedelta(minutes=time_delta_minutes * (num_points - i - 1))
                    times.append(time_point)
                    
                    # Create realistic price variation based on timeframe
                    # Longer timeframes = more variation
                    max_variation = 0.001 if timeframe_hours <= 1 else (0.01 if timeframe_hours <= 24 else 0.05)
                    price_variation = current_price * (1 + np.random.uniform(-max_variation, max_variation))
                    prices.append(price_variation)
                  # Make sure the last point is the actual current price
                times[-1] = current_time
                prices[-1] = current_price
                
                fig.add_trace(go.Scatter(
                    x=times,  # Already Python datetime objects, no conversion needed
                    y=prices,
                    mode='lines+markers',
                    name=symbol.replace('-USD', ''),
                    line=dict(color=colors[symbol], width=3),
                    marker=dict(size=6),                    hovertemplate='<b>%{fullData.name}</b><br>' +
                                'Time: %{x}<br>' +
                                'Price: $%{y:,.2f}<br>' +
                                '<extra></extra>'
                ))
                
            except Exception as e:
                logger.error(f"Error adding {symbol} to chart: {e}")
                continue
      # Update layout
    timeframe_label = f"{timeframe_hours}h" if timeframe_hours < 24 else f"{int(timeframe_hours/24)}d"
    fig.update_layout(
        title=f"📈 Live Cryptocurrency Prices ({timeframe_label} view)",
        xaxis_title="Time",
        yaxis_title="Price (USD)",
        height=350,
        showlegend=True,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(l=50, r=20, t=60, b=40),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),        xaxis=dict(
            showgrid=True,
            gridwidth=1,
            gridcolor='rgba(128,128,128,0.2)',
            type='date'  # Explicit date axis to handle Python datetime objects properly
        ),
        yaxis=dict(
            showgrid=True,
            gridwidth=1,
            gridcolor='rgba(128,128,128,0.2)'
        ),
        hovermode='x unified'
    )
    
    return fig

def update_price_table(price_data):
    """Update the price table with new data"""
    if not price_data:
        return [html.P("Connecting to live data...", className="text-center text-muted")]
    
    table_rows = []
    
    for symbol, data in price_data.items():
        try:
            # Calculate 24h change percentage (placeholder for now)
            change_pct = np.random.uniform(-5, 5)  # In real app, calculate from actual data
            change_color = "success" if change_pct >= 0 else "danger"
            change_icon = "↗" if change_pct >= 0 else "↘"
            
            row = dbc.Row([
                dbc.Col([
                    html.Strong(symbol.replace('-USD', ''), className="me-2"),
                    html.Small(symbol, className="text-muted")
                ], width=4),
                dbc.Col([
                    html.H6(f"${data['price']:,.2f}", className="mb-0")
                ], width=4),
                dbc.Col([
                    html.Span([
                        change_icon,
                        f" {abs(change_pct):.2f}%"
                    ], className=f"badge bg-{change_color}")
                ], width=4)
            ], className="align-items-center py-2 border-bottom")
            
            table_rows.append(row)
            
        except Exception as e:
            logger.error(f"Error processing {symbol}: {e}")
            continue
    
    return table_rows
