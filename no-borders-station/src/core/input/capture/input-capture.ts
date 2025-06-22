/**
 * Input Capture - Cross-platform input handling for mouse, keyboard, and touch
 * Captures input events and forwards them to connected devices
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

export interface MouseEvent {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    buttons: number;
    timestamp: number;
}

export interface KeyboardEvent {
    key: string;
    code: string;
    modifiers: {
        ctrl: boolean;
        shift: boolean;
        alt: boolean;
        meta: boolean;
    };
    pressed: boolean;
    timestamp: number;
}

export interface TouchEvent {
    touches: Array<{ x: number; y: number; id: number; pressure: number }>;
    timestamp: number;
}

export interface InputEvent {
    type: 'mouse' | 'keyboard' | 'touch';
    timestamp: number;
    data: MouseEvent | KeyboardEvent | TouchEvent;
}

export interface InputStats {
    eventsCapture: number;
    eventsPerSecond: number;
    latency: number;
}

export class InputCapture {
    private enabled = false;
    private initialized = false;
    private events: InputEvent[] = [];
    private stats: InputStats = {
        eventsCapture: 0,
        eventsPerSecond: 0,
        latency: 0
    };
    private lastStatsUpdate = 0;
    
    // Event handlers
    private mouseEventHandler: ((event: MouseEvent) => void) | null = null;
    private keyboardEventHandler: ((event: KeyboardEvent) => void) | null = null;

    async initialize(): Promise<boolean> {
        try {
            console.log('🖱️ Initializing Input Capture...');
            
            // Initialize Rust backend for input capture
            const success = await safeInvoke('initialize_input_capture');
            if (!success) {
                throw new Error('Failed to initialize Rust input capture backend');
            }

            // Set up input event listeners
            this.setupInputListeners();
            
            this.initialized = true;
            console.log('✅ Input Capture initialized');
            return true;
        } catch (error) {
            console.error('❌ Input Capture initialization failed:', error);
            return false;
        }
    }

    private setupInputListeners(): void {
        // Set up browser-level input capture for immediate response
        document.addEventListener('mousemove', (e) => this.handleBrowserMouseEvent(e));
        document.addEventListener('mousedown', (e) => this.handleBrowserMouseEvent(e));
        document.addEventListener('mouseup', (e) => this.handleBrowserMouseEvent(e));
        document.addEventListener('keydown', (e) => this.handleBrowserKeyboardEvent(e));
        document.addEventListener('keyup', (e) => this.handleBrowserKeyboardEvent(e));
        
        console.log('👂 Browser input event listeners set up');
    }

    private handleBrowserMouseEvent(event: globalThis.MouseEvent): void {
        if (!this.enabled) return;

        const mouseEvent: MouseEvent = {
            x: event.clientX,
            y: event.clientY,
            deltaX: event.movementX || 0,
            deltaY: event.movementY || 0,
            buttons: event.buttons,
            timestamp: performance.now()
        };

        // Call registered handler
        if (this.mouseEventHandler) {
            this.mouseEventHandler(mouseEvent);
        }

        this.captureEvent({
            type: 'mouse',
            timestamp: mouseEvent.timestamp,
            data: mouseEvent
        });
    }

    private handleBrowserKeyboardEvent(event: globalThis.KeyboardEvent): void {
        if (!this.enabled) return;

        const keyboardEvent: KeyboardEvent = {
            key: event.key,
            code: event.code,
            modifiers: {
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey,
                meta: event.metaKey
            },
            pressed: event.type === 'keydown',
            timestamp: performance.now()
        };

        // Call registered handler
        if (this.keyboardEventHandler) {
            this.keyboardEventHandler(keyboardEvent);
        }

        this.captureEvent({
            type: 'keyboard',
            timestamp: keyboardEvent.timestamp,
            data: keyboardEvent
        });
    }

    async startCapture(): Promise<boolean> {
        try {
            if (this.enabled) return true;

            // Start Rust backend capture
            const success = await invoke('start_input_capture');
            if (!success) {
                throw new Error('Failed to start Rust input capture');
            }

            this.enabled = true;
            console.log('🖱️ Input capture started');
            return true;
        } catch (error) {
            console.error('❌ Failed to start input capture:', error);
            return false;
        }
    }

    async stopCapture(): Promise<void> {
        try {
            if (!this.enabled) return;

            // Stop Rust backend capture
            await invoke('stop_input_capture');

            this.enabled = false;
            console.log('🖱️ Input capture stopped');
        } catch (error) {
            console.error('❌ Failed to stop input capture:', error);
        }
    }

    private captureEvent(event: InputEvent): void {
        this.events.push(event);
        this.stats.eventsCapture++;

        // Keep only recent events to prevent memory buildup
        if (this.events.length > 1000) {
            this.events = this.events.slice(-500);
        }
    }

    // Event handler registration
    onMouseEvent(handler: (event: MouseEvent) => void): void {
        this.mouseEventHandler = handler;
    }

    onKeyboardEvent(handler: (event: KeyboardEvent) => void): void {
        this.keyboardEventHandler = handler;
    }

    update(deltaTime: number): void {
        if (!this.initialized) return;

        // Update performance stats
        const now = performance.now();
        if (now - this.lastStatsUpdate >= 1000) {
            this.stats.eventsPerSecond = this.events.length;
            this.events = [];
            this.lastStatsUpdate = now;
        }

        // Calculate latency (simplified)
        this.stats.latency = deltaTime;
    }

    getStats(): InputStats {
        return { ...this.stats };
    }

    // Public methods for external mouse/keyboard handling
    handleMouse(event: globalThis.MouseEvent): void {
        this.handleBrowserMouseEvent(event);
    }

    handleKeyboard(event: globalThis.KeyboardEvent): void {
        this.handleBrowserKeyboardEvent(event);
    }

    destroy(): void {
        this.stopCapture();
        
        if (this.initialized) {
            // Remove event listeners
            document.removeEventListener('mousemove', this.handleBrowserMouseEvent);
            document.removeEventListener('mousedown', this.handleBrowserMouseEvent);
            document.removeEventListener('mouseup', this.handleBrowserMouseEvent);
            document.removeEventListener('keydown', this.handleBrowserKeyboardEvent);
            document.removeEventListener('keyup', this.handleBrowserKeyboardEvent);
            
            console.log('🖱️ Input Capture destroyed');
            this.initialized = false;
        }
    }
}