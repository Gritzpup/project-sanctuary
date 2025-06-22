# Components package for Alpaca Trading Dashboard
"""
This package contains the trading dashboard components:
- order_book: Order book visualization component
- market_data: Real-time market data component (import directly from submodules)
"""

from .order_book import OrderBookComponent

__all__ = ['OrderBookComponent']
