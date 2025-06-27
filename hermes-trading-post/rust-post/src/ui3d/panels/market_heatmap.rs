//! Market heatmap as 3D grid showing crypto performance

use crate::core::types::{Vec3, Color};
use crate::ui3d::panels::holographic_panel::{HolographicPanel, HologramVertex};
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct MarketHeatmap {
    pub base_panel: HolographicPanel,
    pub crypto_data: Vec<CryptoTile>,
    pub grid_size: (u32, u32),
    pub tile_size: f32,
    pub tile_spacing: f32,
    pub height_multiplier: f32,
    pub animation_time: f32,
}

#[derive(Clone, Debug)]
pub struct CryptoTile {
    pub symbol: String,
    pub price: f64,
    pub change_24h: f32,
    pub volume_24h: f64,
    pub market_cap: f64,
    pub grid_position: (u32, u32),
    pub height: f32,
    pub color: Color,
    pub pulse_phase: f32,
}

impl MarketHeatmap {
    pub fn new(panel: HolographicPanel) -> Self {
        let mut heatmap = Self {
            base_panel: panel,
            crypto_data: Vec::new(),
            grid_size: (8, 6), // 8x6 grid = 48 cryptocurrencies
            tile_size: 0.12,
            tile_spacing: 0.15,
            height_multiplier: 0.8,
            animation_time: 0.0,
        };
        
        heatmap.init_sample_data();
        heatmap
    }
    
    fn init_sample_data(&mut self) {
        let sample_cryptos = [
            ("BTC", 107842.0, 2.35, 28.5e9, 2.1e12),
            ("ETH", 3441.0, 1.85, 15.2e9, 414e9),
            ("BNB", 692.0, -0.45, 1.8e9, 106e9),
            ("SOL", 199.3, 4.12, 3.2e9, 94e9),
            ("USDC", 1.00, 0.01, 4.1e9, 33e9),
            ("XRP", 2.43, -1.23, 1.9e9, 138e9),
            ("DOGE", 0.384, 3.56, 1.1e9, 56e9),
            ("TON", 5.67, 2.89, 245e6, 14.5e9),
            ("ADA", 1.08, -2.1, 892e6, 38e9),
            ("AVAX", 42.8, 1.67, 567e6, 17.2e9),
            ("SHIB", 0.0000245, 5.23, 678e6, 14.5e9),
            ("DOT", 8.94, -0.89, 234e6, 13.1e9),
            ("BCH", 514.0, 0.78, 456e6, 10.2e9),
            ("NEAR", 6.78, 3.45, 234e6, 7.8e9),
            ("LTC", 106.5, -1.56, 567e6, 8.1e9),
            ("UNI", 14.2, 2.34, 234e6, 8.9e9),
        ];
        
        for (i, (symbol, price, change, volume, mcap)) in sample_cryptos.iter().enumerate() {
            let grid_x = i as u32 % self.grid_size.0;
            let grid_y = i as u32 / self.grid_size.0;
            
            // Height based on 24h change
            let height = ((*change as f32).abs() / 10.0_f32).min(1.0_f32) * self.height_multiplier;
            
            // Color based on performance
            let color = if *change > 0.0 {
                // Green for positive
                let intensity = (*change / 5.0_f32).min(1.0_f32);
                Color::new(
                    0.1 * (1.0 - intensity) + 0.0 * intensity,
                    0.6 + 0.4 * intensity,
                    0.2 * (1.0 - intensity) + 0.0 * intensity,
                    0.8,
                )
            } else {
                // Red for negative
                let intensity = ((*change).abs() / 5.0_f32).min(1.0_f32);
                Color::new(
                    0.6 + 0.4 * intensity,
                    0.1 * (1.0 - intensity),
                    0.1 * (1.0 - intensity),
                    0.8,
                )
            };
            
            self.crypto_data.push(CryptoTile {
                symbol: symbol.to_string(),
                price: *price,
                change_24h: *change,
                volume_24h: *volume,
                market_cap: *mcap,
                grid_position: (grid_x, grid_y),
                height,
                color,
                pulse_phase: i as f32 * 0.5, // Stagger pulse animations
            });
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        self.base_panel.update(dt);
        self.animation_time += dt;
        
        // Update tile animations
        for tile in &mut self.crypto_data {
            tile.pulse_phase += dt * 2.0;
            
            // Pulse effect for tiles with high volatility
            if tile.change_24h.abs() > 3.0 {
                let pulse = (tile.pulse_phase.sin() * 0.5 + 0.5) * 0.3 + 0.7;
                tile.color.a = pulse;
            }
        }
    }
    
    pub fn generate_vertices(&self) -> (Vec<HologramVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        
        let center = self.base_panel.transform.position;
        let grid_width = self.grid_size.0 as f32 * self.tile_spacing;
        let grid_height = self.grid_size.1 as f32 * self.tile_spacing;
        
        // Generate grid base
        self.generate_grid_base(&mut vertices, &mut indices, center);
        
        // Generate crypto tiles
        for tile in &self.crypto_data {
            let tile_x = center.x - grid_width / 2.0 + tile.grid_position.0 as f32 * self.tile_spacing;
            let tile_z = center.z - grid_height / 2.0 + tile.grid_position.1 as f32 * self.tile_spacing;
            let tile_y = center.y + tile.height / 2.0;
            
            self.generate_crypto_tile(
                &mut vertices,
                &mut indices,
                Vec3::new(tile_x, tile_y, tile_z),
                tile,
            );
        }
        
        // Generate labels
        self.generate_tile_labels(&mut vertices, &mut indices, center);
        
        (vertices, indices)
    }
    
    fn generate_grid_base(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
    ) {
        let grid_color = self.base_panel.color_scheme.secondary;
        let grid_width = self.grid_size.0 as f32 * self.tile_spacing;
        let grid_height = self.grid_size.1 as f32 * self.tile_spacing;
        
        // Horizontal grid lines
        for i in 0..=self.grid_size.1 {
            let y = center.y - 0.05;
            let z = center.z - grid_height / 2.0 + i as f32 * self.tile_spacing;
            let start_idx = vertices.len() as u16;
            
            vertices.extend_from_slice(&[
                HologramVertex {
                    position: [center.x - grid_width / 2.0, y, z],
                    color: [grid_color.r, grid_color.g, grid_color.b, grid_color.a * 0.5],
                    glow: self.base_panel.glow_intensity * 0.3,
                },
                HologramVertex {
                    position: [center.x + grid_width / 2.0, y, z],
                    color: [grid_color.r, grid_color.g, grid_color.b, grid_color.a * 0.5],
                    glow: self.base_panel.glow_intensity * 0.3,
                },
            ]);
            
            indices.extend_from_slice(&[start_idx, start_idx + 1]);
        }
        
        // Vertical grid lines
        for i in 0..=self.grid_size.0 {
            let y = center.y - 0.05;
            let x = center.x - grid_width / 2.0 + i as f32 * self.tile_spacing;
            let start_idx = vertices.len() as u16;
            
            vertices.extend_from_slice(&[
                HologramVertex {
                    position: [x, y, center.z - grid_height / 2.0],
                    color: [grid_color.r, grid_color.g, grid_color.b, grid_color.a * 0.5],
                    glow: self.base_panel.glow_intensity * 0.3,
                },
                HologramVertex {
                    position: [x, y, center.z + grid_height / 2.0],
                    color: [grid_color.r, grid_color.g, grid_color.b, grid_color.a * 0.5],
                    glow: self.base_panel.glow_intensity * 0.3,
                },
            ]);
            
            indices.extend_from_slice(&[start_idx, start_idx + 1]);
        }
    }
    
    fn generate_crypto_tile(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        position: Vec3,
        tile: &CryptoTile,
    ) {
        let start_idx = vertices.len() as u16;
        let half_size = self.tile_size / 2.0;
        let height = tile.height;
        
        // Generate tile as a box with different colors for faces
        let base_color = tile.color;
        let top_color = Color::new(
            base_color.r * 1.3,
            base_color.g * 1.3,
            base_color.b * 1.3,
            base_color.a,
        );
        
        // Bottom face (at grid level)
        let bottom_y = position.y - height / 2.0;
        vertices.extend_from_slice(&[
            HologramVertex {
                position: [position.x - half_size, bottom_y, position.z - half_size],
                color: [base_color.r * 0.7, base_color.g * 0.7, base_color.b * 0.7, base_color.a],
                glow: self.base_panel.glow_intensity * 0.5,
            },
            HologramVertex {
                position: [position.x + half_size, bottom_y, position.z - half_size],
                color: [base_color.r * 0.7, base_color.g * 0.7, base_color.b * 0.7, base_color.a],
                glow: self.base_panel.glow_intensity * 0.5,
            },
            HologramVertex {
                position: [position.x + half_size, bottom_y, position.z + half_size],
                color: [base_color.r * 0.7, base_color.g * 0.7, base_color.b * 0.7, base_color.a],
                glow: self.base_panel.glow_intensity * 0.5,
            },
            HologramVertex {
                position: [position.x - half_size, bottom_y, position.z + half_size],
                color: [base_color.r * 0.7, base_color.g * 0.7, base_color.b * 0.7, base_color.a],
                glow: self.base_panel.glow_intensity * 0.5,
            },
        ]);
        
        // Top face (bright)
        let top_y = position.y + height / 2.0;
        vertices.extend_from_slice(&[
            HologramVertex {
                position: [position.x - half_size, top_y, position.z - half_size],
                color: [top_color.r, top_color.g, top_color.b, top_color.a],
                glow: self.base_panel.glow_intensity * 1.5,
            },
            HologramVertex {
                position: [position.x + half_size, top_y, position.z - half_size],
                color: [top_color.r, top_color.g, top_color.b, top_color.a],
                glow: self.base_panel.glow_intensity * 1.5,
            },
            HologramVertex {
                position: [position.x + half_size, top_y, position.z + half_size],
                color: [top_color.r, top_color.g, top_color.b, top_color.a],
                glow: self.base_panel.glow_intensity * 1.5,
            },
            HologramVertex {
                position: [position.x - half_size, top_y, position.z + half_size],
                color: [top_color.r, top_color.g, top_color.b, top_color.a],
                glow: self.base_panel.glow_intensity * 1.5,
            },
        ]);
        
        // Generate indices for all faces
        let face_indices = [
            // Bottom face
            [0, 2, 1], [2, 0, 3],
            // Top face  
            [4, 5, 6], [6, 7, 4],
            // Side faces connecting bottom to top
            [0, 1, 5], [5, 4, 0], // Front
            [1, 2, 6], [6, 5, 1], // Right
            [2, 3, 7], [7, 6, 2], // Back
            [3, 0, 4], [4, 7, 3], // Left
        ];
        
        for triangle in &face_indices {
            indices.extend_from_slice(&[
                start_idx + triangle[0],
                start_idx + triangle[1],
                start_idx + triangle[2],
            ]);
        }
    }
    
    fn generate_tile_labels(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
    ) {
        let text_color = self.base_panel.color_scheme.text;
        let grid_width = self.grid_size.0 as f32 * self.tile_spacing;
        let grid_height = self.grid_size.1 as f32 * self.tile_spacing;
        
        // Title label
        self.add_text_quad(
            vertices,
            indices,
            Vec3::new(center.x, center.y + 1.2, center.z - grid_height / 2.0 - 0.3),
            0.6,
            0.12,
            text_color,
        );
        
        // Legend
        self.add_text_quad(
            vertices,
            indices,
            Vec3::new(center.x - grid_width / 2.0 - 0.5, center.y + 0.8, center.z),
            0.4,
            0.08,
            Color::new(0.0, 1.0, 0.3, 1.0), // Green
        );
        
        self.add_text_quad(
            vertices,
            indices,
            Vec3::new(center.x - grid_width / 2.0 - 0.5, center.y + 0.6, center.z),
            0.4,
            0.08,
            Color::new(1.0, 0.2, 0.2, 1.0), // Red
        );
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
    
    pub fn update_market_data(&mut self, symbol: &str, price: f64, change_24h: f32) {
        if let Some(tile) = self.crypto_data.iter_mut().find(|t| t.symbol == symbol) {
            tile.price = price;
            tile.change_24h = change_24h;
            tile.height = (change_24h.abs() / 10.0).min(1.0) * self.height_multiplier;
            
            // Update color based on new change
            tile.color = if change_24h > 0.0 {
                let intensity = (change_24h / 5.0).min(1.0);
                Color::new(
                    0.1 * (1.0 - intensity),
                    0.6 + 0.4 * intensity,
                    0.2 * (1.0 - intensity),
                    0.8,
                )
            } else {
                let intensity = (change_24h.abs() / 5.0).min(1.0);
                Color::new(
                    0.6 + 0.4 * intensity,
                    0.1 * (1.0 - intensity),
                    0.1 * (1.0 - intensity),
                    0.8,
                )
            };
        }
    }
}