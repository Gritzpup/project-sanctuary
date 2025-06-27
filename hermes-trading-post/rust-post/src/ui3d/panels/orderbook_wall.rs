//! Order book visualization as towering buy/sell walls

use crate::core::types::{Vec3, Color};
use crate::ui3d::panels::holographic_panel::{HolographicPanel, HologramVertex};

#[derive(Clone, Debug)]
pub struct OrderBookWall {
    pub base_panel: HolographicPanel,
    pub buy_orders: Vec<OrderLevel>,
    pub sell_orders: Vec<OrderLevel>,
    pub max_wall_height: f32,
    pub wall_width: f32,
    pub level_spacing: f32,
    pub animation_progress: f32,
}

#[derive(Clone, Debug)]
pub struct OrderLevel {
    pub price: f64,
    pub volume: f64,
    pub cumulative_volume: f64,
    pub normalized_height: f32, // 0.0 to 1.0
    pub is_buy: bool,
}

impl OrderBookWall {
    pub fn new(panel: HolographicPanel) -> Self {
        let mut wall = Self {
            base_panel: panel,
            buy_orders: Vec::new(),
            sell_orders: Vec::new(),
            max_wall_height: 2.0,
            wall_width: 1.5,
            level_spacing: 0.05,
            animation_progress: 0.0,
        };
        
        // Initialize with sample order book data
        wall.init_sample_data();
        wall
    }
    
    fn init_sample_data(&mut self) {
        // Sample buy orders (below current price)
        let current_price = 107842.0;
        for i in 0..20 {
            let price = current_price - (i as f64 * 50.0);
            let volume = 0.1 + (20 - i) as f64 * 0.05; // More volume closer to current price
            
            self.buy_orders.push(OrderLevel {
                price,
                volume,
                cumulative_volume: 0.0, // Will be calculated
                normalized_height: 0.0, // Will be calculated
                is_buy: true,
            });
        }
        
        // Sample sell orders (above current price)
        for i in 0..20 {
            let price = current_price + (i as f64 * 50.0);
            let volume = 0.1 + (20 - i) as f64 * 0.05;
            
            self.sell_orders.push(OrderLevel {
                price,
                volume,
                cumulative_volume: 0.0,
                normalized_height: 0.0,
                is_buy: false,
            });
        }
        
        self.calculate_normalized_heights();
    }
    
    fn calculate_normalized_heights(&mut self) {
        // Calculate cumulative volumes and normalize heights
        let max_volume = self.buy_orders.iter()
            .chain(self.sell_orders.iter())
            .map(|order| order.volume)
            .fold(0.0, f64::max);
        
        // Normalize buy orders
        for order in &mut self.buy_orders {
            order.normalized_height = (order.volume / max_volume) as f32;
        }
        
        // Normalize sell orders
        for order in &mut self.sell_orders {
            order.normalized_height = (order.volume / max_volume) as f32;
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        self.base_panel.update(dt);
        
        // Animate walls growing from bottom
        if self.animation_progress < 1.0 {
            self.animation_progress += dt * 1.5; // 2/3 second animation
            self.animation_progress = self.animation_progress.min(1.0);
        }
    }
    
    pub fn generate_vertices(&self) -> (Vec<HologramVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        
        let center = self.base_panel.transform.position;
        
        // Generate buy wall (left side, green)
        self.generate_order_wall(
            &mut vertices,
            &mut indices,
            center,
            &self.buy_orders,
            true,  // is_buy
            Color::new(0.0, 1.0, 0.3, 0.8), // Bright green
        );
        
        // Generate sell wall (right side, red)
        self.generate_order_wall(
            &mut vertices,
            &mut indices,
            center,
            &self.sell_orders,
            false, // is_sell
            Color::new(1.0, 0.2, 0.2, 0.8), // Bright red
        );
        
        // Generate center divider
        self.generate_center_divider(&mut vertices, &mut indices, center);
        
        // Generate price labels
        self.generate_price_labels(&mut vertices, &mut indices, center);
        
        (vertices, indices)
    }
    
    fn generate_order_wall(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
        orders: &[OrderLevel],
        is_buy: bool,
        base_color: Color,
    ) {
        let x_offset = if is_buy { -self.wall_width / 2.0 } else { self.wall_width / 2.0 };
        let wall_depth = 0.15;
        
        for (i, order) in orders.iter().enumerate() {
            let y_offset = (i as f32 * self.level_spacing) - 0.5;
            let height = order.normalized_height * self.max_wall_height * self.animation_progress;
            
            if height < 0.01 { continue; } // Skip tiny orders
            
            // Enhance color based on volume
            let volume_multiplier = 0.7 + (order.normalized_height * 0.8);
            let color = Color::new(
                base_color.r * volume_multiplier,
                base_color.g * volume_multiplier,
                base_color.b * volume_multiplier,
                base_color.a,
            );
            
            self.generate_wall_block(
                vertices,
                indices,
                Vec3::new(
                    center.x + x_offset,
                    center.y + y_offset,
                    center.z,
                ),
                wall_depth,
                self.level_spacing * 0.8,
                height,
                color,
            );
        }
    }
    
    fn generate_wall_block(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        position: Vec3,
        width: f32,
        depth: f32,
        height: f32,
        color: Color,
    ) {
        let start_idx = vertices.len() as u16;
        let half_width = width / 2.0;
        let half_depth = depth / 2.0;
        
        // Generate block vertices (bottom face at y=0, top face at y=height)
        let block_vertices = [
            // Bottom face (4 vertices)
            [position.x - half_width, position.y, position.z - half_depth],
            [position.x + half_width, position.y, position.z - half_depth],
            [position.x + half_width, position.y, position.z + half_depth],
            [position.x - half_width, position.y, position.z + half_depth],
            // Top face (4 vertices)
            [position.x - half_width, position.y + height, position.z - half_depth],
            [position.x + half_width, position.y + height, position.z - half_depth],
            [position.x + half_width, position.y + height, position.z + half_depth],
            [position.x - half_width, position.y + height, position.z + half_depth],
        ];
        
        // Different intensities for different faces
        let face_multipliers = [
            1.0,   // Bottom
            1.2,   // Top (brighter)
            0.8,   // Front
            0.6,   // Back
            0.9,   // Right
            0.7,   // Left
        ];
        
        for (i, pos) in block_vertices.iter().enumerate() {
            let face_idx = if i < 4 { 0 } else { 1 }; // Bottom or top face
            let multiplier = face_multipliers[face_idx];
            
            vertices.push(HologramVertex {
                position: *pos,
                color: [
                    color.r * multiplier,
                    color.g * multiplier,
                    color.b * multiplier,
                    color.a,
                ],
                glow: self.base_panel.glow_intensity,
            });
        }
        
        // Generate indices for the block faces
        let face_indices = [
            // Bottom face
            [0, 1, 2], [2, 3, 0],
            // Top face
            [4, 6, 5], [6, 4, 7],
            // Front face
            [0, 4, 5], [5, 1, 0],
            // Back face
            [2, 6, 7], [7, 3, 2],
            // Right face
            [1, 5, 6], [6, 2, 1],
            // Left face
            [3, 7, 4], [4, 0, 3],
        ];
        
        for triangle in &face_indices {
            indices.extend_from_slice(&[
                start_idx + triangle[0],
                start_idx + triangle[1], 
                start_idx + triangle[2],
            ]);
        }
    }
    
    fn generate_center_divider(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
    ) {
        let divider_color = self.base_panel.color_scheme.accent;
        let divider_height = self.max_wall_height * 1.1;
        let divider_width = 0.02;
        
        // Vertical divider line
        let start_idx = vertices.len() as u16;
        
        vertices.extend_from_slice(&[
            HologramVertex {
                position: [center.x, center.y - 0.6, center.z],
                color: [divider_color.r, divider_color.g, divider_color.b, divider_color.a],
                glow: self.base_panel.glow_intensity * 1.5,
            },
            HologramVertex {
                position: [center.x, center.y + divider_height - 0.6, center.z],
                color: [divider_color.r, divider_color.g, divider_color.b, divider_color.a],
                glow: self.base_panel.glow_intensity * 1.5,
            },
        ]);
        
        indices.extend_from_slice(&[start_idx, start_idx + 1]);
        
        // Horizontal price line
        let price_line_idx = vertices.len() as u16;
        
        vertices.extend_from_slice(&[
            HologramVertex {
                position: [center.x - self.wall_width / 2.0, center.y, center.z],
                color: [divider_color.r, divider_color.g, divider_color.b, divider_color.a * 0.7],
                glow: self.base_panel.glow_intensity,
            },
            HologramVertex {
                position: [center.x + self.wall_width / 2.0, center.y, center.z],
                color: [divider_color.r, divider_color.g, divider_color.b, divider_color.a * 0.7],
                glow: self.base_panel.glow_intensity,
            },
        ]);
        
        indices.extend_from_slice(&[price_line_idx, price_line_idx + 1]);
    }
    
    fn generate_price_labels(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        center: Vec3,
    ) {
        let text_color = self.base_panel.color_scheme.text;
        
        // Current price label
        self.add_text_quad(
            vertices,
            indices,
            Vec3::new(center.x + self.wall_width / 2.0 + 0.3, center.y, center.z),
            0.4,
            0.08,
            text_color,
        );
        
        // Volume labels
        let max_buy = self.buy_orders.iter().map(|o| o.volume).fold(0.0, f64::max);
        let max_sell = self.sell_orders.iter().map(|o| o.volume).fold(0.0, f64::max);
        
        // Buy volume label
        self.add_text_quad(
            vertices,
            indices,
            Vec3::new(center.x - self.wall_width / 2.0 - 0.3, center.y + 0.8, center.z),
            0.3,
            0.06,
            Color::new(0.0, 1.0, 0.3, 1.0),
        );
        
        // Sell volume label
        self.add_text_quad(
            vertices,
            indices,
            Vec3::new(center.x + self.wall_width / 2.0 + 0.3, center.y + 0.8, center.z),
            0.3,
            0.06,
            Color::new(1.0, 0.2, 0.2, 1.0),
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
    
    pub fn update_order_book(&mut self, buy_orders: Vec<OrderLevel>, sell_orders: Vec<OrderLevel>) {
        self.buy_orders = buy_orders;
        self.sell_orders = sell_orders;
        self.calculate_normalized_heights();
        self.animation_progress = 0.0; // Restart animation
    }
}