//! Futuristic 3D panels with holographic effects

use crate::core::types::{Vec2, Vec3, Transform, Color};

#[derive(Debug, Clone)]
pub struct Panel3D {
    pub transform: Transform,
    pub size: Vec2,
    pub content: PanelContent,
    pub style: PanelStyle,
    pub state: PanelState,
    
    // Visual effects
    pub glow_intensity: f32,
    pub hologram_opacity: f32,
    pub scan_line_position: f32,
    pub distortion_amount: f32,
    
    // Animation
    pub hover_offset: f32,
    pub pulse_phase: f32,
}

#[derive(Debug, Clone)]
pub enum PanelContent {
    Price {
        symbol: String,
        value: f64,
        change_percent: f64,
    },
    Chart {
        data_points: Vec<f32>,
    },
    OrderBook {
        bids: Vec<(f64, f64)>,
        asks: Vec<(f64, f64)>,
    },
    Portfolio {
        holdings: Vec<(String, f64, f64)>,
    },
    Custom {
        title: String,
        data: String,
    },
}

#[derive(Debug, Clone, Copy)]
pub enum PanelStyle {
    Holographic,      // Transparent with scan lines
    NeonFrame,        // Glowing border
    GlassPanel,       // Frosted glass effect
    MatrixStyle,      // Digital rain background
    CircuitBoard,     // Tech pattern background
}

#[derive(Debug, Clone, Copy)]
pub enum PanelState {
    Idle,
    Hovered,
    Active,
    Minimized,
    Transitioning(f32), // 0.0 to 1.0
}

impl Panel3D {
    pub fn new(position: Vec3, size: Vec2, style: PanelStyle) -> Self {
        Self {
            transform: Transform {
                position,
                ..Default::default()
            },
            size,
            content: PanelContent::Custom {
                title: "Panel".to_string(),
                data: "Loading...".to_string(),
            },
            style,
            state: PanelState::Idle,
            glow_intensity: 1.0,
            hologram_opacity: 0.8,
            scan_line_position: 0.0,
            distortion_amount: 0.0,
            hover_offset: 0.0,
            pulse_phase: 0.0,
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        // Update scan line animation
        self.scan_line_position = (self.scan_line_position + dt * 0.5) % 1.0;
        
        // Update pulse effect
        self.pulse_phase = (self.pulse_phase + dt * 2.0) % (2.0 * std::f32::consts::PI);
        
        // Update hover animation
        match self.state {
            PanelState::Hovered => {
                self.hover_offset = (self.hover_offset + dt * 3.0).min(1.0);
                self.glow_intensity = 1.0 + 0.5 * self.pulse_phase.sin();
            }
            _ => {
                self.hover_offset = (self.hover_offset - dt * 3.0).max(0.0);
                self.glow_intensity = 1.0;
            }
        }
        
        // Apply hover offset to position
        let hover_y = self.hover_offset * 0.1;
        self.transform.position.y += hover_y * dt;
    }
    
    pub fn get_color(&self) -> Color {
        match self.style {
            PanelStyle::Holographic => Color::new(0.0, 1.0, 1.0, self.hologram_opacity),
            PanelStyle::NeonFrame => Color::NEON_PINK,
            PanelStyle::GlassPanel => Color::new(1.0, 1.0, 1.0, 0.2),
            PanelStyle::MatrixStyle => Color::NEON_GREEN,
            PanelStyle::CircuitBoard => Color::new(0.0, 0.8, 1.0, 0.9),
        }
    }
}