"""
Strategy Components Package

Contains modular components for different trading strategies.
Each strategy has its own module with specialized logic and UI components.
"""

from .always_gain_components import (
    generate_always_gain_backtest_trades,
    calculate_portfolio_metrics,
    render_strategy_controls,
    render_timeframe_selector,
    render_portfolio_metrics,
    render_trade_summary,
    render_vault_growth_chart
)

__all__ = [
    'generate_always_gain_backtest_trades',
    'calculate_portfolio_metrics', 
    'render_strategy_controls',
    'render_timeframe_selector',
    'render_portfolio_metrics',
    'render_trade_summary',
    'render_vault_growth_chart'
]
