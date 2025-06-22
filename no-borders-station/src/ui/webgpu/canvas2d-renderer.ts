/**
 * Canvas2D Fallback Renderer for No-Borders UI
 * Used when WebGPU is not available
 */

interface RenderStats {
    frameTime: number;
    fps: number;
    drawCalls: number;
    gpuMemoryUsed: number;
}

export class Canvas2DRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private initialized = false;
    private lastFrameTime = 0;
    private frameCount = 0;
    private stats: RenderStats = {
        frameTime: 0,
        fps: 0,
        drawCalls: 0,
        gpuMemoryUsed: 0
    };

    // Animation state
    private animationTime = 0;
    private videoFrame: ImageData | HTMLVideoElement | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.ctx = ctx;
    }

    async initialize(): Promise<boolean> {
        try {
            // Enable image smoothing for better quality
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';

            this.initialized = true;
            console.log('✅ Canvas2D Fallback Renderer initialized');
            return true;
        } catch (error) {
            console.error('❌ Canvas2D initialization failed:', error);
            return false;
        }
    }

    public render(deltaTime: number): void {
        if (!this.initialized) return;

        const currentTime = performance.now();
        this.frameCount++;
        this.animationTime += deltaTime;

        // Update performance stats
        this.stats.frameTime = deltaTime;
        if (currentTime - this.lastFrameTime >= 1000) {
            this.stats.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render background
        this.renderBackground();

        // Render video if available
        if (this.videoFrame) {
            this.renderVideo();
        }

        // Render UI overlay
        this.renderUI();

        this.stats.drawCalls = 3; // Background + Video + UI
    }

    private renderBackground(): void {
        const { width, height } = this.canvas;
        
        // Create animated gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        
        // Animate colors
        const pulse = Math.sin(this.animationTime * 0.002) * 0.1 + 0.9;
        const r1 = Math.floor(13 * pulse);
        const g1 = Math.floor(13 * pulse);
        const b1 = Math.floor(25 * pulse);
        
        const r2 = Math.floor(25 * pulse);
        const g2 = Math.floor(13 * pulse);
        const b2 = Math.floor(38 * pulse);

        gradient.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
        gradient.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);

        // Add subtle pattern
        this.ctx.globalAlpha = 0.1;
        this.ctx.fillStyle = '#ffffff';
        
        const time = this.animationTime * 0.001;
        for (let x = 0; x < width; x += 40) {
            for (let y = 0; y < height; y += 40) {
                const offset = Math.sin(time + x * 0.01 + y * 0.01) * 10;
                this.ctx.fillRect(x + offset, y + offset, 2, 2);
            }
        }
        
        this.ctx.globalAlpha = 1.0;
    }

    private renderVideo(): void {
        if (!this.videoFrame) return;

        const { width, height } = this.canvas;
        
        try {
            if (this.videoFrame instanceof ImageData) {
                // Create temporary canvas for ImageData
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.videoFrame.width;
                tempCanvas.height = this.videoFrame.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                if (tempCtx) {
                    tempCtx.putImageData(this.videoFrame, 0, 0);
                    
                    // Scale to fit canvas while maintaining aspect ratio
                    const aspectRatio = this.videoFrame.width / this.videoFrame.height;
                    const canvasAspectRatio = width / height;
                    
                    let renderWidth = width;
                    let renderHeight = height;
                    let offsetX = 0;
                    let offsetY = 0;
                    
                    if (aspectRatio > canvasAspectRatio) {
                        renderHeight = width / aspectRatio;
                        offsetY = (height - renderHeight) / 2;
                    } else {
                        renderWidth = height * aspectRatio;
                        offsetX = (width - renderWidth) / 2;
                    }
                    
                    this.ctx.drawImage(tempCanvas, offsetX, offsetY, renderWidth, renderHeight);
                }
            } else if (this.videoFrame instanceof HTMLVideoElement) {
                // Draw video element directly
                const aspectRatio = this.videoFrame.videoWidth / this.videoFrame.videoHeight;
                const canvasAspectRatio = width / height;
                
                let renderWidth = width;
                let renderHeight = height;
                let offsetX = 0;
                let offsetY = 0;
                
                if (aspectRatio > canvasAspectRatio) {
                    renderHeight = width / aspectRatio;
                    offsetY = (height - renderHeight) / 2;
                } else {
                    renderWidth = height * aspectRatio;
                    offsetX = (width - renderWidth) / 2;
                }
                
                this.ctx.drawImage(this.videoFrame, offsetX, offsetY, renderWidth, renderHeight);
            }
        } catch (error) {
            console.warn('Failed to render video frame:', error);
        }
    }

    private renderUI(): void {
        const { width, height } = this.canvas;
        
        // Draw status text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px "Inter", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // Render stats
        const stats = [
            `FPS: ${this.stats.fps}`,
            `Frame Time: ${this.stats.frameTime.toFixed(2)}ms`,
            `Renderer: Canvas2D (Fallback)`
        ];
        
        let y = 20;
        for (const stat of stats) {
            // Draw text shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillText(stat, 21, y + 1);
            
            // Draw text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(stat, 20, y);
            
            y += 24;
        }
        
        // Draw connection status indicator
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.beginPath();
        this.ctx.arc(width - 40, 30, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Connection status text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('Disconnected', width - 60, 22);
        
        // Draw branding
        this.ctx.textAlign = 'center';
        this.ctx.font = '24px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillText('No Borders', width / 2, height / 2 - 50);
        
        this.ctx.font = '14px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fillText('Ultra-Low Latency Screen Sharing', width / 2, height / 2 - 20);
    }

    public updateVideoTexture(imageData: ImageData | HTMLVideoElement): void {
        this.videoFrame = imageData;
    }

    public resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    public getStats(): RenderStats {
        return { ...this.stats };
    }

    public destroy(): void {
        this.videoFrame = null;
        this.initialized = false;
    }
}
