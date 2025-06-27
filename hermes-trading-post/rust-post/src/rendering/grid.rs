//! Grid renderer for the 3D space

use wgpu;
use cgmath::{Point3, Vector3};

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GridVertex {
    pub position: [f32; 3],
    pub color: [f32; 4],
}

impl GridVertex {
    pub fn desc() -> wgpu::VertexBufferLayout<'static> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<GridVertex>() as wgpu::BufferAddress,
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
                    format: wgpu::VertexFormat::Float32x4,
                },
            ],
        }
    }
}

pub fn create_grid_vertices(size: f32, divisions: u32) -> (Vec<GridVertex>, Vec<u16>) {
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    
    let step = size / divisions as f32;
    let half_size = size / 2.0;
    
    // Create grid lines
    let grid_color = [0.0, 0.8, 0.8, 0.3]; // Cyan with transparency
    let axis_color_x = [1.0, 0.0, 0.0, 0.8]; // Red for X axis
    let axis_color_z = [0.0, 0.0, 1.0, 0.8]; // Blue for Z axis
    
    // Grid lines parallel to X axis
    for i in 0..=divisions {
        let z = -half_size + (i as f32 * step);
        let color = if i == divisions / 2 { axis_color_x } else { grid_color };
        
        vertices.push(GridVertex {
            position: [-half_size, -50.0, z],
            color,
        });
        vertices.push(GridVertex {
            position: [half_size, -50.0, z],
            color,
        });
        
        let idx = (vertices.len() - 2) as u16;
        indices.push(idx);
        indices.push(idx + 1);
    }
    
    // Grid lines parallel to Z axis
    for i in 0..=divisions {
        let x = -half_size + (i as f32 * step);
        let color = if i == divisions / 2 { axis_color_z } else { grid_color };
        
        vertices.push(GridVertex {
            position: [x, -50.0, -half_size],
            color,
        });
        vertices.push(GridVertex {
            position: [x, -50.0, half_size],
            color,
        });
        
        let idx = (vertices.len() - 2) as u16;
        indices.push(idx);
        indices.push(idx + 1);
    }
    
    // Add Y axis (vertical line at origin)
    vertices.push(GridVertex {
        position: [0.0, -50.0, 0.0],
        color: [0.0, 1.0, 0.0, 0.8], // Green for Y axis
    });
    vertices.push(GridVertex {
        position: [0.0, 50.0, 0.0],
        color: [0.0, 1.0, 0.0, 0.8],
    });
    
    let idx = (vertices.len() - 2) as u16;
    indices.push(idx);
    indices.push(idx + 1);
    
    (vertices, indices)
}