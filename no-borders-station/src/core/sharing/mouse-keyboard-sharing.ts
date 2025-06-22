/**
 * Mouse/Keyboard Sharing Orchestrator
 * Coordinates input capture, network transport, and device discovery for seamless sharing
 */

import { invoke } from '@tauri-apps/api/core';
import { InputCapture, MouseEvent, KeyboardEvent } from '../input/capture/input-capture';
import { NetworkTransport, NetworkMessage, MouseNetworkData, KeyboardNetworkData } from '../transport/network';
import { DeviceDiscovery, DiscoveredDevice } from '../discovery/device-discovery';

export interface SharingConfig {
    enableMouseSharing: boolean;
    enableKeyboardSharing: boolean;
    autoDiscovery: boolean;
    latencyMode: 'ultra_low' | 'low' | 'normal';
    edgeSensitivity: number; // 1-10
    trustRequiredForConnection: boolean;
}

export interface EdgeCrossing {
    fromDevice: string;
    toDevice: string;
    edge: 'left' | 'right' | 'top' | 'bottom';
    mousePosition: { x: number; y: number };
    timestamp: number;
}

export class MouseKeyboardSharing {
    private input: InputCapture;
    private network: NetworkTransport;
    private discovery: DeviceDiscovery;
    
    private config: SharingConfig;
    private initialized = false;
    private sharing = false;
    
    // Active state
    private currentActiveDevice: string = 'local';
    private connectedDevices = new Map<string, DiscoveredDevice>();
    private deviceLayout = new Map<string, { x: number; y: number; width: number; height: number }>();
    
    // Mouse state for edge detection
    private mousePosition = { x: 0, y: 0 };
    private screenBounds = { width: 1920, height: 1080 }; // Will be detected
    
    // Performance monitoring
    private stats = {
        mouseMovesSent: 0,
        keyEventsSent: 0,
        networkLatency: 0,
        edgeCrossings: 0,
        lastUpdate: Date.now()
    };

    constructor(config: Partial<SharingConfig> = {}) {
        this.config = {
            enableMouseSharing: true,
            enableKeyboardSharing: true,
            autoDiscovery: true,
            latencyMode: 'ultra_low',
            edgeSensitivity: 5,
            trustRequiredForConnection: true,
            ...config
        };

        this.input = new InputCapture();
        this.network = new NetworkTransport();
        this.discovery = new DeviceDiscovery();

        console.log('🖱️ Mouse/Keyboard Sharing Orchestrator created');
    }

    async initialize(): Promise<boolean> {
        try {
            console.log('🚀 Initializing mouse/keyboard sharing system...');

            // Detect screen dimensions
            await this.detectScreenBounds();

            // Initialize core systems
            const inputOk = await this.input.initialize();
            const networkOk = await this.network.initialize();
            const discoveryOk = await this.discovery.initialize();

            if (!inputOk || !networkOk || !discoveryOk) {
                throw new Error('Failed to initialize core systems');
            }

            // Set up event handlers
            this.setupInputHandlers();
            this.setupNetworkHandlers();
            this.setupDiscoveryHandlers();

            // Start discovery if enabled
            if (this.config.autoDiscovery) {
                await this.discovery.startDiscovery();
            }

            this.initialized = true;
            console.log('✅ Mouse/keyboard sharing system initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize mouse/keyboard sharing:', error);
            return false;
        }
    }

    private async detectScreenBounds(): Promise<void> {
        try {
            // Get screen dimensions from the browser
            this.screenBounds = {
                width: screen.width,
                height: screen.height
            };

            // Set up local device in layout
            this.deviceLayout.set('local', {
                x: 0,
                y: 0,
                width: this.screenBounds.width,
                height: this.screenBounds.height
            });

            console.log(`📺 Screen bounds detected: ${this.screenBounds.width}x${this.screenBounds.height}`);

        } catch (error) {
            console.warn('⚠️ Failed to detect screen bounds, using defaults:', error);
        }
    }

    private setupInputHandlers(): void {
        // Handle mouse events
        this.input.onMouseEvent((mouseEvent: MouseEvent) => {
            this.handleMouseEvent(mouseEvent);
        });

        // Handle keyboard events
        this.input.onKeyboardEvent((keyboardEvent: KeyboardEvent) => {
            this.handleKeyboardEvent(keyboardEvent);
        });

        console.log('👂 Input event handlers set up');
    }

    private setupNetworkHandlers(): void {
        // Handle incoming mouse data
        this.network.onMessage('mouse', (message: NetworkMessage) => {
            this.handleIncomingMouseData(message);
        });

        // Handle incoming keyboard data
        this.network.onMessage('keyboard', (message: NetworkMessage) => {
            this.handleIncomingKeyboardData(message);
        });

        // Handle control messages
        this.network.onMessage('control', (message: NetworkMessage) => {
            this.handleControlMessage(message);
        });

        console.log('🌐 Network event handlers set up');
    }

    private setupDiscoveryHandlers(): void {
        // Handle discovered devices
        this.discovery.onDevicesChanged((devices: DiscoveredDevice[]) => {
            this.handleDiscoveredDevices(devices);
        });

        console.log('🔍 Discovery event handlers set up');
    }

    private async handleMouseEvent(mouseEvent: MouseEvent): Promise<void> {
        // Update local mouse position
        this.mousePosition = { x: mouseEvent.x, y: mouseEvent.y };

        // Check for edge crossing only if we have connected devices
        if (this.connectedDevices.size > 0 && this.currentActiveDevice === 'local') {
            const edgeCrossing = this.detectEdgeCrossing(mouseEvent);
            if (edgeCrossing) {
                await this.handleEdgeCrossing(edgeCrossing);
                return; // Don't send mouse data when crossing edges
            }
        }

        // Send mouse data to current active device (if not local)
        if (this.config.enableMouseSharing && this.currentActiveDevice !== 'local') {
            const mouseData: MouseNetworkData = {
                x: mouseEvent.x,
                y: mouseEvent.y,
                deltaX: mouseEvent.deltaX,
                deltaY: mouseEvent.deltaY,
                buttons: mouseEvent.buttons
            };

            this.network.sendMouseData(mouseData, this.currentActiveDevice);
            this.stats.mouseMovesSent++;
        }
    }

    private async handleKeyboardEvent(keyboardEvent: KeyboardEvent): Promise<void> {
        // Check for special key combinations
        if (await this.handleSpecialKeyCombo(keyboardEvent)) {
            return; // Don't forward special combinations
        }

        // Send keyboard data to current active device (if not local)
        if (this.config.enableKeyboardSharing && this.currentActiveDevice !== 'local') {
            const keyboardData: KeyboardNetworkData = {
                key: keyboardEvent.key,
                code: keyboardEvent.code,
                modifiers: keyboardEvent.modifiers,
                pressed: keyboardEvent.pressed
            };

            this.network.sendKeyboardData(keyboardData, this.currentActiveDevice);
            this.stats.keyEventsSent++;
        }
    }

    private detectEdgeCrossing(mouseEvent: MouseEvent): EdgeCrossing | null {
        const sensitivity = this.config.edgeSensitivity;
        const bounds = this.screenBounds;

        // Check each edge
        if (mouseEvent.x <= sensitivity) {
            return this.findDeviceAtEdge('left', mouseEvent);
        } else if (mouseEvent.x >= bounds.width - sensitivity) {
            return this.findDeviceAtEdge('right', mouseEvent);
        } else if (mouseEvent.y <= sensitivity) {
            return this.findDeviceAtEdge('top', mouseEvent);
        } else if (mouseEvent.y >= bounds.height - sensitivity) {
            return this.findDeviceAtEdge('bottom', mouseEvent);
        }

        return null;
    }

    private findDeviceAtEdge(edge: 'left' | 'right' | 'top' | 'bottom', mouseEvent: MouseEvent): EdgeCrossing | null {
        // Check device layout for devices positioned at this edge
        for (const [deviceId, layout] of this.deviceLayout.entries()) {
            if (deviceId === 'local') continue;
            
            // For left edge, look for devices positioned to the left
            if (edge === 'left' && layout.x < 0) {
                return {
                    fromDevice: 'local',
                    toDevice: deviceId,
                    edge,
                    mousePosition: { x: mouseEvent.x, y: mouseEvent.y },
                    timestamp: Date.now()
                };
            }
            
            // For right edge, look for devices positioned to the right
            if (edge === 'right' && layout.x > this.screenBounds.width) {
                return {
                    fromDevice: 'local',
                    toDevice: deviceId,
                    edge,
                    mousePosition: { x: mouseEvent.x, y: mouseEvent.y },
                    timestamp: Date.now()
                };
            }
            
            // For top edge, look for devices positioned above
            if (edge === 'top' && layout.y < 0) {
                return {
                    fromDevice: 'local',
                    toDevice: deviceId,
                    edge,
                    mousePosition: { x: mouseEvent.x, y: mouseEvent.y },
                    timestamp: Date.now()
                };
            }
            
            // For bottom edge, look for devices positioned below
            if (edge === 'bottom' && layout.y > this.screenBounds.height) {
                return {
                    fromDevice: 'local',
                    toDevice: deviceId,
                    edge,
                    mousePosition: { x: mouseEvent.x, y: mouseEvent.y },
                    timestamp: Date.now()
                };
            }
        }

        return null;
    }

    private async handleEdgeCrossing(crossing: EdgeCrossing): Promise<void> {
        console.log(`🔄 Edge crossing detected: ${crossing.fromDevice} -> ${crossing.toDevice} (${crossing.edge})`);

        // Switch active device
        await this.switchToDevice(crossing.toDevice);

        // Send control message to target device
        this.network.sendControlMessage({
            command: 'edge_cross',
            data: {
                edge: crossing.edge,
                mousePosition: crossing.mousePosition,
                fromDevice: crossing.fromDevice
            }
        }, crossing.toDevice);

        this.stats.edgeCrossings++;
    }

    private async switchToDevice(deviceId: string): Promise<void> {
        if (this.currentActiveDevice === deviceId) {
            return;
        }

        const previousDevice = this.currentActiveDevice;
        this.currentActiveDevice = deviceId;

        console.log(`🖱️ Switched active device: ${previousDevice} -> ${deviceId}`);

        // Send unlock control to previous device
        if (previousDevice !== 'local') {
            this.network.sendControlMessage({
                command: 'unlock_input'
            }, previousDevice);
        }

        // Send lock control to new device
        if (deviceId !== 'local') {
            this.network.sendControlMessage({
                command: 'lock_input'
            }, deviceId);
        }

        // Update UI
        this.updateActiveDeviceInUI(deviceId);
    }

    private async handleSpecialKeyCombo(keyboardEvent: KeyboardEvent): Promise<boolean> {
        const { key, modifiers, pressed } = keyboardEvent;

        if (!pressed) return false; // Only handle key presses

        // Ctrl+Alt+1/2/3 - Switch to specific device
        if (modifiers.ctrl && modifiers.alt && ['1', '2', '3'].includes(key)) {
            const deviceIndex = parseInt(key) - 1;
            const deviceIds = ['local', ...Array.from(this.connectedDevices.keys())];
            
            if (deviceIndex < deviceIds.length) {
                await this.switchToDevice(deviceIds[deviceIndex]);
                return true;
            }
        }

        // Ctrl+Alt+L - Lock to current device
        if (modifiers.ctrl && modifiers.alt && key === 'l') {
            console.log('🔒 Input locked to current device');
            return true;
        }

        // ScrollLock+ScrollLock - Toggle switch
        if (key === 'ScrollLock') {
            // Simple toggle for now
            const deviceIds = ['local', ...Array.from(this.connectedDevices.keys())];
            const currentIndex = deviceIds.indexOf(this.currentActiveDevice);
            const nextIndex = (currentIndex + 1) % deviceIds.length;
            await this.switchToDevice(deviceIds[nextIndex]);
            return true;
        }

        return false;
    }

    private handleIncomingMouseData(message: NetworkMessage): void {
        // In a real implementation, this would inject mouse input
        console.log('🖱️ Received mouse data:', message.data);
    }

    private handleIncomingKeyboardData(message: NetworkMessage): void {
        // In a real implementation, this would inject keyboard input
        console.log('⌨️ Received keyboard data:', message.data);
    }

    private handleControlMessage(message: NetworkMessage): void {
        const { command, data } = message.data;

        switch (command) {
            case 'lock_input':
                console.log('🔒 Input locked by remote device');
                break;
                
            case 'unlock_input':
                console.log('🔓 Input unlocked by remote device');
                break;
                
            case 'edge_cross':
                console.log('🔄 Remote device crossed edge:', data);
                break;
                
            default:
                console.log('❓ Unknown control command:', command);
        }
    }

    private handleDiscoveredDevices(devices: DiscoveredDevice[]): void {
        console.log(`🔍 Discovered ${devices.length} devices`);

        // Update connected devices map
        this.connectedDevices.clear();
        for (const device of devices) {
            if (device.trusted || !this.config.trustRequiredForConnection) {
                this.connectedDevices.set(device.id, device);
                console.log(`✅ Connected to device: ${device.name} (${device.address})`);
            }
        }

        // Update UI
        this.updateDeviceListInUI(devices);
    }

    // Public API
    async startSharing(): Promise<boolean> {
        if (!this.initialized) {
            console.error('System not initialized');
            return false;
        }

        if (this.sharing) {
            return true;
        }

        try {
            // Start input capture
            await this.input.startCapture();

            // Start as network host
            await this.network.startHost();

            this.sharing = true;
            console.log('🚀 Mouse/keyboard sharing started');
            return true;

        } catch (error) {
            console.error('❌ Failed to start sharing:', error);
            return false;
        }
    }

    async stopSharing(): Promise<void> {
        if (!this.sharing) {
            return;
        }

        try {
            // Stop input capture
            await this.input.stopCapture();

            // Reset to local device
            await this.switchToDevice('local');

            this.sharing = false;
            console.log('⏹️ Mouse/keyboard sharing stopped');

        } catch (error) {
            console.error('❌ Failed to stop sharing:', error);
        }
    }

    async connectToDevice(address: string): Promise<boolean> {
        return await this.network.connectToHost(address);
    }

    async trustDevice(deviceId: string): Promise<boolean> {
        return await this.discovery.trustDevice(deviceId);
    }

    getConnectedDevices(): DiscoveredDevice[] {
        return Array.from(this.connectedDevices.values());
    }

    getCurrentActiveDevice(): string {
        return this.currentActiveDevice;
    }

    getStats() {
        const now = Date.now();
        const timeDiff = now - this.stats.lastUpdate;
        
        return {
            ...this.stats,
            mouseMoveRate: this.stats.mouseMovesSent / (timeDiff / 1000),
            keyEventRate: this.stats.keyEventsSent / (timeDiff / 1000),
            networkLatency: this.network.getAverageLatency(),
            connectedDevices: this.connectedDevices.size,
            isSharing: this.sharing,
            activeDevice: this.currentActiveDevice
        };
    }

    // Public methods for network scanning
    async scanNetworkRange(baseIP: string): Promise<any[]> {
        if (!this.initialized) {
            throw new Error('Mouse/keyboard sharing system not initialized');
        }
        return await this.discovery.scanNetworkRange(baseIP);
    }

    async scanSpecificHost(address: string, hostname?: string): Promise<any> {
        if (!this.initialized) {
            throw new Error('Mouse/keyboard sharing system not initialized');
        }
        return await this.discovery.scanSpecificHost(address, hostname);
    }

    getDiscoveredDevices(): any[] {
        return this.discovery.getDevices();
    }

    // Public method to update device layout from UI with 2D coordinates
    updateDeviceLayout(deviceId: string, coordinates: { x: number; y: number } | 'left' | 'right' | 'top' | 'bottom'): void {
        let x = 0, y = 0;
        
        if (typeof coordinates === 'object') {
            // New 2D coordinate system
            x = coordinates.x * this.screenBounds.width;
            y = coordinates.y * this.screenBounds.height;
        } else {
            // Legacy position system for backwards compatibility
            switch (coordinates) {
                case 'left':
                    x = -this.screenBounds.width;
                    y = 0;
                    break;
                case 'right':
                    x = this.screenBounds.width;
                    y = 0;
                    break;
                case 'top':
                    x = 0;
                    y = -this.screenBounds.height;
                    break;
                case 'bottom':
                    x = 0;
                    y = this.screenBounds.height;
                    break;
            }
        }
        
        this.deviceLayout.set(deviceId, {
            x,
            y,
            width: this.screenBounds.width,
            height: this.screenBounds.height
        });
        
        console.log(`📍 Updated device layout: ${deviceId} positioned at (${x}, ${y})`);
    }

    // Remove device from layout
    removeDeviceFromLayout(position: string): void {
        // Find and remove device at the specified position
        for (const [deviceId, layout] of this.deviceLayout.entries()) {
            const coordinates = this.getPositionFromCoordinates(layout.x, layout.y);
            if (coordinates === position) {
                this.deviceLayout.delete(deviceId);
                this.connectedDevices.delete(deviceId);
                console.log(`🗑️ Removed device ${deviceId} from position ${position}`);
                break;
            }
        }
    }

    // Update edge sensitivity for better 2D transitions
    updateEdgeSensitivity(sensitivity: number): void {
        this.config.edgeSensitivity = Math.max(1, Math.min(10, sensitivity));
        console.log(`⚙️ Edge sensitivity updated to ${this.config.edgeSensitivity}`);
    }

    // Convert coordinates back to position for compatibility
    private getPositionFromCoordinates(x: number, y: number): string {
        const normalizedX = x / this.screenBounds.width;
        const normalizedY = y / this.screenBounds.height;
        
        if (normalizedX === -1 && normalizedY === -1) return 'top-left';
        if (normalizedX === 0 && normalizedY === -1) return 'top';
        if (normalizedX === 1 && normalizedY === -1) return 'top-right';
        if (normalizedX === -1 && normalizedY === 0) return 'left';
        if (normalizedX === 1 && normalizedY === 0) return 'right';
        if (normalizedX === -1 && normalizedY === 1) return 'bottom-left';
        if (normalizedX === 0 && normalizedY === 1) return 'bottom';
        if (normalizedX === 1 && normalizedY === 1) return 'bottom-right';
        
        return 'center';
    }

    // Get current device layout for UI display
    getDeviceLayout(): Map<string, { x: number; y: number; width: number; height: number }> {
        return new Map(this.deviceLayout);
    }

    // UI Integration
    private updateActiveDeviceInUI(deviceId: string): void {
        const activeComputerElement = document.getElementById('active-computer');
        if (activeComputerElement) {
            const device = this.connectedDevices.get(deviceId);
            activeComputerElement.textContent = device ? device.name : 'Local PC';
        }
    }

    private updateDeviceListInUI(devices: DiscoveredDevice[]): void {
        const deviceGrid = document.getElementById('device-grid');
        if (deviceGrid) {
            deviceGrid.innerHTML = '';
            
            for (const device of devices) {
                const deviceCard = document.createElement('div');
                deviceCard.className = 'device-card';
                deviceCard.innerHTML = `
                    <div class="device-name">${device.name}</div>
                    <div class="device-address">${device.address}</div>
                    <div class="device-capabilities">
                        ${device.capabilities.map(cap => `<span class="capability-tag">${cap}</span>`).join('')}
                        ${device.trusted ? '<span class="capability-tag trusted">Trusted</span>' : ''}
                    </div>
                `;
                
                deviceCard.addEventListener('click', () => {
                    if (device.trusted || !this.config.trustRequiredForConnection) {
                        this.switchToDevice(device.id);
                    } else {
                        this.trustDevice(device.id);
                    }
                });
                
                deviceGrid.appendChild(deviceCard);
            }
        }
    }

    async update(deltaTime: number): Promise<void> {
        // Update subsystems
        this.input.update(deltaTime);
        await this.network.update(deltaTime);
        this.discovery.update(deltaTime);

        // Update stats display
        const now = Date.now();
        if (now - this.stats.lastUpdate > 1000) {
            this.updateStatsInUI();
            this.stats.lastUpdate = now;
            
            // Periodically broadcast discovery if sharing
            if (this.sharing) {
                await this.broadcastDiscovery();
            }
        }
    }

    private async broadcastDiscovery(): Promise<void> {
        try {
            await invoke('broadcast_discovery');
            
            // Listen for discovery responses
            const discoveries = await invoke('listen_for_discovery') as any[];
            
            // Process discovery responses
            for (const discovery of discoveries) {
                console.log('📡 Discovery response:', discovery);
                // TODO: Add to device list if valid
            }
        } catch (error) {
            console.warn('Discovery broadcast failed:', error);
        }
    }

    private updateStatsInUI(): void {
        const networkLatency = document.getElementById('network-latency');
        if (networkLatency) {
            const latency = this.network.getAverageLatency();
            networkLatency.textContent = `${latency.toFixed(1)}ms`;
            
            // Color code latency
            if (latency <= 5) {
                networkLatency.style.color = '#10b981'; // green
            } else if (latency <= 15) {
                networkLatency.style.color = '#f59e0b'; // yellow
            } else {
                networkLatency.style.color = '#ef4444'; // red
            }
        }

        const computersOnline = document.getElementById('computers-online');
        if (computersOnline) {
            computersOnline.textContent = (this.connectedDevices.size + 1).toString(); // +1 for local
        }
    }

    destroy(): void {
        this.stopSharing();
        this.input.destroy();
        this.network.destroy();
        this.discovery.destroy();
        console.log('🗑️ Mouse/keyboard sharing orchestrator destroyed');
    }
}

export default MouseKeyboardSharing;