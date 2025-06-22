"""
Coinbase Advanced Trade API Authentication
Handles JWT token generation and API authentication using Cloud API Keys
"""

import base64
import json
import time
from typing import Dict, Any
import jwt


class CoinbaseAuth:
    """Authentication handler for Coinbase Advanced Trade API"""
    
    def __init__(self, api_key_name: str, private_key: str):
        """
        Initialize Coinbase authentication
        
        Args:
            api_key_name: Key ID from the JSON file
            private_key: Base64 encoded private key from JSON file
        """
        self.api_key_name = api_key_name
        self.private_key = private_key
        
    def create_jwt_token(self, request_method: str = 'GET', request_path: str = '/api/v3/brokerage/accounts', body: str = '') -> str:
        """
        Create JWT token for Coinbase Advanced Trade API authentication
        
        Args:
            request_method: HTTP method (GET, POST, etc.)
            request_path: API endpoint path
            body: Request body (empty for GET requests)
            
        Returns:
            JWT token string
        """
        # Current timestamp
        timestamp = int(time.time())
        
        # Create JWT payload for Coinbase Advanced Trade API
        payload = {
            'iss': 'coinbase-cloud',
            'nbf': timestamp,
            'exp': timestamp + 120,  # Token expires in 2 minutes
            'sub': self.api_key_name,  # This should be the key ID
            'aud': ['public_websocket_api'],  # Audience for public API
        }
        
        # Decode the base64 private key to get raw bytes for signing
        try:
            private_key_bytes = base64.b64decode(self.private_key)
        except Exception as e:
            raise ValueError(f"Invalid private key format: {e}")
        
        # Create JWT token using ES256 algorithm
        try:
            token = jwt.encode(
                payload,
                private_key_bytes,
                algorithm='ES256',
                headers={
                    'kid': self.api_key_name,  # Key ID in header
                    'nonce': str(timestamp)    # Add nonce for uniqueness
                }
            )
            return token
        except Exception as e:
            raise ValueError(f"Failed to create JWT token: {e}")
    
    def get_auth_headers(self, request_method: str = 'GET', request_path: str = '/api/v3/brokerage/accounts', body: str = '') -> Dict[str, str]:
        """
        Get authentication headers for API requests
        
        Args:
            request_method: HTTP method
            request_path: API endpoint path  
            body: Request body
            
        Returns:
            Dictionary of headers
        """
        jwt_token = self.create_jwt_token(request_method, request_path, body)
        
        return {
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json',
            'User-Agent': 'alpaca-trader-dash/1.0'
        }
