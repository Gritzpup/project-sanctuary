import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

/**
 * CDP Authentication for Coinbase WebSocket
 * Uses JWT for authentication with CDP API keys
 */
export class CDPAuth {
  constructor() {
    this.keyName = process.env.CDP_API_KEY_NAME;
    // Parse the private key from the environment variable
    this.privateKey = process.env.CDP_API_KEY_PRIVATE?.replace(/\\n/g, '\n');

    // Debug logging
    if (this.keyName) {
      console.log('✅ [CDPAuth] CDP_API_KEY_NAME is set');
    } else {
      console.warn('⚠️ [CDPAuth] CDP_API_KEY_NAME is NOT set - cannot authenticate with Coinbase');
    }

    if (this.privateKey) {
      console.log('✅ [CDPAuth] CDP_API_KEY_PRIVATE is set');
    } else {
      console.warn('⚠️ [CDPAuth] CDP_API_KEY_PRIVATE is NOT set - cannot generate JWT tokens');
    }

    if (!this.keyName || !this.privateKey) {
      console.error('❌ [CDPAuth] Missing Coinbase CDP credentials - WebSocket authentication will fail!');
    }
  }

  /**
   * Generate JWT token for WebSocket authentication
   */
  generateJWT(requestMethod = 'GET', requestPath = '', body = '') {
    if (!this.keyName || !this.privateKey) {
      return null;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = timestamp + requestMethod + requestPath + body;

      // Create signature using EC private key
      const sign = crypto.createSign('SHA256');
      sign.update(message);
      sign.end();

      const signature = sign.sign(this.privateKey, 'base64');

      return {
        'CB-ACCESS-KEY': this.keyName,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'CB-ACCESS-SIGN': signature
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate JWT token for WebSocket authentication (Advanced Trade API)
   * Returns a JWT that expires in 2 minutes
   */
  generateWebSocketJWT() {
    if (!this.keyName || !this.privateKey) {
      return null;
    }

    try {
      const algorithm = 'ES256';
      const token = jwt.sign(
        {
          iss: 'cdp',
          nbf: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 120, // 2 minute expiration
          sub: this.keyName,
        },
        this.privateKey,
        {
          algorithm,
          header: {
            kid: this.keyName,
            nonce: crypto.randomBytes(16).toString('hex'),
          },
        }
      );

      return token;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate WebSocket authentication subscription message (Advanced Trade API format)
   */
  getWebSocketAuth() {
    const jwt = this.generateWebSocketJWT();

    if (!jwt) {
      console.error('❌ [CDPAuth] Failed to generate JWT - check credentials');
      return null;
    }

    console.log('✅ [CDPAuth] Generated JWT token for WebSocket authentication');

    // ✅ CRITICAL FIX: Use 'level2' channel (not 'l2_data') with JWT
    // Advanced Trade API DOES support level2 orderbook streaming via JWT authentication
    // Verified working in October 18 commit - uses channel: 'level2' with JWT
    // This provides real-time level2 updates with event.updates format
    return {
      type: 'subscribe',
      product_ids: ['BTC-USD'],
      channel: 'level2', // ✅ Correct channel for Advanced Trade API level2
      jwt: jwt
    };
  }
}

export const cdpAuth = new CDPAuth();