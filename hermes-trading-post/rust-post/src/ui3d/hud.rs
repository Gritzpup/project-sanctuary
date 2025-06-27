//! Heads-up display for overlay UI

use crate::core::types::{Vec2, Color};

pub struct HUD {
    pub elements: Vec<HUDElement>,
    pub visible: bool,
}

pub struct HUDElement {
    pub position: Vec2,
    pub size: Vec2,
    pub content: String,
    pub color: Color,
}

impl HUD {
    pub fn new() -> Self {
        Self {
            elements: Vec::new(),
            visible: true,
        }
    }
}