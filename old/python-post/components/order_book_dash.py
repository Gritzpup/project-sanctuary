#!/usr/bin/env python3
"""
Order Book Component for Real-time Market Data Display - Pure Dash Version
Clean implementation without any Streamlit dependencies
"""
from dash import html, dcc, Input, Output, callback
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import requests
import time
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
import json

class DashOrderBookComponent:
    """Real-time order book display component for Dash"""
    
    def __init__(self, alpaca_api_key: str = None, alpaca_secret_key: str = None, base_url: str = "https://paper-api.alpaca.markets"):
        self.api_key = alpaca_api_key
        self.secret_key = alpaca_secret_key
        self.base_url = base_url
        self.headers = {
            "APCA-API-KEY-ID": alpaca_api_key or "",
            "APCA-API-SECRET-KEY": alpaca_secret_key or "",
            "Content-Type": "application/json"
        }
        
    def fetch_quote_data(self, symbol: str) -> Optional[Dict]:
        """Fetch real-time quote data for a symbol"""
        try:
            # For demo purposes, generate mock data
            # In production, replace with actual Alpaca API calls
            return self._generate_mock_quote_data(symbol)
        except Exception as e:
            print(f"Error fetching quote for {symbol}: {e}")
            return None
            
    def _generate_mock_quote_data(self, symbol: str) -> Dict:
        """Generate realistic mock order book data for testing"""
        base_price = 50000 if "BTC" in symbol else 3000  # Bitcoin vs Ethereum
        
        # Generate bids (below current price)
        bids = []
        for i in range(10):
            price = base_price - (i + 1) * random.uniform(1, 50)
            size = random.uniform(0.1, 5.0)
            bids.append({"price": price, "size": size})
            
        # Generate asks (above current price)  
        asks = []
        for i in range(10):
            price = base_price + (i + 1) * random.uniform(1, 50)
            size = random.uniform(0.1, 5.0)
            asks.append({"price": price, "size": size})
            
        return {
            "bids": bids,
            "asks": asks,
            "mid_price": base_price,
            "spread": asks[0]["price"] - bids[0]["price"] if asks and bids else 0
        }
        
    def create_order_book_chart(self, quote_data: Dict) -> go.Figure:
        """Create order book visualization"""
        if not quote_data or not quote_data.get("bids") or not quote_data.get("asks"):
            return go.Figure().add_annotation(
                text="No order book data available",
                xref="paper", yref="paper", x=0.5, y=0.5,
                showarrow=False, font_size=16
            )
            
        fig = go.Figure()
        
        # Add bids (green bars on left)
        bid_prices = [bid["price"] for bid in quote_data["bids"]]
        bid_sizes = [bid["size"] for bid in quote_data["bids"]]
        
        fig.add_trace(go.Bar(
            x=[-size for size in bid_sizes],  # Negative for left side
            y=bid_prices,
            orientation='h',
            marker_color='rgba(38, 166, 154, 0.7)',
            name='Bids',
            hovertemplate='Price: $%{y:,.2f}<br>Size: %{x:,.3f}<extra></extra>'
        ))
        
        # Add asks (red bars on right)
        ask_prices = [ask["price"] for ask in quote_data["asks"]]
        ask_sizes = [ask["size"] for ask in quote_data["asks"]]
        
        fig.add_trace(go.Bar(
            x=ask_sizes,
            y=ask_prices,
            orientation='h',
            marker_color='rgba(239, 83, 80, 0.7)',
            name='Asks',
            hovertemplate='Price: $%{y:,.2f}<br>Size: %{x:,.3f}<extra></extra>'
        ))
        
        # Add mid price line
        mid_price = quote_data.get("mid_price", 0)
        fig.add_hline(
            y=mid_price,
            line_dash="dash",
            line_color="yellow",
            annotation_text=f"Mid: ${mid_price:,.2f}"
        )
        
        fig.update_layout(
            title="Order Book Depth",
            xaxis_title="Order Size",
            yaxis_title="Price ($)",
            height=400,
            template="plotly_dark",
            showlegend=True,
            xaxis=dict(zeroline=True, zerolinecolor='white'),
            margin=dict(l=60, r=60, t=60, b=60)
        )
        
        return fig
        
    def create_recent_trades_chart(self, symbol: str) -> go.Figure:
        """Create recent trades visualization"""
        # Generate mock trade data
        trades_data = self._generate_mock_trades_data(symbol)
        
        if not trades_data:
            return go.Figure().add_annotation(
                text="No recent trades available",
                xref="paper", yref="paper", x=0.5, y=0.5,
                showarrow=False, font_size=16
            )
            
        df = pd.DataFrame(trades_data)
        
        fig = go.Figure()
        
        # Color trades by type
        colors = ['green' if side == 'buy' else 'red' for side in df['side']]
        
        fig.add_trace(go.Scatter(
            x=df['timestamp'],
            y=df['price'],
            mode='markers',
            marker=dict(
                color=colors,
                size=df['size'] * 3,  # Scale marker size by trade size
                opacity=0.7
            ),
            hovertemplate='Time: %{x}<br>Price: $%{y:,.2f}<br>Size: %{text}<extra></extra>',
            text=df['size'],
            name='Trades'
        ))
        
        fig.update_layout(
            title="Recent Trades",
            xaxis_title="Time",
            yaxis_title="Price ($)",
            height=300,
            template="plotly_dark",
            showlegend=False
        )
        
        return fig
        
    def _generate_mock_trades_data(self, symbol: str) -> List[Dict]:
        """Generate mock recent trades data"""
        base_price = 50000 if "BTC" in symbol else 3000
        trades = []
        
        for i in range(20):
            timestamp = datetime.now() - timedelta(minutes=i)
            price = base_price + random.uniform(-100, 100)
            size = random.uniform(0.01, 2.0)
            side = random.choice(['buy', 'sell'])
            
            trades.append({
                'timestamp': timestamp,
                'price': price,
                'size': size,
                'side': side
            })
            
        return sorted(trades, key=lambda x: x['timestamp'])
        
    def get_dash_layout(self, symbol: str = "BTC/USD") -> html.Div:
        """Get complete Dash layout for order book component"""
        symbol_id = symbol.replace('/', '-').lower()
        
        return dbc.Card([
            dbc.CardHeader([
                html.H4(f"📊 {symbol} Order Book", className="mb-0"),
                dbc.Badge("Live", color="success", className="ms-2")
            ]),
            dbc.CardBody([
                dbc.Row([
                    dbc.Col([
                        html.Div(id=f"order-book-chart-{symbol_id}")
                    ], width=12)
                ]),
                dbc.Row([
                    dbc.Col([
                        html.Div(id=f"trades-chart-{symbol_id}")
                    ], width=12)
                ], className="mt-3"),
                dbc.Row([
                    dbc.Col([
                        html.Div(id=f"order-book-stats-{symbol_id}")
                    ], width=12)
                ], className="mt-3")
            ])
        ], className="mb-4")
        
    def register_callbacks(self, app, symbol: str = "BTC/USD"):
        """Register Dash callbacks for real-time updates"""
        symbol_id = symbol.replace('/', '-').lower()
        
        @app.callback(
            [Output(f"order-book-chart-{symbol_id}", "children"),
             Output(f"trades-chart-{symbol_id}", "children"),
             Output(f"order-book-stats-{symbol_id}", "children")],
            [Input(f"order-book-interval-{symbol_id}", "n_intervals")]
        )
        def update_order_book_data(n_intervals):
            """Update order book and trades data"""
            
            # Fetch fresh data
            quote_data = self.fetch_quote_data(symbol)
            
            if quote_data:
                # Create charts
                order_book_chart = dcc.Graph(
                    figure=self.create_order_book_chart(quote_data),
                    style={'height': '400px'}
                )
                
                trades_chart = dcc.Graph(
                    figure=self.create_recent_trades_chart(symbol),
                    style={'height': '300px'}
                )
                
                # Create stats
                spread = quote_data.get('spread', 0)
                mid_price = quote_data.get('mid_price', 0)
                spread_pct = (spread / mid_price * 100) if mid_price > 0 else 0
                
                stats = dbc.Alert([
                    html.Strong(f"Mid Price: ${mid_price:,.2f}"),
                    html.Span(f" | Spread: ${spread:.2f} ({spread_pct:.3f}%)", className="ms-2"),
                    html.Span(f" | Last Update: {datetime.now().strftime('%H:%M:%S')}", className="ms-2")
                ], color="info", className="mb-0")
                
                return order_book_chart, trades_chart, stats
            else:
                error_msg = html.Div("Error loading order book data", 
                                   style={'color': 'red', 'text-align': 'center', 'padding': '20px'})
                return error_msg, error_msg, error_msg

# Convenience function
def create_order_book_component(symbol: str = "BTC/USD", 
                               alpaca_api_key: str = None, 
                               alpaca_secret_key: str = None) -> DashOrderBookComponent:
    """Create and return a Dash order book component"""
    return DashOrderBookComponent(alpaca_api_key, alpaca_secret_key)

# Usage example
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Test the order book component
    api_key = os.getenv("ALPACA_API_KEY")
    secret_key = os.getenv("ALPACA_SECRET_KEY")
    
    order_book = DashOrderBookComponent(api_key, secret_key)
    print("Dash order book component initialized successfully")
    print("Use order_book.get_dash_layout() to get the Dash layout")
    print("Don't forget to call order_book.register_callbacks(app) in your Dash app")
