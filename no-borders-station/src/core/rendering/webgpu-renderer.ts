// WebGPU Renderer for No-Borders
// Handles GPU-accelerated rendering and cursor management

export interface GPUContextInfo {
  adapter: GPUAdapter;
  device: GPUDevice;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

export interface CursorSettings {
  size: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  opacity: number;
  trailEnabled: boolean;
  trailLength: number;
  glowEffect: boolean;
  glowRadius: number;
  glowColor: string;
}

export class WebGPURenderer {
  private gpu: GPUContextInfo | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private cursor: {
    position: { x: number; y: number };
    settings: CursorSettings;
    buffer: GPUBuffer | null;
    texture: GPUTexture | null;
  };
  private isInitialized = false;

  constructor() {
    this.cursor = {
      position: { x: 0, y: 0 },
      settings: this.getDefaultCursorSettings(),
      buffer: null,
      texture: null
    };
  }

  async initialize(): Promise<void> {
    console.log('🎮 Initializing WebGPU...');

    // Check WebGPU support
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    try {
      // Request adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        throw new Error('Failed to get GPU adapter');
      }

      console.log('✅ GPU Adapter acquired:', adapter.info);

      // Request device
      const device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {}
      });

      console.log('✅ GPU Device acquired');

      // Create canvas
      const canvas = this.createCanvas();
      const context = canvas.getContext('webgpu');
      
      if (!context) {
        throw new Error('Failed to get WebGPU context');
      }

      // Configure context
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied'
      });

      this.gpu = {
        adapter,
        device,
        canvas,
        context,
        format
      };

      // Initialize rendering pipeline
      await this.createRenderPipeline();
      
      // Initialize cursor
      await this.initializeCursor();

      this.isInitialized = true;
      console.log('✅ WebGPU renderer initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WebGPU:', error);
      throw error;
    }
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.id = 'no-borders-canvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 10000;
    `;
    
    // Make canvas high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    document.body.appendChild(canvas);
    return canvas;
  }

  private async createRenderPipeline(): Promise<void> {
    if (!this.gpu) throw new Error('WebGPU not initialized');

    // Vertex shader for cursor rendering
    const vertexShader = `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      }

      @vertex
      fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var pos = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>(-1.0,  1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>( 1.0,  1.0),
          vec2<f32>(-1.0,  1.0)
        );
        
        var uv = array<vec2<f32>, 6>(
          vec2<f32>(0.0, 1.0),
          vec2<f32>(1.0, 1.0),
          vec2<f32>(0.0, 0.0),
          vec2<f32>(1.0, 1.0),
          vec2<f32>(1.0, 0.0),
          vec2<f32>(0.0, 0.0)
        );

        var output: VertexOutput;
        output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        output.uv = uv[vertexIndex];
        return output;
      }
    `;

    // Fragment shader for cursor rendering
    const fragmentShader = `
      @fragment
      fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let center = vec2<f32>(0.5, 0.5);
        let distance = length(uv - center);
        
        // Create cursor shape (circle with outline)
        let radius = 0.4;
        let outlineWidth = 0.1;
        
        var color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        
        if (distance < radius) {
          // Main cursor color
          color = vec4<f32>(1.0, 1.0, 1.0, 1.0);
        } else if (distance < radius + outlineWidth) {
          // Outline
          color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }
        
        // Smooth edges
        let smooth = 0.01;
        color.a *= 1.0 - smoothstep(radius + outlineWidth - smooth, radius + outlineWidth + smooth, distance);
        
        return color;
      }
    `;

    // Create shaders
    const vertexShaderModule = this.gpu.device.createShaderModule({
      code: vertexShader
    });

    const fragmentShaderModule = this.gpu.device.createShaderModule({
      code: fragmentShader
    });

    // Create render pipeline
    this.renderPipeline = this.gpu.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexShaderModule,
        entryPoint: 'main'
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: 'main',
        targets: [{
          format: this.gpu.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });

    console.log('✅ Render pipeline created');
  }

  private async initializeCursor(): Promise<void> {
    if (!this.gpu) return;

    // Create cursor uniform buffer
    this.cursor.buffer = this.gpu.device.createBuffer({
      size: 64, // 4 * 16 bytes for transform matrix
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    console.log('✅ Cursor initialized');
  }

  updateCursor(x: number, y: number): void {
    this.cursor.position = { x, y };
  }

  setCursorSettings(settings: Partial<CursorSettings>): void {
    this.cursor.settings = { ...this.cursor.settings, ...settings };
  }

  render(): void {
    if (!this.isInitialized || !this.gpu || !this.renderPipeline) return;

    const commandEncoder = this.gpu.device.createCommandEncoder();
    const textureView = this.gpu.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.draw(6); // 6 vertices for 2 triangles (quad)
    renderPass.end();

    this.gpu.device.queue.submit([commandEncoder.finish()]);
  }

  resize(): void {
    if (!this.gpu) return;

    const dpr = window.devicePixelRatio || 1;
    this.gpu.canvas.width = window.innerWidth * dpr;
    this.gpu.canvas.height = window.innerHeight * dpr;
  }

  private getDefaultCursorSettings(): CursorSettings {
    return {
      size: 32,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 2,
      opacity: 1.0,
      trailEnabled: false,
      trailLength: 5,
      glowEffect: false,
      glowRadius: 10,
      glowColor: '#00FFFF'
    };
  }

  async cleanup(): Promise<void> {
    if (this.cursor.buffer) {
      this.cursor.buffer.destroy();
    }
    
    if (this.cursor.texture) {
      this.cursor.texture.destroy();
    }

    if (this.gpu?.canvas) {
      this.gpu.canvas.remove();
    }

    this.isInitialized = false;
    console.log('✅ WebGPU renderer cleaned up');
  }
}

// Handle window resize
window.addEventListener('resize', () => {
  // This will be handled by the main app
});
