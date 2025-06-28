//! Core holographic panel system for futuristic 3D UI

use crate::core::types::{Vec3, Vec2, Color, Transform};
use crate::rendering::Renderer;
use wgpu;
use std::time::Instant;

/// Core holographic panel that floats in 3D space
#[derive(Clone, Debug)]
pub struct HolographicPanel {
    pub id: u32,
    pub transform: Transform,
    pub size: Vec2,
    pub opacity: f32,
    pub glow_intensity: f32,
    pub panel_type: PanelType,
    pub is_active: bool,
    pub is_minimized: bool,
    
    // Animation state
    pub animation_time: f32,
    pub hover_intensity: f32,
    pub creation_time: Instant,
    
    // Visual properties
    pub color_scheme: ColorScheme,
    pub border_thickness: f32,
    pub corner_radius: f32,
    pub hologram_flicker: f32,
}

#[derive(Clone, Debug)]
pub enum PanelType {
    PortfolioSphere,
    OrderBookWall,
    MarketHeatmap,
    TradeStream,
    NewsFeed,
    QuickTrade,
}

#[derive(Clone, Debug)]
pub struct ColorScheme {
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub glow: Color,
    pub text: Color,
}

impl ColorScheme {
    pub fn cyberpunk_blue() -> Self {
        Self {
            primary: Color::new(0.0, 0.8, 1.0, 0.7),
            secondary: Color::new(0.0, 0.4, 0.8, 0.5),
            accent: Color::new(0.0, 1.0, 1.0, 0.9),
            glow: Color::new(0.0, 1.0, 1.0, 0.3),
            text: Color::new(0.9, 0.9, 1.0, 1.0),
        }
    }
    
    pub fn cyberpunk_green() -> Self {
        Self {
            primary: Color::new(0.0, 1.0, 0.5, 0.7),
            secondary: Color::new(0.0, 0.8, 0.3, 0.5),
            accent: Color::new(0.2, 1.0, 0.0, 0.9),
            glow: Color::new(0.0, 1.0, 0.0, 0.3),
            text: Color::new(0.9, 1.0, 0.9, 1.0),
        }
    }
    
    pub fn cyberpunk_red() -> Self {
        Self {
            primary: Color::new(1.0, 0.2, 0.3, 0.7),
            secondary: Color::new(0.8, 0.1, 0.2, 0.5),
            accent: Color::new(1.0, 0.0, 0.2, 0.9),
            glow: Color::new(1.0, 0.0, 0.0, 0.3),
            text: Color::new(1.0, 0.9, 0.9, 1.0),
        }
    }
}

impl HolographicPanel {
    pub fn new(
        id: u32,
        position: Vec3,
        size: Vec2,
        panel_type: PanelType,
        color_scheme: ColorScheme,
    ) -> Self {
        Self {
            id,
            transform: Transform {
                position,
                rotation: crate::core::types::Quat::new(1.0, 0.0, 0.0, 0.0), // Quaternion identity
                scale: Vec3::new(1.0, 1.0, 1.0),
            },
            size,
            opacity: 0.0, // Start invisible for animation
            glow_intensity: 1.0,
            panel_type,
            is_active: false,
            is_minimized: false,
            animation_time: 0.0,
            hover_intensity: 0.0,
            creation_time: Instant::now(),
            color_scheme,
            border_thickness: 0.02,
            corner_radius: 0.1,
            hologram_flicker: 0.0,
        }
    }
    
    /// Update panel animations and effects
    pub fn update(&mut self, dt: f32) {
        self.animation_time += dt;
        
        // Fade in animation
        if self.opacity < 0.8 {
            self.opacity += dt * 2.0; // Fade in over 0.4 seconds
        }
        
        // Subtle hologram flicker
        self.hologram_flicker = (self.animation_time * 8.0).sin() * 0.05 + 1.0;
        
        // Floating animation
        let float_offset = (self.animation_time * 0.5).sin() * 0.02;
        self.transform.position.y += float_offset * dt;
        
        // Smooth hover effects
        if self.is_active {
            self.hover_intensity += dt * 4.0;
        } else {
            self.hover_intensity -= dt * 4.0;
        }
        self.hover_intensity = self.hover_intensity.clamp(0.0, 1.0);
    }
    
    /// Generate vertices for the holographic panel border
    pub fn generate_border_vertices(&self) -> (Vec<HologramVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        
        let pos = self.transform.position;
        let size = self.size;
        let thickness = self.border_thickness;
        let opacity = self.opacity * self.hologram_flicker;
        
        // Enhanced glow effect
        let glow_multiplier = 1.0 + self.hover_intensity * 0.5;
        let mut glow_color = self.color_scheme.glow;
        glow_color.r *= glow_multiplier;
        glow_color.g *= glow_multiplier;
        glow_color.b *= glow_multiplier;
        glow_color.a *= opacity;
        
        // Generate border quads (top, bottom, left, right)
        self.add_border_quad(&mut vertices, &mut indices, pos, size, thickness, glow_color);
        
        (vertices, indices)
    }
    
    fn add_border_quad(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        pos: Vec3,
        size: Vec2,
        thickness: f32,
        color: Color,
    ) {
        let start_idx = vertices.len() as u16;
        
        // Top border
        vertices.extend_from_slice(&[
            HologramVertex { position: [pos.x - size.x/2.0, pos.y + size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x + size.x/2.0, pos.y + size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x + size.x/2.0, pos.y + size.y/2.0 - thickness, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x - size.x/2.0, pos.y + size.y/2.0 - thickness, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
        ]);
        
        // Bottom border
        vertices.extend_from_slice(&[
            HologramVertex { position: [pos.x - size.x/2.0, pos.y - size.y/2.0 + thickness, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x + size.x/2.0, pos.y - size.y/2.0 + thickness, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x + size.x/2.0, pos.y - size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x - size.x/2.0, pos.y - size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
        ]);
        
        // Left border
        vertices.extend_from_slice(&[
            HologramVertex { position: [pos.x - size.x/2.0, pos.y - size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x - size.x/2.0 + thickness, pos.y - size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x - size.x/2.0 + thickness, pos.y + size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x - size.x/2.0, pos.y + size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
        ]);
        
        // Right border
        vertices.extend_from_slice(&[
            HologramVertex { position: [pos.x + size.x/2.0 - thickness, pos.y - size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x + size.x/2.0, pos.y - size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x + size.x/2.0, pos.y + size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
            HologramVertex { position: [pos.x + size.x/2.0 - thickness, pos.y + size.y/2.0, pos.z], color: [color.r, color.g, color.b, color.a], glow: self.glow_intensity },
        ]);
        
        // Generate indices for all border quads
        for i in 0..4 {
            let base = start_idx + (i * 4) as u16;
            indices.extend_from_slice(&[
                base, base + 1, base + 2,
                base + 2, base + 3, base,
            ]);
        }
    }
    
    /// Generate background vertices for the panel
    pub fn generate_background_vertices(&self) -> (Vec<HologramVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        
        let pos = self.transform.position;
        let size = self.size;
        
        // Create semi-transparent background color
        let mut bg_color = self.color_scheme.primary;
        bg_color.r *= 0.2;
        bg_color.g *= 0.2;
        bg_color.b *= 0.2;
        bg_color.a = 0.3 * self.opacity * self.hologram_flicker;
        
        // Add background quad
        let z_offset = pos.z - 0.01; // Slightly behind the border
        vertices.extend_from_slice(&[
            HologramVertex { 
                position: [pos.x - size.x/2.0, pos.y - size.y/2.0, z_offset], 
                color: [bg_color.r, bg_color.g, bg_color.b, bg_color.a], 
                glow: self.glow_intensity * 0.5 
            },
            HologramVertex { 
                position: [pos.x + size.x/2.0, pos.y - size.y/2.0, z_offset], 
                color: [bg_color.r, bg_color.g, bg_color.b, bg_color.a], 
                glow: self.glow_intensity * 0.5 
            },
            HologramVertex { 
                position: [pos.x + size.x/2.0, pos.y + size.y/2.0, z_offset], 
                color: [bg_color.r, bg_color.g, bg_color.b, bg_color.a], 
                glow: self.glow_intensity * 0.5 
            },
            HologramVertex { 
                position: [pos.x - size.x/2.0, pos.y + size.y/2.0, z_offset], 
                color: [bg_color.r, bg_color.g, bg_color.b, bg_color.a], 
                glow: self.glow_intensity * 0.5 
            },
        ]);
        
        // Add indices for the background quad
        indices.extend_from_slice(&[0, 1, 2, 2, 3, 0]);
        
        (vertices, indices)
    }
    
    /// Check if a point intersects with this panel
    pub fn contains_point(&self, point: Vec3) -> bool {
        let pos = self.transform.position;
        let half_size = Vec2::new(self.size.x / 2.0, self.size.y / 2.0);
        
        point.x >= pos.x - half_size.x &&
        point.x <= pos.x + half_size.x &&
        point.y >= pos.y - half_size.y &&
        point.y <= pos.y + half_size.y &&
        (point.z - pos.z).abs() < 0.1
    }
    
    /// Handle panel interaction
    pub fn on_hover(&mut self) {
        self.is_active = true;
    }
    
    pub fn on_hover_end(&mut self) {
        self.is_active = false;
    }
    
    pub fn on_click(&mut self) {
        // Trigger click animation
        self.glow_intensity = 2.0;
    }
}

/// Vertex structure for holographic effects
#[repr(C)]
#[derive(Copy, Clone, Debug)]
pub struct HologramVertex {
    pub position: [f32; 3],
    pub color: [f32; 4],
    pub glow: f32,
}

unsafe impl bytemuck::Pod for HologramVertex {}
unsafe impl bytemuck::Zeroable for HologramVertex {}

impl HologramVertex {
    pub fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<HologramVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                // Position
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x3,
                },
                // Color
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x4,
                },
                // Glow
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 7]>() as wgpu::BufferAddress,
                    shader_location: 2,
                    format: wgpu::VertexFormat::Float32,
                },
            ],
        }
    }
}