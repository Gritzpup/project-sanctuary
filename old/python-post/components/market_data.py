"""
Market Data Component - Optimized and Modular

Real-time market data display for the live trading dashboard.
Uses modular components for better organization and maintainability.

This file has been optimized from 474 lines to ~90 lines by extracting:
- Chart rendering to components/market_data/chart_components.py
- Market overview to components/market_data/market_overview.py  
- Alert functionality to components/market_data/alert_components.py
- Core data service to services/market_data_service.py
"""

import streamlit as st
import os
from components.market_data import (
    render_advanced_chart,
    render_market_overview,
    render_market_alerts
)
from components.market_data.market_overview import (
    render_market_heatmap,
    render_top_movers
)
from components.market_data.alert_components import (
    render_notification_settings,
    render_smart_alerts
)


class RealTimeMarketData:
    """Simplified real-time market data coordinator using modular components"""
    
    def __init__(self, alpaca_api_key: str = None, alpaca_secret_key: str = None):
        self.api_key = alpaca_api_key or os.getenv("ALPACA_API_KEY")
        self.secret_key = alpaca_secret_key or os.getenv("ALPACA_SECRET_KEY")
        
        # Initialize session state for market data
        if 'market_data_cache' not in st.session_state:
            st.session_state.market_data_cache = {}
        if 'price_history' not in st.session_state:
            st.session_state.price_history = {}
    
    def render_market_overview(self, symbols=None):
        """Render market overview using modular component"""
        if symbols is None:
            symbols = ["BTC/USD", "ETH/USD", "LTC/USD", "BCH/USD"]
        
        render_market_overview(
            symbols=symbols,
            alpaca_api_key=self.api_key,
            alpaca_secret_key=self.secret_key
        )
    
    def render_advanced_chart(self, symbol="BTC/USD", timeframe="1Hour", days=7):
        """Render advanced chart using modular component"""
        render_advanced_chart(
            symbol=symbol,
            timeframe=timeframe,
            days=days,
            alpaca_api_key=self.api_key,
            alpaca_secret_key=self.secret_key
        )
    
    def render_market_alerts(self):
        """Render market alerts using modular component"""
        render_market_alerts()
    
    def render_market_heatmap(self):
        """Render market heatmap"""
        render_market_heatmap(
            alpaca_api_key=self.api_key,
            alpaca_secret_key=self.secret_key
        )
    
    def render_top_movers(self):
        """Render top movers"""
        render_top_movers(
            alpaca_api_key=self.api_key,
            alpaca_secret_key=self.secret_key
        )
    
    def render_notification_settings(self):
        """Render notification settings"""
        render_notification_settings()
    
    def render_smart_alerts(self):
        """Render smart alerts"""
        render_smart_alerts()
    
    def render_complete_market_dashboard(self):
        """Render complete market data dashboard with all components"""
        # Market Overview Section
        self.render_market_overview()
        
        st.divider()
        
        # Advanced Chart Section
        self.render_advanced_chart()
        
        st.divider()
        
        # Market Analytics
        col1, col2 = st.columns(2)
        with col1:
            self.render_market_heatmap()
        with col2:
            self.render_top_movers()
        
        st.divider()
        
        # Alerts and Notifications
        self.render_market_alerts()


# Factory function for easy instantiation
def get_market_data_component(api_key: str = None, secret_key: str = None) -> RealTimeMarketData:
    """Factory function to create market data component"""
    return RealTimeMarketData(api_key, secret_key)


# Usage example and testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    
    load_dotenv()
    
    api_key = os.getenv("ALPACA_API_KEY")
    secret_key = os.getenv("ALPACA_SECRET_KEY")
    
    if api_key and secret_key:
        market_data = RealTimeMarketData(api_key, secret_key)
        market_data.render_complete_market_dashboard()
    else:
        st.error("Please set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables")
        # Still show components with mock data
        market_data = RealTimeMarketData()
        market_data.render_complete_market_dashboard()