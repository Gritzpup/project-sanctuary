"""
Simple Coinbase Advanced Trade API Client
"""

import requests
from typing import Dict, Any
from coinbase.auth import CoinbaseAuth
from config.coinbase_config import coinbase_config


class CoinbaseClient:
    """Simple client for Coinbase Advanced Trade API"""
    
    BASE_URL = "https://api.coinbase.com/api/v3/brokerage"
    
    def __init__(self):
        self.api_key_name = coinbase_config.api_key_name
        self.private_key = coinbase_config.private_key
        self.auth = CoinbaseAuth(self.api_key_name, self.private_key)
        self.session = requests.Session()
        
    def get_accounts(self) -> Dict[str, Any]:
        """Get all accounts"""
        url = f"{self.BASE_URL}/accounts"
        headers = self.auth.get_auth_headers()
        
        response = self.session.get(url, headers=headers)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"API request failed: {response.status_code} - {response.text}")
    
    def test_connection(self) -> bool:
        """Test the API connection"""
        try:
            accounts = self.get_accounts()
            print(f"✅ Coinbase API connection successful! Found {len(accounts.get('accounts', []))} accounts.")
            return True
        except Exception as e:
            print(f"❌ Coinbase API connection failed: {e}")
            return False
