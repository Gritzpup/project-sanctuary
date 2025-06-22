"""
Modular Backtesting Components

This module provides individual, reusable components for backtesting that can be
arranged in any order on the backtesting page. Each component is self-contained
and handles its own data and state management.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

# Import enhanced data services
from services.data_service import get_enhanced_bitcoin_data, is_backend_available, save_backtest_config, save_backtest_result
from components.strategies import (
    generate_always_gain_backtest_trades,
    calculate_portfolio_metrics
)


# =============================================================================
# CONTROL COMPONENTS
# =============================================================================

def render_strategy_controls() -> Tuple[float, float, float]:
    """
    Render strategy parameter controls
    
    Returns:
        Tuple of (entry_threshold, exit_target, vault_allocation)
    """
    st.markdown("### ⚙️ Strategy Parameters")
    
    entry_threshold = st.slider(
        "📉 Entry Threshold (%)", 
        min_value=0.5, 
        max_value=10.0, 
        value=2.0, 
        step=0.1,
        help="Percentage drop to trigger buy signal"
    )
    
    exit_target = st.slider(
        "📈 Exit Target (%)", 
        min_value=1.0, 
        max_value=20.0, 
        value=5.0, 
        step=0.1,
        help="Percentage gain to trigger sell signal"
    )
    
    vault_allocation = st.slider(
        "🏦 Vault Allocation (%)", 
        min_value=0.0, 
        max_value=50.0, 
        value=20.0, 
        step=1.0,
        help="Percentage of profits to allocate to USDC vault"
    )
    
    return entry_threshold, exit_target, vault_allocation


def render_timeframe_selector() -> Tuple[str, str, int]:
    """
    Render timeframe selection controls
    
    Returns:
        Tuple of (selected_timeframe, timeframe_code, days_count)
    """
    st.markdown("### 📅 Backtest Period")
    
    timeframe_options = {
        "1 Week": ("1W", 7),
        "2 Weeks": ("2W", 14), 
        "1 Month": ("1M", 30),
        "3 Months": ("3M", 90),
        "6 Months": ("6M", 180),
        "1 Year": ("1Y", 365),
        "2 Years": ("2Y", 730)
    }
    
    selected_timeframe = st.selectbox(
        "Select Period:",
        options=list(timeframe_options.keys()),
        index=3  # Default to 3 months
    )
    
    timeframe_code, days_count = timeframe_options[selected_timeframe]
    
    # Show data info
    st.caption(f"📊 Will load {days_count} days of Bitcoin price data")
    
    return selected_timeframe, timeframe_code, days_count


def render_backtest_actions() -> Tuple[bool, bool, Optional[str]]:
    """
    Render backtest action buttons
    
    Returns:
        Tuple of (run_backtest, save_config, config_name)
    """
    st.markdown("### 🎯 Actions")
    
    run_backtest = st.button(
        "🔄 Run Backtest", 
        type="primary", 
        use_container_width=True,
        help="Execute backtest with current parameters"
    )
    
    st.markdown("---")
    
    # Save configuration option
    save_config = st.checkbox("💾 Save Configuration", value=False)
    config_name = None
    
    if save_config:
        config_name = st.text_input(
            "Configuration Name:",
            value=f"Always Gain - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            help="Name for this backtest configuration"
        )
    
    return run_backtest, save_config, config_name


# =============================================================================
# DATA COMPONENTS
# =============================================================================

def load_bitcoin_data(days_count: int, selected_timeframe: str) -> Tuple[List[str], List[float], bool]:
    """
    Load Bitcoin price data with enhanced backend integration
    
    Args:
        days_count: Number of days to load
        selected_timeframe: Human-readable timeframe description
        
    Returns:
        Tuple of (dates, prices, success)
    """
    try:
        with st.spinner(f"📊 Loading {selected_timeframe} Bitcoin data..."):
            dates, prices = get_enhanced_bitcoin_data(days_count, use_cache=True)
            
            if len(dates) > 0:
                st.success(f"✅ Loaded {len(dates)} data points for {selected_timeframe}")
                st.info(f"📅 Data range: {dates[0]} to {dates[-1]}")
                st.info(f"💰 Price range: ${min(prices):,.2f} to ${max(prices):,.2f}")
                return dates, prices, True
            else:
                raise ValueError("No data returned")
                
    except Exception as e:
        st.error(f"❌ Error loading data: {str(e)}")
        # Fallback to default data
        dates = pd.date_range(end=datetime.now(), periods=days_count, freq='D')
        prices = [float(50000 + i * 100) for i in range(len(dates))]
        dates = [d.strftime('%Y-%m-%d') for d in dates]
        st.warning("Using simple fallback data")
        return dates, prices, False


# =============================================================================
# CHART COMPONENTS
# =============================================================================

def render_bitcoin_price_chart(dates: List[str], prices: List[float], 
                              backtest_trades: List[Dict[str, Any]], 
                              selected_timeframe: str) -> None:
    """
    Render Bitcoin price chart with trade markers
    
    Args:
        dates: List of date strings
        prices: List of price values
        backtest_trades: List of trade dictionaries
        selected_timeframe: Timeframe description for title
    """
    st.markdown("### 📊 Bitcoin Price Chart")
    
    # Create the chart
    fig = go.Figure()
    
    # Add Bitcoin price line
    fig.add_trace(go.Scatter(
        x=dates,
        y=prices,
        mode='lines',
        name='Bitcoin Price',
        line=dict(color='#f7931a', width=2),
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
                marker=dict(color='green', size=12, symbol='triangle-up'),
                hovertemplate='<b>BUY</b><br>%{x}<br>Price: $%{y:,.2f}<extra></extra>'
            ))
        
        if sell_dates:
            fig.add_trace(go.Scatter(
                x=sell_dates,
                y=sell_prices,
                mode='markers',
                name='Sell Signal',
                marker=dict(color='red', size=12, symbol='triangle-down'),
                hovertemplate='<b>SELL</b><br>%{x}<br>Price: $%{y:,.2f}<extra></extra>'
            ))
    
    # Update layout
    fig.update_layout(
        title=f'Always Gain Strategy - {selected_timeframe} Backtest',
        xaxis_title='Date',
        yaxis_title='Price (USD)',
        hovermode='x unified',
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
        height=500
    )
    
    st.plotly_chart(fig, use_container_width=True)


def render_portfolio_value_chart(backtest_trades: List[Dict[str, Any]]) -> None:
    """
    Render portfolio value over time chart
    
    Args:
        backtest_trades: List of trade dictionaries
    """
    if not backtest_trades:
        return
        
    st.markdown("### 💰 Portfolio Value Over Time")
    
    # Extract portfolio values from trades
    dates = [trade['date'] for trade in backtest_trades]
    portfolio_values = [trade['balance_after'] for trade in backtest_trades]
    
    # Add initial value
    initial_date = dates[0] if dates else datetime.now().strftime('%Y-%m-%d')
    dates.insert(0, initial_date)
    portfolio_values.insert(0, 10000.0)  # Starting balance
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=dates,
        y=portfolio_values,
        mode='lines',
        name='Portfolio Value',
        line=dict(color='green', width=3),
        fill='tonexty',
        hovertemplate='<b>%{x}</b><br>Value: $%{y:,.2f}<extra></extra>'
    ))
    
    fig.update_layout(
        title='Portfolio Value Growth',
        xaxis_title='Date',
        yaxis_title='Portfolio Value (USD)',
        hovermode='x unified',
        height=400
    )
    
    st.plotly_chart(fig, use_container_width=True)


# =============================================================================
# METRICS COMPONENTS
# =============================================================================

def render_portfolio_metrics(metrics: Dict[str, Any], vault_allocation: float, 
                           selected_timeframe: str) -> None:
    """
    Render portfolio performance metrics
    
    Args:
        metrics: Portfolio metrics dictionary
        vault_allocation: Vault allocation percentage
        selected_timeframe: Timeframe description
    """
    st.markdown("### 💼 Portfolio Performance")
    st.caption(f"📊 **Data Source**: {selected_timeframe} Historical Bitcoin Data")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_return_pct = metrics.get('total_return_pct', 0)
        profit = metrics.get('total_profit', 0)
        st.metric(
            "💰 Total Return",
            f"{total_return_pct:.1f}%",
            f"${profit:,.2f} profit"
        )
    
    with col2:
        final_balance = metrics.get('final_balance', 0)
        st.metric(
            "💵 Final Balance", 
            f"${final_balance:,.2f}"
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


def render_trade_summary(metrics: Dict[str, Any]) -> None:
    """
    Render trade summary statistics
    
    Args:
        metrics: Portfolio metrics dictionary
    """
    st.markdown("### 📋 Trade Summary")
    
    buy_trades = metrics.get('buy_trades', [])
    sell_trades = metrics.get('sell_trades', [])
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_trades = len(buy_trades) + len(sell_trades)
        st.metric("Total Trades", total_trades)
    
    with col2:
        st.metric("Buy Orders", len(buy_trades))
    
    with col3:
        st.metric("Sell Orders", len(sell_trades))
    
    with col4:
        win_rate = (len(sell_trades) / len(buy_trades) * 100) if buy_trades else 0
        st.metric("Completion Rate", f"{win_rate:.1f}%")


def render_trade_history_table(backtest_trades: List[Dict[str, Any]]) -> None:
    """
    Render detailed trade history table
    
    Args:
        backtest_trades: List of trade dictionaries
    """
    if not backtest_trades:
        st.info("No trades to display")
        return
        
    st.markdown("### 📊 Trade History")
    
    # Convert to DataFrame for better display
    trades_df = pd.DataFrame(backtest_trades)
    
    # Format columns for display
    if not trades_df.empty:
        # Select and rename columns for cleaner display
        display_columns = {
            'date': 'Date',
            'action': 'Action',
            'price': 'Price ($)',
            'amount': 'Amount (BTC)',
            'fee': 'Fee ($)',
            'balance_after': 'Balance After ($)',
            'trigger': 'Trigger'
        }
        
        # Filter to only include columns that exist
        available_columns = {k: v for k, v in display_columns.items() if k in trades_df.columns}
        
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
            st.dataframe(trades_df, use_container_width=True)


# =============================================================================
# SAVE/LOAD COMPONENTS
# =============================================================================

def save_backtest_configuration(config_name: str, entry_threshold: float, 
                              exit_target: float, vault_allocation: float, 
                              selected_timeframe: str) -> bool:
    """
    Save backtest configuration
    
    Args:
        config_name: Name for the configuration
        entry_threshold: Entry threshold percentage
        exit_target: Exit target percentage  
        vault_allocation: Vault allocation percentage
        selected_timeframe: Selected timeframe
        
    Returns:
        True if saved successfully, False otherwise
    """
    try:
        config_data = {
            "name": config_name,
            "strategy": "Always Gain BTC",
            "parameters": {
                "entry_threshold": entry_threshold,
                "exit_target": exit_target,
                "vault_allocation": vault_allocation,
                "timeframe": selected_timeframe
            },
            "description": f"Always Gain strategy with {entry_threshold}% entry, {exit_target}% exit"
        }
        
        result = save_backtest_config(config_data)
        
        if result.get('success'):
            st.success(f"✅ Configuration '{config_name}' saved successfully!")
            return True
        else:
            st.warning(f"⚠️ {result.get('message', 'Failed to save configuration')}")
            return False
            
    except Exception as e:
        st.error(f"❌ Error saving configuration: {str(e)}")
        return False


def save_backtest_results(backtest_trades: List[Dict[str, Any]], 
                        metrics: Dict[str, Any], 
                        config_name: str) -> bool:
    """
    Save backtest results
    
    Args:
        backtest_trades: List of trade dictionaries
        metrics: Portfolio metrics dictionary
        config_name: Configuration name
        
    Returns:
        True if saved successfully, False otherwise
    """
    try:
        result_data = {
            "config_name": config_name,
            "strategy": "Always Gain BTC",
            "trades": backtest_trades,
            "metrics": metrics,
            "trade_count": len(backtest_trades),
            "final_balance": metrics.get('final_balance', 0),
            "total_return_pct": metrics.get('total_return_pct', 0)
        }
        
        result = save_backtest_result(result_data)
        
        if result.get('success'):
            st.success(f"✅ Backtest results saved successfully!")
            return True
        else:
            st.warning(f"⚠️ {result.get('message', 'Failed to save results')}")
            return False
            
    except Exception as e:
        st.error(f"❌ Error saving results: {str(e)}")
        return False


# =============================================================================
# COMPOSITE COMPONENTS
# =============================================================================

def render_backtest_summary_card(metrics: Dict[str, Any], trades_count: int, 
                                timeframe: str) -> None:
    """
    Render a summary card with key backtest metrics
    
    Args:
        metrics: Portfolio metrics dictionary
        trades_count: Number of trades executed
        timeframe: Backtest timeframe
    """
    st.markdown("### 📈 Backtest Summary")
    
    # Create a nice summary card
    with st.container():
        st.markdown(
            f"""
            <div style="
                background: linear-gradient(90deg, #1f4068 0%, #162447 100%);
                padding: 20px;
                border-radius: 10px;
                color: white;
                margin: 10px 0;
            ">
                <h4 style="margin: 0; color: #00ff88;">Always Gain Bitcoin Strategy</h4>
                <p style="margin: 5px 0; opacity: 0.8;">Backtest Period: {timeframe}</p>
                <p style="margin: 5px 0; opacity: 0.8;">Total Trades: {trades_count}</p>
                <p style="margin: 5px 0; opacity: 0.8;">Final Return: {metrics.get('total_return_pct', 0):.2f}%</p>
            </div>
            """,
            unsafe_allow_html=True
        )
