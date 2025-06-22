"""
Simple WebSocket client for Coinbase real-time data
Following official Coinbase WebSocket setup guide with auto-reconnection
"""

import websocket
import json
import logging
import threading
import time
from datetime import datetime, timedelta
from collections import defaultdict, deque

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CoinbaseWebSocketClient:
    """Simple WebSocket client for Coinbase real-time market data with auto-reconnection"""
    
    def __init__(self):
        self.ws = None
        self.latest_data = {}
        self.callbacks = []
        self.connected = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 5  # seconds
        self.should_reconnect = True
        # Store historical data for line charts (15 minutes of data)
        self.historical_data = defaultdict(lambda: deque(maxlen=15))  # 15 data points
        
    def add_callback(self, callback):
        """Add callback function for price updates"""
        self.callbacks.append(callback)
        
    def add_historical_point(self, symbol, price, timestamp):
        """Add a price point to historical data for line charts"""
        self.historical_data[symbol].append({
            'timestamp': timestamp,
            'price': price,
            'datetime': datetime.fromtimestamp(timestamp)
        })
        
    def get_historical_data(self, symbol, minutes=15):
        """Get historical price data for the last N minutes"""
        if symbol not in self.historical_data:
            return []
        
        now = time.time()
        cutoff_time = now - (minutes * 60)  # N minutes ago
        
        # Return only recent data
        recent_data = [
            point for point in self.historical_data[symbol] 
            if point['timestamp'] >= cutoff_time
        ]
        
        return recent_data
        
    def on_open(self, ws):
        """Handle WebSocket connection opened"""
        logger.info("✅ Connected to Coinbase WebSocket")
        self.connected = True
        self.reset_reconnect_counter()  # Reset counter on successful connection
        
        # Subscribe to ticker channel for multiple products
        subscribe_msg = {
            "type": "subscribe",
            "product_ids": ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "DOGE-USD"],
            "channels": ["ticker"]
        }
        
        ws.send(json.dumps(subscribe_msg))
        logger.info("📡 Subscribed to ticker data")
        
    def on_message(self, ws, message):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            if data.get("type") == "ticker":
                product_id = data.get("product_id")
                if product_id:
                    # Store latest ticker data
                    price = float(data.get("price", 0))
                    timestamp = time.time()
                    
                    self.latest_data[product_id] = {
                        "price": price,
                        "volume_24h": float(data.get("volume_24h", 0)),
                        "low_24h": float(data.get("low_24h", 0)),
                        "high_24h": float(data.get("high_24h", 0)),
                        "timestamp": timestamp,
                        "symbol": product_id
                    }
                    
                    # Add to historical data for line charts
                    self.add_historical_point(product_id, price, timestamp)
                    
                    # Call registered callbacks
                    for callback in self.callbacks:
                        try:
                            callback(self.latest_data[product_id])
                        except Exception as e:
                            logger.error(f"Callback error: {e}")
                            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            
    def on_error(self, ws, error):
        """Handle WebSocket error"""
        logger.error(f"❌ WebSocket error: {error}")
        self.connected = False
        # Attempt to reconnect
        if self.should_reconnect:
            self.schedule_reconnect()
        
    def on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket connection closed"""
        logger.info(f"🔌 WebSocket connection closed: {close_status_code} - {close_msg}")
        self.connected = False
        # Attempt to reconnect unless explicitly stopped
        if self.should_reconnect:
            self.schedule_reconnect()
            
    def schedule_reconnect(self):
        """Schedule a reconnection attempt"""
        if self.reconnect_attempts < self.max_reconnect_attempts:
            self.reconnect_attempts += 1
            logger.info(f"🔄 Scheduling reconnect attempt {self.reconnect_attempts}/{self.max_reconnect_attempts} in {self.reconnect_delay} seconds")
            
            def reconnect():
                time.sleep(self.reconnect_delay)
                if self.should_reconnect:
                    logger.info(f"🔄 Attempting to reconnect... (attempt {self.reconnect_attempts})")
                    self.start()
                    
            thread = threading.Thread(target=reconnect, daemon=True)
            thread.start()
        else:
            logger.error("❌ Max reconnection attempts reached. WebSocket connection failed.")
            
    def reset_reconnect_counter(self):
        """Reset reconnection counter when successfully connected"""
        self.reconnect_attempts = 0
        
    def start(self):
        """Start WebSocket connection"""
        try:
            # Close existing connection if any
            if self.ws:
                self.ws.close()
                
            websocket.enableTrace(False)
            self.ws = websocket.WebSocketApp(
                "wss://ws-feed.exchange.coinbase.com",
                on_open=self.on_open,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close
            )
            
            # Run in a separate thread
            def run_websocket():
                try:
                    self.ws.run_forever(
                        ping_interval=30,  # Send ping every 30 seconds
                        ping_timeout=10,   # Wait 10 seconds for pong
                        ping_payload="ping"
                    )
                except Exception as e:
                    logger.error(f"WebSocket run_forever error: {e}")
                    if self.should_reconnect:
                        self.schedule_reconnect()
                
            thread = threading.Thread(target=run_websocket, daemon=True)
            thread.start()
            logger.info("🚀 WebSocket service started")
            
        except Exception as e:
            logger.error(f"❌ Failed to start WebSocket: {e}")
            if self.should_reconnect:
                self.schedule_reconnect()
            
    def stop(self):
        """Stop WebSocket connection"""
        self.should_reconnect = False
        if self.ws:
            self.ws.close()
            self.connected = False
        logger.info("🛑 WebSocket service stopped")

# Global WebSocket client instance
ws_client = CoinbaseWebSocketClient()

def start_websocket():
    """Start the global WebSocket connection"""
    ws_client.start()
    
def get_current_prices():
    """Get current price data for all symbols"""
    return ws_client.latest_data.copy()
    
def get_historical_prices(symbol, minutes=15):
    """Get historical price data for a symbol"""
    return ws_client.get_historical_data(symbol, minutes)
    
def get_connection_status():
    """Get WebSocket connection status"""
    return ws_client.connected

def add_price_callback(callback):
    """Add callback for price updates"""
    ws_client.add_callback(callback)

# Auto-start WebSocket when module is imported
if __name__ != "__main__":
    start_websocket()
