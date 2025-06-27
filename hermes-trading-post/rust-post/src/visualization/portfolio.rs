//! 3D Portfolio Sphere/Cube Visualization

use crate::core::types::{Vec3, Color};

pub struct PortfolioSphere {
    pub position: Vec3,
    pub radius: f32,
    pub holdings: Vec<Holding>,
    pub rotation_speed: f32,
}

#[derive(Debug, Clone)]
pub struct Holding {
    pub symbol: String,
    pub amount: f64,
    pub value: f64,
    pub percentage: f32,
    pub color: Color,
}

impl PortfolioSphere {
    pub fn new() -> Self {
        Self {
            position: Vec3::new(0.0, 0.0, 0.0),
            radius: 2.0,
            holdings: Vec::new(),
            rotation_speed: 0.5,
        }
    }
    
    pub fn update(&mut self, _dt: f32) {
        // Update portfolio visualization
    }
}