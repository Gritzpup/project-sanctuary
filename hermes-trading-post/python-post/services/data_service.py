"""
Data Service Module - API Data Fetching Functions
Extracted from streamlit_app.py for better code organization
"""

import requests
from typing import Dict, Any, Optional, List, Tuple
import os
import random
from datetime import datetime, timedelta

# API Configuration
API_BASE_URL = "http://localhost:8000/api"

# Import Alpaca service functions directly from backend
try:
    from backend.app.services.alpaca_service import AlpacaService
    alpaca_service = AlpacaService()
except ImportError:
    alpaca_service = None

# =============================================================================
# Core API Data Fetching Functions
# =============================================================================

@st.cache_data(ttl=30)  # Cache for 30 seconds
def fetch_portfolio_data() -> Optional[Dict[str, Any]]:
    """Fetch real portfolio data from the API"""
    try:
        response = requests.get(f"{API_BASE_URL}/portfolio/", timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except requests.exceptions.RequestException:
        return None

@st.cache_data(ttl=60)  # Cache for 1 minute
def fetch_trades_data(days: int = 30) -> Optional[Dict[str, Any]]:
    """Fetch recent trades from the API"""
    try:
        response = requests.get(f"{API_BASE_URL}/trades?days={days}", timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except requests.exceptions.RequestException:
        return None

@st.cache_data(ttl=120)  # Cache for 2 minutes
def fetch_market_data(symbol: str = "BTCUSD", timeframe: str = "1D", limit: int = 365) -> Optional[Dict[str, Any]]:
    """Fetch market data from the API"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/market-data/historical/{symbol}?days={limit}&resolution={timeframe}", 
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except requests.exceptions.RequestException:
        return None

@st.cache_data(ttl=60)  # Cache for 1 minute  
def fetch_real_trades_data(days: int = 365) -> Optional[List[Dict[str, Any]]]:
    """Fetch real trading history from the API"""
    try:
        response = requests.get(f"{API_BASE_URL}/trades/history?days={days}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Extract trades array from API response
            if isinstance(data, dict) and 'trades' in data:
                return data['trades']
            elif isinstance(data, list):
                return data
            else:
                return []
        else:
            return None
    except requests.exceptions.RequestException:
        return None

# =============================================================================
# Alpaca API Integration Functions
# =============================================================================

@st.cache_data(ttl=30)  # Cache for 30 seconds
def fetch_alpaca_portfolio_data() -> Optional[Dict[str, Any]]:
    """Fetch portfolio data from Alpaca Paper Trading API"""
    try:
        # Get API credentials from environment
        api_key = os.getenv("ALPACA_API_KEY")
        secret_key = os.getenv("ALPACA_SECRET_KEY")
        
        if not api_key or not secret_key or api_key == "your_api_key_here":
            # No valid credentials, return None to use mock data
            return None
        
        # Try to import Alpaca SDK, if not available, fall back to mock data
        try:
            from alpaca.trading.client import TradingClient
        except ImportError:
            # Alpaca SDK not installed, return None to use mock data
            return None
            
        # Initialize Alpaca client for paper trading
        trading_client = TradingClient(
            api_key=api_key,
            secret_key=secret_key,
            paper=True  # Always use paper trading for safety
        )
        
        # Get account information with safe attribute access
        account = trading_client.get_account()
        positions = trading_client.get_all_positions()
        
        # Convert positions to our format with safe access
        portfolio_positions = []
        btc_balance = 0.0
        btc_value = 0.0
        
        for pos in positions:
            # Use getattr for safe attribute access
            symbol = getattr(pos, 'symbol', 'UNKNOWN')
            qty = float(getattr(pos, 'qty', 0))
            market_value = float(getattr(pos, 'market_value', 0))
            unrealized_pl = float(getattr(pos, 'unrealized_pl', 0))
            unrealized_plpc = float(getattr(pos, 'unrealized_plpc', 0))
            
            if symbol == "BTCUSD":
                btc_balance = qty
                btc_value = market_value
                
            portfolio_positions.append({
                'symbol': symbol,
                'qty': qty,
                'market_value': market_value,
                'unrealized_pl': unrealized_pl,
                'unrealized_plpc': unrealized_plpc
            })
        
        # Safe attribute access for account data
        portfolio_value = float(getattr(account, 'portfolio_value', 100000))
        cash = float(getattr(account, 'cash', 10000))
        buying_power = float(getattr(account, 'buying_power', cash * 2))
        last_equity = float(getattr(account, 'last_equity', portfolio_value))
        
        # Calculate day P&L
        day_pnl = portfolio_value - last_equity if last_equity > 0 else 0.0
        
        # Format data for our dashboard
        return {
            'total_value': portfolio_value,
            'cash_balance': cash,
            'buying_power': buying_power,
            'btc_balance': btc_balance,
            'btc_value': btc_value,
            'btc_price': btc_value / btc_balance if btc_balance > 0 else 105390.28,
            'usdc_vault': 0.0,  # We'll implement vault logic separately
            'vault_growth_pct': 2.1,  # Mock data for now
            'day_pnl': day_pnl,
            'day_pnl_pct': (day_pnl / last_equity * 100) if last_equity > 0 else 0.0,
            'total_pnl': portfolio_value - 100000.0,  # Assuming $100k starting balance
            'unrealized_pnl': sum(p['unrealized_pl'] for p in portfolio_positions),
            'positions': portfolio_positions,
            'orders': []  # We'll fetch orders separately if needed
        }
        
    except Exception as e:
        # If there's any error, return None to fall back to mock data
        print(f"Error connecting to Alpaca API: {e}")
        return None

def get_alpaca_account_info() -> Optional[Dict[str, Any]]:
    """Get account information from Alpaca API"""
    try:
        # Import here to avoid import issues
        from services.alpaca_api_service import alpaca_service
        import asyncio
        return asyncio.run(alpaca_service.get_account_info())
    except Exception as e:
        st.warning(f"Could not fetch account info: {e}")
        return None

def get_alpaca_positions() -> List[Dict[str, Any]]:
    """Get current positions from Alpaca API"""
    try:
        from services.alpaca_api_service import alpaca_service
        import asyncio
        return asyncio.run(alpaca_service.get_positions())
    except Exception as e:
        st.warning(f"Could not fetch positions: {e}")
        return []

def get_btc_price_alpaca() -> float:
    """Get current BTC price from Alpaca"""
    try:
        from services.alpaca_api_service import alpaca_service
        import asyncio
        price = asyncio.run(alpaca_service.get_latest_price("BTC/USD"))
        return price if price else 105390.28  # Fallback price
    except Exception as e:
        st.warning(f"Could not fetch BTC price: {e}")
        return 105390.28  # Fallback price

def place_alpaca_order(symbol: str, qty: float, side: str) -> Optional[Dict[str, Any]]:
    """Place an order through Alpaca API"""
    try:
        from services.alpaca_api_service import alpaca_service
        import asyncio
        result = asyncio.run(alpaca_service.place_order(symbol, qty, side))
        return result
    except Exception as e:
        st.error(f"Error placing order: {e}")
        return None

def get_alpaca_orders(limit: int = 20) -> List[Dict[str, Any]]:
    """Get recent orders from Alpaca API"""
    try:
        # For now return mock data since Alpaca service doesn't have get_orders method
        orders = []
        for i in range(min(limit, 5)):  # Return up to 5 mock orders
            orders.append({
                'id': f'order_{i+1}',
                'symbol': 'BTCUSD',
                'side': random.choice(['buy', 'sell']),
                'qty': round(random.uniform(0.001, 0.1), 4),
                'status': random.choice(['filled', 'pending', 'cancelled']),
                'order_type': 'market',
                'submitted_at': datetime.now() - timedelta(hours=random.randint(1, 24))
            })
        return orders
    except Exception as e:
        st.warning(f"Could not fetch orders: {e}")
        return []

def cancel_alpaca_order(order_id: str) -> bool:
    """Cancel an order through Alpaca API"""
    try:
        from services.alpaca_api_service import alpaca_service
        import asyncio
        result = asyncio.run(alpaca_service.cancel_order(order_id))
        return result
    except Exception as e:
        st.error(f"Error cancelling order: {e}")
        return False

# =============================================================================
# Mock Data Generation Functions
# =============================================================================

def get_mock_portfolio_data():
    """Fallback mock data when API is unavailable"""
    return {
        'total_value': 12543.67,
        'cash_balance': 5234.67,
        'btc_balance': 0.125,
        'btc_value': 4977.31,
        'btc_price': 105390.28,
        'usdc_vault': 1234.56,
        'unrealized_pnl': 543.67,
        'total_pnl': 2543.67
    }

def get_alpaca_mock_data(starting_balance: float = 1000.0):
    """Generate Alpaca-style mock data for paper trading mode"""
    return {
        'account_value': starting_balance * random.uniform(0.9, 1.15),
        'cash': starting_balance * random.uniform(0.1, 0.4),
        'portfolio_value': starting_balance * random.uniform(0.6, 0.85),
        'day_trade_buying_power': starting_balance * 4.0,
        'buying_power': starting_balance * 2.0,
        'positions': [],
        'btc_price': 105390.28 + random.uniform(-5000, 5000)
    }

# =============================================================================
# Enhanced Hybrid Backend Support with Graceful Fallback
# =============================================================================

def is_backend_available() -> bool:
    """Check if backend API is available"""
    try:
        response = requests.get(f"{API_BASE_URL}/data/status", timeout=2)
        return response.status_code == 200
    except:
        return False

# =============================================================================
# Backtest Configuration Management
# =============================================================================

def save_backtest_config(config_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save backtest configuration to backend if available, otherwise to session state
    
    Args:
        config_data: Configuration dictionary
        
    Returns:
        Result dictionary with success status
    """
    if is_backend_available():
        try:
            response = requests.post(f"{API_BASE_URL}/backtest/configs", json=config_data, timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                # Fallback to session state
                return _save_config_to_session(config_data)
        except requests.exceptions.RequestException:
            return _save_config_to_session(config_data)
    else:
        return _save_config_to_session(config_data)

def load_backtest_configs() -> List[Dict[str, Any]]:
    """
    Load backtest configurations from backend if available, otherwise from session state
    
    Returns:
        List of configuration dictionaries
    """
    if is_backend_available():
        try:
            response = requests.get(f"{API_BASE_URL}/backtest/configs", timeout=5)
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException:
            pass
    
    # Fallback to session state
    return st.session_state.get('saved_backtest_configs', [])

def save_backtest_result(result_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save backtest result to backend if available, otherwise to session state
    
    Args:
        result_data: Result dictionary
        
    Returns:
        Result dictionary with success status
    """
    if is_backend_available():
        try:
            response = requests.post(f"{API_BASE_URL}/backtest/results", json=result_data, timeout=10)
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException:
            pass
    
    # Fallback to session state
    return _save_result_to_session(result_data)

def load_backtest_results(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Load backtest results from backend if available, otherwise from session state
    
    Args:
        limit: Maximum number of results to return
        
    Returns:
        List of result dictionaries
    """
    if is_backend_available():
        try:
            response = requests.get(f"{API_BASE_URL}/backtest/results?limit={limit}", timeout=5)
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException:
            pass
    
    # Fallback to session state
    return st.session_state.get('saved_backtest_results', [])[-limit:]

# =============================================================================
# Enhanced Bitcoin Data Service with Database Caching
# =============================================================================

def get_cached_bitcoin_data(days: int = 365) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached Bitcoin data from backend database if available
    
    Args:
        days: Number of days to retrieve
        
    Returns:
        List of data dictionaries or None if not available
    """
    if is_backend_available():
        try:
            response = requests.get(f"{API_BASE_URL}/backtest/data/cached/{days}", timeout=10)
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    return result.get('data', [])
        except requests.exceptions.RequestException:
            pass
    
    return None

def trigger_data_update(days: int = 1) -> Dict[str, Any]:
    """
    Trigger Bitcoin data update in backend
    
    Args:
        days: Number of recent days to update
        
    Returns:
        Update result dictionary
    """
    if is_backend_available():
        try:
            response = requests.post(f"{API_BASE_URL}/backtest/data/update?days={days}", timeout=30)
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException:
            pass
    
    return {
        "success": False,
        "error": "Backend not available for data updates"
    }

def get_data_status() -> Dict[str, Any]:
    """
    Get status of Bitcoin data in backend database
    
    Returns:
        Status dictionary
    """
    if is_backend_available():
        try:
            response = requests.get(f"{API_BASE_URL}/backtest/data/status", timeout=5)
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException:
            pass
    
    return {
        "success": False,
        "backend_available": False,
        "message": "Backend not available"
    }

# =============================================================================
# Session State Fallback Functions
# =============================================================================

def _save_config_to_session(config_data: Dict[str, Any]) -> Dict[str, Any]:
    """Save configuration to session state as fallback"""
    if 'saved_backtest_configs' not in st.session_state:
        st.session_state.saved_backtest_configs = []
    
    # Add timestamp and ID
    config_data['id'] = len(st.session_state.saved_backtest_configs) + 1
    config_data['created_at'] = datetime.now().isoformat()
    config_data['source'] = 'session_state'
    
    st.session_state.saved_backtest_configs.append(config_data)
    
    return {
        "success": True,
        "config": config_data,
        "message": "Configuration saved to session (backend unavailable)"
    }

def _save_result_to_session(result_data: Dict[str, Any]) -> Dict[str, Any]:
    """Save result to session state as fallback"""
    if 'saved_backtest_results' not in st.session_state:
        st.session_state.saved_backtest_results = []
    
    # Add timestamp and ID
    result_data['id'] = len(st.session_state.saved_backtest_results) + 1
    result_data['execution_date'] = datetime.now().isoformat()
    result_data['source'] = 'session_state'
    
    st.session_state.saved_backtest_results.append(result_data)
    
    return {
        "success": True,
        "result": result_data,
        "message": "Result saved to session (backend unavailable)"
    }

# =============================================================================
# Enhanced Bitcoin Data Integration
# =============================================================================

def get_enhanced_bitcoin_data(days: int = 365, use_cache: bool = True) -> Tuple[List[str], List[float]]:
    """
    Get Bitcoin data with enhanced backend integration
    
    Args:
        days: Number of days to retrieve
        use_cache: Whether to use cached data from backend
        
    Returns:
        Tuple of (dates, prices) as lists
    """
    # First try to get cached data from backend if requested
    if use_cache:
        cached_data = get_cached_bitcoin_data(days)
        if cached_data:
            dates = [item['timestamp'][:10] for item in cached_data]  # Extract date part
            prices = [item['close'] for item in cached_data]
            
            st.info(f"📊 Using cached data from backend database ({len(dates)} days)")
            return dates, prices
    
    # Fallback to direct bitcoin service
    from services.bitcoin_data_service import get_real_bitcoin_data
    
    st.info("📊 Using real-time Alpaca data (backend cache not available)")
    return get_real_bitcoin_data(days)
