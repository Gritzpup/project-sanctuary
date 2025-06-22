import base64
import time
import secrets
from typing import Dict
import jwt as pyjwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


class CoinbaseAuth:
    def __init__(self, api_key_name: str, private_key: str):
        self.api_key_name = api_key_name
        self.private_key = private_key
        self.cb_api_host = 'api.coinbase.com'
        
    def _get_ed25519_key(self) -> Ed25519PrivateKey:
        """Convert base64 private key to Ed25519PrivateKey object"""
        try:
            # Decode the base64 private key
            blob = base64.b64decode(self.private_key)
            
            # The first 32 bytes are the seed for Ed25519
            seed = blob[:32]
            
            # Create the private key from the seed
            private_key = Ed25519PrivateKey.from_private_bytes(seed)
            return private_key
        except Exception as e:
            print(f"Error loading Ed25519 key: {e}")
            raise e
            
    def create_jwt_token(self, path: str = '/api/v3/brokerage/accounts') -> str:
        """Create JWT token for Coinbase API authentication"""
        timestamp = int(time.time())
        nonce = secrets.token_hex(16)
        uri = f"GET {self.cb_api_host}{path}"
        
        payload = {
            'iss': 'cdp',
            'sub': self.api_key_name,
            'iat': timestamp,
            'nbf': timestamp,
            'exp': timestamp + 120,  # 2 minutes expiry
            'uri': uri
        }
        
        headers = {
            'alg': 'EdDSA',
            'kid': self.api_key_name,
            'nonce': nonce
        }
        
        try:
            private_key = self._get_ed25519_key()
            
            # Use the Ed25519PrivateKey directly with PyJWT
            token = pyjwt.encode(
                payload,
                private_key,
                algorithm='EdDSA',
                headers=headers
            )
            return token
        except Exception as e:
            print(f"Error creating JWT token: {e}")
            raise e
    
    def get_auth_headers(self, path: str = '/api/v3/brokerage/accounts') -> Dict[str, str]:
        jwt_token = self.create_jwt_token(path)
        
        return {
            'Authorization': f'Bearer {jwt_token}',
            'Content-Type': 'application/json',
            'CB-VERSION': '2025-01-01'
        }
