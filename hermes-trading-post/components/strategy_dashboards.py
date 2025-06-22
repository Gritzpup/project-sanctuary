"""
Strategy Dashboard Components Module - Optimized and Modular

This module provides the main dashboard interfaces for different trading strategies,
using modular components for improved maintainability and performance.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
from typing import Dict, Any

# Import modular services and components
from services.data_service import get_enhanced_bitcoin_data, is_backend_available
from components.strategies import (
    generate_always_gain_backtest_trades,
    calculate_portfolio_metrics,
    render_strategy_controls,
    render_timeframe_selector,
    render_portfolio_metrics,
    render_trade_summary,
    render_vault_growth_chart
)


def render_price_chart(dates, prices, backtest_trades, selected_timeframe):
    """Render the main Bitcoin price chart with trade markers"""
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
        title=f'Always Gain Strategy - {selected_timeframe} Backtest',
        xaxis_title='Date',
        yaxis_title='Price (USD)',
        hovermode='x unified',
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01)
    )
    
    st.plotly_chart(fig, use_container_width=True)


def create_always_gain_dashboard():
    """Always Gain Bitcoin Strategy Backtest Dashboard - Optimized"""
    st.markdown("## 🎯 Always Gain Bitcoin Strategy - Backtest Mode")
    
    # Main layout: Chart on left, controls on right
    col_chart, col_controls = st.columns([3, 1])
    
    with col_controls:
        # Render strategy controls using modular component
        entry_threshold, exit_target, vault_allocation = render_strategy_controls()
        
        # Render timeframe selector using modular component
        selected_timeframe, timeframe_code, days_count = render_timeframe_selector()
        
        # Run backtest button
        run_backtest = st.button("🔄 Run Backtest", type="primary", use_container_width=True)
        
        st.markdown("---")
        st.markdown("### 💰 Fee Structure")
        st.write("**Maker Fee**: 0.6%")
        st.write("**Taker Fee**: 1.2%")
    
    with col_chart:
        st.markdown("### 📊 Bitcoin Price Chart & Backtest Results")
        
        # Get Bitcoin data for the selected timeframe
        try:
            with st.spinner(f"📊 Loading {selected_timeframe} Bitcoin data..."):
                dates, prices = get_enhanced_bitcoin_data(days_count, use_cache=True)
                st.success(f"✅ Loaded {len(dates)} data points for {selected_timeframe}")
                
                if len(dates) > 0:
                    st.info(f"📅 Data range: {dates[0]} to {dates[-1]}")
                    st.info(f"💰 Price range: ${min(prices):.2f} to ${max(prices):.2f}")
                
        except Exception as e:
            st.error(f"❌ Error loading data: {str(e)}")
            # Fallback to default data
            dates = pd.date_range(end=datetime.now(), periods=365, freq='D')
            prices = [float(50000 + i * 100) for i in range(len(dates))]  # Simple fallback
            dates = [d.strftime('%Y-%m-%d') for d in dates]
            st.warning("Using simple fallback data")
        
        # Generate backtest trades using modular component
        backtest_trades = generate_always_gain_backtest_trades(
            dates, prices, entry_threshold, exit_target
        )
        
        # Render price chart with trade markers
        render_price_chart(dates, prices, backtest_trades, selected_timeframe)
        
        # Calculate and display results using modular components
        if backtest_trades:
            st.markdown("### 📋 Backtest Results")
            
            # Calculate portfolio metrics using modular component
            current_price = prices[-1] if prices else 95000
            metrics = calculate_portfolio_metrics(backtest_trades, current_price)
            
            # Render portfolio metrics using modular component
            render_portfolio_metrics(metrics, vault_allocation, selected_timeframe)
            
            # Render trade summary using modular component
            render_trade_summary(metrics)
            
            # Render vault growth chart using modular component
            render_vault_growth_chart(metrics, vault_allocation)
            
            # Trade history table
            if st.checkbox("Show Detailed Trade History"):
                trades_df = pd.DataFrame(backtest_trades)
                st.dataframe(trades_df, use_container_width=True)
        else:
            st.info("No trades generated for this time period and strategy settings.")
            
            # Show empty portfolio state
            st.markdown("---")
            st.markdown("### 💼 Portfolio Performance")
            st.markdown("📊 **Data Source**: Bitcoin Historical Data (No trades generated)")
            
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.markdown("💰 **Portfolio Value**")
                st.metric("", "$10,000.00", "$0.00 (0.0%)")
            with col2:
                st.markdown("💵 **Available Cash**")
                st.metric("", "$10,000.00")
            with col3:
                st.markdown("₿ **BTC Position**")
                st.metric("", "0.00000000 BTC", "No position")
            with col4:
                st.markdown("🏦 **USDC Vault**")
                st.metric("", "$0.00", "$0.00 (0.0%)")


def create_dca_dashboard():
    """Dollar Cost Averaging Strategy Dashboard"""
    st.markdown("## 💰 DCA Bitcoin Strategy - Backtest Mode")
    st.info("💡 DCA strategy dashboard coming soon...")
    st.markdown("**Features in development:**")
    st.write("• Regular interval Bitcoin purchases")
    st.write("• Dollar-cost averaging simulation")
    st.write("• Performance vs lump-sum comparison")


def create_momentum_dashboard():
    """Momentum Trading Strategy Dashboard"""
    st.markdown("## 🚀 Momentum Trading Strategy - Backtest Mode")
    st.info("💡 Momentum strategy dashboard coming soon...")
    st.markdown("**Features in development:**")
    st.write("• Price momentum indicators")
    st.write("• Trend-following algorithms")
    st.write("• Breakout detection")


def create_ma_crossover_dashboard():
    """Moving Average Crossover Strategy Dashboard"""
    st.markdown("## 📈 MA Crossover Strategy - Backtest Mode")
    st.info("💡 MA Crossover strategy dashboard coming soon...")
    st.markdown("**Features in development:**")
    st.write("• Moving average crossover signals")
    st.write("• Customizable MA periods")
    st.write("• Golden cross / death cross detection")


def create_rsi_momentum_dashboard():
    """RSI Momentum Strategy Dashboard"""
    st.markdown("## 🌊 RSI Momentum Strategy - Backtest Mode")
    st.info("💡 RSI Momentum strategy dashboard coming soon...")
    st.markdown("**Features in development:**")
    st.write("• RSI overbought/oversold signals")
    st.write("• Momentum confirmation")
    st.write("• Multi-timeframe RSI analysis")


def create_grid_dashboard():
    """Grid Trading Strategy Dashboard"""
    st.markdown("## 🔲 Grid Trading Strategy - Backtest Mode")
    st.info("💡 Grid trading strategy dashboard coming soon...")
    st.markdown("**Features in development:**")
    st.write("• Grid-based order placement")
    st.write("• Profit taking at grid levels")
    st.write("• Dynamic grid adjustment")
