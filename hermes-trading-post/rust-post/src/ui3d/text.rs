//! 3D text rendering

use crate::core::types::{Vec3, Color};

pub struct Text3D {
    pub position: Vec3,
    pub text: String,
    pub size: f32,
    pub color: Color,
    pub font_family: String,
}

impl Text3D {
    pub fn new(position: Vec3, text: String, size: f32) -> Self {
        Self {
            position,
            text,
            size,
            color: Color::new(1.0, 1.0, 1.0, 1.0),
            font_family: "monospace".to_string(),
        }
    }
}