"""
Bitcoin Chart Component with Real Historical + Live Data
Shows actual Bitcoin historical data combined with real-time WebSocket updates
"""

import plotly.graph_objs as go
from dash import html, dcc
import dash_bootstrap_components as dbc
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import logging
import requests

logger = logging.getLogger(__name__)

def create_bitcoin_chart_card():
    """Create a Bitcoin-only chart card with real historical + live data"""
    
    # Define timeframe options (Coinbase API granularity in seconds)
    timeframe_options = [
        {'label': '1 Minute', 'value': 60},
        {'label': '5 Minutes', 'value': 300}, 
        {'label': '15 Minutes', 'value': 900},
        {'label': '1 Hour', 'value': 3600},
        {'label': '6 Hours', 'value': 21600},
        {'label': '1 Day', 'value': 86400}
    ]
    
    # Define date range options
    date_range_options = [
        {'label': '1 Hour', 'value': 1},
        {'label': '4 Hours', 'value': 4}, 
        {'label': '1 Day', 'value': 24},
        {'label': '5 Days', 'value': 120},
        {'label': '1 Month', 'value': 720},
        {'label': '3 Months', 'value': 2160},
        {'label': '6 Months', 'value': 4320},
        {'label': '1 Year', 'value': 8760}
    ]
    
    card = dbc.Card([
        dbc.CardHeader([
            dbc.Row([
                dbc.Col([
                    html.H5("₿ Bitcoin Price Chart", className="mb-0"),
                    html.Small("Real-time WebSocket + Historical data", className="text-muted")
                ], width=6),
                dbc.Col([
                    dbc.Row([
                        dbc.Col([
                            html.Label("Timeframe:", className="form-label mb-1", style={'fontSize': '12px'}),
                            dcc.Dropdown(
                                id="bitcoin-timeframe-dropdown",
                                options=timeframe_options,
                                value=300,  # Default to 5 minutes
                                clearable=False,
                                style={'fontSize': '12px', 'minWidth': '100px'}
                            )
                        ], width=6),
                        dbc.Col([
                            html.Label("Range:", className="form-label mb-1", style={'fontSize': '12px'}),
                            dcc.Dropdown(
                                id="bitcoin-range-dropdown", 
                                options=date_range_options,
                                value=24,  # Default to 1 day
                                clearable=False,
                                style={'fontSize': '12px', 'minWidth': '100px'}
                            )
                        ], width=6)
                    ])
                ], width=6, className="text-end")
            ])
        ]),
        dbc.CardBody([
            dcc.Graph(
                id="bitcoin-price-chart",
                config={'displayModeBar': False},
                style={'height': '400px'}
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

def get_coinbase_historical_bitcoin(hours=24, granularity=300):
    """
    Fetch real Bitcoin historical data from Coinbase public API
    
    Args:
        hours: Number of hours of historical data
        granularity: Granularity in seconds (60, 300, 900, 3600, 21600, 86400)
        
    Returns:
        DataFrame with time, price columns
    """
    try:
        # Calculate time range - USE UTC to match Coinbase API expectations
        end_time = datetime.now(tz=pd.Timestamp.now().tz)  # Use UTC
        start_time = end_time - timedelta(hours=hours)
        
        # Coinbase public API for historical candles
        url = "https://api.exchange.coinbase.com/products/BTC-USD/candles"
        params = {
            'start': start_time.isoformat(),
            'end': end_time.isoformat(),
            'granularity': 3600 if hours > 24 else 300  # 1 hour for >24h, 5 min for <24h
        }
        
        # logger.info(f"Fetching {hours}h of Bitcoin historical data from Coinbase...")
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if not data:
            logger.warning("No historical data received from Coinbase")
            return pd.DataFrame()
        
        # Convert to DataFrame
        # Coinbase returns: [timestamp, low, high, open, close, volume]
        df = pd.DataFrame(data, columns=['timestamp', 'low', 'high', 'open', 'close', 'volume'])
        
        # Convert timestamp to datetime (UTC timezone-aware)
        df['time'] = pd.to_datetime(df['timestamp'], unit='s', utc=True)
        
        # Sort by time (oldest first)
        df = df.sort_values('time')
          # Convert price to float
        df['price'] = pd.to_numeric(df['close'], errors='coerce')
        
        # Debug: Log the latest historical timestamp vs current time
        if not df.empty:
            latest_historical = df['time'].iloc[-1]
            current_time = pd.Timestamp.now(tz='UTC')
            gap_minutes = (current_time - latest_historical).total_seconds() / 60
            logger.info(f"Historical data gap: {gap_minutes:.1f} minutes (Latest: {latest_historical}, Now: {current_time})")
        
        # logger.info(f"Successfully fetched {len(df)} Bitcoin data points")
        return df[['time', 'price']].dropna()
        
    except Exception as e:
        logger.error(f"Error fetching Bitcoin historical data: {e}")
        return pd.DataFrame()

def update_bitcoin_chart(live_bitcoin_price=None, timeframe_hours=24):
    """
    Update Bitcoin chart with real historical data + live price
    
    Args:
        live_bitcoin_price: Current Bitcoin price from WebSocket
        timeframe_hours: Hours of historical data to show
    """
    fig = go.Figure()
    
    try:
        # Get historical data
        historical_df = get_coinbase_historical_bitcoin(hours=timeframe_hours)
        
        if not historical_df.empty:
            # Add historical price line - Modern approach using .to_numpy() instead of deprecated .dt.to_pydatetime()
            fig.add_trace(go.Scatter(
                x=historical_df['time'].to_numpy(),
                y=historical_df['price'],
                mode='lines',
                name='Bitcoin Historical',
                line=dict(color='#f7931a', width=2),                hovertemplate='<b>Bitcoin Historical</b><br>' +
                            'Price: $%{y:,.2f}<br>' +
                            'Time: %{x}<br>' +
                            '<extra></extra>'
            ))            # Add current live price point if available
            if live_bitcoin_price:
                # Connect live price to historical line seamlessly
                if not historical_df.empty:
                    last_historical_time = historical_df['time'].iloc[-1]
                    last_historical_price = historical_df['price'].iloc[-1]
                    
                    # Use current time for live price
                    current_time = pd.Timestamp.now(tz='UTC')
                    
                    # Calculate the time gap between last historical data and now
                    time_gap = (current_time - last_historical_time).total_seconds() / 60  # minutes
                    
                    # If gap is reasonable (< 15 minutes), connect with a line
                    # If gap is too large, show as separate point
                    if time_gap <= 15:
                        # Connect with a dotted line to show it's live/estimated
                        fig.add_trace(go.Scatter(
                            x=[last_historical_time, current_time],
                            y=[last_historical_price, live_bitcoin_price],
                            mode='lines',
                            name='Live Connection',
                            line=dict(color='#f7931a', width=1, dash='dot'),
                            showlegend=False,
                            hoverinfo='skip'
                        ))
                    
                    # Add the live price marker
                    fig.add_trace(go.Scatter(
                        x=[current_time],
                        y=[live_bitcoin_price],
                        mode='markers',
                        name='Live Price',
                        marker=dict(
                            color='#00ff00',
                            size=10,
                            symbol='circle',
                            line=dict(color='#1e293b', width=2)
                        ),
                        hovertemplate='Live Bitcoin<br>' +
                                    'Price: $%{y:,.2f}<br>' +
                                    'Time: %{x}<br>' +
                                    '<extra></extra>',
                        showlegend=True                    ))
                else:
                    # No historical data, show live price only
                    current_time = pd.Timestamp.now(tz='UTC')
                    fig.add_trace(go.Scatter(
                        x=[current_time],
                        y=[live_bitcoin_price],
                        mode='markers',
                        name='Live Price',
                        marker=dict(
                            color='#00ff00',
                            size=12,
                            symbol='circle',
                            line=dict(color='#1e293b', width=2)
                        ),
                        hovertemplate='<b>Live Bitcoin</b><br>' +
                                    'Price: $%{y:,.2f}<br>' +
                                    'Time: %{x}<br>' +
                                    '<extra></extra>',
                        showlegend=True
                    ))
                
            # logger.info(f"Updated Bitcoin chart with historical data and live price: ${live_bitcoin_price:,.2f}")
            # else:
            #     logger.info(f"Updated Bitcoin chart with {len(historical_df)} historical points")
        else:
            # Fallback: show live price only if no historical data
            if live_bitcoin_price:
                current_time = pd.Timestamp.now(tz='UTC')
                past_time = current_time - pd.Timedelta(hours=1)
                
                fig.add_trace(go.Scatter(
                    x=[past_time, current_time],
                    y=[live_bitcoin_price, live_bitcoin_price],
                    mode='lines+markers',
                    name='Bitcoin (Live Only)',
                    line=dict(color='#f7931a', width=2),
                    marker=dict(size=8, color='#00ff00'),                    hovertemplate='<b>Bitcoin (Live Only)</b><br>' +
                                'Price: $%{y:,.2f}<br>' +
                                'Time: %{x}<br>' +
                                '<extra></extra>'
                ))
                
                logger.warning("No historical data available, showing live price only")
    
    except Exception as e:
        logger.error(f"Error updating Bitcoin chart: {e}")
        # Show error message in chart
        fig.add_annotation(
            text=f"Error loading Bitcoin data: {str(e)[:50]}...",
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=16, color="red")
        )
      # Update layout for dark mode compatibility
    timeframe_label = f"{timeframe_hours}h" if timeframe_hours < 24 else f"{int(timeframe_hours/24)}d"
    
    fig.update_layout(
        title=f"₿ Bitcoin Price - {timeframe_label} Historical + Live",
        xaxis_title="Time",
                yaxis_title="Price (USD)",
        height=400,
        showlegend=True,
        paper_bgcolor='rgba(0,0,0,0)',  # Transparent background
        plot_bgcolor='rgba(0,0,0,0)',   # Transparent plot area
        margin=dict(l=50, r=20, t=60, b=40),
        font=dict(color='#f8fafc', family='Inter, sans-serif'),  # Light text for dark mode
        title_font=dict(color='#f8fafc', size=16),
        xaxis=dict(
            gridcolor='#475569',  # Dark grid lines
            linecolor='#475569',
            tickcolor='#475569',
            title_font=dict(color='#cbd5e1'),
            tickfont=dict(color='#cbd5e1'),
            showgrid=True,
            gridwidth=1,
            type='date'
        ),
        yaxis=dict(
            gridcolor='#475569',  # Dark grid lines
            linecolor='#475569',
            tickcolor='#475569',
            title_font=dict(color='#cbd5e1'),
            tickfont=dict(color='#cbd5e1'),
            showgrid=True,
            gridwidth=1
        ),
        legend=dict(
            bgcolor='rgba(30, 41, 59, 0.8)',  # Semi-transparent dark background
            bordercolor='#475569',
            borderwidth=1,
            font=dict(color='#f8fafc'),
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        ),
        hovermode='x unified',  # Better hover experience
        hoverlabel=dict(
            bgcolor='#1e293b',
            bordercolor='#475569',
            font_color='#f8fafc'
        )
    )
    
    return fig
