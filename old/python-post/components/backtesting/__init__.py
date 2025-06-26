"""
Backtesting components package for the Alpaca Trader application.

This package contains modular components for backtesting functionality:
- strategy_engine: Trading strategy implementations and backtesting engine
- chart_components: Chart rendering and visualization functions
- analysis_components: Results analysis and performance display functions
- backtest_utils: Utility functions for calculations and data processing
"""

from .strategy_engine import BacktestEngine, generate_mock_results
from .chart_components import (
    display_performance_charts,
    display_trade_analysis,
    render_strategy_comparison_chart,
    render_risk_metrics_chart
)
from .analysis_components import (
    display_enhanced_backtest_results,
    display_always_gain_analysis,
    display_ma_crossover_analysis,
    display_rsi_momentum_analysis,
    display_backtest_summary,
    display_performance_comparison
)
from .backtest_utils import (
    calculate_max_drawdown,
    calculate_sharpe_ratio,
    calculate_win_rate,
    calculate_performance_metrics,
    format_currency,
    format_percentage,
    format_btc_amount
)

__all__ = [
    # Engine classes
    'BacktestEngine',
    'generate_mock_results',
    
    # Chart components
    'display_performance_charts',
    'display_trade_analysis',
    'render_strategy_comparison_chart',
    'render_risk_metrics_chart',
    
    # Analysis components
    'display_enhanced_backtest_results',
    'display_always_gain_analysis',
    'display_ma_crossover_analysis',
    'display_rsi_momentum_analysis',
    'display_backtest_summary',
    'display_performance_comparison',
    
    # Utility functions
    'calculate_max_drawdown',
    'calculate_sharpe_ratio',
    'calculate_win_rate',
    'calculate_performance_metrics',
    'format_currency',
    'format_percentage',
    'format_btc_amount',
]
