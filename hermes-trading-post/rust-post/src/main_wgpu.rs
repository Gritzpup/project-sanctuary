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
use reqwest;

// Candle data structure
#[derive(Debug, Clone, Deserialize)]
struct Candle {
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    _volume: f64, // Suppress unused warning
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

// Generate 3D candle vertices (a box) positioned at actual price levels
fn generate_candle_vertices(candle: &Candle) -> (Vec<Vertex>, Vec<u16>) {
    // Get actual price values
    let open_f32 = candle.open as f32;
    let close_f32 = candle.close as f32;
    let high_f32 = candle.high as f32;
    let low_f32 = candle.low as f32;
    
    // Scale BTC prices for better visibility
    // Center around current price range and scale up significantly
    let base_price = 106400.0; // Updated to current price range
    let price_scale: f32 = 0.05; // Scale for reasonable height differences
    
    // Convert actual prices to Y positions (centered around 0)
    let open_y = (open_f32 - base_price) * price_scale;
    let close_y = (close_f32 - base_price) * price_scale;
    let high_y = (high_f32 - base_price) * price_scale;
    let low_y = (low_f32 - base_price) * price_scale;
    
    // Candle body goes from open to close
    let mut body_bottom = open_y.min(close_y);
    let mut body_top = open_y.max(close_y);
    
    // Ensure minimum body height for visibility
    if (body_top - body_bottom).abs() < 0.2 {
        let mid = (body_top + body_bottom) / 2.0;
        body_top = mid + 0.1;
        body_bottom = mid - 0.1;
    }
    
    let s = 0.3; // Candle body width - proportional to spacing
    let ws = 0.05; // Wick width
    
    // Color: vibrant green if price is up, vibrant red if down, gray for no change
    let color = if close_f32 > open_f32 {
        [0.2, 1.0, 0.2] // Vibrant green
    } else if close_f32 < open_f32 {
        [1.0, 0.2, 0.2] // Vibrant red  
    } else {
        [0.7, 0.7, 0.7] // Light gray
    };
    
    let mut vertices = vec![
        // Candle body (8 vertices)
        // Front face
        Vertex { position: [-s, body_bottom,  s], color },
        Vertex { position: [ s, body_bottom,  s], color },
        Vertex { position: [ s, body_top,  s], color },
        Vertex { position: [-s, body_top,  s], color },
        // Back face
        Vertex { position: [-s, body_bottom, -s], color },
        Vertex { position: [ s, body_bottom, -s], color },
        Vertex { position: [ s, body_top, -s], color },
        Vertex { position: [-s, body_top, -s], color },
    ];
    
    let mut indices = vec![
        // Body indices
        0, 1, 2, 2, 3, 0, // Front
        1, 5, 6, 6, 2, 1, // Right
        5, 4, 7, 7, 6, 5, // Back
        4, 0, 3, 3, 7, 4, // Left
        3, 2, 6, 6, 7, 3, // Top
        4, 5, 1, 1, 0, 4, // Bottom
    ];
    
    // Add top wick if high > body_top
    if high_y > body_top + 0.001 {
        let wick_start_idx = vertices.len() as u16;
        vertices.extend_from_slice(&[
            // Top wick (thin vertical line)
            Vertex { position: [-ws, body_top,  ws], color },
            Vertex { position: [ ws, body_top,  ws], color },
            Vertex { position: [ ws, high_y,  ws], color },
            Vertex { position: [-ws, high_y,  ws], color },
            Vertex { position: [-ws, body_top, -ws], color },
            Vertex { position: [ ws, body_top, -ws], color },
            Vertex { position: [ ws, high_y, -ws], color },
            Vertex { position: [-ws, high_y, -ws], color },
        ]);
        
        // Add wick indices
        let w = wick_start_idx;
        indices.extend_from_slice(&[
            w, w+1, w+2, w+2, w+3, w,     // Front
            w+1, w+5, w+6, w+6, w+2, w+1, // Right
            w+5, w+4, w+7, w+7, w+6, w+5, // Back
            w+4, w, w+3, w+3, w+7, w+4,   // Left
            w+3, w+2, w+6, w+6, w+7, w+3, // Top
            w+4, w+5, w+1, w+1, w, w+4,   // Bottom
        ]);
    }
    
    // Add bottom wick if low < body_bottom
    if low_y < body_bottom - 0.001 {
        let wick_start_idx = vertices.len() as u16;
        vertices.extend_from_slice(&[
            // Bottom wick (thin vertical line)
            Vertex { position: [-ws, low_y,  ws], color },
            Vertex { position: [ ws, low_y,  ws], color },
            Vertex { position: [ ws, body_bottom,  ws], color },
            Vertex { position: [-ws, body_bottom,  ws], color },
            Vertex { position: [-ws, low_y, -ws], color },
            Vertex { position: [ ws, low_y, -ws], color },
            Vertex { position: [ ws, body_bottom, -ws], color },
            Vertex { position: [-ws, body_bottom, -ws], color },
        ]);
        
        // Add wick indices
        let w = wick_start_idx;
        indices.extend_from_slice(&[
            w, w+1, w+2, w+2, w+3, w,     // Front
            w+1, w+5, w+6, w+6, w+2, w+1, // Right
            w+5, w+4, w+7, w+7, w+6, w+5, // Back
            w+4, w, w+3, w+3, w+7, w+4,   // Left
            w+3, w+2, w+6, w+6, w+7, w+3, // Top
            w+4, w+5, w+1, w+1, w, w+4,   // Bottom
        ]);
    }
    
    (vertices, indices)
}

// Message types from websocket
enum CandleUpdate {
    LiveUpdate(Candle),
    NewMinuteCandle(Candle),
}

// Coinbase WebSocket task
async fn websocket_task(tx: mpsc::Sender<CandleUpdate>) {
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

    // Track candle data - wait for first price
    let mut current_candle: Option<Candle> = None;
    
    // Track when to create new candle
    let mut candle_start_time = std::time::Instant::now();
    let candle_duration = std::time::Duration::from_secs(60); // 1 minute candles

    while let Some(msg) = read.next().await {
        if let Ok(Message::Text(txt)) = msg {
            if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                if json["type"] == "ticker" && json["product_id"] == "BTC-USD" {
                    if let Some(price_str) = json["price"].as_str() {
                        if let Ok(price) = price_str.parse::<f64>() {
                            match &mut current_candle {
                                None => {
                                    // First price - create initial candle
                                    current_candle = Some(Candle {
                                        open: price,
                                        high: price,
                                        low: price,
                                        close: price,
                                        _volume: 0.0,
                                    });
                                    candle_start_time = std::time::Instant::now();
                                }
                                Some(candle) => {
                                    // Check if we need a new candle
                                    if candle_start_time.elapsed() >= candle_duration {
                                        // Send the completed candle
                                        let _ = tx.send(CandleUpdate::NewMinuteCandle(candle.clone())).await;
                                        
                                        // Start new candle
                                        *candle = Candle {
                                            open: price,
                                            high: price,
                                            low: price,
                                            close: price,
                                            _volume: 0.0,
                                        };
                                        candle_start_time = std::time::Instant::now();
                                    } else {
                                        // Update current candle - keep open price constant
                                        candle.close = price;
                                        candle.high = candle.high.max(price);
                                        candle.low = candle.low.min(price);
                                    }
                                }
                            }
                            // Send update immediately for fast rendering
                            if let Some(candle) = &current_candle {
                                let _ = tx.send(CandleUpdate::LiveUpdate(candle.clone())).await;
                            }
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

    fn update_view_proj(&mut self, aspect: f32, _rotation: f32) {
        // Camera with good zoom level
        let spacing = 1.5;
        let num_candles = 40.0;
        let center_x = -(num_candles * spacing) / 2.0 + 15.0; // Center on recent candles
        let distance = 75.0; // Good balance between zoom and overview
        let height = 20.0; // Good viewing angle
        let eye = Point3::new(center_x + 5.0, height, distance); // Slight offset for perspective
        let target = Point3::new(center_x, 0.0, 0.0); // Look at center of candles
        let up = Vector3::unit_y();
        let view = Matrix4::look_at_rh(eye, target, up);
        let proj = perspective(Deg(38.0), aspect, 0.1, 300.0); // Good FOV
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
    historical_candles: Vec<Candle>, // Store historical candles
}

impl<'a> State<'a> {
    async fn new(window: &'a winit::window::Window, historical_candles: Vec<Candle>) -> Self {
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
        
        // Initial candle - use last historical or default to current price range
        let initial_candle = if let Some(last) = historical_candles.last() {
            last.clone()
        } else {
            Candle {
                open: 106000.0,
                high: 106100.0,
                low: 105900.0,
                close: 106050.0,
                _volume: 1.0,
            }
        };
        
        let (vertices, indices) = generate_candle_vertices(&initial_candle);
        
        // Create buffers large enough for candles with wicks
        // Max: 8 vertices for body + 8 for top wick + 8 for bottom wick = 24 vertices
        // Max: 36 indices for body + 36 for top wick + 36 for bottom wick = 108 indices
        let max_vertex_size = 24 * std::mem::size_of::<Vertex>();
        let max_index_size = 108 * std::mem::size_of::<u16>();
        
        let mut vertex_data = vec![0u8; max_vertex_size];
        let mut index_data = vec![0u8; max_index_size];
        
        // Copy actual data into buffers
        let vertex_bytes = bytemuck::cast_slice(&vertices);
        vertex_data[..vertex_bytes.len()].copy_from_slice(vertex_bytes);
        
        let index_bytes = bytemuck::cast_slice(&indices);
        index_data[..index_bytes.len()].copy_from_slice(index_bytes);
        
        let vertex_buffer = device.create_buffer_init(
            &wgpu::util::BufferInitDescriptor {
                label: Some("Vertex Buffer"),
                contents: &vertex_data,
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            }
        );
        
        let index_buffer = device.create_buffer_init(
            &wgpu::util::BufferInitDescriptor {
                label: Some("Index Buffer"),
                contents: &index_data,
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
            historical_candles,
        }
    }
    
    fn update_candle(&mut self, candle: &Candle) {
        let (mut vertices, indices) = generate_candle_vertices(candle);
        
        // Position live candle right after the last historical candle
        let spacing = 1.5; // Match spacing from render function
        let max_hist = 40;
        let hist_len = self.historical_candles.len();
        let hist_start = if hist_len > max_hist { hist_len - max_hist } else { 0 };
        let num_shown = hist_len - hist_start;
        let live_x = (num_shown as f32 - max_hist as f32) * spacing; // Position at the end
        for v in &mut vertices {
            v.position[0] += live_x;
        }
        
        // Create padded buffers for consistent size
        let max_vertex_size = 24 * std::mem::size_of::<Vertex>();
        let max_index_size = 108 * std::mem::size_of::<u16>();
        
        let mut vertex_data = vec![0u8; max_vertex_size];
        let mut index_data = vec![0u8; max_index_size];
        
        // Copy actual data
        let vertex_bytes = bytemuck::cast_slice(&vertices);
        vertex_data[..vertex_bytes.len()].copy_from_slice(vertex_bytes);
        
        let index_bytes = bytemuck::cast_slice(&indices);
        index_data[..index_bytes.len()].copy_from_slice(index_bytes);
        
        // Update buffers
        self.queue.write_buffer(&self.vertex_buffer, 0, &vertex_data);
        self.queue.write_buffer(&self.index_buffer, 0, &index_data);
        self.num_indices = indices.len() as u32;
    }
    
    fn render(&mut self, _rotation: f32) -> Result<(), wgpu::SurfaceError> {
        self.camera_uniform.update_view_proj(self.config.width as f32 / self.config.height as f32, 0.0); // No rotation
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

        // Prepare all historical candle geometry and buffers before render_pass
        let spacing = 1.5; // Increased spacing for better visibility
        let z_offset = 0.0; // Same z-plane as live candle
        let max_hist = 40; // Show last 40 candles for better visibility
        let hist_len = self.historical_candles.len();
        let hist_start = if hist_len > max_hist { hist_len - max_hist } else { 0 };
        let mut all_vertices = Vec::new();
        let mut all_indices = Vec::new();
        let mut draw_ranges = Vec::new();
        let mut vtx_offset = 0u16;
        // Position historical candles from left to right
        for (i, candle) in self.historical_candles[hist_start..].iter().enumerate() {
            let x = (i as f32 - max_hist as f32) * spacing; // Start from left, move right
            let (mut vertices, mut indices) = generate_candle_vertices(candle);
            for v in &mut vertices {
                v.position[0] += x;
                v.position[2] += z_offset;
                // Slightly dim historical candles based on age
                let fade_factor = 0.8 + (i as f32 / max_hist as f32) * 0.2; // 0.8 to 1.0
                v.color = [v.color[0] * fade_factor, v.color[1] * fade_factor, v.color[2] * fade_factor];
            }
            for idx in &mut indices {
                *idx += vtx_offset;
            }
            draw_ranges.push((all_indices.len() as u32, indices.len() as u32));
            vtx_offset += vertices.len() as u16;
            all_vertices.extend(vertices);
            all_indices.extend(indices);
        }
        let vbuf = if !all_vertices.is_empty() {
            Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Hist Vertex Buffer"),
                contents: bytemuck::cast_slice(&all_vertices),
                usage: wgpu::BufferUsages::VERTEX,
            }))
        } else {
            None
        };
        let ibuf = if !all_indices.is_empty() {
            Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Hist Index Buffer"),
                contents: bytemuck::cast_slice(&all_indices),
                usage: wgpu::BufferUsages::INDEX,
            }))
        } else {
            None
        };
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: 0.02, g: 0.02, b: 0.04, a: 1.0,
                    }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            ..Default::default()
        });
        // Draw historical candles (1-minute candles)
        if let (Some(ref vbuf), Some(ref ibuf)) = (vbuf.as_ref(), ibuf.as_ref()) {
            render_pass.set_pipeline(&self.render_pipeline);
            render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
            render_pass.set_vertex_buffer(0, vbuf.slice(..));
            render_pass.set_index_buffer(ibuf.slice(..), wgpu::IndexFormat::Uint16);
            for (start, count) in &draw_ranges {
                render_pass.draw_indexed(*start..(*start+*count), 0, 0..1);
            }
        }
        // Draw the live candle at x=0, z=0 (already handled by update_candle)
        render_pass.set_pipeline(&self.render_pipeline);
        render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
        render_pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
        render_pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint16);
        render_pass.draw_indexed(0..self.num_indices, 0, 0..1);
        drop(render_pass);
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

    // Fetch historical candles before starting event loop
    let historical_candles = fetch_historical_candles().await.unwrap_or_default();
    println!("Fetched {} historical candles", historical_candles.len());

    let event_loop = EventLoop::new().unwrap();
    let window = WindowBuilder::new()
        .with_title("3D BTC Candle - Real-time")
        .build(&event_loop)
        .unwrap();

    let mut state = State::new(&window, historical_candles).await;
    
    // Shared candle data - initialize with last historical candle if available
    let initial_candle = if let Some(last_candle) = state.historical_candles.last() {
        last_candle.clone()
    } else {
        Candle {
            open: 106000.0,
            high: 106000.0,
            low: 106000.0,
            close: 106000.0,
            _volume: 0.0,
        }
    };
    let candle_data = Arc::new(Mutex::new(initial_candle));
    
    // WebSocket channel
    let (tx, mut rx) = mpsc::channel::<CandleUpdate>(100);
    
    // Spawn WebSocket task
    tokio::spawn(async move {
        websocket_task(tx).await;
    });
    
    let mut fps_counter = 0;
    let mut fps_timer = std::time::Instant::now();
    
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
                    match state.render(0.0) {
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
                                                r: 0.02, g: 0.02, b: 0.04, a: 1.0,
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
                while let Ok(update) = rx.try_recv() {
                    match update {
                        CandleUpdate::LiveUpdate(new_candle) => {
                            if let Ok(mut candle) = candle_data.lock() {
                                *candle = new_candle;
                                updated = true;
                            }
                        }
                        CandleUpdate::NewMinuteCandle(completed_candle) => {
                            // Add completed candle to historical
                            state.historical_candles.push(completed_candle);
                            // Keep only last 350 candles
                            if state.historical_candles.len() > 350 {
                                state.historical_candles.remove(0);
                            }
                            updated = true;
                        }
                    }
                }
                // Update candle geometry if data changed
                if updated {
                    if let Ok(candle) = candle_data.lock() {
                        state.update_candle(&*candle);
                        // Update window title
                        let title = format!(
                            "3D BTC 1m | ${:.2} | {} | FPS: {} | Candles: {}",
                            candle.close,
                            if candle.close > candle.open { "🟢" } else if candle.close < candle.open { "🔴" } else { "⚪" },
                            fps_counter,
                            state.historical_candles.len()
                        );
                        window.set_title(&title);
                    }
                }
                // Always render with fixed camera (no rotation for traditional chart view)
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

// Fetch historical candles from Coinbase REST API
async fn fetch_historical_candles() -> Result<Vec<Candle>, Box<dyn std::error::Error>> {
    // Use Coinbase Exchange API (public endpoint)
    // Granularity: 60 = 1 minute candles
    let url = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60";
    let client = reqwest::Client::new();
    let resp = client.get(url)
        .header("User-Agent", "rust-trading-app/1.0")
        .send()
        .await?
        .text()
        .await?;
    
    // Coinbase Exchange returns: [[time, low, high, open, close, volume], ...]
    let json: serde_json::Value = serde_json::from_str(&resp)?;
    let mut candles = Vec::new();
    if let Some(arr) = json.as_array() {
        for entry in arr {
            if let Some(vals) = entry.as_array() {
                if vals.len() >= 6 {
                    candles.push(Candle {
                        open: vals[3].as_f64().unwrap_or(0.0),
                        high: vals[2].as_f64().unwrap_or(0.0),
                        low: vals[1].as_f64().unwrap_or(0.0),
                        close: vals[4].as_f64().unwrap_or(0.0),
                        _volume: vals[5].as_f64().unwrap_or(0.0),
                    });
                }
            }
        }
    }
    // Reverse to get chronological order (API returns newest first)
    candles.reverse();
    println!("Parsed {} candles from API response", candles.len());
    Ok(candles)
}