//! 3D UI system for futuristic interface elements

pub mod panel;
pub mod button;
pub mod text;
pub mod hud;
pub mod theme;
pub mod layouts;
pub mod panels;
pub mod sidebar;

use crate::rendering::Renderer;
use crate::ui3d::sidebar::SidebarManager;
use crate::ui3d::panels::HologramVertex;

pub struct UI3DSystem {
    panels: Vec<panel::Panel3D>,
    active_theme: theme::FuturisticTheme,
    sidebar: SidebarManager,
}

impl UI3DSystem {
    pub fn new(_renderer: &Renderer<'_>) -> Self {
        println!("✨ Initializing futuristic UI components...");
        println!("🔮 Creating holographic panels...");
        
        Self {
            panels: Vec::new(),
            active_theme: theme::FuturisticTheme::cyberpunk(),
            sidebar: SidebarManager::new(),
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        // Update all UI elements
        for panel in &mut self.panels {
            panel.update(dt);
        }
        
        // Update holographic sidebar
        self.sidebar.update(dt);
    }
    
    pub fn render(&self, encoder: &mut wgpu::CommandEncoder) {
        // Render UI elements
        
        // Generate sidebar vertices and render
        let (vertices, indices) = self.sidebar.generate_all_vertices();
        
        // Debug: Show how many vertices we have
        if !vertices.is_empty() {
            println!("🎨 Rendering {} UI vertices with {} indices", vertices.len(), indices.len());
        }
        
        // TODO: Create vertex buffer and render pass for holographic panels
        // For now, this is just a placeholder - we need to implement actual rendering
    }
    
    pub fn get_sidebar(&mut self) -> &mut SidebarManager {
        &mut self.sidebar
    }
}