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
use crate::ui3d::sidebar::{SidebarManager, PanelWrapper};
use crate::ui3d::panels::HologramVertex;
use wgpu::util::DeviceExt;

pub struct UI3DSystem {
    panels: Vec<panel::Panel3D>,
    active_theme: theme::FuturisticTheme,
    sidebar: SidebarManager,
}

impl UI3DSystem {
    pub fn new(_renderer: &Renderer<'_>) -> Self {
        println!("✨ Initializing futuristic UI components...");
        println!("🔮 Creating holographic panels...");
        
        let mut sidebar = SidebarManager::new();
        
        // The sidebar automatically initializes panels in its constructor
        // Set layout to circular for cool arrangement
        sidebar.set_layout(crate::ui3d::sidebar::PanelLayout::Circular);
        
        Self {
            panels: Vec::new(),
            active_theme: theme::FuturisticTheme::cyberpunk(),
            sidebar,
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
    
    pub fn render(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        view: &wgpu::TextureView,
        depth_view: &wgpu::TextureView,
        camera_bind_group: &wgpu::BindGroup,
        holographic_panel_pipeline: &wgpu::RenderPipeline,
        device: &wgpu::Device,
        vertex_buffer: &mut Option<wgpu::Buffer>,
        index_buffer: &mut Option<wgpu::Buffer>,
        index_count: &mut u32,
    ) {
        // Generate vertices for all panels
        let (vertices, indices) = self.sidebar.generate_all_vertices();
        
        if vertices.is_empty() {
            return;
        }
        
        // Create or update vertex buffer
        *vertex_buffer = Some(device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Holographic Panel Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        }));
        
        // Create or update index buffer
        *index_buffer = Some(device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Holographic Panel Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        }));
        
        *index_count = indices.len() as u32;
        
        // Debug output disabled - panels are working properly
        
        // Render holographic panels
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Holographic Panel Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                view: depth_view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                }),
                stencil_ops: None,
            }),
            occlusion_query_set: None,
            timestamp_writes: None,
        });
        
        render_pass.set_pipeline(holographic_panel_pipeline);
        render_pass.set_bind_group(0, camera_bind_group, &[]);
        render_pass.set_vertex_buffer(0, vertex_buffer.as_ref().unwrap().slice(..));
        render_pass.set_index_buffer(index_buffer.as_ref().unwrap().slice(..), wgpu::IndexFormat::Uint16);
        render_pass.draw_indexed(0..*index_count, 0, 0..1);
    }
    
    pub fn get_sidebar(&mut self) -> &mut SidebarManager {
        &mut self.sidebar
    }
}