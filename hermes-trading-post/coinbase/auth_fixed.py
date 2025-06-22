"""
Coinbase Advanced Trade API Authentication
Simple approach using raw Ed25519 key
"""

import base64
import time
import secrets
from typing import Dict
import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


class CoinbaseAuth:
    """Authentication handler for Coinbase Advanced Trade API"""
    
    def __init__(self, api_key_name: str, private_key: str):
        self.api_key_name = api_key_name
        self.private_key = private_key
        self.cb_api_host = 'api.coinbase.com'
        
    def _get_ed25519_key(self) -> Ed25519PrivateKey:
        """Get Ed25519 private key from base64 encoded string"""
        # Decode the base64 private key (Ed25519 seed)
        blob = base64.b64decode(self.private_key)
        seed = blob[:32]  # Ed25519 seed is first 32 bytes
        
        # Create Ed25519 private key from seed
        private_key = Ed25519PrivateKey.from_private_bytes(seed)
        return private_key
        
    def create_jwt_token(self, path: str = '/api/v3/brokerage/accounts') -> str:
        """Create JWT token for Coinbase Advanced Trade API"""
        timestamp = int(time.time())
        nonce = secrets.token_hex(16)
        uri = f"GET {self.cb_api_host}{path}"
        
        # Create JWT payload matching TypeScript implementation
        payload = {
            'iss': 'cdp',  # Coinbase Developer Platform
            'sub': self.api_key_name,
            'iat': timestamp,
            'nbf': timestamp,
            'exp': timestamp + 120,
            'uri': uri
        }
        
        # Get Ed25519 private key
        private_key = self._get_ed25519_key()
        
        # Create JWT token with EdDSA algorithm
        try:
            token = pyjwt.encode(
                payload,
                private_key,
                algorithm='EdDSA',
                headers={
                    'alg': 'EdDSA',
                    'kid': self.api_key_name,
                    'nonce': nonce
                }
            )
            return token
        except Exception as e:
            raise ValueError(f"Failed to create JWT token: {e}")
    
    def get_auth_headers(self, path: str = '/api/v3/brokerage/accounts') -> Dict[str, str]:
        """Get authentication headers for API requests"""
        jwt_token = self.create_jwt_token(path)
        
        return {
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json',
            'CB-VERSION': '2025-01-01'
        }
