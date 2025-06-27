//! Radial layout for 3D UI elements

use crate::core::types::Vec3;
use std::f32::consts::PI;

pub struct RadialLayout3D {
    pub radius: f32,
    pub center: Vec3,
    pub start_angle: f32,
    pub total_angle: f32,
}

impl RadialLayout3D {
    pub fn new(radius: f32, center: Vec3) -> Self {
        Self {
            radius,
            center,
            start_angle: 0.0,
            total_angle: 2.0 * PI,
        }
    }
    
    pub fn get_position(&self, index: u32, total_items: u32) -> Vec3 {
        let angle_step = self.total_angle / total_items as f32;
        let angle = self.start_angle + index as f32 * angle_step;
        
        Vec3::new(
            self.center.x + self.radius * angle.cos(),
            self.center.y,
            self.center.z + self.radius * angle.sin(),
        )
    }
}