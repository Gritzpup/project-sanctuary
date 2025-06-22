"""
Sidebar Components Module

This module contains sidebar components extracted from streamlit_app.py
for better code organization and maintainability.
"""

import streamlit as st
import os
from services.data_service import fetch_alpaca_portfolio_data


def initialize_session_state():
    """Initialize all session state variables"""
    if 'trading_mode' not in st.session_state:
        st.session_state.trading_mode = 'Backtest'
    if 'starting_balance' not in st.session_state:
        st.session_state.starting_balance = 1000.0
    if 'vault_allocation_pct' not in st.session_state:
        st.session_state.vault_allocation_pct = 1.0
    if 'maker_fee_rate' not in st.session_state:
        st.session_state.maker_fee_rate = 0.006  # 0.6%
    if 'taker_fee_rate' not in st.session_state:
        st.session_state.taker_fee_rate = 0.012  # 1.2%
    if 'alpaca_connected' not in st.session_state:
        st.session_state.alpaca_connected = False


def render_trading_mode_selector():
    """Render the trading mode selector with status indicators"""
    current_mode = st.session_state.get('trading_mode', 'Backtest')
    mode_display = {
        'Backtest': '📊 Backtesting Mode',
        'Paper Trading': '🚀 Paper Trading Mode', 
        'Live Trading': '💰 Live Trading Mode'
    }
    st.markdown(f"### 🔄 {mode_display.get(current_mode, 'Trading Mode')}")
    
    # Get current mode from session state or default to Backtesting
    current_mode_index = 0
    if st.session_state.trading_mode == 'Paper Trading':
        current_mode_index = 1
    elif st.session_state.trading_mode == 'Live Trading':
        current_mode_index = 2
        
    trading_mode = st.selectbox(
        "Select Trading Mode",
        ["📊 Backtesting", "🚀 Paper Trading", "💰 Live Trading"],
        index=current_mode_index,
        help="Choose your trading mode"
    )
    
    # Update session state if mode changed
    mode_mapping = {
        "📊 Backtesting": "Backtest",
        "🚀 Paper Trading": "Paper Trading", 
        "💰 Live Trading": "Live Trading"
    }
    st.session_state.trading_mode = mode_mapping[trading_mode]
    
    return trading_mode


def render_mode_status_indicators(trading_mode):
    """Render status indicators for each trading mode"""
    if trading_mode == "📊 Backtesting":
        st.success("🟢 Backtesting Mode Active")
        st.caption("• Historical data analysis")
        st.caption("• Strategy simulation")
        st.caption("• Risk-free testing")
    elif trading_mode == "🚀 Paper Trading":
        st.info("🔵 Paper Trading Mode Active")
        st.caption("• Real-time market data")
        st.caption("• Simulated trades with real prices")
        st.caption("• Alpaca Paper Trading API")
    else:
        st.warning("🟡 Live Trading - Coming Soon!")
        with st.expander("🚀 Live Trading Features", expanded=False):
            st.markdown("**🔜 Coming Soon - Advanced Features:**")
            st.markdown("• Real money trading execution")
            st.markdown("• Advanced risk management")
            st.markdown("• Portfolio protection systems")
            st.markdown("• Multi-exchange connectivity")
            st.markdown("• Advanced order types")
            st.markdown("• Real-time alerts & notifications")
            st.info("💡 **Note**: Live trading will include comprehensive risk management, position sizing algorithms, and advanced order execution strategies.")


def render_account_settings():
    """Render account configuration settings"""
    st.markdown("### 💰 Account Settings")
    
    # Starting balance with session state persistence
    starting_balance = st.number_input(
        "Starting Balance (USD)",
        min_value=100.0,
        max_value=100000.0,
        value=st.session_state.starting_balance,
        step=100.0,
        help="Initial account balance for trading"
    )
    
    # Vault allocation setting with enhanced validation
    vault_allocation_pct = st.slider(
        "Vault Allocation (%)",
        min_value=0.5,
        max_value=5.0,
        value=st.session_state.vault_allocation_pct,
        step=0.1,
        help="Percentage of profits allocated to USDC vault"
    )
    
    # Update session state
    st.session_state.starting_balance = starting_balance
    st.session_state.vault_allocation_pct = vault_allocation_pct
    
    return starting_balance, vault_allocation_pct


def render_mode_specific_settings(trading_mode):
    """Render mode-specific configuration settings"""
    if trading_mode == "📊 Backtesting":
        st.markdown("#### ⚙️ Backtesting Configuration")
        
        # Fee settings for backtesting
        st.markdown("**Trading Fees**")
        maker_fee = st.number_input(
            "Maker Fee (%)",
            min_value=0.0,
            max_value=2.0,
            value=st.session_state.maker_fee_rate * 100,
            step=0.01,
            help="Fee for providing liquidity (maker orders)"
        ) / 100
        
        taker_fee = st.number_input(
            "Taker Fee (%)",
            min_value=0.0,
            max_value=2.0,
            value=st.session_state.taker_fee_rate * 100,
            step=0.01,
            help="Fee for taking liquidity (taker orders)"
        ) / 100
        
        # Update session state
        st.session_state.maker_fee_rate = maker_fee
        st.session_state.taker_fee_rate = taker_fee
        
        st.caption(f"💡 Current fees: Maker {maker_fee*100:.2f}%, Taker {taker_fee*100:.2f}%")
        
    elif trading_mode == "🚀 Paper Trading":
        render_alpaca_connection_section()


def render_alpaca_connection_section():
    """Render Alpaca connection section for paper trading"""
    st.markdown("#### 🔗 Alpaca Connection")
    
    # Check if Alpaca credentials are configured
    api_key = os.getenv("ALPACA_API_KEY", "")
    has_credentials = api_key and api_key != "your_api_key_here"
    
    if has_credentials:
        st.success("✅ Alpaca API credentials configured")
        if st.button("🔄 Test Connection"):
            with st.spinner("Testing Alpaca connection..."):
                portfolio_data = fetch_alpaca_portfolio_data()
                if portfolio_data:
                    st.success("🎉 Successfully connected to Alpaca Paper Trading!")
                    st.session_state.alpaca_connected = True
                else:
                    st.error("❌ Failed to connect to Alpaca API")
                    st.session_state.alpaca_connected = False
    else:
        st.warning("⚠️ Alpaca API credentials not configured")
        st.info("Please set ALPACA_API_KEY and ALPACA_SECRET_KEY in your .env file")
        st.session_state.alpaca_connected = False


def render_strategy_selection():
    """Render strategy selection dropdown"""
    strategy = st.selectbox(
        "Select Strategy",
        ["Always Gain BTC", "MA Crossover", "RSI Momentum"],
        index=0
    )
    return strategy


def render_refresh_controls():
    """Render auto-refresh controls"""
    auto_refresh = st.checkbox("🔄 Auto Refresh", value=True)
    refresh_rate = None
    
    if auto_refresh:
        refresh_rate = st.slider("Refresh Rate (seconds)", 1, 60, 10)
    
    return auto_refresh, refresh_rate


def render_connection_status():
    """Render connection status indicators"""
    st.markdown("## 📡 Status")
    col1, col2 = st.columns(2)
    with col1:
        st.metric("🔌 API", "Connected", delta="✅")
    with col2:
        st.metric("📊 Data", "Live", delta="🟢")


def render_current_settings_display(trading_mode, starting_balance, vault_allocation_pct):
    """Display current settings summary"""
    st.markdown("**Current Settings:**")
    st.markdown(f"• Mode: {trading_mode}")
    st.markdown(f"• Balance: ${starting_balance:,.2f}")
    st.markdown(f"• Vault: {vault_allocation_pct}%")


def render_sidebar():
    """Render the complete sidebar with all components"""
    # Header
    st.image("https://via.placeholder.com/300x100/1f77b4/white?text=ALPACA+TRADER", width=300)
    st.markdown("## 🎛️ Control Panel")
    
    # Trading Mode Selector
    trading_mode = render_trading_mode_selector()
    render_mode_status_indicators(trading_mode)
    
    st.markdown("---")
    
    # Account Settings
    starting_balance, vault_allocation_pct = render_account_settings()
    
    # Mode-specific settings
    render_mode_specific_settings(trading_mode)
    
    # Update session state
    st.session_state.trading_mode = trading_mode
    st.session_state.starting_balance = starting_balance
    st.session_state.vault_allocation_pct = vault_allocation_pct
    
    # Display current settings
    render_current_settings_display(trading_mode, starting_balance, vault_allocation_pct)
    
    st.markdown("---")
    
    # Strategy Selection
    strategy = render_strategy_selection()
    
    st.markdown("---")
    
    # Refresh Controls
    auto_refresh, refresh_rate = render_refresh_controls()
    
    st.markdown("---")
    
    # Connection Status
    render_connection_status()
    
    return strategy, auto_refresh, refresh_rate
