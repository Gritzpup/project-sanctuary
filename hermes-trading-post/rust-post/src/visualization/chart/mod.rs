//! Bitcoin chart visualization integrated from existing btc-chart code

pub mod data;
pub mod graphics;
pub mod camera;

use crate::core::types::{Vec3, Color};

pub use data::*;
pub use graphics::*;
pub use camera::*;

pub struct BtcChart3D {
    pub position: Vec3,
    pub candles: Vec<Candle3D>,
    pub real_time_enabled: bool,
}

#[derive(Debug, Clone)]
pub struct Candle3D {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub position: Vec3,
    pub color: Color,
}

impl BtcChart3D {
    pub fn new() -> Self {
        Self {
            position: Vec3::new(0.0, 0.0, 0.0),
            candles: Vec::new(),
            real_time_enabled: true,
        }
    }
    
    pub fn update(&mut self, _dt: f32) {
        // Update chart visualization
    }
    
    pub fn add_candle(&mut self, candle: Candle3D) {
        self.candles.push(candle);
        
        // Keep only last 100 candles for performance
        if self.candles.len() > 100 {
            self.candles.remove(0);
        }
    }
}