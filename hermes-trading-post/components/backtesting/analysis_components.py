"""
Analysis and results display components for backtesting.
Contains functions for displaying backtest results, strategy-specific analysis, and performance metrics.
"""

import streamlit as st
import plotly.graph_objects as go
from .backtest_utils import format_currency, format_percentage


def display_enhanced_backtest_results(results):
    """Display enhanced backtest results with strategy-specific metrics."""
    st.markdown("---")
    st.header("📊 Enhanced Backtest Results")
    
    strategy_name = results.get('strategy_name', 'unknown')
    perf = results['performance']
    
    # Strategy-specific header
    _render_strategy_header(strategy_name)
    
    # Enhanced Key Metrics - 6 columns for comprehensive display
    _render_key_metrics(perf, strategy_name)
    
    st.markdown("---")
    
    # Strategy-specific analysis section
    if strategy_name == "always_gain_btc":
        display_always_gain_analysis(results)
    elif strategy_name == "ma_crossover":
        display_ma_crossover_analysis(results)
    elif strategy_name == "rsi_momentum":
        display_rsi_momentum_analysis(results)


def _render_strategy_header(strategy_name):
    """Render strategy-specific header with icons and names."""
    strategy_icons = {
        "always_gain_btc": "⚡",
        "ma_crossover": "📊", 
        "rsi_momentum": "🌊",
        "ladder_down": "🪜"
    }
    strategy_names = {
        "always_gain_btc": "Always Gain Bitcoin Strategy",
        "ma_crossover": "Moving Average Crossover",
        "rsi_momentum": "RSI Momentum Strategy",
        "ladder_down": "Ladder Down Strategy"
    }
    
    icon = strategy_icons.get(strategy_name, "📈")
    name = strategy_names.get(strategy_name, strategy_name.title())
    
    st.subheader(f"{icon} {name} Results")


def _render_key_metrics(perf, strategy_name):
    """Render key performance metrics in a 6-column layout."""
    col1, col2, col3, col4, col5, col6 = st.columns(6)
    
    with col1:
        st.metric(
            "Total Return",
            format_percentage(perf['total_return']),
            delta=format_currency(perf['final_value'] - perf['initial_value'])
        )
    
    with col2:
        st.metric(
            "Final Portfolio",
            format_currency(perf['final_value']),
            delta="Total Value"
        )
    
    with col3:
        # Strategy-specific metric
        if strategy_name == "always_gain_btc":
            st.metric(
                "USDC Vault",
                format_currency(perf['vault_balance']),
                delta="Secured Profits"
            )
        else:
            st.metric(
                "Active Trading",
                format_currency(perf['trading_balance']),
                delta="Available Capital"
            )
    
    with col4:
        st.metric(
            "Win Rate",
            format_percentage(perf['win_rate']),
            delta=f"{perf['winning_trades']}/{perf['total_trades']} trades"
        )
    
    with col5:
        st.metric(
            "Total Profit",
            format_currency(perf['total_profit']),
            delta="Net Trading Profit"
        )
    
    with col6:
        st.metric(
            "Max Drawdown",
            format_percentage(perf['max_drawdown']),
            delta=f"Sharpe: {perf['sharpe_ratio']:.2f}"
        )


def display_always_gain_analysis(results):
    """Display Always Gain strategy specific analysis."""
    st.subheader("⚡ Always Gain Strategy Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        _render_vault_vs_trading_balance(results)
        
    with col2:
        _render_always_gain_metrics(results)


def _render_vault_vs_trading_balance(results):
    """Render vault vs trading balance comparison chart."""
    st.markdown("#### 💎 Vault vs Trading Balance")
    
    final_vault = results['performance']['vault_balance']
    final_trading = results['performance']['trading_balance']
    
    fig_balance = go.Figure(data=[
        go.Bar(name='USDC Vault', x=['Final Balance'], y=[final_vault], marker_color='#2ca02c'),
        go.Bar(name='Trading Account', x=['Final Balance'], y=[final_trading], marker_color='#1f77b4')
    ])
    
    fig_balance.update_layout(
        title="Vault vs Trading Account Balance",
        yaxis_title="Balance ($)",
        barmode='group',
        height=300
    )
    
    st.plotly_chart(fig_balance, use_container_width=True)
    
    # Key insights
    total_balance = final_vault + final_trading
    vault_percentage = (final_vault / total_balance) * 100 if total_balance > 0 else 0
    st.info(f"📊 **Vault Allocation**: {vault_percentage:.1f}% of total portfolio secured in USDC vault")


def _render_always_gain_metrics(results):
    """Render Always Gain strategy specific metrics."""
    st.markdown("#### 📈 Strategy Performance Metrics")
    
    total_trades = results['performance']['total_trades']
    if total_trades > 0:
        avg_profit_per_trade = results['performance']['total_profit'] / total_trades
        
        col_a, col_b = st.columns(2)
        with col_a:
            st.metric("Avg Profit/Trade", format_currency(avg_profit_per_trade))
            st.metric("Risk Level", "🟢 Low")
        with col_b:
            st.metric("Strategy Type", "Accumulation")
            st.metric("Loss Protection", "✅ Never Sell at Loss")
    
    # Show vault growth over time
    if len(results['vault_balances']) > 1:
        initial_vault = results['vault_balances'][0]
        final_vault = results['vault_balances'][-1]
        if initial_vault > 0:
            vault_growth = ((final_vault - initial_vault) / initial_vault) * 100
        else:
            vault_growth = 0
        st.success(f"🏦 Vault grew by {vault_growth:.2f}% from secured profits")


def display_ma_crossover_analysis(results):
    """Display MA Crossover strategy specific analysis."""
    st.subheader("📊 Moving Average Crossover Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        _render_ma_signal_analysis(results)
    
    with col2:
        _render_ma_trade_performance(results)


def _render_ma_signal_analysis(results):
    """Render MA crossover signal analysis."""
    st.markdown("#### 📈 Signal Analysis")
    
    buy_trades = [t for t in results['trades'] if t['action'] == 'BUY']
    sell_trades = [t for t in results['trades'] if t['action'] == 'SELL']
    
    st.metric("Buy Signals", len(buy_trades))
    st.metric("Sell Signals", len(sell_trades))
    st.metric("Strategy Type", "Trend Following")
    st.metric("Risk Level", "🟡 Medium")


def _render_ma_trade_performance(results):
    """Render MA crossover trade performance metrics."""
    st.markdown("#### ⚡ Trade Performance")
    
    sell_trades = [t for t in results['trades'] if t['action'] == 'SELL']
    
    if sell_trades:
        profitable_trades = [t for t in sell_trades if t.get('profit', 0) > 0]
        avg_profit = sum(t.get('profit', 0) for t in sell_trades) / len(sell_trades)
        
        st.metric("Profitable Trades", f"{len(profitable_trades)}/{len(sell_trades)}")
        st.metric("Avg Trade Profit", format_currency(avg_profit))
        
        # Show trade distribution
        profits = [t.get('profit', 0) for t in sell_trades]
        max_profit = max(profits) if profits else 0
        min_profit = min(profits) if profits else 0
        
        st.metric("Best Trade", format_currency(max_profit))
        st.metric("Worst Trade", format_currency(min_profit))


def display_rsi_momentum_analysis(results):
    """Display RSI Momentum strategy specific analysis."""
    st.subheader("🌊 RSI Momentum Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        _render_rsi_momentum_metrics(results)
    
    with col2:
        _render_rsi_performance_stats(results)


def _render_rsi_momentum_metrics(results):
    """Render RSI momentum strategy metrics."""
    st.markdown("#### 📊 Momentum Metrics")
    
    st.metric("Strategy Type", "Mean Reversion")
    st.metric("Risk Level", "🔴 High")
    st.metric("Signal Type", "RSI Oversold/Overbought")
    
    # Calculate trade frequency
    total_days = len(results['dates'])
    total_trades = results['performance']['total_trades']
    trades_per_week = (total_trades / total_days) * 7 if total_days > 0 else 0
    
    st.metric("Trade Frequency", f"{trades_per_week:.1f} trades/week")


def _render_rsi_performance_stats(results):
    """Render RSI strategy performance statistics."""
    st.markdown("#### ⚡ Performance Stats")
    
    total_trades = results['performance']['total_trades']
    if total_trades > 0:
        avg_profit = results['performance']['total_profit'] / total_trades
        st.metric("Avg Profit/Trade", format_currency(avg_profit))
        st.metric("Trade Frequency", "High")
        
        # RSI-specific insights
        sell_trades = [t for t in results['trades'] if t['action'] == 'SELL']
        if sell_trades:
            quick_trades = [t for t in sell_trades if t.get('profit', 0) > 0]
            success_rate = len(quick_trades) / len(sell_trades) * 100
            st.metric("Quick Profit Rate", format_percentage(success_rate))


def display_backtest_summary(results):
    """Display a concise backtest summary."""
    st.subheader("📊 Backtest Summary")
    
    perf = results['performance']
    strategy_name = results.get('strategy_name', 'unknown')
    
    # Summary metrics in a compact format
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Final Value", format_currency(perf['final_value']))
    with col2:
        st.metric("Total Return", format_percentage(perf['total_return']))
    with col3:
        st.metric("Total Trades", perf['total_trades'])
    with col4:
        st.metric("Win Rate", format_percentage(perf['win_rate']))
    
    # Strategy-specific summary
    if strategy_name == "always_gain_btc":
        st.info(f"💰 Vault Balance: {format_currency(perf['vault_balance'])} | "
                f"🛡️ Loss Protection: Active | "
                f"📈 Total Profit: {format_currency(perf['total_profit'])}")
    else:
        st.info(f"💼 Active Trading: {format_currency(perf['trading_balance'])} | "
                f"📊 Max Drawdown: {format_percentage(perf['max_drawdown'])} | "
                f"⚡ Sharpe Ratio: {perf['sharpe_ratio']:.2f}")


def display_performance_comparison(results_list, names):
    """
    Display performance comparison between multiple strategies.
    
    Args:
        results_list (list): List of backtest results
        names (list): List of strategy names
    """
    st.subheader("🏆 Strategy Performance Comparison")
    
    # Create comparison table
    comparison_data = []
    for results, name in zip(results_list, names):
        perf = results['performance']
        comparison_data.append({
            'Strategy': name,
            'Final Value': perf['final_value'],
            'Total Return': perf['total_return'],
            'Total Profit': perf['total_profit'],
            'Win Rate': perf['win_rate'],
            'Max Drawdown': perf['max_drawdown'],
            'Sharpe Ratio': perf['sharpe_ratio'],
            'Total Trades': perf['total_trades']
        })
    
    import pandas as pd
    df = pd.DataFrame(comparison_data)
    
    # Format the dataframe for display
    df['Final Value'] = df['Final Value'].apply(format_currency)
    df['Total Return'] = df['Total Return'].apply(format_percentage)
    df['Total Profit'] = df['Total Profit'].apply(format_currency)
    df['Win Rate'] = df['Win Rate'].apply(format_percentage)
    df['Max Drawdown'] = df['Max Drawdown'].apply(format_percentage)
    df['Sharpe Ratio'] = df['Sharpe Ratio'].apply(lambda x: f"{x:.2f}")
    
    st.dataframe(df, use_container_width=True, hide_index=True)
    
    # Highlight best performers
    col1, col2, col3 = st.columns(3)
    
    with col1:
        best_return_idx = max(range(len(results_list)), 
                            key=lambda i: results_list[i]['performance']['total_return'])
        st.success(f"🏆 **Best Return:** {names[best_return_idx]}")
    
    with col2:
        best_sharpe_idx = max(range(len(results_list)), 
                            key=lambda i: results_list[i]['performance']['sharpe_ratio'])
        st.success(f"⚡ **Best Sharpe:** {names[best_sharpe_idx]}")
    
    with col3:
        best_winrate_idx = max(range(len(results_list)), 
                             key=lambda i: results_list[i]['performance']['win_rate'])
        st.success(f"🎯 **Best Win Rate:** {names[best_winrate_idx]}")
