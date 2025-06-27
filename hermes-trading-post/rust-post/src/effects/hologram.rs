//! Hologram effects for futuristic UI elements

use crate::core::types::Color;

pub struct HologramEffect {
    pub opacity: f32,
    pub scan_line_speed: f32,
    pub scan_line_thickness: f32,
    pub flicker_intensity: f32,
    pub flicker_frequency: f32,
    pub chromatic_aberration: f32,
    pub noise_amount: f32,
    pub edge_glow: f32,
    pub enabled: bool,
    
    // Animation state
    pub time: f32,
    pub scan_line_position: f32,
    pub flicker_phase: f32,
    pub glitch_timer: f32,
    pub glitch_intensity: f32,
}

impl HologramEffect {
    pub fn new() -> Self {
        Self {
            opacity: 0.85,
            scan_line_speed: 2.0,
            scan_line_thickness: 0.02,
            flicker_intensity: 0.1,
            flicker_frequency: 0.5,
            chromatic_aberration: 0.002,
            noise_amount: 0.05,
            edge_glow: 1.5,
            enabled: true,
            time: 0.0,
            scan_line_position: 0.0,
            flicker_phase: 0.0,
            glitch_timer: 0.0,
            glitch_intensity: 0.0,
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        if !self.enabled {
            return;
        }
        
        self.time += dt;
        
        // Update scan lines
        self.scan_line_position += self.scan_line_speed * dt;
        if self.scan_line_position > 1.0 {
            self.scan_line_position -= 1.0;
        }
        
        // Update flicker
        self.flicker_phase += self.flicker_frequency * dt;
        
        // Update glitch effect
        self.glitch_timer -= dt;
        if self.glitch_timer <= 0.0 {
            // Random glitch events
            if rand::random::<f32>() < 0.01 { // 1% chance per frame
                self.glitch_timer = 0.1 + rand::random::<f32>() * 0.3;
                self.glitch_intensity = 0.5 + rand::random::<f32>() * 0.5;
            } else {
                self.glitch_intensity = 0.0;
            }
        }
    }
    
    pub fn get_scan_line_alpha(&self, y_position: f32) -> f32 {
        let distance = (y_position - self.scan_line_position).abs();
        if distance < self.scan_line_thickness {
            let fade = 1.0 - (distance / self.scan_line_thickness);
            fade * 0.8
        } else {
            0.0
        }
    }
    
    pub fn get_flicker_modifier(&self) -> f32 {
        let base_flicker = (self.flicker_phase.sin() * 0.5 + 0.5) * self.flicker_intensity;
        let glitch_flicker = self.glitch_intensity * (self.time * 50.0).sin();
        1.0 - (base_flicker + glitch_flicker)
    }
    
    pub fn get_noise_offset(&self, x: f32, y: f32) -> (f32, f32) {
        let noise_x = (x * 100.0 + self.time * 10.0).sin() * self.noise_amount;
        let noise_y = (y * 100.0 + self.time * 10.0).cos() * self.noise_amount;
        (noise_x, noise_y)
    }
    
    pub fn get_chromatic_offset(&self) -> (f32, f32, f32) {
        let aberration = self.chromatic_aberration * (1.0 + self.glitch_intensity);
        (
            -aberration, // Red offset
            0.0,         // Green offset (center)
            aberration,  // Blue offset
        )
    }
    
    pub fn get_edge_glow_intensity(&self, distance_from_edge: f32) -> f32 {
        let glow = (-distance_from_edge * 5.0).exp() * self.edge_glow;
        glow * self.get_flicker_modifier()
    }
    
    pub fn apply_hologram_color(&self, base_color: Color, uv: (f32, f32)) -> Color {
        if !self.enabled {
            return base_color;
        }
        
        let flicker_mod = self.get_flicker_modifier();
        let scan_alpha = self.get_scan_line_alpha(uv.1);
        
        // Apply holographic tint (cyan-ish)
        let hologram_tint = Color::new(0.8, 1.0, 1.2, 1.0);
        
        let mut result = Color::new(
            base_color.r * hologram_tint.r * flicker_mod,
            base_color.g * hologram_tint.g * flicker_mod,
            base_color.b * hologram_tint.b * flicker_mod,
            base_color.a * self.opacity,
        );
        
        // Add scan line effect
        result.a += scan_alpha;
        
        // Clamp values
        result.r = result.r.clamp(0.0, 1.0);
        result.g = result.g.clamp(0.0, 1.0);
        result.b = result.b.clamp(0.0, 1.0);
        result.a = result.a.clamp(0.0, 1.0);
        
        result
    }
    
    pub fn set_opacity(&mut self, opacity: f32) {
        self.opacity = opacity.clamp(0.0, 1.0);
    }
    
    pub fn set_scan_line_speed(&mut self, speed: f32) {
        self.scan_line_speed = speed.clamp(0.0, 10.0);
    }
    
    pub fn set_flicker_intensity(&mut self, intensity: f32) {
        self.flicker_intensity = intensity.clamp(0.0, 1.0);
    }
    
    pub fn trigger_glitch(&mut self, duration: f32, intensity: f32) {
        self.glitch_timer = duration;
        self.glitch_intensity = intensity.clamp(0.0, 1.0);
    }
    
    pub fn toggle(&mut self) {
        self.enabled = !self.enabled;
        log::info!("🔮 Hologram effect: {}", if self.enabled { "Enabled" } else { "Disabled" });
    }
}

// Preset hologram styles
pub struct HologramPresets;

impl HologramPresets {
    pub fn subtle() -> HologramEffect {
        let mut effect = HologramEffect::new();
        effect.opacity = 0.9;
        effect.flicker_intensity = 0.05;
        effect.scan_line_speed = 1.0;
        effect.chromatic_aberration = 0.001;
        effect
    }
    
    pub fn classic() -> HologramEffect {
        HologramEffect::new() // Default settings
    }
    
    pub fn glitchy() -> HologramEffect {
        let mut effect = HologramEffect::new();
        effect.opacity = 0.8;
        effect.flicker_intensity = 0.2;
        effect.scan_line_speed = 3.0;
        effect.chromatic_aberration = 0.005;
        effect.noise_amount = 0.1;
        effect
    }
    
    pub fn stable() -> HologramEffect {
        let mut effect = HologramEffect::new();
        effect.opacity = 0.95;
        effect.flicker_intensity = 0.02;
        effect.scan_line_speed = 0.5;
        effect.chromatic_aberration = 0.0;
        effect.noise_amount = 0.01;
        effect
    }
}