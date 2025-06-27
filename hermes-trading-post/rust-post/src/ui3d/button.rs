//! Interactive 3D buttons

use crate::core::types::{Vec3, Color, Transform};

pub struct Button3D {
    pub transform: Transform,
    pub size: (f32, f32),
    pub label: String,
    pub color: Color,
    pub hover_color: Color,
    pub pressed_color: Color,
    pub state: ButtonState,
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ButtonState {
    Idle,
    Hovered,
    Pressed,
    Disabled,
}

impl Button3D {
    pub fn new(position: Vec3, size: (f32, f32), label: String) -> Self {
        Self {
            transform: Transform {
                position,
                ..Default::default()
            },
            size,
            label,
            color: Color::new(0.2, 0.2, 0.8, 0.8),
            hover_color: Color::new(0.3, 0.3, 1.0, 0.9),
            pressed_color: Color::new(0.1, 0.1, 0.6, 1.0),
            state: ButtonState::Idle,
            enabled: true,
        }
    }
}