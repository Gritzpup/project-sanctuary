use bytemuck::{Pod, Zeroable};
use crate::visualization::chart::data::Candle;

/// Enhanced vertex data with normals and ambient occlusion for better lighting
#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct EnhancedVertex {
    pub position: [f32; 3],
    pub color: [f32; 3],
    pub normal: [f32; 3],
    pub ao: f32, // Ambient occlusion
}

impl EnhancedVertex {
    pub fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
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

/// Legacy vertex format for compatibility
#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct Vertex {
    pub position: [f32; 3],
    pub color: [f32; 3],
}

impl Vertex {
    pub fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
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

/// Helper function to multiply color by a factor
fn multiply_color(color: [f32; 3], factor: f32) -> [f32; 3] {
    [color[0] * factor, color[1] * factor, color[2] * factor]
}

/// Generate enhanced 3D candle vertices with lighting and depth shading
pub fn generate_enhanced_candle_vertices(candle: &Candle) -> (Vec<EnhancedVertex>, Vec<u16>) {
    // Get actual price values as f32
    let open_f32 = candle.open as f32;
    let close_f32 = candle.close as f32;
    let high_f32 = candle.high as f32;
    let low_f32 = candle.low as f32;
    
    // Scale BTC prices for better visibility
    let base_price = 107500.0;
    let price_scale: f32 = 0.2;
    
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
    
    let s = 0.9; // Wider candle body for more presence
    
    // Ultra-enhanced colors with depth and glow effects
    let base_color = if candle.is_bullish() {
        [0.0, 1.2, 0.5] // Brilliant electric green
    } else if candle.is_bearish() {
        [1.2, 0.0, 0.2] // Intense hot red
    } else {
        [0.9, 0.9, 1.0] // Bright metallic silver
    };
    
    // Face-specific color multipliers for dramatic 3D depth
    let face_colors = [
        multiply_color(base_color, 1.5),   // Front (super bright)
        multiply_color(base_color, 0.8),   // Right (medium depth)
        multiply_color(base_color, 0.4),   // Back (deep shadow)
        multiply_color(base_color, 1.0),   // Left (standard)
        multiply_color(base_color, 1.7),   // Top (ultra glossy)
        multiply_color(base_color, 0.3),   // Bottom (deep shadow)
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
    
    // Generate cube faces (Front, Right, Back, Left, Top, Bottom)
    let face_vertices = [
        // Front face
        [[-s, body_bottom, s], [s, body_bottom, s], [s, body_top, s], [-s, body_top, s]],
        // Right face
        [[s, body_bottom, s], [s, body_bottom, -s], [s, body_top, -s], [s, body_top, s]],
        // Back face
        [[s, body_bottom, -s], [-s, body_bottom, -s], [-s, body_top, -s], [s, body_top, -s]],
        // Left face
        [[-s, body_bottom, -s], [-s, body_bottom, s], [-s, body_top, s], [-s, body_top, -s]],
        // Top face
        [[-s, body_top, s], [s, body_top, s], [s, body_top, -s], [-s, body_top, -s]],
        // Bottom face
        [[-s, body_bottom, -s], [s, body_bottom, -s], [s, body_bottom, s], [-s, body_bottom, s]],
    ];
    
    for (face_idx, face) in face_vertices.iter().enumerate() {
        let color = face_colors[face_idx];
        let normal = normals[face_idx];
        
        for (vert_idx, pos) in face.iter().enumerate() {
            let ao = match face_idx {
                4 => 1.0,  // Top face - bright
                5 => 0.7,  // Bottom face - darker
                _ => if vert_idx < 2 { 0.8 } else { 0.9 }, // Corners vs top
            };
            
            vertices.push(EnhancedVertex {
                position: *pos,
                color,
                normal,
                ao,
            });
        }
    }
    
    // Create indices for all faces  
    let mut indices = Vec::new();
    for i in 0..6 {
        let base = (i * 4) as u16;
        indices.extend_from_slice(&[
            base, base + 1, base + 2, 
            base + 2, base + 3, base,
        ]);
    }
    
    // Add upper wick if needed
    if high_y > body_top + 0.001 {
        let wick_start_idx = vertices.len() as u16;
        let wick_width = 0.15;
        let wick_color = multiply_color(base_color, 0.8);
        
        // Add wick geometry (simplified as thin box)
        let wick_vertices = [
            [-wick_width, body_top, wick_width], [wick_width, body_top, wick_width],
            [wick_width, high_y, wick_width], [-wick_width, high_y, wick_width],
            [-wick_width, body_top, -wick_width], [wick_width, body_top, -wick_width],
            [wick_width, high_y, -wick_width], [-wick_width, high_y, -wick_width],
        ];
        
        for pos in &wick_vertices {
            vertices.push(EnhancedVertex {
                position: *pos,
                color: wick_color,
                normal: [0.0, 1.0, 0.0], // Upward normal
                ao: 0.9,
            });
        }
        
        // Wick indices (front, right, back, left faces)
        let w = wick_start_idx;
        indices.extend_from_slice(&[
            w, w+1, w+2, w+2, w+3, w,      // Front
            w+1, w+5, w+6, w+6, w+2, w+1,  // Right  
            w+5, w+4, w+7, w+7, w+6, w+5,  // Back
            w+4, w, w+3, w+3, w+7, w+4,    // Left
        ]);
    }
    
    // Add lower wick if needed
    if low_y < body_bottom - 0.001 {
        let wick_start_idx = vertices.len() as u16;
        let wick_width = 0.15;
        let wick_color = multiply_color(base_color, 0.8);
        
        let wick_vertices = [
            [-wick_width, low_y, wick_width], [wick_width, low_y, wick_width],
            [wick_width, body_bottom, wick_width], [-wick_width, body_bottom, wick_width],
            [-wick_width, low_y, -wick_width], [wick_width, low_y, -wick_width],
            [wick_width, body_bottom, -wick_width], [-wick_width, body_bottom, -wick_width],
        ];
        
        for pos in &wick_vertices {
            vertices.push(EnhancedVertex {
                position: *pos,
                color: wick_color,
                normal: [0.0, -1.0, 0.0], // Downward normal
                ao: 0.8,
            });
        }
        
        let w = wick_start_idx;
        indices.extend_from_slice(&[
            w, w+1, w+2, w+2, w+3, w,
            w+1, w+5, w+6, w+6, w+2, w+1,
            w+5, w+4, w+7, w+7, w+6, w+5,
            w+4, w, w+3, w+3, w+7, w+4,
        ]);
    }
    
    (vertices, indices)
}

/// Generate line chart vertices for price history  
pub fn generate_line_chart_vertices(
    candles: &[Candle], 
    start_idx: usize, 
    chart_offset_x: f32
) -> (Vec<EnhancedVertex>, Vec<u16>) {
    if candles.is_empty() {
        return (vec![], vec![]);
    }
    
    let base_price = 107500.0;
    let price_scale = 0.2;
    let spacing = 2.5;
    
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    
    let line_color = [0.0, 0.8, 1.0]; // Electric cyan
    let line_width = 0.08;
    
    for (i, window) in candles[start_idx..].windows(2).enumerate() {
        let candle1 = &window[0];
        let candle2 = &window[1];
        
        let x1 = chart_offset_x + (i as f32 * spacing);
        let x2 = chart_offset_x + ((i + 1) as f32 * spacing);
        
        let y1 = (candle1.close as f32 - base_price) * price_scale;
        let y2 = (candle2.close as f32 - base_price) * price_scale;
        
        // Create thin quad for line segment
        let start_idx = vertices.len() as u16;
        
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
            
            indices.extend_from_slice(&[
                start_idx, start_idx + 1, start_idx + 2,
                start_idx + 2, start_idx + 3, start_idx,
            ]);
        }
    }
    
    (vertices, indices)
}