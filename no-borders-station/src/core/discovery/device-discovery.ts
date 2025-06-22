/**
 * Device Discovery - Find No-Borders computers on LAN
 * Supports mDNS, UDP broadcast, and manual IP discovery
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

export interface DiscoveredDevice {
    id: string;
    name: string;
    address: string;
    port: number;
    platform: 'windows' | 'linux' | 'macos' | 'unknown';
    version: string;
    capabilities: string[];
    lastSeen: number;
    latency?: number;
    trusted: boolean;
}

export interface DiscoveryConfig {
    enableMDNS: boolean;
    enableBroadcast: boolean;
    enableManualScan: boolean;
    scanInterval: number;
    timeout: number;
    serviceType: string;
}

export class DeviceDiscovery {
    private initialized = false;
    private discovering = false;
    private devices = new Map<string, DiscoveredDevice>();
    private discoveryCallbacks: ((devices: DiscoveredDevice[]) => void)[] = [];
    
    private readonly SERVICE_TYPE = '_no-borders._tcp.local.';
    private readonly BROADCAST_PORT = 33447;
    private readonly DISCOVERY_INTERVAL = 5000; // 5 seconds
    private readonly DEVICE_TIMEOUT = 30000; // 30 seconds
    
    private discoveryTimer: number | null = null;
    private cleanupTimer: number | null = null;

    constructor() {
        console.log('🔍 Initializing Device Discovery...');
    }

    async initialize(): Promise<boolean> {
        try {
            const config: DiscoveryConfig = {
                enableMDNS: true,
                enableBroadcast: true,
                enableManualScan: true,
                scanInterval: this.DISCOVERY_INTERVAL,
                timeout: this.DEVICE_TIMEOUT,
                serviceType: this.SERVICE_TYPE
            };
            
            // Initialize discovery backend
            const success = await safeInvoke('initialize_discovery', { config }) as boolean;
            if (!success) {
                throw new Error('Failed to initialize discovery backend');
            }
            
            // Set up periodic discovery tasks
            this.setupPeriodicTasks();
            
            this.initialized = true;
            console.log('✅ Device discovery initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize device discovery:', error);
            return this.initializeFallback();
        }
    }

    private setupPeriodicTasks(): void {
        // Regular discovery scan
        this.discoveryTimer = window.setInterval(() => {
            if (this.discovering) {
                this.performDiscoveryScan();
            }
        }, this.DISCOVERY_INTERVAL);
        
        // Clean up old devices
        this.cleanupTimer = window.setInterval(() => {
            this.cleanupOldDevices();
        }, 10000); // Clean up every 10 seconds
    }

    private async performDiscoveryScan(): Promise<void> {
        try {
            // mDNS discovery
            const mdnsDevices = await invoke('scan_mdns_devices') as DiscoveredDevice[];
            
            // UDP broadcast discovery
            const broadcastDevices = await invoke('scan_broadcast_devices') as DiscoveredDevice[];
            
            // Combine results
            const allDevices = [...mdnsDevices, ...broadcastDevices];
            
            // Update device list
            for (const device of allDevices) {
                this.updateDevice(device);
            }
            
            // Notify callbacks
            this.notifyDiscoveryCallbacks();
            
        } catch (error) {
            console.warn('Discovery scan failed:', error);
        }
    }

    private updateDevice(device: DiscoveredDevice): void {
        const existing = this.devices.get(device.id);
        
        if (existing) {
            // Update existing device
            existing.lastSeen = Date.now();
            existing.address = device.address;
            existing.port = device.port;
            existing.capabilities = device.capabilities;
            existing.latency = device.latency;
        } else {
            // Add new device
            device.lastSeen = Date.now();
            this.devices.set(device.id, device);
            console.log(`🆕 Discovered new device: ${device.name} (${device.platform}) at ${device.address}`);
        }
    }

    private cleanupOldDevices(): void {
        const now = Date.now();
        const toRemove: string[] = [];
        
        for (const [id, device] of this.devices) {
            if (now - device.lastSeen > this.DEVICE_TIMEOUT) {
                toRemove.push(id);
                console.log(`🗑️ Removing stale device: ${device.name}`);
            }
        }
        
        for (const id of toRemove) {
            this.devices.delete(id);
        }
        
        if (toRemove.length > 0) {
            this.notifyDiscoveryCallbacks();
        }
    }

    private notifyDiscoveryCallbacks(): void {
        const deviceList = Array.from(this.devices.values());
        
        for (const callback of this.discoveryCallbacks) {
            try {
                callback(deviceList);
            } catch (error) {
                console.error('Discovery callback error:', error);
            }
        }
    }

    private initializeFallback(): boolean {
        console.warn('⚠️ Using fallback device discovery (simulated devices)');
        
        // Simulate some discovered devices for testing
        setTimeout(() => {
            this.addSimulatedDevices();
        }, 2000);
        
        this.initialized = true;
        return true;
    }

    private addSimulatedDevices(): void {
        const simulatedDevices: DiscoveredDevice[] = [
            {
                id: 'windows-desktop-001',
                name: 'DESKTOP-ABC123',
                address: '192.168.1.105',
                port: 33446,
                platform: 'windows',
                version: '0.1.0',
                capabilities: ['mouse', 'keyboard', 'screen_share', 'low_latency'],
                lastSeen: Date.now(),
                latency: 2.3,
                trusted: false
            },
            {
                id: 'linux-workstation-001',
                name: 'ubuntu-workstation',
                address: '192.168.1.108',
                port: 33446,
                platform: 'linux',
                version: '0.1.0',
                capabilities: ['mouse', 'keyboard', 'screen_share', 'wayland', 'x11'],
                lastSeen: Date.now(),
                latency: 1.8,
                trusted: false
            }
        ];
        
        for (const device of simulatedDevices) {
            this.updateDevice(device);
        }
        
        this.notifyDiscoveryCallbacks();
    }

    // Public API
    async startDiscovery(): Promise<boolean> {
        if (!this.initialized) {
            console.error('Device discovery not initialized');
            return false;
        }
        
        try {
            // Start discovery backend
            await invoke('start_discovery');
            
            this.discovering = true;
            
            // Perform immediate scan
            await this.performDiscoveryScan();
            
            console.log('🔍 Device discovery started');
            return true;
            
        } catch (error) {
            console.error('Failed to start device discovery:', error);
            return false;
        }
    }

    async stopDiscovery(): Promise<void> {
        if (!this.discovering) return;
        
        try {
            await invoke('stop_discovery');
            this.discovering = false;
            console.log('⏹️ Device discovery stopped');
            
        } catch (error) {
            console.error('Failed to stop device discovery:', error);
        }
    }

    async scanManualIP(address: string): Promise<DiscoveredDevice | null> {
        try {
            console.log(`🔍 Manually scanning ${address}...`);
            
            const device = await invoke('scan_manual_ip', { address }) as DiscoveredDevice | null;
            
            if (device) {
                this.updateDevice(device);
                this.notifyDiscoveryCallbacks();
                console.log(`✅ Found device at ${address}: ${device.name}`);
            } else {
                console.log(`❌ No No-Borders device found at ${address}`);
            }
            
            return device;
            
        } catch (error) {
            console.error(`Failed to scan ${address}:`, error);
            return null;
        }
    }

    async testConnection(deviceId: string): Promise<number | null> {
        const device = this.devices.get(deviceId);
        if (!device) {
            console.error(`Device ${deviceId} not found`);
            return null;
        }
        
        try {
            const startTime = Date.now();
            const success = await invoke('test_device_connection', { 
                address: device.address, 
                port: device.port 
            }) as boolean;
            
            if (success) {
                const latency = Date.now() - startTime;
                device.latency = latency;
                console.log(`✅ Connection test to ${device.name}: ${latency}ms`);
                return latency;
            } else {
                console.log(`❌ Connection test to ${device.name} failed`);
                return null;
            }
            
        } catch (error) {
            console.error(`Connection test to ${device.name} failed:`, error);
            return null;
        }
    }

    async trustDevice(deviceId: string): Promise<boolean> {
        const device = this.devices.get(deviceId);
        if (!device) {
            console.error(`Device ${deviceId} not found`);
            return false;
        }
        
        try {
            const success = await invoke('trust_device', { deviceId }) as boolean;
            if (success) {
                device.trusted = true;
                console.log(`✅ Device ${device.name} is now trusted`);
                this.notifyDiscoveryCallbacks();
            }
            return success;
            
        } catch (error) {
            console.error(`Failed to trust device ${device.name}:`, error);
            return false;
        }
    }

    async untrustDevice(deviceId: string): Promise<boolean> {
        const device = this.devices.get(deviceId);
        if (!device) {
            console.error(`Device ${deviceId} not found`);
            return false;
        }
        
        try {
            const success = await invoke('untrust_device', { deviceId }) as boolean;
            if (success) {
                device.trusted = false;
                console.log(`⚠️ Device ${device.name} is no longer trusted`);
                this.notifyDiscoveryCallbacks();
            }
            return success;
            
        } catch (error) {
            console.error(`Failed to untrust device ${device.name}:`, error);
            return false;
        }
    }

    async scanNetworkRange(baseIP: string): Promise<DiscoveredDevice[]> {
        try {
            console.log(`🔍 Scanning network range ${baseIP}...`);
            
            const devices = await invoke('scan_network_range', { baseIp: baseIP }) as any[];
            const discoveredDevices: DiscoveredDevice[] = [];
            
            for (const deviceData of devices) {
                const device: DiscoveredDevice = {
                    id: deviceData.id,
                    name: deviceData.name,
                    address: deviceData.address,
                    port: deviceData.port,
                    platform: deviceData.platform || 'unknown',
                    version: deviceData.version || '1.0.0',
                    lastSeen: deviceData.lastSeen,
                    trusted: deviceData.trusted,
                    capabilities: [],
                    latency: 0
                };
                
                this.updateDevice(device);
                discoveredDevices.push(device);
                console.log(`✅ Found device: ${device.name} at ${device.address}`);
            }
            
            this.notifyDiscoveryCallbacks();
            console.log(`🔍 Network scan complete. Found ${discoveredDevices.length} devices.`);
            
            return discoveredDevices;
            
        } catch (error) {
            console.error(`Failed to scan network range ${baseIP}:`, error);
            return [];
        }
    }

    async scanSpecificHost(address: string, hostname?: string): Promise<DiscoveredDevice | null> {
        try {
            console.log(`🔍 Scanning specific host ${address}...`);
            
            const deviceData = await invoke('scan_specific_host', { 
                address, 
                hostname: hostname || null 
            }) as any;
            
            if (deviceData) {
                const device: DiscoveredDevice = {
                    id: deviceData.id,
                    name: deviceData.name,
                    address: deviceData.address,
                    port: deviceData.port,
                    platform: deviceData.platform || 'unknown',
                    version: deviceData.version || '1.0.0',
                    lastSeen: deviceData.lastSeen,
                    trusted: deviceData.trusted,
                    capabilities: [],
                    latency: 0
                };
                
                this.updateDevice(device);
                this.notifyDiscoveryCallbacks();
                console.log(`✅ Found specific host: ${device.name} at ${device.address}`);
                
                return device;
            } else {
                console.log(`❌ No No-Borders device found at ${address}`);
                return null;
            }
            
        } catch (error) {
            console.error(`Failed to scan host ${address}:`, error);
            return null;
        }
    }

    onDevicesChanged(callback: (devices: DiscoveredDevice[]) => void): void {
        this.discoveryCallbacks.push(callback);
    }

    removeDevicesCallback(callback: (devices: DiscoveredDevice[]) => void): void {
        const index = this.discoveryCallbacks.indexOf(callback);
        if (index > -1) {
            this.discoveryCallbacks.splice(index, 1);
        }
    }

    getDevices(): DiscoveredDevice[] {
        return Array.from(this.devices.values());
    }

    getDevice(id: string): DiscoveredDevice | undefined {
        return this.devices.get(id);
    }

    getTrustedDevices(): DiscoveredDevice[] {
        return Array.from(this.devices.values()).filter(device => device.trusted);
    }

    getDevicesByPlatform(platform: string): DiscoveredDevice[] {
        return Array.from(this.devices.values()).filter(device => device.platform === platform);
    }

    update(deltaTime: number): void {
        // This is called from the main loop with deltaTime for consistency
        // Most work is done by periodic timers, deltaTime could be used for 
        // future optimizations or rate limiting
        if (deltaTime > 0 && this.discovering) {
            // Could track update frequency or throttle operations
        }
    }

    getStats() {
        return {
            initialized: this.initialized,
            discovering: this.discovering,
            totalDevices: this.devices.size,
            trustedDevices: this.getTrustedDevices().length,
            windowsDevices: this.getDevicesByPlatform('windows').length,
            linuxDevices: this.getDevicesByPlatform('linux').length,
            macosDevices: this.getDevicesByPlatform('macos').length,
            callbacks: this.discoveryCallbacks.length
        };
    }

    destroy(): void {
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = null;
        }
        
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        this.stopDiscovery();
        this.devices.clear();
        this.discoveryCallbacks = [];
        this.initialized = false;
        console.log('🗑️ Device discovery destroyed');
    }
}