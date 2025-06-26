"""
Individual Dashboard Widget Components

This module provides small, individual dashboard components that can be arranged
in any order on the backtesting page. Each widget is self-contained and independent.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

# Import services
from services.data_service import get_enhanced_bitcoin_data, is_backend_available
from components.strategies import (
    generate_always_gain_backtest_trades,
    calculate_portfolio_metrics
)


# =============================================================================
# CONTROL WIDGETS
# =============================================================================

def widget_strategy_controls(key_suffix: str = "") -> Tuple[float, float, float]:
    """
    Individual widget: Strategy parameter controls
    
    Args:
        key_suffix: Unique suffix for widget keys to avoid conflicts
        
    Returns:
        Tuple of (entry_threshold, exit_target, vault_allocation)
    """
    st.markdown("### ⚙️ Strategy Controls")
    
    with st.container():
        entry_threshold = st.slider(
            "Entry Threshold (%)",
            min_value=1.0, max_value=10.0, value=2.0, step=0.1,
            help="Percentage drop to trigger buy signal",
            key=f"entry_threshold_{key_suffix}"
        )
        
        exit_target = st.slider(
            "Exit Target (%)",
            min_value=1.0, max_value=20.0, value=5.0, step=0.1,
            help="Percentage gain to trigger sell signal",
            key=f"exit_target_{key_suffix}"
        )
        
        vault_allocation = st.slider(
            "Vault Allocation (%)",
            min_value=0.0, max_value=100.0, value=1.0, step=0.1,
            help="Percentage of profits to allocate to USDC vault",
            key=f"vault_allocation_{key_suffix}"
        )
    
    return entry_threshold, exit_target, vault_allocation


def widget_timeframe_selector(key_suffix: str = "") -> Tuple[str, str, int]:
    """
    Individual widget: Timeframe selection
    
    Args:
        key_suffix: Unique suffix for widget keys
        
    Returns:
        Tuple of (selected_timeframe, timeframe_code, days_count)
    """
    st.markdown("### 📅 Timeframe Selection")
    
    timeframes = {
        "1 Week": ("1W", 7),
        "2 Weeks": ("2W", 14),
        "1 Month": ("1M", 30),
        "3 Months": ("3M", 90),
        "6 Months": ("6M", 180),
        "1 Year": ("1Y", 365)
    }
    
    selected_timeframe = st.selectbox(
        "Select Timeframe",
        options=list(timeframes.keys()),
        index=2,  # Default to 1 Month
        help="Historical data timeframe for backtesting",
        key=f"timeframe_{key_suffix}"
    )
    
    timeframe_code, days_count = timeframes[selected_timeframe]
    
    return selected_timeframe, timeframe_code, days_count


def widget_run_button(key_suffix: str = "") -> bool:
    """
    Individual widget: Run backtest button
    
    Args:
        key_suffix: Unique suffix for widget keys
        
    Returns:
        True if button was clicked
    """
    st.markdown("### 🚀 Execute Backtest")
    
    run_backtest = st.button(
        "🔄 Run Backtest",
        type="primary",
        use_container_width=True,
        help="Execute backtest with current parameters",
        key=f"run_backtest_{key_suffix}"
    )
    
    if st.session_state.get('backtest_running', False):
        st.info("🔄 Backtest in progress...")
    
    return run_backtest


def widget_quick_actions(key_suffix: str = "") -> Tuple[bool, bool]:
    """
    Individual widget: Quick action buttons
    
    Args:
        key_suffix: Unique suffix for widget keys
        
    Returns:
        Tuple of (quick_test_clicked, save_config_clicked)
    """
    st.markdown("### ⚡ Quick Actions")
    
    col1, col2 = st.columns(2)
    
    with col1:
        quick_test = st.button(
            "⚡ Quick Test\n(30 days)",
            use_container_width=True,
            help="Run a quick 30-day backtest",
            key=f"quick_test_{key_suffix}"
        )
    
    with col2:
        save_config = st.button(
            "💾 Save Config",
            use_container_width=True,
            help="Save current configuration",
            key=f"save_config_{key_suffix}"
        )
    
    return quick_test, save_config


def widget_fee_structure(key_suffix: str = "") -> None:
    """
    Individual widget: Fee structure display
    
    Args:
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 💰 Fee Structure")
    
    with st.container():
        fee_data = {
            "Fee Type": ["Maker Fee", "Taker Fee", "Withdrawal Fee"],
            "Rate": ["0.6%", "1.2%", "0.0005 BTC"],
            "Description": ["Limit orders", "Market orders", "BTC withdrawal"]
        }
        
        fee_df = pd.DataFrame(fee_data)
        st.dataframe(fee_df, use_container_width=True, hide_index=True)


# =============================================================================
# DISPLAY WIDGETS
# =============================================================================

def widget_data_status(dates: List[str], prices: List[float], key_suffix: str = "") -> None:
    """
    Individual widget: Data loading status and info
    
    Args:
        dates: List of date strings
        prices: List of price values
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 📊 Data Status")
    
    col1, col2 = st.columns(2)
    
    with col1:
        if dates and prices:
            st.success(f"✅ Loaded {len(dates)} data points")
            st.info(f"📅 From: {dates[0]}")
            st.info(f"📅 To: {dates[-1]}")
        else:
            st.warning("⚠️ No data loaded")
    
    with col2:
        if prices:
            price_min = min(prices)
            price_max = max(prices)
            price_current = prices[-1]
            
            st.metric("Current Price", f"${price_current:,.2f}")
            st.metric("Price Range", f"${price_min:,.0f} - ${price_max:,.0f}")
        else:
            st.metric("Current Price", "N/A")


def widget_bitcoin_price_chart(dates: List[str], prices: List[float], 
                              backtest_trades: List[Dict[str, Any]], 
                              selected_timeframe: str, key_suffix: str = "") -> None:
    """
    Individual widget: Bitcoin price chart with trade markers
    
    Args:
        dates: List of date strings
        prices: List of price values
        backtest_trades: List of trade dictionaries
        selected_timeframe: Selected timeframe string
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 📈 Bitcoin Price Chart")
    
    if not dates or not prices:
        st.warning("No price data available")
        return
    
    # Create the chart
    fig = go.Figure()
    
    # Add Bitcoin price line
    fig.add_trace(go.Scatter(
        x=dates,
        y=prices,
        mode='lines',
        name='Bitcoin Price',
        line=dict(color='orange', width=2),
        hovertemplate='<b>%{x}</b><br>Price: $%{y:,.2f}<extra></extra>'
    ))
    
    # Add trade markers
    if backtest_trades:
        buy_dates = [trade['date'] for trade in backtest_trades if trade['action'] == 'BUY']
        buy_prices = [trade['price'] for trade in backtest_trades if trade['action'] == 'BUY']
        sell_dates = [trade['date'] for trade in backtest_trades if trade['action'] == 'SELL']
        sell_prices = [trade['price'] for trade in backtest_trades if trade['action'] == 'SELL']
        
        if buy_dates:
            fig.add_trace(go.Scatter(
                x=buy_dates,
                y=buy_prices,
                mode='markers',
                name='Buy Signal',
                marker=dict(color='green', size=10, symbol='triangle-up'),
                hovertemplate='<b>BUY</b><br>%{x}<br>Price: $%{y:,.2f}<extra></extra>'
            ))
        
        if sell_dates:
            fig.add_trace(go.Scatter(
                x=sell_dates,
                y=sell_prices,
                mode='markers',
                name='Sell Signal',
                marker=dict(color='red', size=10, symbol='triangle-down'),
                hovertemplate='<b>SELL</b><br>%{x}<br>Price: $%{y:,.2f}<extra></extra>'
            ))
    
    # Update layout
    fig.update_layout(
        title=f'Bitcoin Price - {selected_timeframe}',
        xaxis_title='Date',
        yaxis_title='Price (USD)',
        hovermode='x unified',
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
        height=400
    )
    
    st.plotly_chart(fig, use_container_width=True)


def widget_portfolio_metrics(metrics: Dict[str, Any], vault_allocation: float, 
                           selected_timeframe: str, key_suffix: str = "") -> None:
    """
    Individual widget: Portfolio performance metrics
    
    Args:
        metrics: Portfolio metrics dictionary
        vault_allocation: Vault allocation percentage
        selected_timeframe: Selected timeframe string
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 💼 Portfolio Metrics")
    
    if not metrics:
        st.info("Run a backtest to see portfolio metrics")
        return
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        final_balance = metrics.get('final_balance', 0)
        initial_balance = metrics.get('initial_balance', 10000)
        balance_change = final_balance - initial_balance
        balance_pct = (balance_change / initial_balance) * 100 if initial_balance > 0 else 0
        
        st.metric(
            "💰 Portfolio Value",
            f"${final_balance:,.2f}",
            f"${balance_change:+,.2f} ({balance_pct:+.2f}%)"
        )
    
    with col2:
        available_cash = metrics.get('available_cash', 0)
        st.metric(
            "💵 Available Cash",
            f"${available_cash:,.2f}"
        )
    
    with col3:
        btc_balance = metrics.get('current_btc_balance', 0)
        btc_value = metrics.get('current_btc_value', 0)
        if btc_balance > 0:
            st.metric(
                "₿ BTC Position",
                f"{btc_balance:.8f} BTC",
                f"${btc_value:,.2f} value"
            )
        else:
            st.metric(
                "₿ BTC Position",
                "0.00000000 BTC",
                "No position"
            )
    
    with col4:
        vault_value = final_balance * (vault_allocation / 100)
        st.metric(
            "🏦 USDC Vault",
            f"${vault_value:,.2f}",
            f"{vault_allocation}% allocation"
        )


def widget_trade_summary(metrics: Dict[str, Any], key_suffix: str = "") -> None:
    """
    Individual widget: Trade summary statistics
    
    Args:
        metrics: Portfolio metrics dictionary
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 📊 Trade Summary")
    
    if not metrics:
        st.info("Run a backtest to see trade summary")
        return
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        total_trades = metrics.get('total_trades', 0)
        st.metric("Total Trades", total_trades)
    
    with col2:
        win_rate = metrics.get('win_rate', 0)
        st.metric("Win Rate", f"{win_rate:.1f}%")
    
    with col3:
        total_profit = metrics.get('total_profit', 0)
        st.metric("Total Profit", f"${total_profit:,.2f}")


def widget_portfolio_value_chart(backtest_trades: List[Dict[str, Any]], key_suffix: str = "") -> None:
    """
    Individual widget: Portfolio value growth chart
    
    Args:
        backtest_trades: List of trade dictionaries
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 📈 Portfolio Growth")
    
    if not backtest_trades:
        st.info("Run a backtest to see portfolio growth")
        return
    
    # Calculate portfolio value over time
    portfolio_values = []
    current_balance = 10000  # Starting balance
    
    for trade in backtest_trades:
        current_balance = trade.get('balance_after', current_balance)
        portfolio_values.append(current_balance)
    
    if not portfolio_values:
        st.info("No portfolio data to display")
        return
    
    # Create chart
    fig = go.Figure()
    
    dates = [trade['date'] for trade in backtest_trades]
    
    fig.add_trace(go.Scatter(
        x=dates,
        y=portfolio_values,
        mode='lines+markers',
        name='Portfolio Value',
        line=dict(color='blue', width=2),
        marker=dict(size=4),
        hovertemplate='<b>%{x}</b><br>Value: $%{y:,.2f}<extra></extra>'
    ))
    
    fig.update_layout(
        title='Portfolio Value Growth',
        xaxis_title='Date',
        yaxis_title='Portfolio Value (USD)',
        hovermode='x unified',
        height=350
    )
    
    st.plotly_chart(fig, use_container_width=True)


def widget_trade_history_table(backtest_trades: List[Dict[str, Any]], 
                              show_detailed: bool = False, key_suffix: str = "") -> None:
    """
    Individual widget: Trade history table
    
    Args:
        backtest_trades: List of trade dictionaries
        show_detailed: Whether to show detailed columns
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 📋 Trade History")
    
    if not backtest_trades:
        st.info("Run a backtest to see trade history")
        return
    
    # Convert to DataFrame
    trades_df = pd.DataFrame(backtest_trades)
    
    if show_detailed:
        # Show all columns
        display_columns = ['date', 'action', 'price', 'amount', 'fee', 'balance_after']
        column_names = {
            'date': 'Date',
            'action': 'Action',
            'price': 'Price ($)',
            'amount': 'Amount (BTC)',
            'fee': 'Fee ($)',
            'balance_after': 'Balance After ($)'
        }
    else:
        # Show essential columns only
        display_columns = ['date', 'action', 'price', 'amount']
        column_names = {
            'date': 'Date',
            'action': 'Action',
            'price': 'Price ($)',
            'amount': 'Amount (BTC)'
        }
    
    # Filter and rename columns
    available_columns = {col: name for col, name in column_names.items() if col in trades_df.columns}
    
    if available_columns:
        display_df = trades_df[list(available_columns.keys())].rename(columns=available_columns)
        
        # Format numeric columns
        if 'Price ($)' in display_df.columns:
            display_df['Price ($)'] = display_df['Price ($)'].apply(lambda x: f"${x:,.2f}")
        if 'Amount (BTC)' in display_df.columns:
            display_df['Amount (BTC)'] = display_df['Amount (BTC)'].apply(lambda x: f"{x:.8f}")
        if 'Fee ($)' in display_df.columns:
            display_df['Fee ($)'] = display_df['Fee ($)'].apply(lambda x: f"${x:.2f}")
        if 'Balance After ($)' in display_df.columns:
            display_df['Balance After ($)'] = display_df['Balance After ($)'].apply(lambda x: f"${x:,.2f}")
        
        st.dataframe(display_df, use_container_width=True, hide_index=True)
    else:
        st.error("No valid columns found in trade data")


def widget_performance_comparison(backtest_trades: List[Dict[str, Any]], 
                                 dates: List[str], prices: List[float], key_suffix: str = "") -> None:
    """
    Individual widget: Strategy vs Buy & Hold comparison
    
    Args:
        backtest_trades: List of trade dictionaries
        dates: List of date strings
        prices: List of price values
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("### 📊 Strategy vs Buy & Hold")
    
    if not dates or not prices or not backtest_trades:
        st.info("Run a backtest to see performance comparison")
        return
    
    # Calculate buy & hold return
    initial_price = prices[0]
    final_price = prices[-1]
    buy_hold_return = ((final_price - initial_price) / initial_price) * 100
    
    # Calculate strategy return
    initial_balance = 10000
    final_balance = backtest_trades[-1].get('balance_after', initial_balance) if backtest_trades else initial_balance
    strategy_return = ((final_balance - initial_balance) / initial_balance) * 100
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Buy & Hold Return", f"{buy_hold_return:.2f}%")
    
    with col2:
        st.metric("Strategy Return", f"{strategy_return:.2f}%")
    
    with col3:
        outperformance = strategy_return - buy_hold_return
        st.metric("Outperformance", f"{outperformance:+.2f}%")


# =============================================================================
# COMPOSITE WIDGETS (COMBINING MULTIPLE INDIVIDUAL WIDGETS)
# =============================================================================

def widget_control_panel(key_suffix: str = "") -> Dict[str, Any]:
    """
    Composite widget: Complete control panel
    
    Args:
        key_suffix: Unique suffix for widget keys
        
    Returns:
        Dictionary with all control values
    """
    st.markdown("## ⚙️ Backtest Controls")
    
    col1, col2, col3 = st.columns([2, 2, 1])
    
    with col1:
        entry_threshold, exit_target, vault_allocation = widget_strategy_controls(key_suffix)
    
    with col2:
        selected_timeframe, timeframe_code, days_count = widget_timeframe_selector(key_suffix)
    
    with col3:
        run_backtest = widget_run_button(key_suffix)
        quick_test, save_config = widget_quick_actions(key_suffix)
    
    return {
        'entry_threshold': entry_threshold,
        'exit_target': exit_target,
        'vault_allocation': vault_allocation,
        'selected_timeframe': selected_timeframe,
        'timeframe_code': timeframe_code,
        'days_count': days_count,
        'run_backtest': run_backtest,
        'quick_test': quick_test,
        'save_config': save_config
    }


def widget_analysis_panel(backtest_trades: List[Dict[str, Any]], 
                         metrics: Dict[str, Any], vault_allocation: float,
                         selected_timeframe: str, key_suffix: str = "") -> None:
    """
    Composite widget: Complete analysis panel
    
    Args:
        backtest_trades: List of trade dictionaries
        metrics: Portfolio metrics dictionary
        vault_allocation: Vault allocation percentage
        selected_timeframe: Selected timeframe string
        key_suffix: Unique suffix for widget keys
    """
    st.markdown("## 📊 Analysis Results")
    
    if not backtest_trades:
        st.info("Run a backtest to see analysis results")
        return
    
    # Row 1: Portfolio metrics
    widget_portfolio_metrics(metrics, vault_allocation, selected_timeframe, key_suffix)
    
    st.markdown("---")
    
    # Row 2: Charts
    col1, col2 = st.columns([2, 1])
    
    with col1:
        widget_portfolio_value_chart(backtest_trades, key_suffix)
    
    with col2:
        widget_trade_summary(metrics, key_suffix)
    
    st.markdown("---")
    
    # Row 3: Trade history (expandable)
    with st.expander("📋 Detailed Trade History", expanded=False):
        show_detailed = st.checkbox("Show all columns", key=f"detailed_trades_{key_suffix}")
        widget_trade_history_table(backtest_trades, show_detailed, key_suffix)
