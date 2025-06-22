"""
Dash chart card components for real-time crypto price display
Movable cards with historical price charts and live updates
"""

import plotly.graph_objs as go
from dash import html, dcc
import dash_bootstrap_components as dbc
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import logging

# Import historical data fetcher
from coinbase.historical_public import get_crypto_historical_data, get_all_crypto_data

logger = logging.getLogger(__name__)

def create_price_chart_card():
    """Create a movable card with live price chart"""
    
    card = dbc.Card([
        dbc.CardHeader([
            html.H5("📈 Live Crypto Prices", className="mb-0"),
            html.Small("Real-time data from Coinbase", className="text-muted")
        ]),
        dbc.CardBody([
            dcc.Graph(
                id="live-price-chart",
                config={'displayModeBar': False},
                style={'height': '300px'}
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
    """Update the price chart with historical data + live updates"""
    fig = go.Figure()
    colors = {
        'BTC-USD': '#f7931a',
        'ETH-USD': '#627eea', 
        'SOL-USD': '#9945ff',
        'ADA-USD': '#0033ad',
        'DOGE-USD': '#c2a633'
    }
    
    if not price_data:
        # Return empty chart if no data
        fig.update_layout(
            title="⏳ Loading historical crypto data...",
            xaxis_title="Time",
            yaxis_title="Price (USD)",
            height=350,
            showlegend=True,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)'
        )
        return fig
    
    # Get historical data for all symbols
    logger.info(f"Fetching {timeframe_hours}h historical data for chart...")
    
    for symbol in ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD', 'DOGE-USD']:
        if symbol in colors:
            try:
                # Fetch historical data with specified timeframe
                df = get_crypto_historical_data(symbol, hours=timeframe_hours)
                
                if not df.empty:                    # Use historical data as the base - limit to recent data to prevent overload
                    df_recent = df.tail(100)  # Only use last 100 data points for performance
                    
                    # Modern approach using .to_numpy() instead of deprecated .dt.to_pydatetime()
                    x_data = df_recent['time'].to_numpy()
                    y_data = df_recent['close'].astype(float)
                    
                    fig.add_trace(go.Scatter(
                        x=x_data,
                        y=y_data,
                        mode='lines',
                        name=symbol.replace('-USD', ''),
                        line=dict(color=colors[symbol], width=2),
                        hovertemplate='<b>%{fullData.name}</b><br>' +
                                    'Time: %{x}<br>' +
                                    'Price: $%{y:,.2f}<br>' +
                                    '<extra></extra>'
                    ))
                    
                    # Add current live price as a point
                    if price_data and symbol in price_data:
                        current_price = price_data[symbol]['price']
                        current_time = datetime.now()
                        
                        fig.add_trace(go.Scatter(
                            x=[current_time],
                            y=[current_price],
                            mode='markers',
                            name=f"{symbol.replace('-USD', '')} Live",
                            marker=dict(
                                color=colors[symbol],
                                size=12,
                                symbol='circle',
                                line=dict(color='white', width=2)
                            ),
                            hovertemplate='<b>%{fullData.name}</b><br>' +
                                        'Live Price: $%{y:,.2f}<br>' +
                                        '<extra></extra>',
                            showlegend=False
                        ))
                else:
                    logger.warning(f"No historical data for {symbol}")
                    
            except Exception as e:
                logger.error(f"Error fetching data for {symbol}: {e}")
                # Fallback: show only current price if available
                if price_data and symbol in price_data:
                    current_price = price_data[symbol]['price']
                    current_time = datetime.now()
                    past_time = current_time - timedelta(hours=1)
                    
                    fig.add_trace(go.Scatter(
                        x=[past_time, current_time],  # Use datetime objects instead of strings
                        y=[current_price, current_price],
                        mode='lines+markers',
                        name=f"{symbol.replace('-USD', '')} (Live Only)",
                        line=dict(color=colors[symbol], width=2),
                        marker=dict(size=8)
                    ))
    
    # Update layout
    timeframe_label = f"{timeframe_hours}h" if timeframe_hours < 24 else f"{int(timeframe_hours/24)}d"
    fig.update_layout(
        title=f"📈 Cryptocurrency Prices ({timeframe_label} Historical + Live Updates)",
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
        ),
        xaxis=dict(
            showgrid=True,
            gridwidth=1,
            gridcolor='rgba(128,128,128,0.2)',
            type='date'
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
    
    return table_rows
