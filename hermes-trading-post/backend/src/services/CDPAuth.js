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

    // 🔧 FIX: Track current JWT and expiration for auto-renewal
    this.currentJWT = null;
    this.jwtExpiresAt = null;
    this.renewalInterval = null;

    // Debug logging
    if (this.keyName) {
    } else {
    }

    if (this.privateKey) {
    } else {
    }

    if (!this.keyName || !this.privateKey) {
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
   * 🔧 FIX: Now caches token and tracks expiration for auto-renewal
   */
  generateWebSocketJWT(forceNew = false) {
    if (!this.keyName || !this.privateKey) {
      return null;
    }

    // 🔧 FIX: Return cached token if still valid (with 30s buffer)
    if (!forceNew && this.currentJWT && this.jwtExpiresAt) {
      const now = Date.now() / 1000;
      const timeUntilExpiry = this.jwtExpiresAt - now;
      if (timeUntilExpiry > 30) {
        return this.currentJWT;
      }
    }

    try {
      const algorithm = 'ES256';
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 120; // 2 minute expiration

      const token = jwt.sign(
        {
          iss: 'cdp',
          nbf: now,
          exp: exp,
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

      // 🔧 FIX: Cache the token and track expiration
      this.currentJWT = token;
      this.jwtExpiresAt = exp;


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
      return null;
    }


    // ✅ CRITICAL FIX: Use 'l2_data' channel for Advanced Trade API
    // The response comes back with channel: 'l2_data' not 'level2'
    // This provides real-time level2 updates with event.updates format
    return {
      type: 'subscribe',
      product_ids: ['BTC-USD'],
      channel: 'l2_data', // ✅ Changed to l2_data to match Coinbase response
      jwt: jwt
    };
  }

  /**
   * 🔧 FIX: Start automatic JWT token renewal
   * Renews token every 90 seconds (before 2-minute expiration)
   * Calls callback with new token for WebSocket reconnection
   */
  startAutoRenewal(onTokenRenewed) {
    if (!this.keyName || !this.privateKey) {
      return;
    }

    // Clear any existing interval
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
    }


    // Renew every 90 seconds (30s before 120s expiration)
    this.renewalInterval = setInterval(() => {
      const newToken = this.generateWebSocketJWT(true); // Force new token
      if (newToken && onTokenRenewed) {
        onTokenRenewed(newToken);
      }
    }, 90000); // 90 seconds
  }

  /**
   * Stop automatic JWT token renewal
   */
  stopAutoRenewal() {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
    }
  }
}

export const cdpAuth = new CDPAuth();