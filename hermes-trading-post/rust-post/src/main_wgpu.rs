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
    keyboard::{KeyCode, PhysicalKey},
};
use wgpu::util::DeviceExt;
use cgmath::{Matrix4, Deg, perspective, Point3, Vector3, InnerSpace};
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

// UI Layout configuration for professional trading interface
#[derive(Debug, Clone)]
struct UILayout {
    // Fixed dimensions
    sidebar_width: f32,
    header_height: f32,
    footer_height: f32,
    chart_padding: f32,
    
    // Calculated dimensions (updated on resize)
    chart_x: f32,
    chart_y: f32,
    chart_width: f32,
    chart_height: f32,
    window_width: f32,
    window_height: f32,
}

impl UILayout {
    fn new(window_width: f32, window_height: f32) -> Self {
        let sidebar_width = 250.0;
        let header_height = 50.0;
        let footer_height = 80.0;
        let chart_padding = 10.0;
        
        let chart_x = sidebar_width + chart_padding;
        let chart_y = header_height + chart_padding;
        let chart_width = window_width - sidebar_width - (chart_padding * 2.0);
        let chart_height = window_height - header_height - footer_height - (chart_padding * 2.0);
        
        Self {
            sidebar_width,
            header_height,
            footer_height,
            chart_padding,
            chart_x,
            chart_y,
            chart_width,
            chart_height,
            window_width,
            window_height,
        }
    }
    
    fn update_size(&mut self, window_width: f32, window_height: f32) {
        self.window_width = window_width;
        self.window_height = window_height;
        self.chart_x = self.sidebar_width + self.chart_padding;
        self.chart_y = self.header_height + self.chart_padding;
        self.chart_width = window_width - self.sidebar_width - (self.chart_padding * 2.0);
        self.chart_height = window_height - self.header_height - self.footer_height - (self.chart_padding * 2.0);
    }
    
    fn chart_aspect_ratio(&self) -> f32 {
        self.chart_width / self.chart_height
    }
}

// Placeholder for text rendering
#[derive(Debug, Clone)]
struct TextInstance {
    text: String,
    position: [f32; 2],
    size: f32,
    color: [f32; 4],
}

// Enhanced vertex data with normals and ambient occlusion for better lighting
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct EnhancedVertex {
    position: [f32; 3],
    color: [f32; 3],
    normal: [f32; 3],
    ao: f32, // Ambient occlusion
}

impl EnhancedVertex {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<EnhancedVertex>() as wgpu::BufferAddress,
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
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress * 2,
                    shader_location: 2,
                    format: wgpu::VertexFormat::Float32x3,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress * 3,
                    shader_location: 3,
                    format: wgpu::VertexFormat::Float32,
                },
            ],
        }
    }
}

// Helper function to multiply color by a factor
fn multiply_color(color: [f32; 3], factor: f32) -> [f32; 3] {
    [color[0] * factor, color[1] * factor, color[2] * factor]
}

// Generate enhanced 3D candle vertices with lighting and depth shading
fn generate_enhanced_candle_vertices(candle: &Candle) -> (Vec<EnhancedVertex>, Vec<u16>) {
    // Get actual price values
    let open_f32 = candle.open as f32;
    let close_f32 = candle.close as f32;
    let high_f32 = candle.high as f32;
    let low_f32 = candle.low as f32;
    
    // Scale BTC prices for better visibility
    // Center around current price range and scale up significantly
    let base_price = 107500.0; // Updated to current price range
    let price_scale: f32 = 0.2; // Scale for reasonable height differences
    
    // Convert actual prices to Y positions (centered around 0)
    let open_y = (open_f32 - base_price) * price_scale;
    let close_y = (close_f32 - base_price) * price_scale;
    let _high_y = (high_f32 - base_price) * price_scale;
    let _low_y = (low_f32 - base_price) * price_scale;
    
    // Candle body goes from open to close
    let mut body_bottom = open_y.min(close_y);
    let mut body_top = open_y.max(close_y);
    
    // Ensure minimum body height for visibility
    if (body_top - body_bottom).abs() < 0.2 {
        let mid = (body_top + body_bottom) / 2.0;
        body_top = mid + 0.1;
        body_bottom = mid - 0.1;
    }
    
    let s = 0.8; // Candle body width - proportional to spacing
    let _ws = 0.1; // Wick width
    
    // Enhanced colors with metallic/glass finish
    let base_color = if close_f32 > open_f32 {
        [0.0, 1.0, 0.4] // Electric green
    } else if close_f32 < open_f32 {
        [1.0, 0.1, 0.3] // Hot red  
    } else {
        [0.8, 0.8, 0.9] // Metallic gray
    };
    
    // Face-specific color multipliers for metallic finish
    let face_colors = [
        multiply_color(base_color, 1.2),   // Front (brightest - metallic shine)
        multiply_color(base_color, 0.9),   // Right
        multiply_color(base_color, 0.6),   // Back (darkest)
        multiply_color(base_color, 1.0),   // Left
        multiply_color(base_color, 1.4),   // Top (glossy reflection)
        multiply_color(base_color, 0.4),   // Bottom (shadow)
    ];
    
    // Normals for each face
    let normals = [
        [0.0, 0.0, 1.0],   // Front
        [1.0, 0.0, 0.0],   // Right
        [0.0, 0.0, -1.0],  // Back
        [-1.0, 0.0, 0.0],  // Left
        [0.0, 1.0, 0.0],   // Top
        [0.0, -1.0, 0.0],  // Bottom
    ];
    
    let mut vertices = vec![];
    
    // Front face (4 vertices)
    vertices.extend_from_slice(&[
        EnhancedVertex { 
            position: [-s, body_bottom, s], 
            color: face_colors[0], 
            normal: normals[0],
            ao: 0.8  // Corners darker
        },
        EnhancedVertex { 
            position: [s, body_bottom, s], 
            color: face_colors[0], 
            normal: normals[0],
            ao: 0.8
        },
        EnhancedVertex { 
            position: [s, body_top, s], 
            color: face_colors[0], 
            normal: normals[0],
            ao: 0.9
        },
        EnhancedVertex { 
            position: [-s, body_top, s], 
            color: face_colors[0], 
            normal: normals[0],
            ao: 0.9
        },
    ]);
    
    // Right face
    vertices.extend_from_slice(&[
        EnhancedVertex { 
            position: [s, body_bottom, s], 
            color: face_colors[1], 
            normal: normals[1],
            ao: 0.8
        },
        EnhancedVertex { 
            position: [s, body_bottom, -s], 
            color: face_colors[1], 
            normal: normals[1],
            ao: 0.8
        },
        EnhancedVertex { 
            position: [s, body_top, -s], 
            color: face_colors[1], 
            normal: normals[1],
            ao: 0.9
        },
        EnhancedVertex { 
            position: [s, body_top, s], 
            color: face_colors[1], 
            normal: normals[1],
            ao: 0.9
        },
    ]);
    
    // Back face
    vertices.extend_from_slice(&[
        EnhancedVertex { 
            position: [s, body_bottom, -s], 
            color: face_colors[2], 
            normal: normals[2],
            ao: 0.7
        },
        EnhancedVertex { 
            position: [-s, body_bottom, -s], 
            color: face_colors[2], 
            normal: normals[2],
            ao: 0.7
        },
        EnhancedVertex { 
            position: [-s, body_top, -s], 
            color: face_colors[2], 
            normal: normals[2],
            ao: 0.8
        },
        EnhancedVertex { 
            position: [s, body_top, -s], 
            color: face_colors[2], 
            normal: normals[2],
            ao: 0.8
        },
    ]);
    
    // Left face
    vertices.extend_from_slice(&[
        EnhancedVertex { 
            position: [-s, body_bottom, -s], 
            color: face_colors[3], 
            normal: normals[3],
            ao: 0.8
        },
        EnhancedVertex { 
            position: [-s, body_bottom, s], 
            color: face_colors[3], 
            normal: normals[3],
            ao: 0.8
        },
        EnhancedVertex { 
            position: [-s, body_top, s], 
            color: face_colors[3], 
            normal: normals[3],
            ao: 0.9
        },
        EnhancedVertex { 
            position: [-s, body_top, -s], 
            color: face_colors[3], 
            normal: normals[3],
            ao: 0.9
        },
    ]);
    
    // Top face
    vertices.extend_from_slice(&[
        EnhancedVertex { 
            position: [-s, body_top, s], 
            color: face_colors[4], 
            normal: normals[4],
            ao: 1.0
        },
        EnhancedVertex { 
            position: [s, body_top, s], 
            color: face_colors[4], 
            normal: normals[4],
            ao: 1.0
        },
        EnhancedVertex { 
            position: [s, body_top, -s], 
            color: face_colors[4], 
            normal: normals[4],
            ao: 1.0
        },
        EnhancedVertex { 
            position: [-s, body_top, -s], 
            color: face_colors[4], 
            normal: normals[4],
            ao: 1.0
        },
    ]);
    
    // Bottom face
    vertices.extend_from_slice(&[
        EnhancedVertex { 
            position: [-s, body_bottom, -s], 
            color: face_colors[5], 
            normal: normals[5],
            ao: 0.7
        },
        EnhancedVertex { 
            position: [s, body_bottom, -s], 
            color: face_colors[5], 
            normal: normals[5],
            ao: 0.7
        },
        EnhancedVertex { 
            position: [s, body_bottom, s], 
            color: face_colors[5], 
            normal: normals[5],
            ao: 0.7
        },
        EnhancedVertex { 
            position: [-s, body_bottom, s], 
            color: face_colors[5], 
            normal: normals[5],
            ao: 0.7
        },
    ]);
    
    // Create indices for all faces  
    let mut indices = Vec::new();
    for i in 0..6 {
        let base = i * 4;
        indices.extend_from_slice(&[
            base, base+1, base+2, base+2, base+3, base,
        ]);
    }
    
    // TODO: Add wicks with enhanced vertices
    
    (vertices, indices)
}

// Generate line chart vertices for price history
fn generate_line_chart_vertices(candles: &[Candle], start_idx: usize, chart_offset_x: f32) -> (Vec<EnhancedVertex>, Vec<u16>) {
    if candles.is_empty() {
        return (vec![], vec![]);
    }
    
    let base_price = 107500.0;
    let price_scale = 0.2;
    let spacing = 2.5; // Match the candle spacing
    
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    
    // Generate line segments connecting close prices with glow effect
    let line_color = [0.0, 0.8, 1.0]; // Electric cyan
    let line_width = 0.08; // Thicker line for more presence
    
    for (i, window) in candles[start_idx..].windows(2).enumerate() {
        let candle1 = &window[0];
        let candle2 = &window[1];
        
        let x1 = chart_offset_x + (i as f32 * spacing);
        let x2 = chart_offset_x + ((i + 1) as f32 * spacing);
        
        let y1 = (candle1.close as f32 - base_price) * price_scale;
        let y2 = (candle2.close as f32 - base_price) * price_scale;
        
        // Create a thin quad for the line segment
        let start_idx = vertices.len() as u16;
        
        // Calculate perpendicular vector for line width
        let dx = x2 - x1;
        let dy = y2 - y1;
        let length = (dx * dx + dy * dy).sqrt();
        if length > 0.0 {
            let perp_x = -dy / length * line_width;
            let perp_y = dx / length * line_width;
            
            vertices.extend_from_slice(&[
                EnhancedVertex { 
                    position: [x1 - perp_x, y1 - perp_y, 0.5], 
                    color: line_color, 
                    normal: [0.0, 0.0, 1.0],
                    ao: 1.0
                },
                EnhancedVertex { 
                    position: [x1 + perp_x, y1 + perp_y, 0.5], 
                    color: line_color, 
                    normal: [0.0, 0.0, 1.0],
                    ao: 1.0
                },
                EnhancedVertex { 
                    position: [x2 + perp_x, y2 + perp_y, 0.5], 
                    color: line_color, 
                    normal: [0.0, 0.0, 1.0],
                    ao: 1.0
                },
                EnhancedVertex { 
                    position: [x2 - perp_x, y2 - perp_y, 0.5], 
                    color: line_color, 
                    normal: [0.0, 0.0, 1.0],
                    ao: 1.0
                },
            ]);
            
            // Two triangles to form the quad
            indices.extend_from_slice(&[
                start_idx, start_idx + 1, start_idx + 2,
                start_idx + 2, start_idx + 3, start_idx,
            ]);
        }
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

// Enhanced shader with improved lighting and smooth edges
const ENHANCED_SHADER: &str = r#"
// Vertex shader
struct CameraUniform {
    view_proj: mat4x4<f32>,
    view_pos: vec3<f32>,
    _padding: f32,
}
@group(0) @binding(0)
var<uniform> camera: CameraUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) normal: vec3<f32>,
    @location(3) ao: f32,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) world_pos: vec3<f32>,
    @location(2) normal: vec3<f32>,
    @location(3) ao: f32,
}

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.color = model.color;
    out.world_pos = model.position;
    out.normal = model.normal;
    out.ao = model.ao;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    return out;
}

// Fragment shader with enhanced metallic/glass finish and smooth shading
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Multiple light sources for better illumination
    let light_dir1 = normalize(vec3<f32>(0.6, 1.0, 0.4));   // Main light
    let light_dir2 = normalize(vec3<f32>(-0.3, 0.5, -0.2)); // Fill light
    let light_dir3 = normalize(vec3<f32>(0.0, -0.8, 0.6));  // Rim light
    
    let view_dir = normalize(camera.view_pos - in.world_pos);
    let n = normalize(in.normal);
    
    // Diffuse lighting from multiple sources
    let diff1 = max(dot(n, light_dir1), 0.0) * 0.8;
    let diff2 = max(dot(n, light_dir2), 0.0) * 0.4;
    let diff3 = max(dot(n, light_dir3), 0.0) * 0.3;
    let total_diffuse = diff1 + diff2 + diff3;
    
    // Enhanced specular with multiple highlights
    let reflect_dir1 = reflect(-light_dir1, n);
    let reflect_dir2 = reflect(-light_dir2, n);
    let spec1 = pow(max(dot(view_dir, reflect_dir1), 0.0), 64.0) * 0.8;
    let spec2 = pow(max(dot(view_dir, reflect_dir2), 0.0), 32.0) * 0.4;
    let total_spec = spec1 + spec2;
    
    // Fresnel effect for glass-like edges (more pronounced)
    let fresnel = pow(1.0 - max(dot(view_dir, n), 0.0), 1.5);
    
    // Enhanced rim lighting for glowing edges
    let rim = 1.0 - max(dot(view_dir, n), 0.0);
    let rim_light = pow(rim, 2.0) * 0.6;
    
    // Improved ambient lighting
    let ambient = 0.15;
    
    // Combine all lighting components
    let lighting = ambient + total_diffuse + total_spec + rim_light;
    
    // Apply AO with smoother falloff
    let ao_factor = smoothstep(0.5, 1.0, in.ao);
    
    // Enhanced fresnel contribution
    let final_light = lighting * ao_factor * (1.0 + fresnel * 0.5);
    
    // Apply lighting to color with enhanced metallic boost
    let metallic_boost = vec3<f32>(total_spec * 0.6);
    let lit_color = in.color * final_light + metallic_boost;
    
    // Subtle color saturation boost for more vibrant appearance
    let enhanced_color = mix(lit_color, lit_color * lit_color, 0.1);
    
    return vec4<f32>(enhanced_color, 1.0);
}
"#;

// Legacy shader for fallback
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

// Legacy vertex format (for compatibility)
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

// Generate 3D candle vertices (old version - still used for wicks)
fn generate_candle_vertices(candle: &Candle) -> (Vec<Vertex>, Vec<u16>) {
    let open_f32 = candle.open as f32;
    let close_f32 = candle.close as f32;
    let high_f32 = candle.high as f32;
    let low_f32 = candle.low as f32;
    
    let base_price = 107500.0; // Updated to current price range
    let price_scale: f32 = 0.2; // Scale for reasonable height differences
    
    let open_y = (open_f32 - base_price) * price_scale;
    let close_y = (close_f32 - base_price) * price_scale;
    let high_y = (high_f32 - base_price) * price_scale;
    let low_y = (low_f32 - base_price) * price_scale;
    
    let mut body_bottom = open_y.min(close_y);
    let mut body_top = open_y.max(close_y);
    
    if (body_top - body_bottom).abs() < 0.2 {
        let mid = (body_top + body_bottom) / 2.0;
        body_top = mid + 0.1;
        body_bottom = mid - 0.1;
    }
    
    let s = 0.8; // Candle body width - proportional to spacing
    let ws = 0.1; // Wick width
    
    let color = if close_f32 > open_f32 {
        [0.1, 0.9, 0.3]
    } else if close_f32 < open_f32 {
        [0.95, 0.15, 0.2]
    } else {
        [0.6, 0.6, 0.65]
    };
    
    let mut vertices = vec![
        // Body vertices
        Vertex { position: [-s, body_bottom,  s], color },
        Vertex { position: [ s, body_bottom,  s], color },
        Vertex { position: [ s, body_top,     s], color },
        Vertex { position: [-s, body_top,     s], color },
        Vertex { position: [-s, body_bottom, -s], color },
        Vertex { position: [ s, body_bottom, -s], color },
        Vertex { position: [ s, body_top,    -s], color },
        Vertex { position: [-s, body_top,    -s], color },
    ];
    
    let mut indices = vec![
        0, 1, 2, 2, 3, 0,
        1, 5, 6, 6, 2, 1,
        5, 4, 7, 7, 6, 5,
        4, 0, 3, 3, 7, 4,
        3, 2, 6, 6, 7, 3,
        4, 5, 1, 1, 0, 4,
    ];
    
    // Add wicks if needed (similar to enhanced version)
    if high_y > body_top + 0.001 {
        let wick_start_idx = vertices.len() as u16;
        vertices.extend_from_slice(&[
            Vertex { position: [-ws, body_top,  ws], color },
            Vertex { position: [ ws, body_top,  ws], color },
            Vertex { position: [ ws, high_y,  ws], color },
            Vertex { position: [-ws, high_y,  ws], color },
            Vertex { position: [-ws, body_top, -ws], color },
            Vertex { position: [ ws, body_top, -ws], color },
            Vertex { position: [ ws, high_y, -ws], color },
            Vertex { position: [-ws, high_y, -ws], color },
        ]);
        
        let w = wick_start_idx;
        indices.extend_from_slice(&[
            w, w+1, w+2, w+2, w+3, w,
            w+1, w+5, w+6, w+6, w+2, w+1,
            w+5, w+4, w+7, w+7, w+6, w+5,
            w+4, w, w+3, w+3, w+7, w+4,
            w+3, w+2, w+6, w+6, w+7, w+3,
            w+4, w+5, w+1, w+1, w, w+4,
        ]);
    }
    
    if low_y < body_bottom - 0.001 {
        let wick_start_idx = vertices.len() as u16;
        vertices.extend_from_slice(&[
            Vertex { position: [-ws, low_y,  ws], color },
            Vertex { position: [ ws, low_y,  ws], color },
            Vertex { position: [ ws, body_bottom,  ws], color },
            Vertex { position: [-ws, body_bottom,  ws], color },
            Vertex { position: [-ws, low_y, -ws], color },
            Vertex { position: [ ws, low_y, -ws], color },
            Vertex { position: [ ws, body_bottom, -ws], color },
            Vertex { position: [-ws, body_bottom, -ws], color },
        ]);
        
        let w = wick_start_idx;
        indices.extend_from_slice(&[
            w, w+1, w+2, w+2, w+3, w,
            w+1, w+5, w+6, w+6, w+2, w+1,
            w+5, w+4, w+7, w+7, w+6, w+5,
            w+4, w, w+3, w+3, w+7, w+4,
            w+3, w+2, w+6, w+6, w+7, w+3,
            w+4, w+5, w+1, w+1, w, w+4,
        ]);
    }
    
    (vertices, indices)
}

#[repr(C)]
#[derive(Debug, Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
struct CameraUniform {
    view_proj: [[f32; 4]; 4],
    view_pos: [f32; 3],
    _padding: f32,
}

// Camera controller for smooth movement
#[derive(Debug)]
struct CameraController {
    eye: Point3<f32>,
    target: Point3<f32>,
    up: Vector3<f32>,
    fov: f32,
    aspect: f32,
    znear: f32,
    zfar: f32,
    
    // Controls
    forward_speed: f32,
    rotation_speed: f32,
    zoom_speed: f32,
    
    // Input state
    keys_pressed: std::collections::HashSet<KeyCode>,
    mouse_pressed: bool,
    shift_pressed: bool, // Track shift key for panning mode
    last_mouse_pos: (f64, f64),
}

impl CameraController {
    fn new(aspect: f32) -> Self {
        Self {
            eye: Point3::new(8.0, 25.0, 120.0),
            target: Point3::new(0.0, 0.0, 0.0),
            up: Vector3::unit_y(),
            fov: 45.0,
            aspect,
            znear: 0.1,
            zfar: 400.0,
            
            forward_speed: 5.0,
            rotation_speed: 0.015, // Increased sensitivity for more responsive rotation
            zoom_speed: 2.0,
            
            keys_pressed: std::collections::HashSet::new(),
            mouse_pressed: false,
            shift_pressed: false,
            last_mouse_pos: (0.0, 0.0),
        }
    }
    
    fn update_aspect(&mut self, aspect: f32) {
        self.aspect = aspect;
    }
    
    fn process_keyboard(&mut self, key: KeyCode, state: ElementState) {
        match state {
            ElementState::Pressed => {
                self.keys_pressed.insert(key);
                if key == KeyCode::ShiftLeft || key == KeyCode::ShiftRight {
                    self.shift_pressed = true;
                }
            }
            ElementState::Released => {
                self.keys_pressed.remove(&key);
                if key == KeyCode::ShiftLeft || key == KeyCode::ShiftRight {
                    self.shift_pressed = false;
                }
            }
        }
    }
    
    fn process_mouse_motion(&mut self, delta_x: f64, delta_y: f64) {
        if self.mouse_pressed {
            let dx = delta_x as f32;
            let dy = delta_y as f32;
            
            if self.shift_pressed {
                // Panning mode - move both eye and target together
                let pan_speed = 0.05;
                let forward = (self.target - self.eye).normalize();
                let right = forward.cross(self.up).normalize();
                let up = right.cross(forward).normalize();
                
                // Calculate pan movement in world space
                let pan_movement = right * (-dx * pan_speed) + up * (dy * pan_speed);
                
                // Move both eye and target by the same amount (no rotation)
                self.eye += pan_movement;
                self.target += pan_movement;
            } else {
                // Rotation mode - rotate around target
                let dx = dx * self.rotation_speed;
                let dy = dy * self.rotation_speed;
                
                let radius = (self.eye - self.target).magnitude();
                let theta = dx; // Horizontal rotation
                let phi = dy;   // Vertical rotation
                
                let forward = (self.target - self.eye).normalize();
                let right = forward.cross(self.up).normalize();
                let up = right.cross(forward).normalize();
                
                // Apply rotations
                let new_forward = Matrix4::from_axis_angle(up, Deg(-theta)) * 
                                 Matrix4::from_axis_angle(right, Deg(-phi)) * 
                                 forward.extend(0.0);

                self.eye = self.target - Vector3::new(new_forward.x, new_forward.y, new_forward.z) * radius;
            }
        }
    }
    
    fn process_mouse_button(&mut self, button: MouseButton, state: ElementState) {
        if button == MouseButton::Left {
            self.mouse_pressed = state == ElementState::Pressed;
        }
    }
    
    fn process_scroll(&mut self, delta: f32) {
        let forward = (self.target - self.eye).normalize();
        self.eye += forward * delta * self.zoom_speed;
        
        // Prevent getting too close
        let distance = (self.eye - self.target).magnitude();
        if distance < 5.0 {
            self.eye = self.target - forward * 5.0;
        }
    }
    
    fn update(&mut self, dt: f32) {
        let forward = (self.target - self.eye).normalize();
        let right = forward.cross(self.up).normalize();
        let up = right.cross(forward).normalize();
        
        let mut movement = Vector3::new(0.0, 0.0, 0.0);
        
        // WASD movement
        if self.keys_pressed.contains(&KeyCode::KeyW) {
            movement += forward;
        }
        if self.keys_pressed.contains(&KeyCode::KeyS) {
            movement -= forward;
        }
        if self.keys_pressed.contains(&KeyCode::KeyA) {
            movement -= right;
        }
        if self.keys_pressed.contains(&KeyCode::KeyD) {
            movement += right;
        }
        if self.keys_pressed.contains(&KeyCode::KeyQ) {
            movement += up;
        }
        if self.keys_pressed.contains(&KeyCode::KeyE) {
            movement -= up;
        }
        
        // Apply movement
        if movement.magnitude() > 0.0 {
            movement = movement.normalize() * self.forward_speed * dt;
            self.eye += movement;
            self.target += movement;
        }
    }
    
    fn build_view_projection_matrix(&self) -> Matrix4<f32> {
        let view = Matrix4::look_at_rh(self.eye, self.target, self.up);
        let proj = perspective(Deg(self.fov), self.aspect, self.znear, self.zfar);
        proj * view
    }
    
    fn get_camera_info(&self) -> String {
        format!(
            "Camera: Eye({:.1}, {:.1}, {:.1}) Target({:.1}, {:.1}, {:.1}) FOV: {:.1}°",
            self.eye.x, self.eye.y, self.eye.z,
            self.target.x, self.target.y, self.target.z,
            self.fov
        )
    }
}

impl CameraUniform {
    fn new() -> Self {
        use cgmath::SquareMatrix;
        Self {
            view_proj: cgmath::Matrix4::identity().into(),
            view_pos: [0.0, 0.0, 0.0],
            _padding: 0.0,
        }
    }

    fn update_view_proj(&mut self, camera_controller: &CameraController) {
        self.view_proj = camera_controller.build_view_projection_matrix().into();
        self.view_pos = [camera_controller.eye.x, camera_controller.eye.y, camera_controller.eye.z];
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
    camera_controller: CameraController,
    camera_buffer: wgpu::Buffer,
    camera_bind_group: wgpu::BindGroup,
    depth_texture: wgpu::Texture,
    depth_view: wgpu::TextureView,
    historical_candles: Vec<Candle>, // Store historical candles
    current_candle: Option<Candle>,  // Store the current live candle
    ui_layout: UILayout,
    last_frame_time: std::time::Instant,
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
        
        // Create depth texture for proper 3D rendering
        let depth_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Depth Texture"),
            size: wgpu::Extent3d {
                width: config.width,
                height: config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 4, // 4x MSAA
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth32Float,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        
        let depth_view = depth_texture.create_view(&wgpu::TextureViewDescriptor::default());
        
        // Create shader
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Shader"),
            source: wgpu::ShaderSource::Wgsl(ENHANCED_SHADER.into()),
        });
        
        // Create UI layout
        let ui_layout = UILayout::new(size.width as f32, size.height as f32);
        
        // Camera controller
        let camera_controller = CameraController::new(config.width as f32 / config.height as f32);
        let mut camera_uniform = CameraUniform::new();
        camera_uniform.update_view_proj(&camera_controller);
        
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
                    visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
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
                buffers: &[EnhancedVertex::desc()],
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
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth32Float,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::Less,
                stencil: wgpu::StencilState::default(),
                bias: wgpu::DepthBiasState::default(),
            }),
            multisample: wgpu::MultisampleState {
                count: 4, // 4x MSAA for high quality anti-aliasing
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
        
        let (vertices, indices) = generate_enhanced_candle_vertices(&initial_candle);
        
        // Create buffers large enough for enhanced candles with wicks
        // Max: 24 vertices for body + 8 for top wick + 8 for bottom wick = 40 vertices
        // Max: 36 indices for body + 36 for top wick + 36 for bottom wick = 108 indices
        let max_vertex_size = 40 * std::mem::size_of::<EnhancedVertex>();
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
            camera_controller,
            camera_buffer,
            camera_bind_group,
            depth_texture,
            depth_view,
            historical_candles,
            current_candle: None, // Initialize with no current candle
            ui_layout,
            last_frame_time: std::time::Instant::now(),
        }
    }
    
    fn update_candle(&mut self, candle: &Candle) {
        // Replace or add the live candle as the most recent historical candle
        if self.historical_candles.is_empty() {
            self.historical_candles.push(candle.clone());
        } else {
            // Update the last candle (this represents the current live candle)
            *self.historical_candles.last_mut().unwrap() = candle.clone();
        }
    }
    
    fn update_current_candle(&mut self, candle: Candle) {
        // Update the current live candle that gets rendered separately
        self.current_candle = Some(candle);
    }
    
    fn render(&mut self, _rotation: f32) -> Result<(), wgpu::SurfaceError> {
        // Update camera controller
        let now = std::time::Instant::now();
        let dt = now.duration_since(self.last_frame_time).as_secs_f32();
        self.last_frame_time = now;
        
        self.camera_controller.update(dt);
        self.camera_uniform.update_view_proj(&self.camera_controller);
        self.queue.write_buffer(&self.camera_buffer, 0, bytemuck::cast_slice(&[self.camera_uniform]));
        
        let output = match self.surface.get_current_texture() {
            Ok(tex) => tex,
            Err(e) => {
                eprintln!("Failed to acquire next swap chain texture: {:?}", e);
                return Err(e);
            }
        };
        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
        
        // Create multisampled color attachment
        let multisampled_framebuffer = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Multisampled framebuffer"),
            size: wgpu::Extent3d {
                width: self.config.width,
                height: self.config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 4, // 4x MSAA (8x not supported on this device)
            dimension: wgpu::TextureDimension::D2,
            format: self.config.format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        let multisampled_view = multisampled_framebuffer.create_view(&wgpu::TextureViewDescriptor::default());
        
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Encoder"),
        });

        // Prepare ALL geometry (line chart + candles) in one buffer
        let spacing = 2.5; // Increased spacing between candles
        let max_hist = 40;
        let hist_len = self.historical_candles.len();
        let hist_start = if hist_len > max_hist { hist_len - max_hist } else { 0 };
        
        println!("Rendering: total_candles={}, showing={}, hist_start={}", 
            hist_len, hist_len - hist_start, hist_start);
        
        let mut all_vertices = Vec::new();
        let mut all_indices = Vec::new();
        let mut draw_ranges = Vec::new();
        let mut vtx_offset = 0u16;
        
        // Calculate positioning for split view: line chart on left, candles on right
        let visible_count = (hist_len - hist_start) as f32;
        let chart_width = visible_count * spacing;
        let gap = spacing * 2.0; // Gap between line chart and candles
        let total_width = chart_width * 2.0 + gap; // Line chart + gap + candles
        let start_x = -total_width / 2.0;
        
        // 1. Add line chart on the left side
        let line_chart_start_x = start_x;
        if hist_len > hist_start + 1 {
            let (line_vertices, mut line_indices) = generate_line_chart_vertices(
                &self.historical_candles, 
                hist_start, 
                line_chart_start_x
            );
            
            for idx in &mut line_indices {
                *idx += vtx_offset;
            }
            
            if !line_vertices.is_empty() {
                draw_ranges.push((all_indices.len() as u32, line_indices.len() as u32));
                vtx_offset += line_vertices.len() as u16;
                all_vertices.extend(line_vertices);
                all_indices.extend(line_indices);
            }
        }
        
        // 2. Add historical candles on the right side
        let candles_start_x = start_x + chart_width + gap;
        
        for (i, candle) in self.historical_candles[hist_start..].iter().enumerate() {
            let x = candles_start_x + (i as f32 * spacing);
            let (mut vertices, mut indices) = generate_enhanced_candle_vertices(candle);
            
            // Debug output for first few candles
            if i < 3 {
                println!("Candle {}: x={:.2}, open={:.2}, close={:.2}, vertices={}", 
                    i, x, candle.open, candle.close, vertices.len());
            }
            
            for v in &mut vertices {
                v.position[0] += x;
                // Fade historical candles slightly, with most recent being brightest
                let fade_factor = 0.6 + (i as f32 / visible_count) * 0.4;
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
        
        // 3. Add live candle at the rightmost position
        if let Some(current_candle) = &self.current_candle {
            let live_x = candles_start_x + visible_count * spacing;
            let (mut vertices, mut indices) = generate_enhanced_candle_vertices(current_candle);
            
            println!("Live candle: x={:.2}, open={:.2}, close={:.2}, high={:.2}, low={:.2}", 
                live_x, current_candle.open, current_candle.close, current_candle.high, current_candle.low);
            
            for v in &mut vertices {
                v.position[0] += live_x;
                // Make live candle brighter to distinguish it
                v.color = [v.color[0] * 1.2, v.color[1] * 1.2, v.color[2] * 1.2];
            }
            
            for idx in &mut indices {
                *idx += vtx_offset;
            }
            
            draw_ranges.push((all_indices.len() as u32, indices.len() as u32));
            vtx_offset += vertices.len() as u16;
            all_vertices.extend(vertices);
            all_indices.extend(indices);
        }
        
        // Create combined buffers for all candles
        let combined_vbuf = if !all_vertices.is_empty() {
            Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Combined Vertex Buffer"),
                contents: bytemuck::cast_slice(&all_vertices),
                usage: wgpu::BufferUsages::VERTEX,
            }))
        } else {
            None
        };
        
        let combined_ibuf = if !all_indices.is_empty() {
            Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Combined Index Buffer"),
                contents: bytemuck::cast_slice(&all_indices),
                usage: wgpu::BufferUsages::INDEX,
            }))
        } else {
            None
        };
        
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &multisampled_view,
                resolve_target: Some(&view),
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: 0.02, g: 0.02, b: 0.04, a: 1.0,
                    }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                view: &self.depth_view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Clear(1.0),
                    store: wgpu::StoreOp::Store,
                }),
                stencil_ops: None,
            }),
            ..Default::default()
        });
        
        // Draw all candles at once
        if let (Some(ref vbuf), Some(ref ibuf)) = (combined_vbuf.as_ref(), combined_ibuf.as_ref()) {
            render_pass.set_pipeline(&self.render_pipeline);
            render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
            render_pass.set_vertex_buffer(0, vbuf.slice(..));
            render_pass.set_index_buffer(ibuf.slice(..), wgpu::IndexFormat::Uint16);
            
            for (start, count) in &draw_ranges {
                render_pass.draw_indexed(*start..(*start+*count), 0, 0..1);
            }
        }
        
        drop(render_pass);
        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();
        Ok(())
    }
    
    fn resize(&mut self, new_size: winit::dpi::PhysicalSize<u32>) {
        if new_size.width > 0 && new_size.height > 0 {
            self.size = new_size;
            self.config.width = new_size.width;
            self.config.height = new_size.height;
            self.surface.configure(&self.device, &self.config);
            
            // Recreate depth texture with new size
            self.depth_texture = self.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("Depth Texture"),
                size: wgpu::Extent3d {
                    width: self.config.width,
                    height: self.config.height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 4,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Depth32Float,
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
                view_formats: &[],
            });
            
            self.depth_view = self.depth_texture.create_view(&wgpu::TextureViewDescriptor::default());
            self.camera_controller.update_aspect(new_size.width as f32 / new_size.height as f32);
        }
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
                    state.resize(*physical_size);
                    window.request_redraw(); // Always redraw on resize
                }
                WindowEvent::KeyboardInput { event, .. } => {
                    if let PhysicalKey::Code(keycode) = event.physical_key {
                        state.camera_controller.process_keyboard(keycode, event.state);
                        
                        // Reset camera on R key
                        if keycode == KeyCode::KeyR && event.state == ElementState::Pressed {
                            state.camera_controller = CameraController::new(state.config.width as f32 / state.config.height as f32);
                        }
                    }
                }
                WindowEvent::MouseInput { button, state: btn_state, .. } => {
                    state.camera_controller.process_mouse_button(*button, *btn_state);
                }
                WindowEvent::CursorMoved { position, .. } => {
                    let (last_x, last_y) = state.camera_controller.last_mouse_pos;
                    let delta_x = position.x - last_x;
                    let delta_y = position.y - last_y;
                    state.camera_controller.process_mouse_motion(delta_x, delta_y);
                    state.camera_controller.last_mouse_pos = (position.x, position.y);
                }
                WindowEvent::MouseWheel { delta, .. } => {
                    let scroll_delta = match delta {
                        MouseScrollDelta::LineDelta(_, y) => *y,
                        MouseScrollDelta::PixelDelta(pos) => pos.y as f32 * 0.01,
                    };
                    state.camera_controller.process_scroll(scroll_delta);
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
                        state.update_current_candle(candle.clone());
                        // Update window title with camera info
                        let camera_info = state.camera_controller.get_camera_info();
                        let title = format!(
                            "3D BTC 1m | ${:.2} | {} | FPS: {} | Candles: {} | {}",
                            candle.close,
                            if candle.close > candle.open { "🟢" } else if candle.close < candle.open { "🔴" } else { "⚪" },
                            fps_counter,
                            state.historical_candles.len(),
                            camera_info
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