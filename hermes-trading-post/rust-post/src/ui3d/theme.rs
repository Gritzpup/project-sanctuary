//! Futuristic theme system for the 3D dashboard

use crate::core::types::Color;

#[derive(Debug, Clone)]
pub struct FuturisticTheme {
    pub name: String,
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    pub background: Color,
    pub text: Color,
    pub glow: GlowSettings,
    pub effects: EffectSettings,
}

#[derive(Debug, Clone)]
pub struct GlowSettings {
    pub intensity: f32,
    pub radius: f32,
    pub pulse_speed: f32,
    pub color_shift: bool,
}

#[derive(Debug, Clone)]
pub struct EffectSettings {
    pub chromatic_aberration: f32,
    pub scan_lines: bool,
    pub noise_amount: f32,
    pub hologram_flicker: f32,
    pub digital_glitch: bool,
}

impl FuturisticTheme {
    pub fn cyberpunk() -> Self {
        Self {
            name: "Cyberpunk 2077".to_string(),
            primary: Color::CYAN,
            secondary: Color::MAGENTA,
            accent: Color::YELLOW,
            background: Color::new(0.02, 0.02, 0.04, 1.0),
            text: Color::new(0.9, 0.9, 0.9, 1.0),
            glow: GlowSettings {
                intensity: 1.5,
                radius: 20.0,
                pulse_speed: 2.0,
                color_shift: true,
            },
            effects: EffectSettings {
                chromatic_aberration: 0.02,
                scan_lines: true,
                noise_amount: 0.05,
                hologram_flicker: 0.1,
                digital_glitch: true,
            },
        }
    }
    
    pub fn matrix() -> Self {
        Self {
            name: "Matrix".to_string(),
            primary: Color::NEON_GREEN,
            secondary: Color::new(0.0, 0.5, 0.0, 1.0),
            accent: Color::new(0.0, 1.0, 0.0, 1.0),
            background: Color::new(0.0, 0.0, 0.0, 1.0),
            text: Color::NEON_GREEN,
            glow: GlowSettings {
                intensity: 2.0,
                radius: 15.0,
                pulse_speed: 1.0,
                color_shift: false,
            },
            effects: EffectSettings {
                chromatic_aberration: 0.0,
                scan_lines: false,
                noise_amount: 0.1,
                hologram_flicker: 0.0,
                digital_glitch: false,
            },
        }
    }
    
    pub fn tron() -> Self {
        Self {
            name: "Tron Legacy".to_string(),
            primary: Color::new(0.0, 0.8, 1.0, 1.0),
            secondary: Color::new(1.0, 0.5, 0.0, 1.0),
            accent: Color::new(1.0, 1.0, 1.0, 1.0),
            background: Color::new(0.0, 0.0, 0.05, 1.0),
            text: Color::new(0.8, 0.9, 1.0, 1.0),
            glow: GlowSettings {
                intensity: 2.5,
                radius: 25.0,
                pulse_speed: 0.5,
                color_shift: false,
            },
            effects: EffectSettings {
                chromatic_aberration: 0.01,
                scan_lines: false,
                noise_amount: 0.0,
                hologram_flicker: 0.0,
                digital_glitch: false,
            },
        }
    }
    
    pub fn synthwave() -> Self {
        Self {
            name: "Synthwave".to_string(),
            primary: Color::MAGENTA,
            secondary: Color::CYAN,
            accent: Color::new(1.0, 0.0, 0.5, 1.0),
            background: Color::new(0.1, 0.0, 0.2, 1.0),
            text: Color::new(1.0, 0.8, 1.0, 1.0),
            glow: GlowSettings {
                intensity: 3.0,
                radius: 30.0,
                pulse_speed: 3.0,
                color_shift: true,
            },
            effects: EffectSettings {
                chromatic_aberration: 0.03,
                scan_lines: true,
                noise_amount: 0.02,
                hologram_flicker: 0.05,
                digital_glitch: false,
            },
        }
    }
}