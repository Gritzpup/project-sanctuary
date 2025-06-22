#!/usr/bin/env python3
"""
Order Book Component for Real-time Market Data Display - Dash Version
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
import asyncio
import aiohttp
import json

class OrderBookComponent:
    """Real-time order book display component"""
    
    def __init__(self, alpaca_api_key: str, alpaca_secret_key: str, base_url: str = "https://paper-api.alpaca.markets"):
        self.api_key = alpaca_api_key
        self.secret_key = alpaca_secret_key
        self.base_url = base_url
        self.headers = {
            "APCA-API-KEY-ID": self.api_key,
            "APCA-API-SECRET-KEY": self.secret_key,
            "Content-Type": "application/json"
        }
    
    def get_latest_quote(self, symbol: str = "BTC/USD") -> Optional[Dict[str, Any]]:
        """Get latest bid/ask data for crypto symbol"""
        try:
            endpoint = f"{self.base_url}/v1beta1/crypto/latest/quotes?symbols={symbol}"
            response = requests.get(endpoint, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "quotes" in data and symbol in data["quotes"]:
                    quote = data["quotes"][symbol]
                    return {
                        "bid_price": float(quote.get("bid_price", 0)),
                        "ask_price": float(quote.get("ask_price", 0)),
                        "bid_size": float(quote.get("bid_size", 0)),
                        "ask_size": float(quote.get("ask_size", 0)),
                        "timestamp": quote.get("timestamp"),
                        "spread": float(quote.get("ask_price", 0)) - float(quote.get("bid_price", 0)),
                        "mid_price": (float(quote.get("bid_price", 0)) + float(quote.get("ask_price", 0))) / 2
                    }
        except Exception as e:
            st.error(f"Error fetching quote for {symbol}: {e}")
        return None
    
    def get_recent_trades(self, symbol: str = "BTC/USD", limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent trades for a symbol"""
        try:
            # Get latest bars as proxy for recent trades
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=1)
            
            endpoint = f"{self.base_url}/v1beta1/crypto/bars"
            params = {
                "symbols": symbol,
                "timeframe": "1Min",
                "start": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end": end_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "limit": limit
            }
            
            response = requests.get(endpoint, headers=self.headers, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "bars" in data and symbol in data["bars"]:
                    bars = data["bars"][symbol]
                    trades = []
                    for bar in bars[-20:]:  # Get last 20 bars
                        trades.append({
                            "timestamp": bar.get("t"),
                            "price": float(bar.get("c", 0)),  # close price
                            "volume": float(bar.get("v", 0)),
                            "side": "buy" if random.choice([True, False]) else "sell"  # Simulated
                        })
                    return trades
        except Exception as e:
            st.error(f"Error fetching trades for {symbol}: {e}")
        return []
    
    def generate_mock_order_book(self, mid_price: Union[str, float], depth: int = 10) -> Dict[str, List[Dict]]:
        """Generate mock order book data around mid price or symbol"""
        import random
        # If a symbol string is provided, fetch the latest mid price
        if isinstance(mid_price, str):
            quote = self.get_latest_quote(mid_price)
            mid_price_val = quote['mid_price'] if quote and 'mid_price' in quote else 0.0
        else:
            mid_price_val = mid_price
        bids = []
        asks = []
        
        # Generate bid levels (below mid_price_val)
        for i in range(depth):
            price = mid_price_val - (i + 1) * random.uniform(0.1, 5.0)
            size = random.uniform(0.1, 2.0)
            bids.append({
                "price": round(price, 2),
                "size": round(size, 4),
                "total": round(sum([b["size"] for b in bids]) + size, 4)
            })
        # Generate ask levels (above mid_price_val)
        for i in range(depth):
            price = mid_price_val + (i + 1) * random.uniform(0.1, 5.0)
            size = random.uniform(0.1, 2.0)
            asks.append({
                "price": round(price, 2),
                "size": round(size, 4),
                "total": round(sum([a["size"] for a in asks]) + size, 4)
            })
        return {
            "bids": sorted(bids, key=lambda x: x["price"], reverse=True),
            "asks": sorted(asks, key=lambda x: x["price"])
        }
    
    def render_order_book(self, symbol: str = "BTC/USD"):
        """Render the order book component"""
        st.markdown("### 📊 Real-time Order Book")
        
        # Create columns for layout
        col1, col2, col3 = st.columns([2, 2, 1])
        
        with col3:
            auto_refresh = st.checkbox("Auto Refresh", value=True)
            refresh_interval = st.slider("Refresh (seconds)", 1, 10, 3)
        
        # Get latest quote data
        quote = self.get_latest_quote(symbol)
        
        if quote:
            # Display current price info
            with col1:
                st.metric(
                    label=f"{symbol} Bid",
                    value=f"${quote['bid_price']:,.2f}",
                    delta=f"Size: {quote['bid_size']:.4f}"
                )
            
            with col2:
                st.metric(
                    label=f"{symbol} Ask", 
                    value=f"${quote['ask_price']:,.2f}",
                    delta=f"Size: {quote['ask_size']:.4f}"
                )
            
            # Generate order book data
            order_book = self.generate_mock_order_book(quote['mid_price'])
            
            # Create order book visualization
            self.render_order_book_chart(order_book, quote['mid_price'])
            
            # Display order book table
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("#### 🟢 Bids")
                bids_df = pd.DataFrame(order_book['bids'])
                if not bids_df.empty:
                    # Color code the rows
                    st.dataframe(
                        bids_df,
                        use_container_width=True,
                        hide_index=True
                    )
            
            with col2:
                st.markdown("#### 🔴 Asks")
                asks_df = pd.DataFrame(order_book['asks'])
                if not asks_df.empty:
                    st.dataframe(
                        asks_df,
                        use_container_width=True,
                        hide_index=True
                    )
            
            # Display spread information
            spread_pct = (quote['spread'] / quote['mid_price']) * 100
            st.info(f"**Spread**: ${quote['spread']:.2f} ({spread_pct:.3f}%) | **Mid Price**: ${quote['mid_price']:,.2f}")
            
        else:
            st.error(f"Unable to fetch order book data for {symbol}")
        
        # Auto refresh
        if auto_refresh:
            time.sleep(refresh_interval)
            st.rerun()
    
    def render_order_book_chart(self, order_book: Dict, mid_price: float):
        """Render order book depth chart"""
        try:
            bids_df = pd.DataFrame(order_book['bids'])
            asks_df = pd.DataFrame(order_book['asks'])
            
            fig = go.Figure()
            
            # Add bid side (green)
            if not bids_df.empty:
                fig.add_trace(go.Scatter(
                    x=bids_df['price'],
                    y=bids_df['total'],
                    mode='lines',
                    fill='tonexty',
                    name='Bids',
                    line=dict(color='green'),
                    fillcolor='rgba(0, 255, 0, 0.3)'
                ))
            
            # Add ask side (red)
            if not asks_df.empty:
                fig.add_trace(go.Scatter(
                    x=asks_df['price'],
                    y=asks_df['total'],
                    mode='lines',
                    fill='tonexty',
                    name='Asks',
                    line=dict(color='red'),
                    fillcolor='rgba(255, 0, 0, 0.3)'
                ))
            
            # Add mid price line
            max_total = max(
                bids_df['total'].max() if not bids_df.empty else 0,
                asks_df['total'].max() if not asks_df.empty else 0
            )
            
            fig.add_vline(
                x=mid_price,
                line_dash="dash",
                line_color="blue",
                annotation_text=f"Mid: ${mid_price:,.2f}"
            )
            
            fig.update_layout(
                title="Order Book Depth",
                xaxis_title="Price ($)",
                yaxis_title="Cumulative Size",
                showlegend=True,
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
        except Exception as e:
            st.error(f"Error rendering order book chart: {e}")
    
    def render_recent_trades(self, symbol: str = "BTC/USD"):
        """Render recent trades component"""
        st.markdown("### 📈 Recent Trades")
        
        trades = self.get_recent_trades(symbol)
        
        if trades:
            trades_df = pd.DataFrame(trades)
            trades_df['timestamp'] = pd.to_datetime(trades_df['timestamp'])
            trades_df = trades_df.sort_values('timestamp', ascending=False)
            
            # Color code by side
            def color_trades(val):
                if val == 'buy':
                    return 'background-color: rgba(0, 255, 0, 0.3)'
                else:
                    return 'background-color: rgba(255, 0, 0, 0.3)'
            
            styled_df = trades_df.style.apply(lambda x: [color_trades(val) for val in x], subset=['side'])
            
            st.dataframe(
                styled_df,
                use_container_width=True,
                hide_index=True
            )
            
            # Price trend chart
            fig = px.line(
                trades_df,
                x='timestamp',
                y='price',
                title=f"{symbol} Recent Price Movement",
                color_discrete_sequence=['blue']
            )
            
            fig.update_layout(                xaxis_title="Time",
                yaxis_title="Price ($)",
                height=300
            )
            
            return dcc.Graph(figure=fig, style={'height': '300px'})
        else:
            return html.Div("No recent trades available for " + symbol, 
                          style={'color': 'orange', 'text-align': 'center', 'padding': '20px'})

    def get_dash_layout(self, symbol: str = "BTC/USD") -> html.Div:
        """Get complete Dash layout for order book component"""
        return html.Div([
            html.H3(f"{symbol} Order Book", className="mb-3"),
            html.Div(id=f"order-book-{symbol.replace('/', '-')}", children="Loading order book..."),
            html.H3(f"{symbol} Recent Trades", className="mb-3 mt-4"),
            html.Div(id=f"recent-trades-{symbol.replace('/', '-')}", children="Loading recent trades..."),
            dcc.Interval(
                id=f"order-book-interval-{symbol.replace('/', '-')}",
                interval=5000,  # Update every 5 seconds
                n_intervals=0
            )
        ])

# Usage example and testing
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Test the order book component
    api_key = os.getenv("ALPACA_API_KEY")
    secret_key = os.getenv("ALPACA_SECRET_KEY")
    
    if api_key and secret_key:
        order_book = OrderBookComponent(api_key, secret_key)
        print("Order book component initialized successfully")
        print("Use order_book.get_dash_layout() to get the Dash layout")
    else:
        print("Please set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables")
