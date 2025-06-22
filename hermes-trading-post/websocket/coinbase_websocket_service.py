"""
Official Coinbase SDK WebSocket Real-time Data Service
Provides sub-100ms real-time crypto data streaming using the official Coinbase SDK
Based on: https://docs.cdp.coinbase.com/coinbase-app/docs/trade/sdk-ws-client-subscribe
"""

import asyncio
import json
import logging
import time
import os
from datetime import datetime
from typing import Dict, List, Callable, Optional, Any
from coinbase.websocket import WSClient
from coinbase.rest import RESTClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CoinbaseSDKWebSocketClient:
    """
    Official Coinbase SDK WebSocket client for real-time market data.
    Handles market data streaming with sub-100ms latency targets.
    """
    
    def __init__(self, api_key: str = None, api_secret: str = None):
        """Initialize with Coinbase API credentials."""
        self.api_key = api_key or os.getenv('COINBASE_API_KEY')
        self.api_secret = api_secret or os.getenv('COINBASE_API_SECRET')
        
        if not self.api_key or not self.api_secret:
            logger.warning("⚠️ Coinbase API credentials not found, using public WebSocket feeds only")
            
        # Initialize the REST client for authentication
        if self.api_key and self.api_secret:
            self.rest_client = RESTClient(api_key=self.api_key, api_secret=self.api_secret)
        else:
            self.rest_client = RESTClient()  # Public endpoints only
            
        self.ws_client = None
        self.is_connected = False
        self.subscribers = []
        self.real_time_data = {}
        self.callbacks = {}
        
    def subscribe_to_callback(self, callback: Callable):
        """Subscribe to real-time data updates."""
        self.subscribers.append(callback)
        logger.info(f"📝 Added callback subscriber (total: {len(self.subscribers)})")
        
    async def connect(self, symbols: List[str] = None):
        """Connect to Coinbase WebSocket and subscribe to channels."""
        if not symbols:
            symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD', 'DOGE-USD', 'LTC-USD']
            
        try:
            logger.info("🔄 Connecting to Coinbase WebSocket using official SDK...")
            
            # Initialize WebSocket client
            if self.api_key and self.api_secret:
                self.ws_client = WSClient(api_key=self.api_key, api_secret=self.api_secret)
            else:
                self.ws_client = WSClient()  # Public feeds only
                
            # Set up message handlers
            self.ws_client.on_message(self._handle_message)
            self.ws_client.on_open(self._handle_open)
            self.ws_client.on_close(self._handle_close)
            self.ws_client.on_error(self._handle_error)
            
            # Subscribe to ticker channel for real-time prices
            await self.ws_client.subscribe(
                product_ids=symbols,
                channels=['ticker', 'level2_batch']
            )
            
            self.is_connected = True
            logger.info(f"✅ Connected to Coinbase WebSocket with {len(symbols)} symbols")
            
            # Start the WebSocket connection
            await self.ws_client.run()
            
        except Exception as e:
            logger.error(f"❌ WebSocket connection failed: {e}")
            self.is_connected = False
            
    async def _handle_open(self):
        """Handle WebSocket connection opened."""
        self.is_connected = True
        logger.info("🔗 Coinbase WebSocket connection opened")
        
    async def _handle_close(self):
        """Handle WebSocket connection closed."""
        self.is_connected = False
        logger.info("🔌 Coinbase WebSocket connection closed")
        
    async def _handle_error(self, error):
        """Handle WebSocket error."""
        logger.error(f"❌ Coinbase WebSocket error: {error}")
        
    async def _handle_message(self, message):
        """Handle incoming WebSocket message."""
        try:
            if isinstance(message, str):
                data = json.loads(message)
            else:
                data = message
                
            # Process different message types
            message_type = data.get('type')
            
            if message_type == 'ticker':
                await self._handle_ticker_update(data)
            elif message_type == 'l2update':
                await self._handle_orderbook_update(data)
            elif message_type == 'snapshot':
                await self._handle_snapshot(data)
                
        except Exception as e:
            logger.error(f"❌ Error processing WebSocket message: {e}")
            
    async def _handle_ticker_update(self, data):
        """Process real-time ticker updates."""
        try:
            product_id = data.get('product_id')
            if not product_id:
                return
                
            # Extract ticker data
            ticker_data = {
                'symbol': product_id,
                'price': float(data.get('price', 0)),
                'volume_24h': float(data.get('volume_24h', 0)),
                'low_24h': float(data.get('low_24h', 0)),
                'high_24h': float(data.get('high_24h', 0)),
                'open_24h': float(data.get('open_24h', 0)),
                'best_bid': float(data.get('best_bid', 0)),
                'best_ask': float(data.get('best_ask', 0)),
                'timestamp': data.get('time', datetime.utcnow().isoformat()),
                'change_24h': 0.0,
                'change_pct_24h': 0.0
            }
            
            # Calculate 24h change
            if ticker_data['open_24h'] > 0:
                ticker_data['change_24h'] = ticker_data['price'] - ticker_data['open_24h']
                ticker_data['change_pct_24h'] = (ticker_data['change_24h'] / ticker_data['open_24h']) * 100
                
            # Update real-time data store
            self.real_time_data[product_id] = ticker_data
            
            # Notify all subscribers
            for callback in self.subscribers:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(ticker_data)
                    else:
                        callback(ticker_data)
                except Exception as e:
                    logger.error(f"❌ Callback error for {product_id}: {e}")
                    
        except Exception as e:
            logger.error(f"❌ Error handling ticker update: {e}")
            
    async def _handle_orderbook_update(self, data):
        """Process real-time order book updates."""
        try:
            product_id = data.get('product_id')
            if not product_id:
                return
                
            # Store order book data (simplified for now)
            if 'orderbook' not in self.real_time_data:
                self.real_time_data['orderbook'] = {}
                
            self.real_time_data['orderbook'][product_id] = {
                'bids': data.get('changes', []),
                'asks': data.get('changes', []),
                'timestamp': data.get('time', datetime.utcnow().isoformat())
            }
            
        except Exception as e:
            logger.error(f"❌ Error handling order book update: {e}")
            
    async def _handle_snapshot(self, data):
        """Process snapshot messages."""
        try:
            product_id = data.get('product_id')
            if product_id:
                logger.info(f"📸 Received snapshot for {product_id}")
        except Exception as e:
            logger.error(f"❌ Error handling snapshot: {e}")
            
    def get_latest_data(self, product_id: str = None) -> Dict[str, Any]:
        """Get latest real-time data."""
        if product_id:
            return self.real_time_data.get(product_id, {})
        return self.real_time_data
        
    def get_connection_status(self) -> Dict[str, Any]:
        """Get WebSocket connection status."""
        return {
            'connected': self.is_connected,
            'symbols_count': len(self.real_time_data),
            'last_update': max([
                data.get('timestamp', '1970-01-01T00:00:00Z') 
                for data in self.real_time_data.values() 
                if isinstance(data, dict)
            ], default='1970-01-01T00:00:00Z')
        }
        
    async def disconnect(self):
        """Disconnect WebSocket."""
        if self.ws_client:
            await self.ws_client.close()
        self.is_connected = False
        logger.info("🔌 Coinbase WebSocket disconnected")

# Real-time data store for Dash callbacks
class RealTimeDataStore:
    """Thread-safe real-time data store for Dash components."""
    
    def __init__(self):
        self.market_data = {}
        self.portfolio_data = {}
        self.orderbook_data = {}
        self.last_update = 0
        self._lock = asyncio.Lock()
        
    async def update_ticker(self, data: Dict[str, Any]):
        """Update ticker data in store."""
        async with self._lock:
            symbol = data.get('symbol')
            if symbol:
                self.market_data[symbol] = data
                self.last_update = time.time()
                
    def get_market_data(self) -> Dict[str, Any]:
        """Get current market data."""
        return self.market_data.copy()
        
    def get_latest_prices(self) -> Dict[str, float]:
        """Get latest prices for all symbols."""
        return {
            symbol: data.get('price', 0.0) 
            for symbol, data in self.market_data.items()
        }

# Global instances
real_time_store = RealTimeDataStore()
ws_client = CoinbaseSDKWebSocketClient()

# Register data store callbacks
ws_client.subscribe_to_callback(real_time_store.update_ticker)

async def start_websocket_service(symbols: List[str] = None):
    """Start the WebSocket service."""
    if not symbols:
        symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD', 'DOGE-USD', 'LTC-USD']
    
    try:
        logger.info("🚀 Starting Coinbase SDK WebSocket service...")
        await ws_client.connect(symbols)
        return True
    except Exception as e:
        logger.error(f"❌ Failed to start WebSocket service: {e}")
        return False

async def stop_websocket_service():
    """Stop the WebSocket service."""
    await ws_client.disconnect()

def get_real_time_prices() -> Dict[str, Any]:
    """Get current real-time prices for dashboard."""
    try:
        return real_time_store.get_latest_prices()
    except Exception as e:
        logger.error(f"❌ Error getting real-time prices: {e}")
        return {}

def get_connection_status() -> Dict[str, Any]:
    """Get WebSocket connection status."""
    return ws_client.get_connection_status()

# Export the required objects for dashboard import
__all__ = [
    'ws_client', 
    'real_time_store', 
    'start_websocket_service', 
    'stop_websocket_service',
    'get_real_time_prices',
    'get_connection_status'
]

if __name__ == "__main__":
    # Test WebSocket connection
    async def test_callback(data):
        print(f"📈 {data['symbol']}: ${data['price']:.2f} ({data['change_pct_24h']:+.2f}%)")
    
    async def main():
        ws_client.subscribe_to_callback(test_callback)
        await start_websocket_service()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🔌 Disconnecting WebSocket...")
        asyncio.run(stop_websocket_service())
