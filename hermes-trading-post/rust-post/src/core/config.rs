//! Configuration and settings for the futuristic dashboard

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardConfig {
    pub theme: Theme,
    pub layout: LayoutPreset,
    pub performance: PerformanceSettings,
    pub ui_scale: f32,
    pub effects_quality: EffectsQuality,
}

impl Default for DashboardConfig {
    fn default() -> Self {
        Self {
            theme: Theme::CyberPunk,
            layout: LayoutPreset::Standard,
            performance: PerformanceSettings::default(),
            ui_scale: 1.0,
            effects_quality: EffectsQuality::High,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Theme {
    CyberPunk,
    Matrix,
    Tron,
    Synthwave,
    Minimal,
}

impl Theme {
    pub fn primary_color(&self) -> [f32; 3] {
        match self {
            Theme::CyberPunk => [0.0, 1.0, 1.0],     // Cyan
            Theme::Matrix => [0.0, 1.0, 0.0],        // Green
            Theme::Tron => [0.0, 0.8, 1.0],          // Light Blue
            Theme::Synthwave => [1.0, 0.0, 1.0],     // Magenta
            Theme::Minimal => [1.0, 1.0, 1.0],       // White
        }
    }
    
    pub fn accent_color(&self) -> [f32; 3] {
        match self {
            Theme::CyberPunk => [1.0, 0.0, 0.5],     // Pink
            Theme::Matrix => [0.0, 0.5, 0.0],        // Dark Green
            Theme::Tron => [1.0, 0.5, 0.0],          // Orange
            Theme::Synthwave => [0.0, 1.0, 1.0],     // Cyan
            Theme::Minimal => [0.5, 0.5, 0.5],       // Gray
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LayoutPreset {
    Standard,
    Trading,
    Analytics,
    Minimal,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSettings {
    pub target_fps: u32,
    pub msaa_samples: u32,
    pub shadow_quality: ShadowQuality,
    pub particle_count: u32,
}

impl Default for PerformanceSettings {
    fn default() -> Self {
        Self {
            target_fps: 60,
            msaa_samples: 4,
            shadow_quality: ShadowQuality::Medium,
            particle_count: 10000,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ShadowQuality {
    Off,
    Low,
    Medium,
    High,
    Ultra,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum EffectsQuality {
    Low,
    Medium,
    High,
    Ultra,
}