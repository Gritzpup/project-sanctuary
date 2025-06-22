"""
Utility functions for backtesting calculations and data processing.
Contains helper functions for risk metrics, performance calculations, and data transformations.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def calculate_max_drawdown(portfolio_values):
    """
    Calculate maximum drawdown from a series of portfolio values.
    
    Args:
        portfolio_values (list): List of portfolio values over time
        
    Returns:
        float: Maximum drawdown as a percentage
    """
    if len(portfolio_values) < 2:
        return 0.0
    
    peak = portfolio_values[0]
    max_dd = 0
    
    for value in portfolio_values[1:]:
        if value > peak:
            peak = value
        drawdown = (peak - value) / peak if peak > 0 else 0
        max_dd = max(max_dd, drawdown)
    
    return max_dd * 100


def calculate_sharpe_ratio(portfolio_values):
    """
    Calculate Sharpe ratio (simplified version without risk-free rate).
    
    Args:
        portfolio_values (list): List of portfolio values over time
        
    Returns:
        float: Annualized Sharpe ratio
    """
    if len(portfolio_values) < 2:
        return 0.0
        
    returns = np.diff(portfolio_values) / portfolio_values[:-1]
    if len(returns) > 1 and np.std(returns) > 0:
        return np.mean(returns) / np.std(returns) * np.sqrt(252)  # Annualized
    return 0.0


def calculate_win_rate(trades):
    """
    Calculate win rate from a list of trades.
    
    Args:
        trades (list): List of trade dictionaries
        
    Returns:
        dict: Dictionary containing win rate statistics
    """
    if not trades:
        return {
            'win_rate': 0.0,
            'winning_trades': 0,
            'losing_trades': 0,
            'total_trades': 0
        }
    
    sell_trades = [t for t in trades if t['action'] == 'SELL']
    if not sell_trades:
        return {
            'win_rate': 0.0,
            'winning_trades': 0,
            'losing_trades': 0,
            'total_trades': len(trades)
        }
    
    winning_trades = len([t for t in sell_trades if t.get('profit', 0) > 0])
    losing_trades = len(sell_trades) - winning_trades
    win_rate = (winning_trades / len(sell_trades)) * 100 if sell_trades else 0
    
    return {
        'win_rate': win_rate,
        'winning_trades': winning_trades,
        'losing_trades': losing_trades,
        'total_trades': len(trades)
    }


def calculate_performance_metrics(results):
    """
    Calculate comprehensive performance metrics from backtest results.
    
    Args:
        results (dict): Backtest results dictionary
        
    Returns:
        dict: Enhanced performance metrics
    """
    initial_value = results['portfolio_values'][0]
    final_value = results['portfolio_values'][-1]
    total_return = ((final_value - initial_value) / initial_value) * 100
    
    # Calculate basic metrics
    max_drawdown = calculate_max_drawdown(results['portfolio_values'])
    sharpe_ratio = calculate_sharpe_ratio(results['portfolio_values'])
    win_stats = calculate_win_rate(results['trades'])
    
    # Calculate total profit from trades
    total_profit = sum(t.get('profit', 0) for t in results['trades'] if t['action'] == 'SELL')
    
    # Strategy-specific metrics
    final_vault = results['vault_balances'][-1] if results['vault_balances'] else 0
    final_cash = results['cash_balances'][-1] if results['cash_balances'] else 0
    final_btc_value = results['btc_holdings'][-1] * results['prices'][-1] if results['btc_holdings'] and results['prices'] else 0
    
    return {
        'initial_value': initial_value,
        'final_value': final_value,
        'total_return': total_return,
        'max_drawdown': max_drawdown,
        'sharpe_ratio': sharpe_ratio,
        'total_profit': total_profit,
        'vault_balance': final_vault,
        'cash_balance': final_cash,
        'trading_balance': final_cash + final_btc_value,
        'btc_holdings_value': final_btc_value,
        **win_stats
    }


def generate_date_range(start_date, end_date):
    """
    Generate a date range for backtesting.
    
    Args:
        start_date (datetime): Start date
        end_date (datetime): End date
        
    Returns:
        pd.DatetimeIndex: Date range
    """
    return pd.date_range(start=start_date, end=end_date, freq='D')


def simulate_price_data(dates, initial_price=45000, volatility=0.03, drift=0.001, seed=42):
    """
    Simulate realistic Bitcoin price data for backtesting.
    
    Args:
        dates (pd.DatetimeIndex): Date range
        initial_price (float): Starting price
        volatility (float): Price volatility
        drift (float): Price drift (trend)
        seed (int): Random seed for reproducibility
        
    Returns:
        list: Simulated price data
    """
    np.random.seed(seed)
    returns = np.random.normal(drift, volatility, len(dates))
    prices = [initial_price]
    
    for return_rate in returns[1:]:
        new_price = prices[-1] * (1 + return_rate)
        prices.append(max(new_price, 1000))  # Prevent negative prices
    
    return prices


def format_currency(value):
    """Format currency values for display."""
    return f"${value:,.2f}"


def format_percentage(value):
    """Format percentage values for display."""
    return f"{value:.2f}%"


def format_btc_amount(value):
    """Format Bitcoin amounts for display."""
    return f"{value:.6f} BTC"
