/**
 * Network Transport - UDP-based protocol for ultra-low latency communication
 * Handles device discovery, connection management, and data streaming
 */

import { invoke } from '@tauri-apps/api/core';

// Utility to check if running in Tauri environment
const isTauriEnv = () => {
    return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
};

// Safe invoke wrapper that handles non-Tauri environments
const safeInvoke = async (command: string, ...args: any[]): Promise<any> => {
    if (isTauriEnv()) {
        return invoke(command, ...args);
    } else {
        console.warn(`🔧 Tauri command '${command}' called in non-Tauri environment, using fallback`);
        // Return success for initialization commands in development
        if (command.includes('initialize')) {
            return true;
        }
        return null;
    }
};

export interface MouseNetworkData {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    buttons: number;
}

export interface KeyboardNetworkData {
    key: string;
    code: string;
    modifiers: {
        ctrl: boolean;
        shift: boolean;
        alt: boolean;
        meta: boolean;
    };
    pressed: boolean;
}

export interface NetworkMessage {
    type: 'mouse' | 'keyboard' | 'control' | 'discovery';
    data: any;
    timestamp: number;
    sourceId: string;
    targetId?: string;
}

export interface NetworkStats {
    bytesSent: number;
    bytesReceived: number;
    packetsLost: number;
    latency: number;
    bandwidth: number;
    connectedPeers: number;
}

export class NetworkTransport {
    private initialized = false;
    private connected = false;
    private hosting = false;
    private lastUpdateTime = 0;
    private stats: NetworkStats = {
        bytesSent: 0,
        bytesReceived: 0,
        packetsLost: 0,
        latency: 0,
        bandwidth: 0,
        connectedPeers: 0
    };
    
    private latencyHistory: number[] = [];
    private messageHandlers = new Map<string, (message: NetworkMessage) => void>();

    async initialize(): Promise<boolean> {
        try {
            console.log('🌐 Initializing Network Transport...');
            
            // Initialize Rust backend for networking
            const success = await safeInvoke('initialize_network');
            if (!success) {
                throw new Error('Failed to initialize Rust network backend');
            }
            
            this.initialized = true;
            console.log('✅ Network Transport initialized');
            return true;
        } catch (error) {
            console.error('❌ Network Transport initialization failed:', error);
            return false;
        }
    }

    async startHost(): Promise<boolean> {
        try {
            if (!this.initialized) {
                throw new Error('Network not initialized');
            }

            console.log('🌐 Starting network host...');
            
            // Start hosting via Rust backend
            const success = await invoke('start_network_host');
            if (!success) {
                throw new Error('Failed to start network host');
            }

            this.hosting = true;
            console.log('✅ Network host started');
            return true;
        } catch (error) {
            console.error('❌ Failed to start network host:', error);
            return false;
        }
    }

    async connectToHost(address: string): Promise<boolean> {
        try {
            if (!this.initialized) {
                throw new Error('Network not initialized');
            }

            console.log(`🌐 Connecting to host at ${address}...`);
            
            // Connect to host via Rust backend
            const success = await invoke('connect_to_host', { address });
            if (!success) {
                throw new Error('Failed to connect to host');
            }

            this.connected = true;
            console.log('✅ Connected to host successfully');
            return true;
        } catch (error) {
            console.error('❌ Connection failed:', error);
            return false;
        }
    }

    sendMouseData(mouseData: MouseNetworkData, targetId?: string): void {
        if (!this.isReady()) return;

        const message: NetworkMessage = {
            type: 'mouse',
            data: mouseData,
            timestamp: performance.now(),
            sourceId: 'local',
            targetId
        };

        this.sendMessage(message);
    }

    sendKeyboardData(keyboardData: KeyboardNetworkData, targetId?: string): void {
        if (!this.isReady()) return;

        const message: NetworkMessage = {
            type: 'keyboard',
            data: keyboardData,
            timestamp: performance.now(),
            sourceId: 'local',
            targetId
        };

        this.sendMessage(message);
    }

    sendControlMessage(controlData: any, targetId?: string): void {
        if (!this.isReady()) return;

        const message: NetworkMessage = {
            type: 'control',
            data: controlData,
            timestamp: performance.now(),
            sourceId: 'local',
            targetId
        };

        this.sendMessage(message);
    }

    private async sendMessage(message: NetworkMessage): Promise<void> {
        try {
            // Convert to backend format
            const backendMessage = {
                message_type: message.type,
                data: message.data,
                timestamp: message.timestamp,
                source_id: message.sourceId,
                target_id: message.targetId
            };
            
            // Send message via Rust backend
            await invoke('send_network_messages', { messages: [backendMessage] });
            
            // Update stats (simplified)
            this.stats.bytesSent += JSON.stringify(message).length;
            
        } catch (error) {
            console.error('❌ Failed to send network message:', error);
        }
    }

    onMessage(messageType: string, handler: (message: NetworkMessage) => void): void {
        this.messageHandlers.set(messageType, handler);
        console.log(`📝 Registered handler for message type: ${messageType}`);
    }

    // Process incoming message and update latency stats
    async processMessage(message: NetworkMessage): Promise<void> {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
            handler(message);
        }

        // Handle input injection for received messages
        if (message.type === 'mouse') {
            await this.injectMouseInput(message.data);
        } else if (message.type === 'keyboard') {
            await this.injectKeyboardInput(message.data);
        }

        // Update latency calculation
        const now = performance.now();
        const latency = now - message.timestamp;
        this.latencyHistory.push(latency);
        
        // Keep only last 100 measurements
        if (this.latencyHistory.length > 100) {
            this.latencyHistory.shift();
        }

        // Update stats
        this.stats.bytesReceived += JSON.stringify(message).length;
    }

    private async injectMouseInput(mouseData: MouseNetworkData): Promise<void> {
        try {
            // Inject mouse movement
            await invoke('inject_mouse_move', { x: mouseData.x, y: mouseData.y });
            
            // Handle mouse clicks (simplified, in reality would track button states)
            if (mouseData.buttons > 0) {
                if (mouseData.buttons & 1) await invoke('inject_mouse_click', { button: 'left' });
                if (mouseData.buttons & 2) await invoke('inject_mouse_click', { button: 'right' });
                if (mouseData.buttons & 4) await invoke('inject_mouse_click', { button: 'middle' });
            }
        } catch (error) {
            console.error('Failed to inject mouse input:', error);
        }
    }

    private async injectKeyboardInput(keyboardData: KeyboardNetworkData): Promise<void> {
        try {
            if (keyboardData.pressed) {
                await invoke('inject_key_press', { key: keyboardData.key });
            } else {
                await invoke('inject_key_release', { key: keyboardData.key });
            }
        } catch (error) {
            console.error('Failed to inject keyboard input:', error);
        }
    }

    getAverageLatency(): number {
        if (this.latencyHistory.length === 0) return 0;
        
        const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
        return sum / this.latencyHistory.length;
    }

    async update(deltaTime: number): Promise<void> {
        if (!this.initialized) return;

        // Update network statistics with time-based calculations
        this.stats.latency = this.getAverageLatency();
        
        // Use deltaTime for periodic operations (every 1000ms)
        this.lastUpdateTime = (this.lastUpdateTime || 0) + deltaTime;
        if (this.lastUpdateTime >= 1000) {
            this.lastUpdateTime = 0;
            
            // Check for incoming messages from Rust backend
            await this.processIncomingMessages();
        }
    }

    private async processIncomingMessages(): Promise<void> {
        try {
            // Get messages from Rust backend
            const messages = await invoke('get_network_messages') as any[];
            
            for (const msg of messages) {
                const networkMessage: NetworkMessage = {
                    type: msg.message_type,
                    data: msg.data,
                    timestamp: msg.timestamp,
                    sourceId: msg.source_id,
                    targetId: msg.target_id
                };
                
                await this.processMessage(networkMessage);
            }
        } catch (error) {
            console.error('Failed to process incoming messages:', error);
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    isHosting(): boolean {
        return this.hosting;
    }

    isReady(): boolean {
        return this.initialized && (this.connected || this.hosting);
    }

    getStats(): NetworkStats {
        return { ...this.stats };
    }

    async disconnect(): Promise<void> {
        try {
            if (this.connected || this.hosting) {
                console.log('🌐 Disconnecting from network...');
                
                // Disconnect via Rust backend
                await invoke('disconnect_network');
                
                this.connected = false;
                this.hosting = false;
                console.log('✅ Disconnected from network');
            }
        } catch (error) {
            console.error('❌ Failed to disconnect:', error);
        }
    }

    destroy(): void {
        this.disconnect();
        
        if (this.initialized) {
            console.log('🌐 Network Transport destroyed');
            this.initialized = false;
        }
    }
}