//! 3D Order Book Wall Visualization

use crate::core::types::{Vec3, Color};

pub struct OrderBookWall {
    pub position: Vec3,
    pub bids: Vec<OrderLevel>,
    pub asks: Vec<OrderLevel>,
}

#[derive(Debug, Clone)]
pub struct OrderLevel {
    pub price: f64,
    pub volume: f64,
    pub position: Vec3,
    pub color: Color,
}

impl OrderBookWall {
    pub fn new() -> Self {
        Self {
            position: Vec3::new(0.0, 0.0, 0.0),
            bids: Vec::new(),
            asks: Vec::new(),
        }
    }
    
    pub fn update(&mut self, _dt: f32) {
        // Update order book visualization
    }
}