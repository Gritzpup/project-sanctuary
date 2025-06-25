"""
Chart rendering components for backtesting visualizations.
Contains all chart generation and visualization functions.
"""

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
from .backtest_utils import format_currency, format_percentage, format_btc_amount


def display_performance_charts(results):
    """Display comprehensive performance charts in a three-column layout."""
    st.subheader("📈 Performance Analysis")
    
    # Three-column chart layout
    col1, col2, col3 = st.columns(3)
    
    with col1:
        _render_portfolio_chart(results)
    
    with col2:
        _render_balance_chart(results)
    
    with col3:
        _render_btc_holdings_chart(results)
    
    # Full-width Bitcoin price with trade signals
    _render_price_signals_chart(results)


def _render_portfolio_chart(results):
    """Render portfolio value over time chart."""
    fig_portfolio = go.Figure()
    
    fig_portfolio.add_trace(go.Scatter(
        x=results['dates'],
        y=results['portfolio_values'],
        mode='lines',
        name='Portfolio Value',
        line=dict(color='#1f77b4', width=2)
    ))
    
    # Add initial investment line for comparison
    initial_value = results['portfolio_values'][0]
    fig_portfolio.add_hline(
        y=initial_value, 
        line_dash="dash", 
        line_color="gray",
        annotation_text="Initial Investment"
    )
    
    fig_portfolio.update_layout(
        title="Portfolio Growth",
        xaxis_title="Date",
        yaxis_title="Value ($)",
        height=350
    )
    
    st.plotly_chart(fig_portfolio, use_container_width=True)


def _render_balance_chart(results):
    """Render balance chart (vault or cash depending on strategy)."""
    strategy_name = results.get('strategy_name', 'unknown')
    
    if strategy_name == "always_gain_btc":
        # USDC Vault growth for Always Gain
        fig_vault = go.Figure()
        
        fig_vault.add_trace(go.Scatter(
            x=results['dates'],
            y=results['vault_balances'],
            mode='lines',
            fill='tonexty',
            name='USDC Vault',
            line=dict(color='#2ca02c', width=2)
        ))
        
        fig_vault.update_layout(
            title="USDC Vault Growth",
            xaxis_title="Date",
            yaxis_title="USDC Balance ($)",
            height=350
        )
        
        st.plotly_chart(fig_vault, use_container_width=True)
    else:
        # Cash balance for other strategies
        fig_cash = go.Figure()
        
        fig_cash.add_trace(go.Scatter(
            x=results['dates'],
            y=results['cash_balances'],
            mode='lines',
            name='Cash Balance',
            line=dict(color='#ff7f0e', width=2)
        ))
        
        fig_cash.update_layout(
            title="Cash Balance",
            xaxis_title="Date",
            yaxis_title="Cash ($)",
            height=350
        )
        
        st.plotly_chart(fig_cash, use_container_width=True)


def _render_btc_holdings_chart(results):
    """Render Bitcoin holdings over time chart."""
    fig_btc = go.Figure()
    
    fig_btc.add_trace(go.Scatter(
        x=results['dates'],
        y=results['btc_holdings'],
        mode='lines',
        name='BTC Holdings',
        line=dict(color='#f7931a', width=2)
    ))
    
    fig_btc.update_layout(
        title="Bitcoin Holdings",
        xaxis_title="Date",
        yaxis_title="BTC Amount",
        height=350
    )
    
    st.plotly_chart(fig_btc, use_container_width=True)


def _render_price_signals_chart(results):
    """Render Bitcoin price with trading signals chart."""
    st.markdown("#### 📊 Bitcoin Price with Trading Signals")
    
    fig_btc_signals = go.Figure()
    
    # Price line
    fig_btc_signals.add_trace(go.Scatter(
        x=results['dates'],
        y=results['prices'],
        mode='lines',
        name='BTC Price',
        line=dict(color='#f7931a', width=2)
    ))
    
    # Add trade markers
    buy_trades = [t for t in results['trades'] if t['action'] == 'BUY']
    sell_trades = [t for t in results['trades'] if t['action'] == 'SELL']
    
    if buy_trades:
        fig_btc_signals.add_trace(go.Scatter(
            x=[t['date'] for t in buy_trades],
            y=[t['price'] for t in buy_trades],
            mode='markers',
            name='Buy Signals',
            marker=dict(symbol='triangle-up', size=12, color='green'),
            hovertemplate='<b>BUY</b><br>Date: %{x}<br>Price: $%{y:,.2f}<extra></extra>'
        ))
    
    if sell_trades:
        fig_btc_signals.add_trace(go.Scatter(
            x=[t['date'] for t in sell_trades],
            y=[t['price'] for t in sell_trades],
            mode='markers',
            name='Sell Signals',
            marker=dict(symbol='triangle-down', size=12, color='red'),
            hovertemplate='<b>SELL</b><br>Date: %{x}<br>Price: $%{y:,.2f}<br>Profit: $%{customdata:.2f}<extra></extra>',
            customdata=[t.get('profit', 0) for t in sell_trades]
        ))
    
    fig_btc_signals.update_layout(
        title="Bitcoin Price with Trading Signals",
        xaxis_title="Date",
        yaxis_title="Price ($)",
        height=500
    )
    
    st.plotly_chart(fig_btc_signals, use_container_width=True)


def display_trade_analysis(results):
    """Display detailed trade analysis with table and statistics."""
    if not results['trades']:
        st.info("📝 No trades executed during this backtest period")
        return
        
    st.subheader("📋 Detailed Trade Analysis")
    
    # Trade summary statistics
    _render_trade_statistics(results)
    
    # Trade history table
    _render_trade_history_table(results)


def _render_trade_statistics(results):
    """Render trade summary statistics."""
    col1, col2, col3, col4 = st.columns(4)
    
    buy_trades = [t for t in results['trades'] if t['action'] == 'BUY']
    sell_trades = [t for t in results['trades'] if t['action'] == 'SELL']
    
    with col1:
        st.metric("Total Trades", len(results['trades']))
    with col2:
        st.metric("Buy Orders", len(buy_trades))
    with col3:
        st.metric("Sell Orders", len(sell_trades))
    with col4:
        total_volume = sum(t.get('value', 0) for t in results['trades'])
        st.metric("Total Volume", format_currency(total_volume))


def _render_trade_history_table(results):
    """Render detailed trade history table."""
    trades_df = pd.DataFrame(results['trades'])
    trades_df['Date'] = trades_df['date'].dt.strftime('%Y-%m-%d %H:%M')
    trades_df['Action'] = trades_df['action']
    trades_df['Price'] = trades_df['price'].apply(lambda x: format_currency(x))
    trades_df['Quantity'] = trades_df['quantity'].apply(lambda x: format_btc_amount(x))
    trades_df['Value'] = trades_df['value'].apply(lambda x: format_currency(x))
    
    # Format profit columns if they exist
    if 'profit' in trades_df.columns:
        trades_df['Profit'] = trades_df['profit'].fillna(0).apply(
            lambda x: format_currency(x) if x != 0 else ""
        )
    if 'vault_contribution' in trades_df.columns:
        trades_df['Vault'] = trades_df['vault_contribution'].fillna(0).apply(
            lambda x: format_currency(x) if x != 0 else ""
        )
    
    # Select display columns
    display_cols = ['Date', 'Action', 'Price', 'Quantity', 'Value']
    if 'Profit' in trades_df.columns:
        display_cols.append('Profit')
    if 'Vault' in trades_df.columns:
        display_cols.append('Vault')
    
    st.dataframe(trades_df[display_cols], use_container_width=True, hide_index=True)


def render_strategy_comparison_chart(results_list, strategy_names):
    """
    Render comparison chart for multiple strategies.
    
    Args:
        results_list (list): List of backtest results
        strategy_names (list): List of strategy names
    """
    st.subheader("📊 Strategy Performance Comparison")
    
    fig = go.Figure()
    
    colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
    
    for i, (results, name) in enumerate(zip(results_list, strategy_names)):
        fig.add_trace(go.Scatter(
            x=results['dates'],
            y=results['portfolio_values'],
            mode='lines',
            name=name,
            line=dict(color=colors[i % len(colors)], width=2)
        ))
    
    fig.update_layout(
        title="Portfolio Value Comparison",
        xaxis_title="Date",
        yaxis_title="Portfolio Value ($)",
        height=500,
        legend=dict(
            yanchor="top",
            y=0.99,
            xanchor="left",
            x=0.01
        )
    )
    
    st.plotly_chart(fig, use_container_width=True)


def render_risk_metrics_chart(results):
    """Render risk metrics visualization."""
    st.subheader("⚠️ Risk Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Drawdown chart
        portfolio_values = results['portfolio_values']
        peak_values = []
        drawdowns = []
        peak = portfolio_values[0]
        
        for value in portfolio_values:
            if value > peak:
                peak = value
            peak_values.append(peak)
            drawdown = (peak - value) / peak * 100 if peak > 0 else 0
            drawdowns.append(drawdown)
        
        fig_dd = go.Figure()
        fig_dd.add_trace(go.Scatter(
            x=results['dates'],
            y=drawdowns,
            mode='lines',
            fill='tozeroy',
            name='Drawdown %',
            line=dict(color='red', width=1),
            fillcolor='rgba(255,0,0,0.1)'
        ))
        
        fig_dd.update_layout(
            title="Portfolio Drawdown",
            xaxis_title="Date",
            yaxis_title="Drawdown (%)",
            height=300
        )
        
        st.plotly_chart(fig_dd, use_container_width=True)
    
    with col2:
        # Risk metrics summary
        perf = results['performance']
        
        st.markdown("#### Key Risk Metrics")
        st.metric("Maximum Drawdown", format_percentage(perf['max_drawdown']))
        st.metric("Sharpe Ratio", f"{perf['sharpe_ratio']:.2f}")
        st.metric("Win Rate", format_percentage(perf['win_rate']))
        
        # Risk level assessment
        max_dd = perf['max_drawdown']
        if max_dd < 5:
            risk_level = "🟢 Low Risk"
        elif max_dd < 15:
            risk_level = "🟡 Medium Risk"
        else:
            risk_level = "🔴 High Risk"
        
        st.metric("Risk Assessment", risk_level)
