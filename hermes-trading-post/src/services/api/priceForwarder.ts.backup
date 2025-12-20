import { writable, get } from 'svelte/store';
import { getBackendWsUrl } from '../../utils/backendConfig';

interface PriceUpdate {
    price: number;
    timestamp: number;
    product_id: string;
}

class PriceForwarder {
    private isForwarding = false;
    private ws: WebSocket | null = null;
    
    constructor() {
        this.connect();
    }
    
    private connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }
        
        try {
            // Connect directly to backend WebSocket server
            const wsUrl = `${getBackendWsUrl()}/ws`;
            this.ws = new WebSocket(wsUrl);
            
            this.ws.addEventListener('open', () => {
                this.isForwarding = true;
            });
            
            this.ws.addEventListener('close', () => {
                this.isForwarding = false;
                setTimeout(() => this.connect(), 5000);
            });
            
            this.ws.addEventListener('error', (error) => {
                console.error('PriceForwarder WebSocket error:', error);
                this.isForwarding = false;
            });
        } catch (error) {
            console.error('Failed to connect PriceForwarder:', error);
            setTimeout(() => this.connect(), 5000);
        }
    }
    
    public forwardPrice(price: number, product_id: string) {
        if (!this.isForwarding || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const priceUpdate: PriceUpdate = {
            price,
            timestamp: Date.now(),
            product_id
        };
        
        try {
            this.ws.send(JSON.stringify({
                type: 'realtimePrice',
                data: priceUpdate
            }));
        } catch (error) {
            console.error('Failed to forward price:', error);
        }
    }
}

export const priceForwarder = new PriceForwarder();