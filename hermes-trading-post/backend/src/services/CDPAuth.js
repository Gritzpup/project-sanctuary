import crypto from 'crypto';
import dotenv from 'dotenv';

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
  }

  /**
   * Generate JWT token for WebSocket authentication
   */
  generateJWT(requestMethod = 'GET', requestPath = '', body = '') {
    if (!this.keyName || !this.privateKey) {
      console.warn('⚠️ CDP API credentials not configured');
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
      console.error('❌ Failed to generate CDP JWT:', error);
      return null;
    }
  }

  /**
   * Generate WebSocket authentication message
   */
  getWebSocketAuth() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = timestamp + 'GET' + '/users/self/verify';

    try {
      const sign = crypto.createSign('SHA256');
      sign.update(message);
      sign.end();

      const signature = sign.sign(this.privateKey, 'base64');

      return {
        type: 'subscribe',
        product_ids: ['BTC-USD'],
        channels: [
          {
            name: 'level2',
            product_ids: ['BTC-USD']
          }
        ],
        signature: signature,
        key: this.keyName,
        timestamp: timestamp
      };
    } catch (error) {
      console.error('❌ Failed to generate WebSocket auth:', error);
      return null;
    }
  }
}

export const cdpAuth = new CDPAuth();