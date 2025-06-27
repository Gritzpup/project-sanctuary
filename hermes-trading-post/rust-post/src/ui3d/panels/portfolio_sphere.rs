//! Portfolio visualization as floating 3D sphere with orbiting assets

use crate::core::types::{Vec3, Color};
use crate::ui3d::panels::holographic_panel::{HolographicPanel, HologramVertex};
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct PortfolioSphere {
    pub base_panel: HolographicPanel,
    pub holdings: Vec<AssetHolding>,
    pub sphere_radius: f32,
    pub rotation_speed: f32,
    pub current_rotation: f32,
    pub total_value: f64,
}

#[derive(Clone, Debug)]
pub struct AssetHolding {
    pub symbol: String,
    pub amount: f64,
    pub value_usd: f64,
    pub percentage: f32,
    pub color: Color,
    pub orbit_radius: f32,
    pub orbit_speed: f32,
    pub current_angle: f32,
}

impl PortfolioSphere {
    pub fn new(panel: HolographicPanel) -> Self {
        Self {
            base_panel: panel,
            holdings: vec![
                AssetHolding {
                    symbol: "BTC".to_string(),
                    amount: 0.5,
                    value_usd: 53921.0,
                    percentage: 60.0,
                    color: Color::new(1.0, 0.6, 0.0, 1.0), // Bitcoin orange
                    orbit_radius: 1.2,
                    orbit_speed: 0.5,
                    current_angle: 0.0,
                },
                AssetHolding {
                    symbol: "ETH".to_string(),
                    amount: 8.2,
                    value_usd: 28240.0,
                    percentage: 30.0,
                    color: Color::new(0.3, 0.3, 0.9, 1.0), // Ethereum blue
                    orbit_radius: 1.0,
                    orbit_speed: 0.7,
                    current_angle: 2.1,
                },
                AssetHolding {
                    symbol: "SOL".to_string(),
                    amount: 45.0,
                    value_usd: 8968.0,
                    percentage: 10.0,
                    color: Color::new(0.6, 0.2, 0.8, 1.0), // Solana purple
                    orbit_radius: 0.8,
                    orbit_speed: 1.2,
                    current_angle: 4.2,
                },
            ],
            sphere_radius: 0.6,
            rotation_speed: 0.3,
            current_rotation: 0.0,
            total_value: 91129.0,
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        self.base_panel.update(dt);
        self.current_rotation += self.rotation_speed * dt;
        
        // Update orbiting assets
        for holding in &mut self.holdings {
            holding.current_angle += holding.orbit_speed * dt;
            if holding.current_angle > std::f32::consts::TAU {
                holding.current_angle -= std::f32::consts::TAU;
            }
        }
    }
    
    pub fn generate_vertices(&self) -> (Vec<HologramVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        
        let center = self.base_panel.transform.position;
        
        // Generate central sphere wireframe
        self.generate_sphere_wireframe(&mut vertices, &mut indices, center);
        
        // Generate orbiting asset representations
        for holding in &self.holdings {
            self.generate_asset_orbit(&mut vertices, &mut indices, center, holding);
        }
        
        // Add portfolio stats display
        self.generate_stats_display(&mut vertices, &mut indices, center);
        
        (vertices, indices)
    }
    
    fn generate_sphere_wireframe(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
    ) {
        let segments = 16;
        let rings = 8;
        let color = self.base_panel.color_scheme.primary;
        let glow = self.base_panel.glow_intensity;
        
        // Generate wireframe sphere
        for ring in 0..rings {
            let phi = std::f32::consts::PI * ring as f32 / (rings - 1) as f32;
            let y = self.sphere_radius * phi.cos();
            let ring_radius = self.sphere_radius * phi.sin();
            
            for segment in 0..segments {
                let theta = 2.0 * std::f32::consts::PI * segment as f32 / segments as f32;
                let x = ring_radius * theta.cos();
                let z = ring_radius * theta.sin();
                
                vertices.push(HologramVertex {
                    position: [center.x + x, center.y + y, center.z + z],
                    color: [color.r, color.g, color.b, color.a * 0.6],
                    glow: glow * 0.8,
                });
                
                // Connect to next point in ring
                if segment < segments - 1 {
                    let start_idx = vertices.len() as u16 - 1;
                    indices.extend_from_slice(&[start_idx, start_idx + 1]);
                } else {
                    // Connect last to first in ring
                    let end_idx = vertices.len() as u16 - 1;
                    let start_idx = end_idx.checked_sub(segments as u16 - 1)
                        .expect("segments as u16 - 1 must not be greater than end_idx") + 1;
                    indices.extend_from_slice(&[end_idx, start_idx]);
                }
                
                // Connect to corresponding point in next ring
                if ring < rings - 1 {
                    let current_idx = vertices.len() as u16 - 1;
                    let next_ring_idx = current_idx + segments as u16;
                    // We'll add this connection when we create the next ring
                }
            }
        }
    }
    
    fn generate_asset_orbit(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
        holding: &AssetHolding,
    ) {
        // Calculate current position of orbiting asset
        let x = center.x + holding.orbit_radius * holding.current_angle.cos();
        let y = center.y + (holding.current_angle * 0.5).sin() * 0.2; // Slight vertical bobbing
        let z = center.z + holding.orbit_radius * holding.current_angle.sin();
        
        // Asset size based on portfolio percentage
        let size = 0.1 + (holding.percentage / 100.0) * 0.15;
        
        // Generate small cube for asset
        let half_size = size / 2.0;
        let start_idx = vertices.len() as u16;
        
        // Cube vertices
        let cube_positions = [
            [x - half_size, y - half_size, z - half_size],
            [x + half_size, y - half_size, z - half_size],
            [x + half_size, y + half_size, z - half_size],
            [x - half_size, y + half_size, z - half_size],
            [x - half_size, y - half_size, z + half_size],
            [x + half_size, y - half_size, z + half_size],
            [x + half_size, y + half_size, z + half_size],
            [x - half_size, y + half_size, z + half_size],
        ];
        
        for pos in &cube_positions {
            vertices.push(HologramVertex {
                position: *pos,
                color: [holding.color.r, holding.color.g, holding.color.b, holding.color.a],
                glow: self.base_panel.glow_intensity,
            });
        }
        
        // Cube edges (wireframe)
        let cube_edges = [
            // Bottom face
            [0, 1], [1, 2], [2, 3], [3, 0],
            // Top face  
            [4, 5], [5, 6], [6, 7], [7, 4],
            // Vertical edges
            [0, 4], [1, 5], [2, 6], [3, 7],
        ];
        
        for edge in &cube_edges {
            indices.extend_from_slice(&[start_idx + edge[0], start_idx + edge[1]]);
        }
        
        // Generate orbit trail
        self.generate_orbit_trail(vertices, indices, center, holding);
    }
    
    fn generate_orbit_trail(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
        holding: &AssetHolding,
    ) {
        let trail_segments = 32;
        let mut trail_color = holding.color;
        trail_color.a *= 0.3; // Make trail more transparent
        
        for i in 0..trail_segments {
            let angle = 2.0 * std::f32::consts::PI * i as f32 / trail_segments as f32;
            let x = center.x + holding.orbit_radius * angle.cos();
            let y = center.y;
            let z = center.z + holding.orbit_radius * angle.sin();
            
            vertices.push(HologramVertex {
                position: [x, y, z],
                color: [trail_color.r, trail_color.g, trail_color.b, trail_color.a],
                glow: self.base_panel.glow_intensity * 0.5,
            });
            
            // Connect trail points
            if i > 0 {
                let current_idx = vertices.len() as u16 - 1;
                indices.extend_from_slice(&[current_idx - 1, current_idx]);
            }
        }
        
        // Close the orbit circle
        if trail_segments > 0 {
            let first_trail_idx = vertices.len() as u16 - trail_segments as u16;
            let last_trail_idx = vertices.len() as u16 - 1;
            indices.extend_from_slice(&[last_trail_idx, first_trail_idx]);
        }
    }
    
    fn generate_stats_display(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
    ) {
        // Generate floating text quads for portfolio stats
        let text_color = self.base_panel.color_scheme.text;
        let stats_y_offset = self.sphere_radius + 0.8;
        
        // Total value display
        self.add_text_quad(
            vertices,
            indices,
            Vec3::new(center.x, center.y + stats_y_offset, center.z),
            0.3,
            0.1,
            text_color,
        );
        
        // Individual holdings
        for (i, holding) in self.holdings.iter().enumerate() {
            let y_offset = stats_y_offset - 0.15 * (i + 1) as f32;
            self.add_text_quad(
                vertices,
                indices,
                Vec3::new(center.x + 0.5, center.y + y_offset, center.z),
                0.25,
                0.08,
                holding.color,
            );
        }
    }
    
    fn add_text_quad(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        position: Vec3,
        width: f32,
        height: f32,
        color: Color,
    ) {
        let start_idx = vertices.len() as u16;
        let half_w = width / 2.0;
        let half_h = height / 2.0;
        
        vertices.extend_from_slice(&[
            HologramVertex {
                position: [position.x - half_w, position.y - half_h, position.z],
                color: [color.r, color.g, color.b, color.a],
                glow: self.base_panel.glow_intensity,
            },
            HologramVertex {
                position: [position.x + half_w, position.y - half_h, position.z],
                color: [color.r, color.g, color.b, color.a],
                glow: self.base_panel.glow_intensity,
            },
            HologramVertex {
                position: [position.x + half_w, position.y + half_h, position.z],
                color: [color.r, color.g, color.b, color.a],
                glow: self.base_panel.glow_intensity,
            },
            HologramVertex {
                position: [position.x - half_w, position.y + half_h, position.z],
                color: [color.r, color.g, color.b, color.a],
                glow: self.base_panel.glow_intensity,
            },
        ]);
        
        indices.extend_from_slice(&[
            start_idx, start_idx + 1, start_idx + 2,
            start_idx + 2, start_idx + 3, start_idx,
        ]);
    }
    
    pub fn update_holdings(&mut self, holdings: Vec<AssetHolding>) {
        self.holdings = holdings;
        self.total_value = self.holdings.iter().map(|h| h.value_usd).sum();
    }
}