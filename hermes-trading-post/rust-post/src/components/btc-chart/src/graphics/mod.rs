mod shaders;
pub mod text;

use crate::data::Candle;
pub use shaders::{ENHANCED_SHADER, TEXT_SHADER};
pub use text::{FontAtlas, TextVertex, CharacterInfo};

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct EnhancedVertex {
    pub position: [f32; 3],
    pub color: [f32; 3],
    pub normal: [f32; 3],
    pub ao: f32,
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

fn multiply_color(color: [f32; 3], factor: f32) -> [f32; 3] {
    [color[0] * factor, color[1] * factor, color[2] * factor]
}

pub fn generate_enhanced_candle_vertices(candle: &Candle) -> (Vec<EnhancedVertex>, Vec<u16>) {
    let open_f32 = candle.open as f32;
    let close_f32 = candle.close as f32;
    let high_f32 = candle.high as f32;
    let low_f32 = candle.low as f32;
    
    let base_price = 107500.0;
    let price_scale: f32 = 0.2;
    
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
    
    let s = 0.9;
    
    let base_color = if close_f32 > open_f32 {
        [0.0, 1.2, 0.5]
    } else if close_f32 < open_f32 {
        [1.2, 0.0, 0.2]
    } else {
        [0.9, 0.9, 1.0]
    };
    
    let face_colors = [
        multiply_color(base_color, 1.5),   // Front
        multiply_color(base_color, 0.8),   // Right
        multiply_color(base_color, 0.4),   // Back
        multiply_color(base_color, 1.0),   // Left
        multiply_color(base_color, 1.7),   // Top
        multiply_color(base_color, 0.3),   // Bottom
    ];
    
    let normals = [
        [0.0, 0.0, 1.0],   // Front
        [1.0, 0.0, 0.0],   // Right
        [0.0, 0.0, -1.0],  // Back
        [-1.0, 0.0, 0.0],  // Left
        [0.0, 1.0, 0.0],   // Top
        [0.0, -1.0, 0.0],  // Bottom
    ];
    
    let mut vertices = vec![];
    
    // Front face
    vertices.extend_from_slice(&[
        EnhancedVertex { 
            position: [-s, body_bottom, s], 
            color: face_colors[0], 
            normal: normals[0],
            ao: 0.8
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
    
    let mut indices = Vec::new();
    for i in 0..6 {
        let base = i * 4;
        indices.extend_from_slice(&[
            base, base+1, base+2, base+2, base+3, base,
        ]);
    }
    
    // Add wicks
    add_wick_if_needed(&mut vertices, &mut indices, high_y, body_top, base_color, true);
    add_wick_if_needed(&mut vertices, &mut indices, low_y, body_bottom, base_color, false);
    
    (vertices, indices)
}

fn add_wick_if_needed(
    vertices: &mut Vec<EnhancedVertex>,
    indices: &mut Vec<u16>,
    wick_end: f32,
    body_edge: f32,
    base_color: [f32; 3],
    is_upper: bool,
) {
    let should_add = if is_upper {
        wick_end > body_edge + 0.001
    } else {
        wick_end < body_edge - 0.001
    };
    
    if should_add {
        let wick_start_idx = vertices.len() as u16;
        let wick_width = 0.15;
        let wick_color = multiply_color(base_color, 0.8);
        
        let (start_y, end_y) = if is_upper {
            (body_edge, wick_end)
        } else {
            (wick_end, body_edge)
        };
        
        // Wick vertices
        vertices.extend_from_slice(&[
            EnhancedVertex { 
                position: [-wick_width, start_y, wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, 1.0],
                ao: 0.9
            },
            EnhancedVertex { 
                position: [wick_width, start_y, wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, 1.0],
                ao: 0.9
            },
            EnhancedVertex { 
                position: [wick_width, end_y, wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, 1.0],
                ao: 1.0
            },
            EnhancedVertex { 
                position: [-wick_width, end_y, wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, 1.0],
                ao: 1.0
            },
            // Back face
            EnhancedVertex { 
                position: [-wick_width, start_y, -wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, -1.0],
                ao: 0.8
            },
            EnhancedVertex { 
                position: [wick_width, start_y, -wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, -1.0],
                ao: 0.8
            },
            EnhancedVertex { 
                position: [wick_width, end_y, -wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, -1.0],
                ao: 0.9
            },
            EnhancedVertex { 
                position: [-wick_width, end_y, -wick_width], 
                color: wick_color, 
                normal: [0.0, 0.0, -1.0],
                ao: 0.9
            },
        ]);
        
        let w = wick_start_idx;
        // Wick indices
        indices.extend_from_slice(&[
            // Front face
            w, w+1, w+2, w+2, w+3, w,
            // Right face  
            w+1, w+5, w+6, w+6, w+2, w+1,
            // Back face
            w+5, w+4, w+7, w+7, w+6, w+5,
            // Left face
            w+4, w, w+3, w+3, w+7, w+4,
        ]);
    }
}