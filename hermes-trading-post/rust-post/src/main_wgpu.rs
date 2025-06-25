//! Ultra-fast 3D candle renderer with wgpu and Coinbase WebSocket
//! Renders a 3D box that changes size/color based on real-time BTC price

use std::sync::{Arc, Mutex};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use winit::{
    event::*,
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};
use wgpu::util::DeviceExt;
use cgmath::{Matrix4, Deg, perspective, Point3, Vector3};

// Candle data structure
#[derive(Debug, Clone, Deserialize)]
struct Candle {
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: f64,
}

// Vertex data for 3D candle
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct Vertex {
    position: [f32; 3],
    color: [f32; 3],
}

impl Vertex {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<Vertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x3,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x3,
                },
            ],
        }
    }
}

// Generate 3D candle vertices (a box)
fn generate_candle_vertices(candle: &Candle) -> (Vec<Vertex>, Vec<u16>) {
    // Candle height is proportional to percent change (close - open) / open
    let base: f32 = -0.5; // Center the candle vertically
    let open_f32 = candle.open as f32;
    let close_f32 = candle.close as f32;
    let percent_change = if open_f32.abs() > 1e-6 {
        (close_f32 - open_f32) / open_f32
    } else {
        0.0
    };
    let scale: f32 = 2.0; // Visual scale for percent change
    let height = (percent_change * scale).clamp(-1.0, 1.0); // Clamp for sanity
    let s = 0.2; // width/depth
    // Color: green if price is up, red if down
    let color = if close_f32 >= open_f32 {
        [0.0, 1.0, 0.0] // green
    } else {
        [1.0, 0.0, 0.0] // red
    };
    let top = base + height.max(0.05); // Ensure minimum height
    let vertices = vec![
        // Front face
        Vertex { position: [-s, base,  s], color },
        Vertex { position: [ s, base,  s], color },
        Vertex { position: [ s, top,  s], color },
        Vertex { position: [-s, top,  s], color },
        // Back face
        Vertex { position: [-s, base, -s], color },
        Vertex { position: [ s, base, -s], color },
        Vertex { position: [ s, top, -s], color },
        Vertex { position: [-s, top, -s], color },
    ];
    let indices = vec![
        0, 1, 2, 2, 3, 0, // Front
        1, 5, 6, 6, 2, 1, // Right
        5, 4, 7, 7, 6, 5, // Back
        4, 0, 3, 3, 7, 4, // Left
        3, 2, 6, 6, 7, 3, // Top
        4, 5, 1, 1, 0, 4, // Bottom
    ];
    (vertices, indices)
}

// Coinbase WebSocket task
async fn websocket_task(tx: mpsc::Sender<Candle>) {
    use tokio_tungstenite::connect_async;
    use tungstenite::Message;
    use serde_json::Value;

    let url = "wss://ws-feed.exchange.coinbase.com";
    
    println!("Connecting to Coinbase WebSocket...");
    
    let (ws_stream, _) = match connect_async(url).await {
        Ok(stream) => stream,
        Err(e) => {
            eprintln!("Failed to connect: {}", e);
            return;
        }
    };
    
    let (mut write, mut read) = ws_stream.split();

    // Subscribe to ticker for real-time updates
    let subscribe_msg = serde_json::json!({
        "type": "subscribe",
        "channels": [{
            "name": "ticker",
            "product_ids": ["BTC-USD"]
        }]
    });
    
    if let Err(e) = write.send(Message::Text(subscribe_msg.to_string())).await {
        eprintln!("Failed to subscribe: {}", e);
        return;
    }

    // Track candle data
    let mut current_candle = Candle {
        open: 100000.0,
        high: 100000.0,
        low: 100000.0,
        close: 100000.0,
        volume: 0.0,
    };

    while let Some(msg) = read.next().await {
        if let Ok(Message::Text(txt)) = msg {
            if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                if json["type"] == "ticker" && json["product_id"] == "BTC-USD" {
                    if let Some(price_str) = json["price"].as_str() {
                        if let Ok(price) = price_str.parse::<f64>() {
                            // Update candle with latest price
                            current_candle.close = price;
                            current_candle.high = current_candle.high.max(price);
                            current_candle.low = current_candle.low.min(price);
                            
                            // Send update immediately for fast rendering
                            let _ = tx.send(current_candle.clone()).await;
                        }
                    }
                }
            }
        }
    }
}

// Shader code
const SHADER: &str = r#"
// Vertex shader
struct CameraUniform {
    view_proj: mat4x4<f32>,
}
@group(0) @binding(0)
var<uniform> camera: CameraUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec3<f32>,
}

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.color = model.color;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    return out;
}

// Fragment shader
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(in.color, 1.0);
}
"#;

#[repr(C)]
#[derive(Debug, Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
struct CameraUniform {
    view_proj: [[f32; 4]; 4],
}

impl CameraUniform {
    fn new() -> Self {
        use cgmath::SquareMatrix;
        Self {
            view_proj: cgmath::Matrix4::identity().into(),
        }
    }

    fn update_view_proj(&mut self, aspect: f32, rotation: f32) {
        // Camera farther away for 3x zoom out
        let distance = 3.0; // was 2.0, now 3x farther
        let eye = Point3::new(distance * rotation.cos(), 3.0, distance * rotation.sin());
        let target = Point3::new(0.0, 0.5, 0.0);
        let up = Vector3::unit_y();
        let view = Matrix4::look_at_rh(eye, target, up);
        let proj = perspective(Deg(45.0), aspect, 0.1, 100.0);
        self.view_proj = (proj * view).into();
    }
}

struct State<'a> {
    surface: wgpu::Surface<'a>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    size: winit::dpi::PhysicalSize<u32>,
    render_pipeline: wgpu::RenderPipeline,
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    num_indices: u32,
    camera_uniform: CameraUniform,
    camera_buffer: wgpu::Buffer,
    camera_bind_group: wgpu::BindGroup,
}

impl<'a> State<'a> {
    async fn new(window: &'a winit::window::Window) -> Self {
        let size = window.inner_size();
        
        // Create instance
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::VULKAN, // Force Vulkan backend for NVIDIA GPU
            ..Default::default()
        });
        
        let surface = instance.create_surface(window).unwrap();
        
        let adapter = instance.request_adapter(
            &wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            },
        ).await.unwrap();
        
        let (device, queue) = adapter.request_device(
            &wgpu::DeviceDescriptor {
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                label: None,
            },
            None,
        ).await.unwrap();
        
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps.formats.iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(surface_caps.formats[0]);
        
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width,
            height: size.height,
            present_mode: wgpu::PresentMode::AutoNoVsync, // FAST updates!
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2, // Added for wgpu 0.19+
        };
        surface.configure(&device, &config);
        
        // Create shader
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Shader"),
            source: wgpu::ShaderSource::Wgsl(SHADER.into()),
        });
        
        // Camera
        let mut camera_uniform = CameraUniform::new();
        camera_uniform.update_view_proj(config.width as f32 / config.height as f32, 0.0);
        
        let camera_buffer = device.create_buffer_init(
            &wgpu::util::BufferInitDescriptor {
                label: Some("Camera Buffer"),
                contents: bytemuck::cast_slice(&[camera_uniform]),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            }
        );
        
        let camera_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }
            ],
            label: Some("camera_bind_group_layout"),
        });
        
        let camera_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &camera_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: camera_buffer.as_entire_binding(),
                }
            ],
            label: Some("camera_bind_group"),
        });
        
        // Pipeline
        let render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Render Pipeline Layout"),
            bind_group_layouts: &[&camera_bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Render Pipeline"),
            layout: Some(&render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: "vs_main",
                buffers: &[Vertex::desc()],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: "fs_main",
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: Some(wgpu::Face::Back),
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState {
                count: 1,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
        });
        
        // Initial candle
        let initial_candle = Candle {
            open: 100000.0,
            high: 101000.0,
            low: 99000.0,
            close: 100500.0,
            volume: 1.0,
        };
        
        let (vertices, indices) = generate_candle_vertices(&initial_candle);
        
        let vertex_buffer = device.create_buffer_init(
            &wgpu::util::BufferInitDescriptor {
                label: Some("Vertex Buffer"),
                contents: bytemuck::cast_slice(&vertices),
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            }
        );
        
        let index_buffer = device.create_buffer_init(
            &wgpu::util::BufferInitDescriptor {
                label: Some("Index Buffer"),
                contents: bytemuck::cast_slice(&indices),
                usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
            }
        );
        
        let num_indices = indices.len() as u32;
        
        Self {
            surface,
            device,
            queue,
            config,
            size,
            render_pipeline,
            vertex_buffer,
            index_buffer,
            num_indices,
            camera_uniform,
            camera_buffer,
            camera_bind_group,
        }
    }
    
    fn update_candle(&mut self, candle: &Candle) {
        let (vertices, indices) = generate_candle_vertices(candle);
        
        // Update buffers
        self.queue.write_buffer(&self.vertex_buffer, 0, bytemuck::cast_slice(&vertices));
        self.queue.write_buffer(&self.index_buffer, 0, bytemuck::cast_slice(&indices));
        self.num_indices = indices.len() as u32;
    }
    
    fn render(&mut self, rotation: f32) -> Result<(), wgpu::SurfaceError> {
        self.camera_uniform.update_view_proj(self.config.width as f32 / self.config.height as f32, rotation);
        self.queue.write_buffer(&self.camera_buffer, 0, bytemuck::cast_slice(&[self.camera_uniform]));
        let output = match self.surface.get_current_texture() {
            Ok(tex) => tex,
            Err(e) => {
                eprintln!("Failed to acquire next swap chain texture: {:?}", e);
                return Err(e);
            }
        };
        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Encoder"),
        });
        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.2, g: 0.2, b: 0.3, a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                ..Default::default()
            });
            render_pass.set_pipeline(&self.render_pipeline);
            render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
            render_pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
            render_pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint16);
            render_pass.draw_indexed(0..self.num_indices, 0, 0..1);
        }
        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();
        Ok(())
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();
    
    println!("3D Candle Renderer - Ultra Fast Edition!");
    println!("Connecting to Coinbase for real-time BTC prices...");
    
    let event_loop = EventLoop::new().unwrap();
    let window = WindowBuilder::new()
        .with_title("3D BTC Candle - Real-time")
        .build(&event_loop)
        .unwrap();
    
    let mut state = State::new(&window).await;
    
    // Shared candle data
    let candle_data = Arc::new(Mutex::new(Candle {
        open: 100000.0,
        high: 100000.0,
        low: 100000.0,
        close: 100000.0,
        volume: 0.0,
    }));
    
    // WebSocket channel
    let (tx, mut rx) = mpsc::channel::<Candle>(100);
    
    // Spawn WebSocket task
    tokio::spawn(async move {
        websocket_task(tx).await;
    });
    
    let mut fps_counter = 0;
    let mut fps_timer = std::time::Instant::now();
    let mut rotation: f32 = 0.0;
    
    event_loop.run(|event, target| {
        target.set_control_flow(ControlFlow::Poll);
        match event {
            Event::WindowEvent {
                ref event,
                window_id,
            } if window_id == window.id() => match event {
                WindowEvent::CloseRequested => target.exit(),
                WindowEvent::Resized(physical_size) => {
                    state.size = *physical_size;
                    state.config.width = physical_size.width;
                    state.config.height = physical_size.height;
                    state.surface.configure(&state.device, &state.config);
                    window.request_redraw(); // Always redraw on resize
                }
                WindowEvent::RedrawRequested => {
                    // Always try to render, even if no new data
                    match state.render(rotation) {
                        Ok(_) => {}
                        Err(wgpu::SurfaceError::Lost) => {
                            state.surface.configure(&state.device, &state.config);
                            window.request_redraw();
                        }
                        Err(wgpu::SurfaceError::OutOfMemory) => target.exit(),
                        Err(_) => {
                            // Fallback: clear the screen to a solid color
                            let output = match state.surface.get_current_texture() {
                                Ok(tex) => tex,
                                Err(_) => return,
                            };
                            let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
                            let mut encoder = state.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                                label: Some("Fallback Clear Encoder"),
                            });
                            {
                                let _ = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                                    label: Some("Fallback Clear Pass"),
                                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                                        view: &view,
                                        resolve_target: None,
                                        ops: wgpu::Operations {
                                            load: wgpu::LoadOp::Clear(wgpu::Color {
                                                r: 0.1, g: 0.1, b: 0.2, a: 1.0,
                                            }),
                                            store: wgpu::StoreOp::Store,
                                        },
                                    })],
                                    depth_stencil_attachment: None,
                                    ..Default::default()
                                });
                            }
                            state.queue.submit(std::iter::once(encoder.finish()));
                            output.present();
                        }
                    }
                }
                _ => {}
            },
            Event::AboutToWait => {
                // Check for new candle data
                let mut updated = false;
                while let Ok(new_candle) = rx.try_recv() {
                    if let Ok(mut candle) = candle_data.lock() {
                        *candle = new_candle;
                        updated = true;
                    }
                }
                // Update candle geometry if data changed
                if updated {
                    if let Ok(candle) = candle_data.lock() {
                        state.update_candle(&*candle);
                        // Update window title
                        let title = format!(
                            "3D BTC | ${:.0} | {} | FPS: {}",
                            candle.close,
                            if candle.close > candle.open { "🟢" } else { "🔴" },
                            fps_counter
                        );
                        window.set_title(&title);
                    }
                }
                // Always render for smooth rotation
                rotation += 0.002; // Slower rotation
                state.camera_uniform.update_view_proj(state.config.width as f32 / state.config.height as f32, rotation);
                window.request_redraw();
                // FPS counter
                fps_counter += 1;
                if fps_timer.elapsed().as_secs() >= 1 {
                    fps_timer = std::time::Instant::now();
                    fps_counter = 0;
                }
            }
            _ => {}
        }
    }).unwrap();
}