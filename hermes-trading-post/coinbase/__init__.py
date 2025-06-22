"""
Coinbase Advanced Trade API Integration
Provides secure authentication and API client functionality
"""

from coinbase.client import CoinbaseClient
from coinbase.auth import CoinbaseAuth

__all__ = ['CoinbaseClient', 'CoinbaseAuth']
