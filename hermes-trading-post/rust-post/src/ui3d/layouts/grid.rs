//! Grid layout for 3D UI elements

use crate::core::types::Vec3;

pub struct GridLayout3D {
    pub columns: u32,
    pub rows: u32,
    pub spacing: f32,
    pub origin: Vec3,
}

impl GridLayout3D {
    pub fn new(columns: u32, rows: u32, spacing: f32) -> Self {
        Self {
            columns,
            rows,
            spacing,
            origin: Vec3::new(0.0, 0.0, 0.0),
        }
    }
    
    pub fn get_position(&self, index: u32) -> Vec3 {
        let col = index % self.columns;
        let row = index / self.columns;
        
        Vec3::new(
            self.origin.x + col as f32 * self.spacing,
            self.origin.y,
            self.origin.z + row as f32 * self.spacing,
        )
    }
}