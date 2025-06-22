import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import pandas as pd
import logging
from alpaca.trading.client import TradingClient
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.trading.models import Position
from app.core.config import settings

logger = logging.getLogger(__name__)

class AlpacaService:
    """Service for interacting with Alpaca API"""
    
    def __init__(self):
        """Initialize Alpaca service configuration"""
        self.api_key = settings.ALPACA_API_KEY
        self.secret_key = settings.ALPACA_SECRET_KEY
        self.base_url = getattr(settings, 'ALPACA_BASE_URL', "https://paper-api.alpaca.markets")
        
        # Lazy client attributes
        self._trading_client: Optional[TradingClient] = None
        self._data_client: Optional[CryptoHistoricalDataClient] = None

    @property
    def trading_client(self) -> TradingClient:
        """Lazily initialize and return the TradingClient"""
        if self._trading_client is None:
            if not self.api_key or not self.secret_key:
                raise ValueError("You must supply Alpaca API credentials via environment variables ALPACA_API_KEY and ALPACA_SECRET_KEY")
            self._trading_client = TradingClient(
                api_key=self.api_key,
                secret_key=self.secret_key,
                paper=True  # Always use paper trading for safety
            )
        return self._trading_client

    @property
    def data_client(self) -> CryptoHistoricalDataClient:
        """Lazily initialize and return the CryptoHistoricalDataClient"""
        if self._data_client is None:
            # Crypto data client doesn't require API keys for historical data
            self._data_client = CryptoHistoricalDataClient()
        return self._data_client

    def normalize_crypto_symbol(self, symbol: str) -> str:
        """
        Normalize crypto symbol to Alpaca's required format: BASE/QUOTE
        Examples: BTCUSD -> BTC/USD, btcusd -> BTC/USD, BTC/USD -> BTC/USD
        """
        symbol = symbol.upper().strip()
        
        # If already contains '/', assume it's correct
        if '/' in symbol:
            return symbol
        
        # Common crypto mappings
        crypto_pairs = {
            'BTCUSD': 'BTC/USD',
            'ETHUSD': 'ETH/USD',
            'LTCUSD': 'LTC/USD',
            'BCHUSD': 'BCH/USD',
            'ADAUSD': 'ADA/USD',
            'DOGEUSD': 'DOGE/USD',
            'SOLUSD': 'SOL/USD',
            'MATICUSD': 'MATIC/USD',
            'AVAXUSD': 'AVAX/USD',
            'DOTUSD': 'DOT/USD',
            'UNIUSD': 'UNI/USD',
            'LINKUSD': 'LINK/USD',
            'ATOMUSD': 'ATOM/USD',
            'ALGOUSD': 'ALGO/USD',
            'XLMUSD': 'XLM/USD',
            'BTCUSDT': 'BTC/USDT',
            'ETHUSDT': 'ETH/USDT'
        }
        
        if symbol in crypto_pairs:
            return crypto_pairs[symbol]
        
        # For unknown symbols, try to guess the format
        # Assume last 3 or 4 characters are the quote currency
        if len(symbol) >= 6:
            if symbol.endswith('USDT'):
                base = symbol[:-4]
                return f"{base}/USDT"
            elif symbol.endswith('USD'):
                base = symbol[:-3]
                return f"{base}/USD"
        
        # Default fallback
        return symbol

    def get_current_price(self, symbol: str) -> Optional[float]:
        """Get current price for a symbol"""
        try:
            # Normalize the symbol format
            normalized_symbol = self.normalize_crypto_symbol(symbol)
            logger.info(f"Getting current price for normalized symbol '{symbol}' -> '{normalized_symbol}'")
            
            # Get latest crypto bar data
            end_date = datetime.now()
            start_date = end_date - timedelta(minutes=5)
            
            request_params = CryptoBarsRequest(
                symbol_or_symbols=[normalized_symbol],
                timeframe=TimeFrame(amount=1, unit=TimeFrameUnit.Minute),
                start=start_date,
                end=end_date
            )
            
            bars = self.data_client.get_crypto_bars(request_params)
            
            if hasattr(bars, normalized_symbol) and len(getattr(bars, normalized_symbol, [])) > 0:
                latest_bar = getattr(bars, normalized_symbol)[-1]
                return float(getattr(latest_bar, 'close', 0))
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e}")
            return None

    def get_historical_data(
        self, 
        symbol: str, 
        timeframe: str = "1Min", 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 1000
    ) -> Optional[pd.DataFrame]:
        """Get historical crypto price data"""
        try:
            # Normalize the symbol format
            normalized_symbol = self.normalize_crypto_symbol(symbol)
            logger.info(f"Normalized symbol '{symbol}' to '{normalized_symbol}'")
            
            # Set default dates if not provided
            if end_date is None:
                end_date = datetime.now()
            if start_date is None:
                start_date = end_date - timedelta(days=7)
            
            # Convert timeframe string to TimeFrame object
            timeframe_obj = self._parse_timeframe(timeframe)
            
            request_params = CryptoBarsRequest(
                symbol_or_symbols=[normalized_symbol],
                timeframe=timeframe_obj,
                start=start_date,
                end=end_date
            )
            
            bars = self.data_client.get_crypto_bars(request_params)
            
            # Convert to DataFrame
            if hasattr(bars, normalized_symbol):
                symbol_bars = getattr(bars, normalized_symbol)
                if symbol_bars:
                    data = []
                    for bar in symbol_bars:
                        data.append({
                            'timestamp': getattr(bar, 'timestamp'),
                            'open': float(getattr(bar, 'open', 0)),
                            'high': float(getattr(bar, 'high', 0)),
                            'low': float(getattr(bar, 'low', 0)),
                            'close': float(getattr(bar, 'close', 0)),
                            'volume': float(getattr(bar, 'volume', 0))
                        })
                    
                    df = pd.DataFrame(data)
                    if not df.empty:
                        df.set_index('timestamp', inplace=True)
                        return df
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting historical data for {symbol}: {e}")
            return None

    def _parse_timeframe(self, timeframe: str) -> TimeFrame:
        """Parse timeframe string into TimeFrame object"""
        # Default to 1 minute
        amount = 1
        unit = TimeFrameUnit.Minute
        
        if timeframe:
            # Extract number and unit (e.g., "5Min" -> 5, "Min")
            import re
            match = re.match(r'(\d+)([A-Za-z]+)', timeframe)
            if match:
                amount = int(match.group(1))
                unit_str = match.group(2).lower()
                
                if unit_str in ['min', 'minute', 'minutes']:
                    unit = TimeFrameUnit.Minute
                elif unit_str in ['hour', 'hours']:
                    unit = TimeFrameUnit.Hour
                elif unit_str in ['day', 'days']:
                    unit = TimeFrameUnit.Day
        
        return TimeFrame(amount=amount, unit=unit)

    def get_account_info(self) -> Optional[Dict[str, Any]]:
        """Get account information"""
        try:
            account = self.trading_client.get_account()
            
            # Safe conversion with getattr and defaults
            def safe_float(value, default=0.0):
                if value is None:
                    return default
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default
            
            return {
                "account_id": getattr(account, 'id', None),
                "cash": safe_float(getattr(account, 'cash', None)),
                "portfolio_value": safe_float(getattr(account, 'portfolio_value', None)),
                "buying_power": safe_float(getattr(account, 'buying_power', None)),
                "status": getattr(account, 'status', None)
            }
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            return None
    
    def get_positions(self) -> List[Dict[str, Any]]:
        """Get current positions"""
        try:
            positions = self.trading_client.get_all_positions()
            
            # Safe conversion with getattr and defaults
            def safe_float(value, default=0.0):
                if value is None:
                    return default
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default
            
            position_list = []
            for position in positions:
                position_data = {
                    "symbol": getattr(position, 'symbol', ''),
                    "qty": safe_float(getattr(position, 'qty', None)),
                    "market_value": safe_float(getattr(position, 'market_value', None)),
                    "cost_basis": safe_float(getattr(position, 'cost_basis', None)),
                    "unrealized_pl": safe_float(getattr(position, 'unrealized_pl', None)),
                    "unrealized_plpc": safe_float(getattr(position, 'unrealized_plpc', None)),
                    "side": getattr(position, 'side', None),
                    "avg_entry_price": safe_float(getattr(position, 'avg_entry_price', None))
                }
                position_list.append(position_data)
            
            return position_list
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []

    def place_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> Optional[Dict[str, Any]]:
        """Place an order"""
        try:
            # Normalize the symbol format
            normalized_symbol = self.normalize_crypto_symbol(symbol)
            logger.info(f"Placing order for normalized symbol '{symbol}' -> '{normalized_symbol}'")
            
            from alpaca.trading.requests import MarketOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce
            
            # Convert string side to enum
            order_side = OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL
            
            market_order_data = MarketOrderRequest(
                symbol=normalized_symbol,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.GTC
            )
            
            order = self.trading_client.submit_order(order_data=market_order_data)
            
            # Convert order to dict
            return {
                "id": getattr(order, 'id', None),
                "symbol": getattr(order, 'symbol', None),
                "qty": float(getattr(order, 'qty', 0)),
                "side": str(getattr(order, 'side', None)),
                "status": str(getattr(order, 'status', None)),
                "submitted_at": str(getattr(order, 'submitted_at', None))
            }
            
        except Exception as e:
            logger.error(f"Error placing order for {symbol}: {e}")
            return None

# Create a global instance
alpaca_service = AlpacaService()