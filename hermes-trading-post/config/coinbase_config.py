"""
Coinbase Advanced Trade API Configuration
Handles Cloud API Keys and authentication setup
"""
import os
import json
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class CoinbaseConfig:
    """Configuration class for Coinbase Advanced Trade API"""
    
    def __init__(self):
        # Try to load from JSON file first, then fall back to environment variables
        self.api_key_name: str = ''
        self.private_key: str = ''
        
        # Load API credentials
        self._load_credentials()
          # If not loaded from JSON, try environment variables
        if not self.api_key_name:
            self.api_key_name = os.getenv('COINBASE_API_KEY_NAME', '')
        if not self.private_key:
            self.private_key = os.getenv('COINBASE_PRIVATE_KEY', '')
        
        # WebSocket URLs
        self.ws_market_data_url: str = os.getenv(
            'COINBASE_WS_MARKET_DATA_URL', 
            'wss://advanced-trade-ws.coinbase.com'
        )
        self.ws_user_data_url: str = os.getenv(
            'COINBASE_WS_USER_DATA_URL', 
            'wss://advanced-trade-ws-user.coinbase.com'
        )
        
        # Trading pairs
        self.default_pairs: list = os.getenv(
            'DEFAULT_CRYPTO_PAIRS', 
            'BTC-USD,ETH-USD,SOL-USD,ADA-USD'
        ).split(',')
          # Validate configuration
        self._validate_config()
    
    def _load_credentials(self) -> None:
        """Load API credentials from cdp_api_key.json file"""
        try:
            # Look for the JSON key file in the root directory
            json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cdp_api_key.json')
            
            if os.path.exists(json_path):
                with open(json_path, 'r') as f:
                    key_data = json.load(f)
                    
                # For now, use the key ID directly (we'll get org ID from API later)
                key_id = key_data.get('id', '')
                self.api_key_name = key_id  # Use just the key ID for now
                self.private_key = key_data.get('privateKey', '')
                
                print(f"✅ Loaded Coinbase API credentials from {json_path}")
                print(f"   Key ID: {key_id[:8]}...")
            else:
                print(f"⚠️ No cdp_api_key.json found at {json_path}")
                
        except Exception as e:
            print(f"❌ Error loading Coinbase credentials: {e}")
            # Continue with empty credentials, will fall back to env vars
    
    def _validate_config(self) -> None:
        """Validate that required configuration is present"""
        if not self.api_key_name:
            raise ValueError("Coinbase API key name is required (from cdp_api_key.json or COINBASE_API_KEY_NAME)")
        
        if not self.private_key:
            raise ValueError("Coinbase private key is required (from cdp_api_key.json or COINBASE_PRIVATE_KEY)")
        
        # The private key from JSON is base64 encoded, not PEM format
        # So we don't validate PEM format anymore
        if len(self.private_key) < 10:  # Basic length check
            raise ValueError("Coinbase private key appears to be invalid (too short)")
    
    @property
    def is_configured(self) -> bool:
        """Check if Coinbase API is properly configured"""
        try:
            self._validate_config()
            return True
        except ValueError:
            return False
    
    def get_trading_pairs(self) -> list:
        """Get list of trading pairs for the application"""
        return self.default_pairs
    
    def get_ws_market_url(self) -> str:
        """Get WebSocket URL for market data"""
        return self.ws_market_data_url
    
    def get_ws_user_url(self) -> str:
        """Get WebSocket URL for user data"""
        return self.ws_user_data_url


# Global config instance
coinbase_config = CoinbaseConfig()
