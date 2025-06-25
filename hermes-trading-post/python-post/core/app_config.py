"""
Core Application Module

This module contains the core application initialization and configuration
extracted from streamlit_app.py for better code organization.
"""

import streamlit as st
import os
from dotenv import load_dotenv


def configure_page():
    """Configure Streamlit page settings"""
    st.set_page_config(
        page_title="Alpaca Trading Bot",
        page_icon="🚀",
        layout="wide",
        initial_sidebar_state="expanded"
    )


def load_environment():
    """Load environment variables"""
    load_dotenv()


def setup_custom_css():
    """Setup custom CSS for the application"""
    st.markdown("""
    <style>
    .main-header {
        text-align: center;
        color: #1f77b4;
        font-size: 2.5rem;
        font-weight: bold;
        margin-bottom: 2rem;
        padding: 1rem;
        background: linear-gradient(90deg, #1f77b4, #ff7f0e);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    
    .metric-card {
        background: #f0f2f6;
        padding: 1rem;
        border-radius: 10px;
        border-left: 5px solid #1f77b4;
        margin: 0.5rem 0;
    }
    
    .status-indicator {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 8px;
    }
    
    .status-connected {
        background-color: #28a745;
    }
    
    .status-disconnected {
        background-color: #dc3545;
    }
    
    .trading-mode-card {
        border: 2px solid #1f77b4;
        border-radius: 10px;
        padding: 1rem;
        margin: 1rem 0;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }
    </style>
    """, unsafe_allow_html=True)


def check_component_availability():
    """Check availability of optional components"""
    component_status = {
        'order_book': False,
        'market_data': False
    }
    
    try:
        from components.order_book import OrderBookComponent
        component_status['order_book'] = True
        OrderBookComponent_import = OrderBookComponent
    except ImportError:
        OrderBookComponent_import = None
    
    try:
        from components.market_data.real_time_market_data import RealTimeMarketData
        component_status['market_data'] = True
        RealTimeMarketData_import = RealTimeMarketData
    except ImportError:
        RealTimeMarketData_import = None
    
    # Only show warning if both components failed to import
    if not any(component_status.values()):
        st.warning("⚠️ Some optional components are not available")
    
    return component_status, OrderBookComponent_import, RealTimeMarketData_import


def setup_application():
    """Complete application setup"""
    load_environment()
    configure_page()
    setup_custom_css()
    return check_component_availability()
