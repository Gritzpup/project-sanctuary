"""
Always Gain Strategy Components

Contains the specific implementation logic for the Always Gain Bitcoin strategy,
including backtest trade generation, portfolio calculations, and UI rendering.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
import numpy as np

# Import enhanced data services
from services.data_service import get_enhanced_bitcoin_data, is_backend_available


def generate_always_gain_backtest_trades(dates: List[str], prices: List[float], 
                                       entry_threshold: float = 2.0, 
                                       exit_target: float = 5.0) -> List[Dict[str, Any]]:
    """
    Generate realistic Always Gain Bitcoin strategy backtest trades
    
    Args:
        dates: List of date strings
        prices: List of corresponding prices
        entry_threshold: Percentage drop to trigger buy signal
        exit_target: Percentage gain to trigger sell signal
        
    Returns:
        List of trade dictionaries with detailed information
    """
    trades = []
    cash_balance = 10000.0  # Starting with $10,000
    btc_balance = 0.0
    in_position = False
    entry_price = 0.0
    max_position_size = 0.8  # Use 80% of available cash
    
    # Track previous price for percentage calculations
    prev_price = None
    
    for i, (date, price) in enumerate(zip(dates, prices)):
        if prev_price is None:
            prev_price = price
            continue
            
        price_change_pct = (price - prev_price) / prev_price * 100
        
        # Buy signal: Price dropped by entry_threshold and we're not in position
        if not in_position and price_change_pct <= -entry_threshold and cash_balance > 100:
            position_value = cash_balance * max_position_size
            btc_amount = position_value / price
            fee = position_value * 0.012  # 1.2% taker fee
            total_cost = position_value + fee
            
            if total_cost <= cash_balance:
                cash_balance -= total_cost
                btc_balance = btc_amount
                entry_price = price
                in_position = True
                
                trades.append({
                    'date': date,
                    'action': 'BUY',
                    'price': price,
                    'amount': btc_amount,
                    'fee': fee,
                    'balance_after': cash_balance,
                    'trigger': f"Price drop {price_change_pct:.1f}%"
                })
        
        # Sell signal: Price increased by exit_target and we're in position
        elif in_position and price_change_pct >= exit_target:
            position_value = btc_balance * price
            fee = position_value * 0.012  # 1.2% taker fee
            proceeds = position_value - fee
            profit = proceeds - (btc_balance * entry_price)
            
            cash_balance += proceeds
            btc_balance = 0.0
            in_position = False
            
            trades.append({
                'date': date,
                'action': 'SELL',
                'price': price,
                'amount': btc_balance,
                'fee': fee,
                'balance_after': cash_balance,
                'profit': profit,
                'trigger': f"Price gain {price_change_pct:.1f}%"
            })
        
        prev_price = price
    
    return trades


def calculate_portfolio_metrics(backtest_trades: List[Dict[str, Any]], 
                              current_price: float) -> Dict[str, Any]:
    """
    Calculate comprehensive portfolio metrics from backtest trades
    
    Args:
        backtest_trades: List of trade dictionaries
        current_price: Current Bitcoin price
        
    Returns:
        Dictionary with calculated metrics
    """
    if not backtest_trades:
        return {
            'initial_balance': 10000.0,
            'final_balance': 10000.0,
            'total_profit': 0.0,
            'total_return_pct': 0.0,
            'current_btc_balance': 0.0,
            'current_btc_value': 0.0,
            'buy_trades': [],
            'sell_trades': []
        }
    
    # Separate trade types
    buy_trades = [t for t in backtest_trades if t['action'] == 'BUY']
    sell_trades = [t for t in backtest_trades if t['action'] == 'SELL']
    
    # Basic calculations
    initial_balance = 10000.0
    final_balance = backtest_trades[-1]['balance_after'] if backtest_trades else initial_balance
    total_profit = sum(trade.get('profit', 0) for trade in sell_trades)
    total_return_pct = ((final_balance - initial_balance) / initial_balance) * 100
    
    # Calculate current BTC position
    current_btc_balance = 0.0
    current_btc_value = 0.0
    
    # Check if we're currently holding BTC
    if buy_trades and sell_trades:
        if len(buy_trades) > len(sell_trades):
            # We have an open position
            last_buy = buy_trades[-1]
            current_btc_balance = last_buy['amount']
            current_btc_value = current_btc_balance * current_price
    elif buy_trades and not sell_trades:
        # Only buy trades, still holding
        last_buy = buy_trades[-1]
        current_btc_balance = last_buy['amount']
        current_btc_value = current_btc_balance * current_price
    
    return {
        'initial_balance': initial_balance,
        'final_balance': final_balance,
        'total_profit': total_profit,
        'total_return_pct': total_return_pct,
        'current_btc_balance': current_btc_balance,
        'current_btc_value': current_btc_value,
        'buy_trades': buy_trades,
        'sell_trades': sell_trades
    }


def render_strategy_controls() -> Tuple[float, float, float]:
    """
    Render Always Gain strategy configuration controls
    
    Returns:
        Tuple of (entry_threshold, exit_target, vault_allocation)
    """
    st.markdown("### ⚙️ Strategy Settings")
    
    # Strategy parameters
    entry_threshold = st.slider(
        "Entry Threshold (%)",
        min_value=1.0,
        max_value=5.0,
        value=2.0,
        step=0.1,
        help="Buy when BTC drops by this percentage"
    )
    
    exit_target = st.slider(
        "Exit Target (%)",
        min_value=3.0,
        max_value=10.0,
        value=5.0,
        step=0.1,
        help="Sell when profit reaches this percentage"
    )
    
    vault_allocation = st.slider(
        "Vault Allocation (%)",
        min_value=0.5,
        max_value=3.0,
        value=1.0,
        step=0.1,
        help="Percentage of profit to USDC vault"
    )
    
    return entry_threshold, exit_target, vault_allocation


def render_timeframe_selector() -> Tuple[str, str, int]:
    """
    Render comprehensive timeframe selection interface
    
    Returns:
        Tuple of (selected_timeframe, timeframe_code, days_count)
    """
    st.markdown("---")
    st.markdown("### 📅 Time Period Selection")
    
    # Comprehensive time period selection
    time_category = st.selectbox(
        "Time Category",
        ["Short Term", "Medium Term", "Long Term", "Very Long Term", "Historical"],
        index=4,  # Default to Historical
        help="Select time frame category",
        key="time_category_selector"
    )
    
    # Define time options based on category
    time_options = {}
    
    if time_category == "Short Term":
        time_options = {
            "1 Minute": ("1min", 1440),    # 1 day of 1min data
            "5 Minutes": ("5min", 2016),   # 1 week of 5min data  
            "15 Minutes": ("15min", 1344), # 2 weeks of 15min data
            "30 Minutes": ("30min", 1440)  # 1 month of 30min data
        }
    elif time_category == "Medium Term":
        time_options = {
            "1 Hour": ("1hour", 720),      # 1 month of hourly data
            "2 Hours": ("2hour", 720),     # 2 months of 2-hour data
            "4 Hours": ("4hour", 540),     # 3 months of 4-hour data  
            "6 Hours": ("6hour", 480)      # 4 months of 6-hour data
        }
    elif time_category == "Long Term":
        time_options = {
            "1 Day": ("1day", 365)         # 1 year of daily data
        }
    elif time_category == "Very Long Term":
        time_options = {
            "1 Month": ("1month", 36),     # 3 years of monthly data
            "6 Months": ("6month", 20)     # 10 years of 6-month data
        }
    else:  # Historical
        time_options = {
            "1 Year": ("1year", 365),
            "2 Years": ("2year", 730),
            "3 Years": ("3year", 1095),
            "4 Years": ("4year", 1460),
            "5 Years": ("5year", 1825)
        }
    
    selected_timeframe = st.selectbox(
        "Time Period",
        options=list(time_options.keys()),
        index=0,
        help="Select specific time period",
        key=f"timeframe_selector_{time_category.replace(' ', '_')}"
    )
    
    timeframe_code, days_count = time_options[selected_timeframe]
    
    return selected_timeframe, timeframe_code, days_count


def render_portfolio_metrics(metrics: Dict[str, Any], vault_allocation: float, 
                           selected_timeframe: str) -> None:
    """
    Render comprehensive portfolio performance metrics
    
    Args:
        metrics: Portfolio metrics dictionary
        vault_allocation: Vault allocation percentage
        selected_timeframe: Selected timeframe string
    """
    st.markdown("---")
    st.markdown("### 💼 Portfolio Performance (Based on Backtest)")
    
    # Data source info
    col1, col2 = st.columns([3, 1])
    with col1:
        st.markdown("📊 **Data Source**: Real Bitcoin Historical Data + Backtest Simulation")
    with col2:
        st.markdown(f"**Period**: {selected_timeframe}")
    
    # Calculate vault metrics
    vault_balance = metrics['total_profit'] * (vault_allocation / 100) if metrics['total_profit'] > 0 else 0
    vault_growth_pct = (vault_balance / 100) * 100 if vault_balance > 0 else 0  # From $100 initial
    
    # Available cash (final balance minus any BTC position value)
    available_cash = metrics['final_balance'] - metrics['current_btc_value']
    
    # Portfolio metrics in columns
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown("💰 **Portfolio Value**")
        portfolio_value = metrics['final_balance'] + metrics['current_btc_value']
        portfolio_change = portfolio_value - metrics['initial_balance']
        st.metric("", f"${portfolio_value:,.2f}", 
                 f"${portfolio_change:,.2f} ({metrics['total_return_pct']:+.1f}%)")
    
    with col2:
        st.markdown("💵 **Available Cash**")
        st.metric("", f"${available_cash:,.2f}")
    
    with col3:
        if metrics['current_btc_balance'] > 0:
            st.markdown("₿ **BTC Position**")
            current_price = metrics['current_btc_value'] / metrics['current_btc_balance'] if metrics['current_btc_balance'] > 0 else 0
            st.metric("", f"{metrics['current_btc_balance']:.8f} BTC", 
                     f"${metrics['current_btc_value']:,.2f} @ ${current_price:,.2f}")
        else:
            st.markdown("₿ **BTC Position**")
            st.metric("", "0.00000000 BTC", "No position")
    
    with col4:
        st.markdown("🏦 **USDC Vault**")
        vault_change = vault_balance if vault_balance > 0 else 0
        st.metric("", f"${vault_balance:,.2f}", 
                 f"+${vault_change:,.2f} ({vault_growth_pct:+.1f}%)")


def render_trade_summary(metrics: Dict[str, Any]) -> None:
    """
    Render trade summary and detailed metrics
    
    Args:
        metrics: Portfolio metrics dictionary
    """
    # Unrealized P&L
    if metrics['current_btc_balance'] > 0 and metrics['buy_trades']:
        last_buy_price = metrics['buy_trades'][-1]['price']
        unrealized_pnl = metrics['current_btc_value'] - (metrics['current_btc_balance'] * last_buy_price)
        
        col1, col2 = st.columns([1, 1])
        with col1:
            st.markdown("📈 **Unrealized P&L**")
            status = "Floating" if metrics['current_btc_balance'] > 0 else "Closed"
            st.metric("", f"${unrealized_pnl:,.2f}", status)
    
    # Trade summary metrics
    st.markdown("### 📊 Trade Summary")
    total_trades = len(metrics['buy_trades']) + len(metrics['sell_trades'])
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Trades", total_trades)
    
    with col2:
        st.metric("Buy Signals", len(metrics['buy_trades']))
    
    with col3:
        st.metric("Sell Signals", len(metrics['sell_trades']))
    
    # Profit metrics
    if metrics['sell_trades']:
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Realized Profit", f"${metrics['total_profit']:,.2f}")
        with col2:
            st.metric("Final Balance", f"${metrics['final_balance']:,.2f}")


def render_vault_growth_chart(metrics: Dict[str, Any], vault_allocation: float) -> None:
    """
    Render USDC vault growth chart
    
    Args:
        metrics: Portfolio metrics dictionary
        vault_allocation: Vault allocation percentage
    """
    vault_balance = metrics['total_profit'] * (vault_allocation / 100) if metrics['total_profit'] > 0 else 0
    
    if vault_balance > 0:
        st.markdown("### 🏦 USDC Vault Growth")
        
        # Create vault growth data based on successful trades
        vault_dates = []
        vault_values = []
        cumulative_vault = 0
        
        for trade in metrics['sell_trades']:
            if trade.get('profit', 0) > 0:
                vault_contribution = trade['profit'] * (vault_allocation / 100)
                cumulative_vault += vault_contribution
                vault_dates.append(trade['date'])
                vault_values.append(cumulative_vault)
        
        if vault_dates:
            # Create vault growth chart
            vault_fig = go.Figure()
            vault_fig.add_trace(go.Scatter(
                x=vault_dates,
                y=vault_values,
                mode='lines+markers',
                name='USDC Vault Balance',
                line=dict(color='blue', width=3),
                marker=dict(size=8),
                hovertemplate='<b>%{x}</b><br>Vault: $%{y:,.2f}<extra></extra>'
            ))
            
            vault_fig.update_layout(
                title=f'USDC Vault Growth ({vault_allocation}% of Profits)',
                xaxis_title='Date',
                yaxis_title='Vault Balance (USD)',
                hovermode='x'
            )
            
            st.plotly_chart(vault_fig, use_container_width=True)
            
            # Vault statistics
            col1, col2, col3 = st.columns(3)
            with col1:
                profitable_trades = len([t for t in metrics['sell_trades'] if t.get('profit', 0) > 0])
                st.metric("Vault Contributions", profitable_trades)
            with col2:
                avg_contribution = vault_balance / profitable_trades if profitable_trades > 0 else 0
                st.metric("Avg Contribution", f"${avg_contribution:,.2f}")
            with col3:
                st.metric("Vault Allocation", f"{vault_allocation}%")
