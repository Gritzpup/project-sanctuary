/**
 * No-Borders Main Application Entry Point
 * Phase 1: Mouse/Keyboard Sharing between Windows and Linux PCs
 */

import { WebGPURenderer } from './ui/webgpu/renderer';
import { Canvas2DRenderer } from './ui/webgpu/canvas2d-renderer';
import MouseKeyboardSharing from './core/sharing/mouse-keyboard-sharing';

class NoBordersApp {
    private renderer: WebGPURenderer | Canvas2DRenderer | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private sharing: MouseKeyboardSharing | null = null;
    
    private initialized = false;
    private isRunning = false;
    private lastFrameTime = 0;
    private animationFrame = 0;

    constructor() {
        console.log('🚀 Starting No-Borders Mouse/Keyboard Sharing Application...');
        
        // Ensure DOM is loaded before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initialize();
            });
        } else {
            // DOM is already loaded
            this.initialize();
        }
    }

    private async initialize(): Promise<void> {
        console.log('🔧 No-Borders initialization starting...');
        
        try {
            console.log('🔧 Step 1: Setting up canvas and UI...');
            // Create main canvas and UI first - this should always succeed
            this.setupCanvas();
            console.log('✅ Canvas and UI setup completed');
            
            // Always show the UI immediately, then try to initialize other components
            this.updateConnectionStatus('ready', 'Loading mouse & keyboard sharing...');
            
            console.log('🔧 Step 2: Setting up event listeners...');
            // Setup event listeners early
            this.setupEventListeners();
            console.log('✅ Event listeners setup completed');
            
            console.log('🔧 Step 3: Starting application loop...');
            // Start main application loop (without renderer for now)
            this.start();
            console.log('✅ Application loop started');
            
            console.log('🔧 Step 4: Initializing renderer (optional)...');
            // Initialize renderer (WebGPU with Canvas2D fallback)
            try {
                await this.initializeRenderer();
                console.log('✅ Renderer initialized successfully');
                this.updateConnectionStatus('ready', 'Renderer initialized');
            } catch (error) {
                console.warn('⚠️ Renderer initialization failed, continuing without renderer:', error);
                this.updateConnectionStatus('ready', 'Running without renderer');
                // Continue without renderer - UI is still functional
            }
            
            console.log('🔧 Step 5: Initializing sharing system (optional)...');
            // Initialize mouse/keyboard sharing system
            try {
                await this.initializeSharingSystem();
                console.log('✅ Sharing system initialized successfully');
                this.updateConnectionStatus('ready', 'Ready to share mouse & keyboard');
            } catch (error) {
                console.warn('⚠️ Sharing system initialization failed, continuing with limited functionality:', error);
                this.updateConnectionStatus('ready', 'Limited functionality - sharing unavailable');
                // Continue without sharing system - UI still works for setup
            }
            
            this.initialized = true;
            
            console.log('🔧 Step 6: Auto-detecting monitors...');
            // Automatically detect monitors when app initializes
            setTimeout(() => {
                try {
                    this.detectAndUpdateMonitors();
                } catch (error) {
                    console.warn('⚠️ Monitor detection failed:', error);
                }
            }, 500);
            
            // Add monitor testing panel for debugging
            setTimeout(() => {
                this.createMonitorTestPanel();
                // Run simple test immediately
                this.runSimpleMonitorTest();
            }, 1000);
            
            console.log('✅ No-Borders mouse/keyboard sharing initialized successfully');
            
        } catch (error) {
            console.error('❌ Critical failure during initialization:', error);
            // Always ensure UI is visible even if initialization fails
            this.showErrorScreen(error as Error);
        }
    }

    private async initializeRenderer(): Promise<void> {
        if (!this.canvas) {
            throw new Error('Canvas not created');
        }

        console.log('🎨 Skipping renderer initialization for debugging...');
        // Skip renderer initialization for now to debug the UI loading issue
        this.renderer = null;
        console.log('✅ Renderer initialization skipped (debug mode)');
        return;

        /*
        console.log('🎨 Attempting WebGPU renderer initialization...');
        // Try WebGPU first with timeout
        try {
            this.renderer = new WebGPURenderer(this.canvas);
            
            // Add timeout for WebGPU initialization
            const webgpuPromise = this.renderer.initialize();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('WebGPU initialization timeout')), 5000)
            );
            
            const webgpuSuccess = await Promise.race([webgpuPromise, timeoutPromise]) as boolean;
            
            if (webgpuSuccess) {
                console.log('✅ Using WebGPU renderer for optimal performance');
                return;
            } else {
                console.warn('⚠️ WebGPU returned false, falling back to Canvas2D');
            }
        } catch (error) {
            console.warn('⚠️ WebGPU initialization failed, falling back to Canvas2D:', error);
        }

        console.log('🎨 Attempting Canvas2D renderer initialization...');
        // Fallback to Canvas2D
        try {
            this.renderer = new Canvas2DRenderer(this.canvas);
            const canvas2dSuccess = await this.renderer.initialize();
            
            if (canvas2dSuccess) {
                console.log('✅ Using Canvas2D fallback renderer');
                return;
            } else {
                console.warn('⚠️ Canvas2D returned false');
            }
        } catch (error) {
            console.error('❌ Canvas2D fallback failed:', error);
        }

        // Don't throw error - allow app to continue without renderer
        console.warn('⚠️ No suitable renderer available, continuing without renderer');
        this.renderer = null;
        */
    }

    private async initializeSharingSystem(): Promise<void> {
        console.log('🔗 Skipping sharing system initialization for debugging...');
        // Skip sharing system initialization for now to debug the UI loading issue
        this.sharing = null;
        console.log('✅ Sharing system initialization skipped (debug mode)');
        return;

        /*
        try {
            console.log('🔗 Creating mouse/keyboard sharing instance...');
            // Initialize mouse/keyboard sharing with optimized settings
            this.sharing = new MouseKeyboardSharing({
                enableMouseSharing: true,
                enableKeyboardSharing: true,
                autoDiscovery: true,
                latencyMode: 'ultra_low',
                edgeSensitivity: 5,
                trustRequiredForConnection: false // For initial testing
            });

            console.log('🔗 Initializing sharing system...');
            const success = await this.sharing.initialize();
            if (!success) {
                throw new Error('Failed to initialize sharing system');
            }

            console.log('✅ Mouse/keyboard sharing system initialized');

        } catch (error) {
            console.warn('⚠️ Sharing system failed to initialize, continuing without it:', error);
            // Don't throw - allow app to continue without sharing system
            this.sharing = null;
        }
        */
    }

    private setupCanvas(): void {
        console.log('📱 Setting up canvas...');
        
        // First, force remove any loading screen immediately
        const loadingElement = document.querySelector('.loading');
        if (loadingElement) {
            console.log('📱 Removing loading screen...');
            loadingElement.remove();
        }
        
        // Create main canvas element for screen content
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'no-borders-canvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 1;
            background: #000000;
            cursor: crosshair;
            object-fit: contain;
        `;

        // Set canvas resolution to match display
        this.resizeCanvas();

        // Remove loading screen and replace app content
        const appDiv = document.getElementById('app');
        if (appDiv) {
            console.log('📱 Clearing app content and adding canvas...');
            // Clear all content (including loading screen)
            appDiv.innerHTML = '';
            // Add canvas
            appDiv.appendChild(this.canvas);
            // Create UI overlay - this should always succeed
            try {
                console.log('📱 Creating UI overlay...');
                this.createUIOverlay(appDiv);
                console.log('✅ UI overlay created successfully');
            } catch (error) {
                console.error('❌ Failed to create UI overlay:', error);
                // Create a minimal fallback UI
                console.log('📱 Creating fallback UI...');
                this.createFallbackUI(appDiv);
            }
        } else {
            console.log('📱 No app div found, adding canvas to body...');
            document.body.appendChild(this.canvas);
        }
        
        console.log('✅ Canvas created and added to DOM');
    }

    private resizeCanvas(): void {
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set actual canvas size (accounting for device pixel ratio)
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        // Notify renderer of size change
        if (this.renderer) {
            this.renderer.resize(this.canvas.width, this.canvas.height);
        }
    }

    private setupEventListeners(): void {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Handle keyboard events
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        // Handle mouse events
        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (event) => {
                this.handleMouseMove(event);
            });

            this.canvas.addEventListener('click', (event) => {
                this.handleMouseClick(event);
            });
        }

        // Handle window focus/blur for performance optimization
        window.addEventListener('focus', () => {
            console.log('📱 Application gained focus');
        });

        window.addEventListener('blur', () => {
            console.log('📱 Application lost focus');
        });

        console.log('👂 Event listeners set up');
    }

    private handleKeyDown(event: KeyboardEvent): void {
        // Handle application shortcuts
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'q':
                    event.preventDefault();
                    this.shutdown();
                    break;
                case 'r':
                    event.preventDefault();
                    this.restart();
                    break;
                case 'd':
                    event.preventDefault();
                    this.toggleDebugMode();
                    break;
                case 'm':
                    // Hidden shortcut: Ctrl/Cmd + M to simulate multi-monitor
                    if (event.shiftKey) {
                        event.preventDefault();
                        console.log('🔧 Triggering multi-monitor simulation...');
                        this.simulateMultiMonitorSetup();
                    }
                    break;
            }
        }

        // Mouse/keyboard sharing system handles its own shortcuts internally
    }

    private handleMouseMove(event: MouseEvent): void {
        // Update cursor position display
        this.updateCursorPosition(event.clientX, event.clientY);
        
        // Mouse/keyboard sharing system handles mouse events internally
    }

    private handleMouseClick(event: MouseEvent): void {
        // Handle UI interactions
        console.log('🖱️ Mouse click at:', event.clientX, event.clientY);
        
        // Mouse/keyboard sharing system handles mouse events internally
    }

    private updateCursorPosition(x: number, y: number): void {
        // Update cursor position in UI
        const cursorPos = document.getElementById('cursor-position');
        if (cursorPos) {
            cursorPos.textContent = `${x}, ${y}`;
        }
    }

    private start(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.renderLoop();
        
        console.log('🎮 Main application loop started');
    }

    private renderLoop = async (): Promise<void> => {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Update application logic
        await this.update(deltaTime);

        // Render frame
        if (this.renderer) {
            this.renderer.render(deltaTime);
        }

        // Schedule next frame
        this.animationFrame = requestAnimationFrame(this.renderLoop);
    };

    private update = async (deltaTime: number): Promise<void> => {
        // Update mouse/keyboard sharing system
        if (this.sharing) {
            await this.sharing.update(deltaTime);
        }

        // Update UI stats
        this.updatePerformanceStats(deltaTime);
    };

    private updatePerformanceStats(_deltaTime: number): void {
        if (!this.sharing) return;

        const stats = this.sharing.getStats();

        // Update active computer display
        const activeComputer = document.getElementById('active-computer');
        if (activeComputer) {
            const currentDevice = this.sharing.getCurrentActiveDevice();
            const devices = this.sharing.getConnectedDevices();
            const device = devices.find(d => d.id === currentDevice);
            activeComputer.textContent = device ? device.name : 'This PC';
        }

        // Update network latency
        const networkLatency = document.getElementById('network-latency');
        if (networkLatency) {
            const latency = stats.networkLatency || 0;
            networkLatency.textContent = `${latency.toFixed(1)}ms`;
            
            // Color code latency for mouse/keyboard sharing
            if (latency <= 5) {
                networkLatency.style.color = '#10b981'; // green - excellent for input
            } else if (latency <= 15) {
                networkLatency.style.color = '#f59e0b'; // yellow - acceptable
            } else {
                networkLatency.style.color = '#ef4444'; // red - too high for good experience
            }
        }

        // Update computers online count
        const computersOnline = document.getElementById('computers-online');
        if (computersOnline) {
            computersOnline.textContent = (stats.connectedDevices + 1).toString(); // +1 for local
        }

        // Update sharing status
        const sharingStatus = document.getElementById('sharing-status');
        if (sharingStatus) {
            sharingStatus.textContent = stats.isSharing ? 'Active' : 'Inactive';
            sharingStatus.style.color = stats.isSharing ? '#10b981' : '#6b7280';
        }
    }

    private toggleDebugMode(): void {
        console.log('🔧 Debug mode toggled');
        
        // Show performance stats
        if (this.renderer) {
            const rendererStats = this.renderer.getStats();
            console.table(rendererStats);
        }

        if (this.sharing) {
            const sharingStats = this.sharing.getStats();
            console.table(sharingStats);
        }
    }

    private restart(): void {
        console.log('🔄 Restarting application...');
        this.shutdown();
        setTimeout(() => {
            this.initialize();
        }, 100);
    }

    private shutdown(): void {
        console.log('🛑 Shutting down application...');
        
        this.isRunning = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        // Cleanup services
        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }

        if (this.sharing) {
            this.sharing.destroy();
            this.sharing = null;
        }

        // Remove canvas
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
            this.canvas = null;
        }

        this.initialized = false;
    }

    private showErrorScreen(error: Error): void {
        // Create error display
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: 'Inter', sans-serif;
            z-index: 10000;
        `;

        errorDiv.innerHTML = `
            <h1 style="font-size: 48px; margin-bottom: 20px; color: #ff6b6b;">⚠️</h1>
            <h2 style="font-size: 24px; margin-bottom: 20px;">Mouse/Keyboard Sharing Error</h2>
            <p style="font-size: 16px; margin-bottom: 10px; max-width: 600px; text-align: center;">
                ${error.message}
            </p>
            <p style="font-size: 14px; color: #888; margin-bottom: 30px;">
                Check the console for more details
            </p>
            <button id="retry-btn" style="
                background: #4dabf7;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
            ">Retry</button>
        `;

        document.body.appendChild(errorDiv);

        // Add retry functionality
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                document.body.removeChild(errorDiv);
                this.restart();
            });
        }
    }

    private createUIOverlay(appContainer: HTMLElement): void {
        // Create UI overlay container
        const overlay = document.createElement('div');
        overlay.className = 'ui-overlay';
        
        // Create main branding
        const branding = document.createElement('div');
        branding.className = 'app-branding';
        branding.innerHTML = `
            <h1 class="app-title">No Borders</h1>
            <p class="app-subtitle">Seamless mouse & keyboard sharing • Ultra-low latency</p>
            <div class="action-buttons">
                <button class="btn btn-primary" id="start-sharing-btn">
                    🖱️ Start Sharing
                </button>
                <button class="btn btn-secondary" id="scan-devices-btn">
                    🔍 Scan for Computers
                </button>
            </div>
        `;
        
        // Create computer layout display
        const layoutDisplay = document.createElement('div');
        layoutDisplay.className = 'layout-display';
        layoutDisplay.innerHTML = `
            <div class="layout-title">Monitor Layout Grid</div>
            <div class="layout-instructions">Drag monitors to position them around your displays. Supports multi-monitor setups and all directions.</div>
            <div class="monitor-detection">
                <button class="btn btn-small" id="detect-monitors-btn">🖥️ Detect Monitors</button>
                <button class="btn btn-small" id="force-refresh-monitors-btn">🔄 Force Refresh</button>
                <span id="monitor-count">Detecting displays...</span>
            </div>
            <div class="grid-layout-container" id="grid-layout">
                <!-- 5x5 grid for monitor positioning -->
                <div class="grid-slot" data-position="top-left" data-x="-1" data-y="-1">
                    <div class="slot-label">↖️</div>
                </div>
                <div class="grid-slot" data-position="top" data-x="0" data-y="-1">
                    <div class="slot-label">⬆️</div>
                </div>
                <div class="grid-slot" data-position="top-right" data-x="1" data-y="-1">
                    <div class="slot-label">↗️</div>
                </div>
                
                <div class="grid-slot" data-position="left" data-x="-1" data-y="0">
                    <div class="slot-label">⬅️</div>
                </div>
                <div class="grid-slot center-slot" data-position="center" data-x="0" data-y="0">
                    <div class="primary-monitor" id="primary-monitor">
                        <div class="monitor-header">
                            <span class="monitor-name">Primary Display</span>
                            <span class="monitor-status">�️ Local</span>
                        </div>
                        <div class="monitor-info">
                            <div class="monitor-resolution" id="primary-resolution">1920×1080</div>
                            <div class="monitor-position">Main Screen</div>
                        </div>
                    </div>
                </div>
                <div class="grid-slot" data-position="right" data-x="1" data-y="0">
                    <div class="slot-label">➡️</div>
                </div>
                
                <div class="grid-slot" data-position="bottom-left" data-x="-1" data-y="1">
                    <div class="slot-label">↙️</div>
                </div>
                <div class="grid-slot" data-position="bottom" data-x="0" data-y="1">
                    <div class="slot-label">⬇️</div>
                </div>
                <div class="grid-slot" data-position="bottom-right" data-x="1" data-y="1">
                    <div class="slot-label">↘️</div>
                </div>
            </div>
            <div class="layout-controls">
                <button class="btn btn-small" id="reset-layout-btn">🔄 Reset Layout</button>
                <button class="btn btn-small" id="test-transitions-btn">🧪 Test Transitions</button>
                <button class="btn btn-small" id="configure-edges-btn">⚙️ Configure Edges</button>
                <button class="btn btn-small" id="auto-arrange-btn">🎯 Auto Arrange</button>
            </div>
        `;
        
        // Create stats panel for input sharing
        const statsPanel = document.createElement('div');
        statsPanel.className = 'stats-panel';
        statsPanel.innerHTML = `
            <div class="stats-item">
                <span class="stats-label">Active Computer:</span>
                <span class="stats-value" id="active-computer">This PC</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">Network Latency:</span>
                <span class="stats-value" id="network-latency">0.0ms</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">Computers Online:</span>
                <span class="stats-value" id="computers-online">1</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">Sharing Status:</span>
                <span class="stats-value" id="sharing-status">Inactive</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">Cursor Position:</span>
                <span class="stats-value" id="cursor-position">0, 0</span>
            </div>
        `;
        
        // Create connection status
        const connectionStatus = document.createElement('div');
        connectionStatus.className = 'connection-status';
        connectionStatus.innerHTML = `
            <div class="status-dot status-ready" id="status-dot"></div>
            <span id="status-text">Ready to share mouse & keyboard</span>
        `;
        
        // Create device discovery for nearby computers
        const deviceDiscovery = document.createElement('div');
        deviceDiscovery.className = 'device-discovery';
        deviceDiscovery.innerHTML = `
            <div class="discovery-title">Discovered Computers</div>
            <div class="discovery-subtitle">Drag computers to position them left or right of your screen</div>
            <div class="device-grid" id="device-grid">
                <div class="device-card scanning">
                    <div class="device-name">Scanning network...</div>
                    <div class="device-address">Looking for No-Borders computers</div>
                    <div class="device-capabilities">
                        <span class="capability-tag">Windows & Linux</span>
                        <span class="capability-tag">Ultra-low Latency</span>
                    </div>
                </div>
            </div>
            <div class="discovery-actions">
                <button class="btn btn-secondary" id="scan-devices-btn-alt">
                    🔍 Scan Again
                </button>
                <button class="btn btn-outline" id="add-manual-btn">
                    ➕ Add Manually
                </button>
            </div>
        `;
        
        // Create keyboard shortcuts help
        const keyboardHelp = document.createElement('div');
        keyboardHelp.className = 'keyboard-help';
        keyboardHelp.innerHTML = `
            <div class="help-title">Keyboard Shortcuts</div>
            <div class="shortcuts-grid">
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+Alt+1/2/3</span>
                    <span class="shortcut-desc">Switch to computer 1/2/3</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">ScrollLock</span>
                    <span class="shortcut-desc">Toggle between computers</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+Alt+L</span>
                    <span class="shortcut-desc">Lock to current computer</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">Mouse Edge</span>
                    <span class="shortcut-desc">Seamless switching at screen edges</span>
                </div>
            </div>
        `;
        
        // Add all elements to overlay
        overlay.appendChild(branding);
        overlay.appendChild(layoutDisplay);
        overlay.appendChild(statsPanel);
        overlay.appendChild(connectionStatus);
        overlay.appendChild(deviceDiscovery);
        overlay.appendChild(keyboardHelp);
        
        // Add overlay to app container
        appContainer.appendChild(overlay);
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('🎨 Mouse/Keyboard sharing UI overlay created');
    }

    private createFallbackUI(appContainer: HTMLElement): void {
        console.log('🆘 Creating fallback UI...');
        
        // Create a minimal UI that always works
        const fallbackOverlay = document.createElement('div');
        fallbackOverlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            border: 2px solid #4dabf7;
            z-index: 1000;
            font-family: 'Inter', sans-serif;
            min-width: 300px;
        `;
        
        fallbackOverlay.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #4dabf7;">🚀 No Borders</h3>
            <p style="margin: 0 0 15px 0; color: #ccc; font-size: 14px;">
                UI partially loaded - some features may be limited
            </p>
            <div style="display: flex; gap: 10px;">
                <button id="fallback-retry" style="
                    background: #4dabf7;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Retry</button>
                <button id="fallback-continue" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Continue</button>
            </div>
        `;
        
        appContainer.appendChild(fallbackOverlay);
        
        // Setup fallback buttons
        const retryBtn = document.getElementById('fallback-retry');
        const continueBtn = document.getElementById('fallback-continue');
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.restart();
            });
        }
        
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                if (fallbackOverlay.parentNode) {
                    fallbackOverlay.parentNode.removeChild(fallbackOverlay);
                }
                // Try to create the full UI again
                try {
                    this.createUIOverlay(appContainer);
                } catch (error) {
                    console.error('Still unable to create full UI:', error);
                }
            });
        }
        
        console.log('✅ Fallback UI created');
    }

    private createMonitorTestPanel(): void {
        // Create a test panel for monitor detection debugging
        const testPanel = document.createElement('div');
        testPanel.id = 'monitor-test-panel';
        testPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(20, 20, 30, 0.95);
            border: 2px solid #4dabf7;
            border-radius: 10px;
            padding: 15px;
            color: white;
            font-family: 'Inter', sans-serif;
            z-index: 2000;
            min-width: 300px;
            max-height: 400px;
            overflow-y: auto;
        `;
        
        testPanel.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #4dabf7;">🔬 Monitor Detection Test</h3>
            <div style="margin-bottom: 10px;">
                <button id="test-screen-details" style="margin: 2px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Test Screen Details API</button>
                <button id="test-tauri-monitors" style="margin: 2px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Test Tauri Monitors</button>
            </div>
            <div style="margin-bottom: 10px;">
                <button id="test-heuristics" style="margin: 2px; padding: 5px 10px; background: #fd7e14; color: white; border: none; border-radius: 4px; cursor: pointer;">Test Heuristics</button>
                <button id="test-all-methods" style="margin: 2px; padding: 5px 10px; background: #6f42c1; color: white; border: none; border-radius: 4px; cursor: pointer;">Test All Methods</button>
            </div>
            <div style="margin-bottom: 10px;">
                <button id="simulate-dual" style="margin: 2px; padding: 5px 10px; background: #20c997; color: white; border: none; border-radius: 4px; cursor: pointer;">Simulate Dual</button>
                <button id="simulate-triple" style="margin: 2px; padding: 5px 10px; background: #20c997; color: white; border: none; border-radius: 4px; cursor: pointer;">Simulate Triple</button>
            </div>
            <div id="test-results" style="background: #111; padding: 10px; border-radius: 5px; font-size: 12px; max-height: 200px; overflow-y: auto;">
                <div style="color: #888;">Test results will appear here...</div>
            </div>
        `;
        
        document.body.appendChild(testPanel);
        
        // Setup test button handlers
        this.setupMonitorTestHandlers();
    }

    private setupMonitorTestHandlers(): void {
        const testResults = document.getElementById('test-results');
        
        const log = (message: string, color = '#fff') => {
            if (testResults) {
                const timestamp = new Date().toLocaleTimeString();
                testResults.innerHTML += `<div style="color: ${color}; margin: 2px 0;">[${timestamp}] ${message}</div>`;
                testResults.scrollTop = testResults.scrollHeight;
            }
        };
        
        // Test Screen Details API
        document.getElementById('test-screen-details')?.addEventListener('click', async () => {
            log('🔍 Testing Screen Details API...', '#4dabf7');
            try {
                if ('getScreenDetails' in window) {
                    const permission = await navigator.permissions.query({ name: 'window-management' as any });
                    log(`Permission state: ${permission.state}`, '#ffc107');
                    
                    if (permission.state === 'granted') {
                        const screenDetails = await (window as any).getScreenDetails();
                        log(`✅ Found ${screenDetails.screens.length} screens`, '#28a745');
                        screenDetails.screens.forEach((screen: any, i: number) => {
                            log(`  Screen ${i}: ${screen.width}x${screen.height} at (${screen.left}, ${screen.top})`, '#17a2b8');
                        });
                    } else {
                        log('❌ Permission not granted. Click on page first, then try again.', '#dc3545');
                    }
                } else {
                    log('❌ Screen Details API not available', '#dc3545');
                }
            } catch (error) {
                log(`❌ Error: ${error}`, '#dc3545');
            }
        });

        // Test Tauri monitors
        document.getElementById('test-tauri-monitors')?.addEventListener('click', async () => {
            log('🔍 Testing Tauri monitor detection...', '#4dabf7');
            try {
                if ((window as any).__TAURI__) {
                    const { invoke } = (window as any).__TAURI__.tauri;
                    const monitors = await invoke('get_monitors');
                    log(`✅ Found ${monitors.length} monitors via Tauri`, '#28a745');
                    monitors.forEach((monitor: any, i: number) => {
                        log(`  Monitor ${i}: ${monitor.name} ${monitor.size.width}x${monitor.size.height} at (${monitor.position.x}, ${monitor.position.y})`, '#17a2b8');
                    });
                } else {
                    log('❌ Tauri not available (web mode)', '#dc3545');
                }
            } catch (error) {
                log(`❌ Tauri error: ${error}`, '#dc3545');
            }
        });

        // Test heuristics
        document.getElementById('test-heuristics')?.addEventListener('click', () => {
            log('🔍 Testing heuristic detection...', '#4dabf7');
            log(`Screen: ${window.screen.width}x${window.screen.height}`, '#17a2b8');
            log(`Available: ${window.screen.availWidth}x${window.screen.availHeight}`, '#17a2b8');
            log(`Device pixel ratio: ${window.devicePixelRatio}`, '#17a2b8');
            
            const indicators = this.detectMultiMonitorIndicators();
            log(`Multi-monitor detected: ${indicators.hasMultipleMonitors}`, indicators.hasMultipleMonitors ? '#28a745' : '#ffc107');
            log(`Estimated monitors: ${indicators.estimatedMonitorCount}`, '#17a2b8');
        });

        // Test all methods
        document.getElementById('test-all-methods')?.addEventListener('click', async () => {
            log('🔍 Testing all detection methods...', '#4dabf7');
            const screens = await this.getAvailableScreens();
            log(`✅ Total detected: ${screens.length} screens`, '#28a745');
            screens.forEach((screen, i) => {
                log(`  ${screen.name}: ${screen.width}x${screen.height} at (${screen.x}, ${screen.y}) via ${screen.method}`, '#17a2b8');
            });
        });

        // Simulate dual monitors
        document.getElementById('simulate-dual')?.addEventListener('click', () => {
            log('🧪 Simulating dual monitor setup...', '#20c997');
            this.simulateMultiMonitorSetup();
            log('✅ Dual monitor simulation applied', '#28a745');
        });

        // Simulate triple monitors
        document.getElementById('simulate-triple')?.addEventListener('click', () => {
            log('🧪 Simulating triple monitor setup...', '#20c997');
            this.simulateTripleMonitorSetup();
            log('✅ Triple monitor simulation applied', '#28a745');
        });
    }

    private simulateTripleMonitorSetup(): void {
        console.log('🧪 Simulating triple monitor setup for testing...');
        
        const baseWidth = window.screen.width || 1920;
        const baseHeight = window.screen.height || 1080;
        
        // Create a triple monitor setup (left + primary + right)
        const simulatedScreens = [
            {
                id: 'screen-left',
                width: baseWidth,
                height: baseHeight,
                x: -baseWidth, // Left monitor
                y: 0,
                primary: false,
                name: 'Left Display (Simulated)',
                estimated: false
            },
            {
                id: 'primary',
                width: baseWidth,
                height: baseHeight,
                x: 0,
                y: 0,
                primary: true,
                name: 'Primary Display'
            },
            {
                id: 'screen-right',
                width: baseWidth,
                height: baseHeight,
                x: baseWidth, // Right monitor
                y: 0,
                primary: false,
                name: 'Right Display (Simulated)',
                estimated: false
            }
        ];
        
        console.log('🖥️ Simulated triple screens:', simulatedScreens);
        this.updateMonitorGrid(simulatedScreens);
        
        // Update monitor count display
        const monitorCount = document.getElementById('monitor-count');
        if (monitorCount) {
            monitorCount.textContent = `${simulatedScreens.length} displays detected (simulated)`;
        }
        
        console.log('✅ Triple monitor simulation complete');
    }

    private simulateMultiMonitorSetup(): void {
        console.log('🧪 Simulating dual monitor setup for testing...');
        
        const baseWidth = window.screen.width || 1920;
        const baseHeight = window.screen.height || 1080;
        
        // Create a simulated dual monitor setup (primary + right monitor)
        const simulatedScreens = [
            {
                id: 'primary',
                width: baseWidth,
                height: baseHeight,
                x: 0,
                y: 0,
                primary: true,
                name: 'Primary Display'
            },
            {
                id: 'screen-1',
                width: baseWidth,
                height: baseHeight,
                x: baseWidth, // Positioned to the right
                y: 0,
                primary: false,
                name: 'Display 2 (Simulated)',
                estimated: false
            }
        ];
        
        console.log('🖥️ Simulated dual screens:', simulatedScreens);
        this.updateMonitorGrid(simulatedScreens);
        
        // Update monitor count display
        const monitorCount = document.getElementById('monitor-count');
        if (monitorCount) {
            monitorCount.textContent = `${simulatedScreens.length} displays detected (simulated)`;
        }
        
        console.log('✅ Dual monitor simulation complete');
    }

    private updateConnectionStatus(status: string, message: string): void {
        console.log(`📡 Connection status: ${status} - ${message}`);
        
        // Update status in the UI if elements exist
        const statusElement = document.getElementById('connection-status');
        const messageElement = document.getElementById('status-message');
        
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `status-indicator ${status}`;
        }
        
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        // Also update any status displays in the main UI
        const statusDisplays = document.querySelectorAll('.connection-status');
        statusDisplays.forEach(display => {
            (display as HTMLElement).textContent = message;
            display.className = `connection-status ${status}`;
        });
    }

    private detectAndUpdateMonitors(): void {
        console.log('🖥️ Detecting and updating monitor layout...');
        
        // Detect multiple monitors using browser APIs
        this.getAvailableScreens().then(screens => {
            // Update the grid with detected monitors
            this.updateMonitorGrid(screens);
            
            // Update monitor count display
            const monitorCount = document.getElementById('monitor-count');
            if (monitorCount) {
                monitorCount.textContent = `${screens.length} display${screens.length !== 1 ? 's' : ''} detected`;
            }
            
            console.log(`✅ Detected ${screens.length} monitor(s)`);
        }).catch(error => {
            console.error('Failed to detect monitors:', error);
        });
    }

    private async getAvailableScreens(): Promise<any[]> {
        console.log('🔍 Starting comprehensive multi-monitor detection...');
        const screens = [];
        
        // Method 1: Screen Details API (Chrome 100+, requires user gesture)
        try {
            if ('getScreenDetails' in window) {
                console.log('📡 Attempting Screen Details API...');
                
                // Check permission first
                const permission = await navigator.permissions.query({ name: 'window-management' as any });
                console.log('Window management permission:', permission.state);
                
                if (permission.state === 'granted') {
                    try {
                        const screenDetails = await (window as any).getScreenDetails();
                        console.log('✅ Screen Details API response:', screenDetails);
                        
                        if (screenDetails.screens && screenDetails.screens.length > 0) {
                            screenDetails.screens.forEach((screen: any, index: number) => {
                                screens.push({
                                    id: screen.primary ? 'primary' : `screen-${index}`,
                                    width: screen.width,
                                    height: screen.height,
                                    x: screen.left,
                                    y: screen.top,
                                    primary: screen.primary || false,
                                    name: screen.primary ? 'Primary Display' : `Display ${index + 1}`,
                                    colorDepth: screen.colorDepth,
                                    pixelRatio: screen.devicePixelRatio || 1,
                                    orientation: screen.orientation?.type || 'landscape-primary',
                                    method: 'Screen Details API'
                                });
                            });
                            console.log(`✅ Screen Details API found ${screens.length} monitor(s)`);
                            return screens;
                        }
                    } catch (error) {
                        console.warn('⚠️ Screen Details API failed:', error);
                    }
                } else if (permission.state === 'prompt' || permission.state === 'denied') {
                    console.log('🔐 Screen Details API permission required - will show UI option');
                    this.showScreenDetailsPermissionOption();
                }
            }
        } catch (error) {
            console.warn('⚠️ Screen Details API not available:', error);
        }

        // Fallback: Always add primary screen
        const primaryScreen = {
            id: 'primary',
            width: window.screen.width,
            height: window.screen.height,
            x: 0,
            y: 0,
            primary: true,
            name: 'Primary Display',
            method: 'Window.screen API'
        };
        screens.push(primaryScreen);
        
        // Check for multiple monitor indicators
        const indicators = this.detectMultiMonitorIndicators();
        if (indicators.hasMultipleMonitors) {
            const additionalMonitors = this.estimateAdditionalMonitors(indicators);
            screens.push(...additionalMonitors);
        }

        console.log(`🖥️ Final detection result: ${screens.length} monitor(s)`, screens);
        return screens;
    }

    private detectMultiMonitorIndicators(): any {
        const indicators = {
            hasMultipleMonitors: false,
            totalWidth: window.screen.width,
            totalHeight: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
            devicePixelRatio: window.devicePixelRatio,
            estimatedMonitorCount: 1
        };

        // Check if available screen space suggests multiple monitors
        if (window.screen.availWidth > window.screen.width * 1.5) {
            indicators.hasMultipleMonitors = true;
            indicators.estimatedMonitorCount = Math.round(window.screen.availWidth / window.screen.width);
            console.log(`📏 Available width (${window.screen.availWidth}) suggests ${indicators.estimatedMonitorCount} monitors`);
        }

        return indicators;
    }

    private estimateAdditionalMonitors(indicators: any): any[] {
        const additionalMonitors = [];
        const baseWidth = window.screen.width;
        const baseHeight = window.screen.height;

        // Estimate monitors to the right
        for (let i = 1; i < indicators.estimatedMonitorCount; i++) {
            additionalMonitors.push({
                id: `screen-${i}`,
                width: baseWidth,
                height: baseHeight,
                x: baseWidth * i,
                y: 0,
                primary: false,
                name: `Display ${i + 1} (Estimated)`,
                estimated: true,
                method: 'Heuristic estimation'
            });
        }

        console.log(`📊 Estimated ${additionalMonitors.length} additional monitor(s)`);
        return additionalMonitors;
    }

    private calculateOptimalGridLayout(screens: any[]): any {
        if (screens.length === 1) {
            return { cols: 3, rows: 3, centerX: 1, centerY: 1, minX: -1, maxX: 1, minY: -1, maxY: 1 };
        }
        
        // Calculate bounding box of all monitors
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        let primaryX = 0, primaryY = 0;
        
        screens.forEach(screen => {
            const relativeX = Math.round(screen.x / (screen.width || 1920));
            const relativeY = Math.round(screen.y / (screen.height || 1080));
            
            if (screen.primary) {
                primaryX = relativeX;
                primaryY = relativeY;
            }
            
            minX = Math.min(minX, relativeX);
            maxX = Math.max(maxX, relativeX);
            minY = Math.min(minY, relativeY);
            maxY = Math.max(maxY, relativeY);
        });
        
        // Add padding around the monitors
        const paddingX = 1;
        const paddingY = 1;
        
        minX -= paddingX;
        maxX += paddingX;
        minY -= paddingY;
        maxY += paddingY;
        
        const cols = maxX - minX + 1;
        const rows = maxY - minY + 1;
        const centerX = primaryX - minX;
        const centerY = primaryY - minY;
        
        return { cols, rows, centerX, centerY, minX, maxX, minY, maxY };
    }

    private updateGridCSS(gridLayout: HTMLElement, gridInfo: any): void {
        gridLayout.style.gridTemplateColumns = `repeat(${gridInfo.cols}, 1fr)`;
        gridLayout.style.gridTemplateRows = `repeat(${gridInfo.rows}, 1fr)`;
        
        const baseWidth = 120;
        const maxWidth = Math.min(800, baseWidth * gridInfo.cols);
        gridLayout.style.maxWidth = `${maxWidth}px`;
        gridLayout.style.aspectRatio = `${gridInfo.cols} / ${gridInfo.rows}`;
        
        if (gridInfo.cols > 3 || gridInfo.rows > 3) {
            gridLayout.classList.add('extended');
        } else {
            gridLayout.classList.remove('extended');
        }
    }

    private createDynamicGrid(gridLayout: HTMLElement, gridInfo: any, screens: any[]): void {
        console.log('🗺️ Creating dynamic grid with screens:', screens);
        
        // Create a map of screen positions
        const screenMap = new Map();
        screens.forEach((screen, index) => {
            const relativeX = Math.round(screen.x / (screen.width || 1920)) - gridInfo.minX;
            const relativeY = Math.round(screen.y / (screen.height || 1080)) - gridInfo.minY;
            const key = `${relativeX},${relativeY}`;
            
            console.log(`🖥️ Screen ${index} "${screen.name}": grid position (${relativeX}, ${relativeY})`);
            screenMap.set(key, screen);
        });
        
        // Create grid slots
        for (let row = 0; row < gridInfo.rows; row++) {
            for (let col = 0; col < gridInfo.cols; col++) {
                const screenKey = `${col},${row}`;
                const screen = screenMap.get(screenKey);
                
                const slot = document.createElement('div');
                slot.className = 'grid-slot';
                
                if (screen) {
                    if (screen.primary) {
                        slot.classList.add('center-slot');
                        slot.innerHTML = `
                            <div class="primary-monitor">
                                <div class="monitor-header">
                                    <span class="monitor-name">Primary Display</span>
                                    <span class="monitor-status">🖥️ Local</span>
                                </div>
                                <div class="monitor-info">
                                    <div class="monitor-resolution">${screen.width}×${screen.height}</div>
                                    <div class="monitor-position">Main Screen</div>
                                </div>
                            </div>
                        `;
                    } else {
                        slot.classList.add('occupied-local');
                        slot.innerHTML = `
                            <div class="local-monitor">
                                <div class="monitor-header">
                                    <span class="monitor-name">${screen.name}</span>
                                    <span class="monitor-status">🖥️ Local</span>
                                </div>
                                <div class="monitor-info">
                                    <div class="monitor-resolution">${screen.width}×${screen.height}</div>
                                    <div class="monitor-position">${screen.estimated ? 'Estimated' : 'Extended'} Display</div>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    const gridX = col - gridInfo.centerX;
                    const gridY = row - gridInfo.centerY;
                    const position = this.getPositionName(gridX, gridY);
                    slot.setAttribute('data-position', position);
                    slot.innerHTML = `<div class="slot-label">${this.getPositionEmoji(position)}</div>`;
                }
                
                gridLayout.appendChild(slot);
            }
        }
        
        console.log(`✅ Grid creation complete: ${gridInfo.rows * gridInfo.cols} slots created`);
    }

    private getPositionName(x: number, y: number): string {
        if (x === 0 && y === 0) return 'center';
        if (x === -1 && y === -1) return 'top-left';
        if (x === 0 && y === -1) return 'top';
        if (x === 1 && y === -1) return 'top-right';
        if (x === -1 && y === 0) return 'left';
        if (x === 1 && y === 0) return 'right';
        if (x === -1 && y === 1) return 'bottom-left';
        if (x === 0 && y === 1) return 'bottom';
        if (x === 1 && y === 1) return 'bottom-right';
        
        let name = '';
        if (y < 0) name += 'top';
        else if (y > 0) name += 'bottom';
        
        if (x < 0) name += name ? '-left' : 'left';
        else if (x > 0) name += name ? '-right' : 'right';
        
        const distance = Math.abs(x) + Math.abs(y);
        if (distance > 1) {
            name += `-${distance}`;
        }
        
        return name || 'center';
    }

    private getPositionEmoji(position: string): string {
        const emojiMap: Record<string, string> = {
            'top-left': '↖️',
            'top': '⬆️',
            'top-right': '↗️',
            'left': '⬅️',
            'center': '🖥️',
            'right': '➡️',
            'bottom-left': '↙️',
            'bottom': '⬇️',
            'bottom-right': '↘️'
        };
        
        return emojiMap[position] || '📱';
    }

    private updateDiscoveredComputers(): void {
        console.log('🔍 Updating discovered computers list...');
        // This method will be implemented when we add device discovery
    }

    private setupDragAndDrop(): void {
        console.log('🖱️ Setting up drag and drop functionality...');
        // This method will be implemented for drag and drop device positioning
    }

    private async runAutomatedMonitorTests(): Promise<void> {
        console.log('\n🧪 ===============================================');
        console.log('🧪 AUTOMATED MONITOR DETECTION TEST SUITE');
        console.log('🧪 ===============================================\n');

        // Test 1: Basic Screen Properties
        console.log('📊 TEST 1: Basic Screen Properties');
        console.log('-------------------------------------');
        console.log(`Screen width: ${window.screen.width}px`);
        console.log(`Screen height: ${window.screen.height}px`);
        console.log(`Available width: ${window.screen.availWidth}px`);
        console.log(`Available height: ${window.screen.availHeight}px`);
        console.log(`Device pixel ratio: ${window.devicePixelRatio}`);
        console.log(`Color depth: ${window.screen.colorDepth}bit`);
        
        // Calculate width ratio
        const widthRatio = window.screen.availWidth / window.screen.width;
        console.log(`Width ratio (avail/screen): ${widthRatio.toFixed(2)}`);
        
        if (widthRatio > 1.5) {
            console.log('✅ MULTIPLE MONITORS LIKELY DETECTED (width ratio > 1.5)');
        } else {
            console.log('❌ Single monitor detected (width ratio <= 1.5)');
        }
        console.log('');

        // Test 2: Screen Details API
        console.log('📊 TEST 2: Screen Details API');
        console.log('-------------------------------------');
        try {
            if ('getScreenDetails' in window) {
                console.log('✅ Screen Details API is available');
                
                try {
                    // Check permission first
                    const permission = await navigator.permissions.query({ name: 'window-management' as any });
                    console.log(`Permission state: ${permission.state}`);
                    
                    if (permission.state === 'granted') {
                        const screenDetails = await (window as any).getScreenDetails();
                        console.log(`✅ Screen Details API SUCCESS: Found ${screenDetails.screens.length} screen(s)`);
                        
                        screenDetails.screens.forEach((screen: any, i: number) => {
                            console.log(`  Screen ${i + 1}:`);
                            console.log(`    - Size: ${screen.width}x${screen.height}`);
                            console.log(`    - Position: (${screen.left}, ${screen.top})`);
                            console.log(`    - Primary: ${screen.primary ? 'Yes' : 'No'}`);
                            console.log(`    - Device Pixel Ratio: ${screen.devicePixelRatio || 'N/A'}`);
                        });
                    } else {
                        console.log('❌ Permission not granted. User interaction required.');
                        console.log('💡 Tip: Click anywhere on the page, then try "Test Screen Details API" button');
                    }
                } catch (apiError) {
                    console.log(`❌ Screen Details API error: ${apiError}`);
                }
            } else {
                console.log('❌ Screen Details API not available in this browser');
            }
        } catch (error) {
            console.log(`❌ Screen Details API test failed: ${error}`);
        }
        console.log('');

        // Test 3: Heuristic Detection
        console.log('📊 TEST 3: Heuristic Multi-Monitor Detection');
        console.log('-------------------------------------');
        const indicators = this.detectMultiMonitorIndicators();
        console.log(`Multi-monitor detected: ${indicators.hasMultipleMonitors ? 'YES' : 'NO'}`);
        console.log(`Estimated monitor count: ${indicators.estimatedMonitorCount}`);
        console.log(`Total width: ${indicators.totalWidth}px`);
        console.log(`Available width: ${indicators.availWidth}px`);
        console.log('');

        // Test 4: Full Detection Method
        console.log('📊 TEST 4: Complete Detection Method');
        console.log('-------------------------------------');
        try {
            const detectedScreens = await this.getAvailableScreens();
            console.log(`✅ Total screens detected: ${detectedScreens.length}`);
            
            detectedScreens.forEach((screen, i) => {
                console.log(`  Screen ${i + 1}: ${screen.name}`);
                console.log(`    - Size: ${screen.width}x${screen.height}`);
                console.log(`    - Position: (${screen.x}, ${screen.y})`);
                console.log(`    - Primary: ${screen.primary ? 'Yes' : 'No'}`);
                console.log(`    - Method: ${screen.method}`);
                console.log(`    - Estimated: ${screen.estimated ? 'Yes' : 'No'}`);
            });
        } catch (error) {
            console.log(`❌ Complete detection failed: ${error}`);
        }
        console.log('');

        // Test 5: Tauri Native Detection (if available)
        console.log('📊 TEST 5: Tauri Native Monitor Detection');
        console.log('-------------------------------------');
        try {
            if ((window as any).__TAURI__) {
                console.log('✅ Tauri environment detected');
                const { invoke } = (window as any).__TAURI__.tauri;
                
                try {
                    const monitors = await invoke('get_monitors');
                    console.log(`✅ Tauri found ${monitors.length} monitor(s):`);
                    
                    monitors.forEach((monitor: any, i: number) => {
                        console.log(`  Monitor ${i + 1}:`);
                        console.log(`    - Name: ${monitor.name}`);
                        console.log(`    - Size: ${monitor.size.width}x${monitor.size.height}`);
                        console.log(`    - Position: (${monitor.position.x}, ${monitor.position.y})`);
                        console.log(`    - Primary: ${monitor.is_primary ? 'Yes' : 'No'}`);
                        console.log(`    - Scale Factor: ${monitor.scale_factor || 'N/A'}`);
                    });
                } catch (tauriError) {
                    console.log(`❌ Tauri get_monitors failed: ${tauriError}`);
                    console.log('💡 This might mean the Rust backend needs monitor detection implementation');
                }
            } else {
                console.log('ℹ️ Not running in Tauri environment (web mode)');
                console.log('💡 For full monitor detection, run: npm run tauri dev');
            }
        } catch (error) {
            console.log(`❌ Tauri test failed: ${error}`);
        }
        console.log('');

        // Test 6: Window Positioning Test
        console.log('📊 TEST 6: Window Positioning Test');
        console.log('-------------------------------------');
        try {
            console.log('Testing if windows can be positioned beyond primary screen...');
            const testWindow = window.open('', '', 'width=1,height=1,left=9999,top=9999');
            
            if (testWindow) {
                setTimeout(() => {
                    const actualX = testWindow.screenX;
                    const actualY = testWindow.screenY;
                    console.log(`Test window requested position: (9999, 9999)`);
                    console.log(`Test window actual position: (${actualX}, ${actualY})`);
                    
                    if (actualX !== 9999 || actualY !== 9999) {
                        console.log('✅ Window positioning suggests multiple monitors may be present');
                    } else {
                        console.log('❌ Window positioning limited to primary screen');
                    }
                    
                    testWindow.close();
                }, 100);
            } else {
                console.log('❌ Could not open test window (popup blocked?)');
            }
        } catch (error) {
            console.log(`❌ Window positioning test failed: ${error}`);
        }

        console.log('\n🧪 ===============================================');
        console.log('🧪 TEST SUITE COMPLETE');
        console.log('🧪 ===============================================\n');

        // Summary and recommendations
        console.log('📋 SUMMARY & RECOMMENDATIONS:');
        console.log('-------------------------------------');
        
        const widthSuggestsMultiple = (window.screen.availWidth / window.screen.width) > 1.5;
        const hasScreenDetailsAPI = 'getScreenDetails' in window;
        const hasTauri = !!(window as any).__TAURI__;
        
        if (widthSuggestsMultiple) {
            console.log('✅ Your system likely has multiple monitors based on screen width');
            console.log('💡 Try clicking "Test Screen Details API" button to get detailed info');
        } else {
            console.log('ℹ️ Heuristics suggest single monitor setup');
        }
        
        if (hasScreenDetailsAPI) {
            console.log('✅ Your browser supports modern multi-monitor detection');
            console.log('💡 Click anywhere on the page to grant permission if needed');
        } else {
            console.log('❌ Browser lacks modern multi-monitor API support');
            console.log('💡 Consider using Chrome/Edge 100+ for best detection');
        }
        
        if (hasTauri) {
            console.log('✅ Running in Tauri - native monitor detection available');
        } else {
            console.log('ℹ️ Running in web mode - limited to browser APIs');
            console.log('💡 Run "npm run tauri dev" for native monitor detection');
        }
        
        console.log('');
    }

    private logToServer(message: string): void {
        // Send log to server console (this will appear in the dev server terminal)
        try {
            fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, timestamp: new Date().toISOString() })
            }).catch(() => {
                // Fallback: use console.log which should appear in browser dev tools
                console.log(`[SERVER LOG] ${message}`);
            });
        } catch {
            console.log(`[SERVER LOG] ${message}`);
        }
    }

    private async runSimpleMonitorTest(): Promise<void> {
        console.log('\n=== QUICK MONITOR DETECTION TEST ===\n');
        
        const results: string[] = [];
        
        // Test basic screen properties
        results.push('Screen Properties:');
        results.push(`- Width: ${window.screen.width}px`);
        results.push(`- Height: ${window.screen.height}px`);
        results.push(`- Available Width: ${window.screen.availWidth}px`);
        results.push(`- Available Height: ${window.screen.availHeight}px`);
        
        const ratio = window.screen.availWidth / window.screen.width;
        results.push(`- Width Ratio: ${ratio.toFixed(2)} (${ratio > 1.5 ? 'MULTI-MONITORS LIKELY' : 'SINGLE MONITOR'})`);
        
        // Test Screen Details API
        if ('getScreenDetails' in window) {
            results.push('\nScreen Details API: AVAILABLE');
            try {
                const permission = await navigator.permissions.query({ name: 'window-management' as any });
                results.push(`Permission: ${permission.state}`);
                
                if (permission.state === 'granted') {
                    const details = await (window as any).getScreenDetails();
                    results.push(`Screens found: ${details.screens.length}`);
                    details.screens.forEach((screen: any, i: number) => {
                        results.push(`  Screen ${i + 1}: ${screen.width}x${screen.height} at (${screen.left}, ${screen.top}) ${screen.primary ? '[PRIMARY]' : ''}`);
                    });
                } else {
                    results.push('Permission needed - click page first');
                }
            } catch (error) {
                results.push(`API Error: ${error}`);
            }
        } else {
            results.push('\nScreen Details API: NOT AVAILABLE');
        }
        
        // Test our detection method
        results.push('\nOur Detection Method:');
        try {
            const screens = await this.getAvailableScreens();
            results.push(`Total detected: ${screens.length} screens`);
            screens.forEach((screen, i) => {
                results.push(`  ${i + 1}. ${screen.name}: ${screen.width}x${screen.height} at (${screen.x}, ${screen.y}) [${screen.method}]`);
            });
        } catch (error) {
            results.push(`Detection error: ${error}`);
        }
        
        results.push('\n=== TEST COMPLETE ===');
        
        // Output to console
        results.forEach(line => console.log(line));
        
        // Also display in UI for easy reading
        this.displayTestResults(results);
    }

    private displayTestResults(results: string[]): void {
        // Create or update test results display
        let resultsDiv = document.getElementById('test-results-display');
        if (!resultsDiv) {
            resultsDiv = document.createElement('div');
            resultsDiv.id = 'test-results-display';
            resultsDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.95);
                color: #00ff00;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                padding: 15px;
                border: 2px solid #00ff00;
                border-radius: 5px;
                max-width: 600px;
                max-height: 400px;
                overflow-y: auto;
                z-index: 9999;
                white-space: pre-line;
            `;
            document.body.appendChild(resultsDiv);
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 5px;
                right: 10px;
                background: none;
                border: none;
                color: #00ff00;
                font-size: 16px;
                cursor: pointer;
            `;
            closeBtn.onclick = () => resultsDiv?.remove();
            resultsDiv.appendChild(closeBtn);
        }
        
        resultsDiv.innerHTML = `<button style="position: absolute; top: 5px; right: 10px; background: none; border: none; color: #00ff00; font-size: 16px; cursor: pointer;" onclick="this.parentElement.remove()">×</button><pre style="margin: 20px 0 0 0;">${results.join('\n')}</pre>`;
    }

    private showScreenDetailsPermissionOption(): void {
        console.log('🔐 Showing Screen Details API permission option');
        
        // Check if permission UI already exists
        let permissionUI = document.getElementById('screen-details-permission');
        if (permissionUI) {
            permissionUI.style.display = 'block';
            return;
        }
        
        // Create permission request UI
        permissionUI = document.createElement('div');
        permissionUI.id = 'screen-details-permission';
        permissionUI.className = 'permission-request-overlay';
        permissionUI.innerHTML = `
            <div class="permission-dialog">
                <div class="permission-icon">🖥️</div>
                <h3>Enhanced Multi-Monitor Detection</h3>
                <p>For accurate multi-monitor detection, this app can use the Screen Details API.</p>
                <p class="permission-note">This requires one-time permission to access window management features.</p>
                <div class="permission-buttons">
                    <button id="grant-screen-permission" class="btn-primary">
                        <span class="btn-icon">🔓</span>
                        Grant Permission
                    </button>
                    <button id="skip-screen-permission" class="btn-secondary">
                        <span class="btn-icon">⏭️</span>
                        Use Fallback Detection
                    </button>
                </div>
                <div class="permission-help">
                    <details>
                        <summary>Why is this needed?</summary>
                        <p>The Screen Details API provides precise information about all connected monitors, including their positions and properties. This enables accurate mouse/keyboard sharing across multiple displays.</p>
                    </details>
                </div>
            </div>
        `;
        
        document.body.appendChild(permissionUI);
        
        // Add event listeners
        const grantButton = document.getElementById('grant-screen-permission');
        const skipButton = document.getElementById('skip-screen-permission');
        
        grantButton?.addEventListener('click', async () => {
            await this.requestScreenDetailsPermission();
        });
        
        skipButton?.addEventListener('click', () => {
            this.hideScreenDetailsPermissionUI();
            this.showPermissionStatus('Using fallback detection methods', 'info');
        });
    }
    
    private async requestScreenDetailsPermission(): Promise<void> {
        try {
            console.log('🔓 Requesting Screen Details API permission...');
            
            // This requires a user gesture, so it should work when called from button click
            const screenDetails = await (window as any).getScreenDetails();
            console.log('✅ Screen Details API permission granted!', screenDetails);
            
            this.hideScreenDetailsPermissionUI();
            this.showPermissionStatus('Screen Details API enabled! Re-detecting monitors...', 'success');
            
            // Re-run monitor detection with new permission
            setTimeout(() => {
                this.detectAndUpdateMonitors();
                this.runSimpleMonitorTest();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Screen Details API permission denied:', error);
            this.showPermissionStatus('Permission denied. Using fallback detection.', 'warning');
            this.hideScreenDetailsPermissionUI();
        }
    }
    
    private hideScreenDetailsPermissionUI(): void {
        const permissionUI = document.getElementById('screen-details-permission');
        if (permissionUI) {
            permissionUI.style.display = 'none';
        }
    }
    
    private showPermissionStatus(message: string, type: 'success' | 'info' | 'warning' | 'error'): void {
        console.log(`📢 Permission status: ${message}`);
        
        // Show status in the test results overlay
        const testOverlay = document.getElementById('test-results-overlay');
        if (testOverlay) {
            const statusDiv = document.createElement('div');
            statusDiv.className = `permission-status ${type}`;
            statusDiv.innerHTML = `
                <div class="status-icon">
                    ${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️'}
                </div>
                <div class="status-message">${message}</div>
            `;
            
            testOverlay.insertBefore(statusDiv, testOverlay.firstChild);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.parentNode.removeChild(statusDiv);
                }
            }, 5000);
        }
    }
}

// Initialize the application
console.log('🎯 About to instantiate NoBordersApp...');
new NoBordersApp();
console.log('🎯 NoBordersApp instantiated');