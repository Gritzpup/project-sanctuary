//! Sidebar manager coordinating all holographic panels in 3D space

use crate::core::types::{Vec3, Vec2};
use crate::ui3d::panels::*;
use crate::rendering::Renderer;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct SidebarManager {
    pub panels: Vec<PanelWrapper>,
    pub layout: PanelLayout,
    pub camera_distance: f32,
    pub auto_arrange: bool,
    pub active_panel: Option<u32>,
    pub animation_time: f32,
}

#[derive(Clone, Debug)]
pub enum PanelWrapper {
    Portfolio(PortfolioSphere),
    OrderBook(OrderBookWall),
    MarketHeatmap(MarketHeatmap),
    TradeStream(TradeStream),
}

#[derive(Clone, Debug)]
pub enum PanelLayout {
    Circular,      // Panels arranged in circle around center
    Semicircle,    // Panels in arc in front of user
    Linear,        // Panels in horizontal line
    Custom,        // User-defined positions
}

impl SidebarManager {
    pub fn new() -> Self {
        let mut manager = Self {
            panels: Vec::new(),
            layout: PanelLayout::Circular,
            camera_distance: 50.0, // Distance for panel arrangement
            auto_arrange: true,
            active_panel: None,
            animation_time: 0.0,
        };
        
        manager.initialize_panels();
        manager
    }
    
    fn initialize_panels(&mut self) {
        // Create portfolio panel
        let portfolio_panel = HolographicPanel::new(
            1,
            Vec3::new(-50.0, 10.0, 0.0),
            Vec2::new(15.0, 12.0), // Reduced size
            PanelType::PortfolioSphere,
            ColorScheme::cyberpunk_blue(),
        );
        let portfolio = PortfolioSphere::new(portfolio_panel);
        self.panels.push(PanelWrapper::Portfolio(portfolio));
        
        // Create order book panel
        let orderbook_panel = HolographicPanel::new(
            2,
            Vec3::new(50.0, 10.0, 0.0),
            Vec2::new(15.0, 12.0), // Reduced size
            PanelType::OrderBookWall,
            ColorScheme::cyberpunk_green(),
        );
        let orderbook = OrderBookWall::new(orderbook_panel);
        self.panels.push(PanelWrapper::OrderBook(orderbook));
        
        // Create market heatmap panel
        let heatmap_panel = HolographicPanel::new(
            3,
            Vec3::new(0.0, 10.0, -50.0),
            Vec2::new(18.0, 15.0), // Reduced size
            PanelType::MarketHeatmap,
            ColorScheme::cyberpunk_red(),
        );
        let heatmap = MarketHeatmap::new(heatmap_panel);
        self.panels.push(PanelWrapper::MarketHeatmap(heatmap));
        
        // Create trade stream panel
        let stream_panel = HolographicPanel::new(
            4,
            Vec3::new(0.0, 10.0, 50.0),
            Vec2::new(15.0, 13.0), // Reduced size
            PanelType::TradeStream,
            ColorScheme::cyberpunk_blue(),
        );
        let stream = TradeStream::new(stream_panel);
        self.panels.push(PanelWrapper::TradeStream(stream));
    }
    
    pub fn update(&mut self, dt: f32) {
        self.animation_time += dt;
        
        // Update all panels
        for panel in &mut self.panels {
            match panel {
                PanelWrapper::Portfolio(p) => p.update(dt),
                PanelWrapper::OrderBook(p) => p.update(dt),
                PanelWrapper::MarketHeatmap(p) => p.update(dt),
                PanelWrapper::TradeStream(p) => p.update(dt),
            }
        }
        
        // Auto-arrange panels if enabled
        if self.auto_arrange {
            self.arrange_panels();
        }
    }
    
    fn arrange_panels(&mut self) {
        match self.layout {
            PanelLayout::Semicircle => self.arrange_semicircle(),
            PanelLayout::Circular => self.arrange_circular(),
            PanelLayout::Linear => self.arrange_linear(),
            PanelLayout::Custom => {}, // Don't auto-arrange in custom mode
        }
    }
    
    fn arrange_semicircle(&mut self) {
        let radius = 60.0; // Fixed radius
        let panel_count = self.panels.len();
        let angle_start = -std::f32::consts::PI * 0.4; // -72 degrees  
        let angle_end = std::f32::consts::PI * 0.4;    // 72 degrees
        let angle_range = angle_end - angle_start;
        let angle_step = angle_range / (panel_count as f32 - 1.0).max(1.0);
        
        for (i, panel) in self.panels.iter_mut().enumerate() {
            let angle = angle_start + i as f32 * angle_step;
            let x = radius * angle.sin();
            let z = -radius * angle.cos(); // Semicircle behind chart
            let y = 15.0 + ((i as f32 - panel_count as f32 / 2.0) * 0.3).sin() * 2.0; // Moderate elevation
            
            let position = Vec3::new(x, y, z);
            
            match panel {
                PanelWrapper::Portfolio(p) => p.base_panel.transform.position = position,
                PanelWrapper::OrderBook(p) => p.base_panel.transform.position = position,
                PanelWrapper::MarketHeatmap(p) => p.base_panel.transform.position = position,
                PanelWrapper::TradeStream(p) => p.base_panel.transform.position = position,
            }
        }
    }
    
    fn arrange_circular(&mut self) {
        let radius = 50.0; // Fixed radius around the chart
        
        // Create a full circle around the chart
        let angle_step = 2.0 * std::f32::consts::PI / self.panels.len() as f32;
        
        for (i, panel) in self.panels.iter_mut().enumerate() {
            let angle = i as f32 * angle_step;
            let x = radius * angle.cos();
            let z = radius * angle.sin(); // Circle around origin
            let y = 10.0; // Slightly elevated
            
            let position = Vec3::new(x, y, z);
            
            match panel {
                PanelWrapper::Portfolio(p) => p.base_panel.transform.position = position,
                PanelWrapper::OrderBook(p) => p.base_panel.transform.position = position,
                PanelWrapper::MarketHeatmap(p) => p.base_panel.transform.position = position,
                PanelWrapper::TradeStream(p) => p.base_panel.transform.position = position,
            }
        }
    }
    
    fn arrange_linear(&mut self) {
        let spacing = 40.0; // Spacing between panels
        let total_width = (self.panels.len() - 1) as f32 * spacing;
        let start_x = -total_width / 2.0;
        
        for (i, panel) in self.panels.iter_mut().enumerate() {
            let x = start_x + i as f32 * spacing;
            let y = 15.0 + (i as f32 * 0.5).sin() * 3.0; // Moderate elevation with wave
            let z = -30.0; // Position panels behind chart
            
            let position = Vec3::new(x, y, z);
            
            match panel {
                PanelWrapper::Portfolio(p) => p.base_panel.transform.position = position,
                PanelWrapper::OrderBook(p) => p.base_panel.transform.position = position,
                PanelWrapper::MarketHeatmap(p) => p.base_panel.transform.position = position,
                PanelWrapper::TradeStream(p) => p.base_panel.transform.position = position,
            }
        }
    }
    
    pub fn generate_all_vertices(&self) -> (Vec<HologramVertex>, Vec<u16>) {
        let mut all_vertices = Vec::new();
        let mut all_indices = Vec::new();
        
        for panel in &self.panels {
            let (vertices, mut indices) = match panel {
                PanelWrapper::Portfolio(p) => {
                    // First add background
                    let (mut v, mut i) = p.base_panel.generate_background_vertices();
                    
                    // Then add border (with offset indices)
                    let (border_v, mut border_i) = p.base_panel.generate_border_vertices();
                    let border_offset = v.len() as u16;
                    for idx in &mut border_i {
                        *idx += border_offset;
                    }
                    v.extend(border_v);
                    i.extend(border_i);
                    
                    // Finally add panel-specific content
                    let (pv, mut pi) = p.generate_vertices();
                    let panel_offset = v.len() as u16;
                    for idx in &mut pi {
                        *idx += panel_offset;
                    }
                    v.extend(pv);
                    i.extend(pi);
                    (v, i)
                },
                PanelWrapper::OrderBook(p) => {
                    // First add background
                    let (mut v, mut i) = p.base_panel.generate_background_vertices();
                    
                    // Then add border (with offset indices)
                    let (border_v, mut border_i) = p.base_panel.generate_border_vertices();
                    let border_offset = v.len() as u16;
                    for idx in &mut border_i {
                        *idx += border_offset;
                    }
                    v.extend(border_v);
                    i.extend(border_i);
                    
                    // Finally add panel-specific content
                    let (pv, mut pi) = p.generate_vertices();
                    let panel_offset = v.len() as u16;
                    for idx in &mut pi {
                        *idx += panel_offset;
                    }
                    v.extend(pv);
                    i.extend(pi);
                    (v, i)
                },
                PanelWrapper::MarketHeatmap(p) => {
                    // First add background
                    let (mut v, mut i) = p.base_panel.generate_background_vertices();
                    
                    // Then add border (with offset indices)
                    let (border_v, mut border_i) = p.base_panel.generate_border_vertices();
                    let border_offset = v.len() as u16;
                    for idx in &mut border_i {
                        *idx += border_offset;
                    }
                    v.extend(border_v);
                    i.extend(border_i);
                    
                    // Finally add panel-specific content
                    let (pv, mut pi) = p.generate_vertices();
                    let panel_offset = v.len() as u16;
                    for idx in &mut pi {
                        *idx += panel_offset;
                    }
                    v.extend(pv);
                    i.extend(pi);
                    (v, i)
                },
                PanelWrapper::TradeStream(p) => {
                    // First add background
                    let (mut v, mut i) = p.base_panel.generate_background_vertices();
                    
                    // Then add border (with offset indices)
                    let (border_v, mut border_i) = p.base_panel.generate_border_vertices();
                    let border_offset = v.len() as u16;
                    for idx in &mut border_i {
                        *idx += border_offset;
                    }
                    v.extend(border_v);
                    i.extend(border_i);
                    
                    // Finally add panel-specific content
                    let (pv, mut pi) = p.generate_vertices();
                    let panel_offset = v.len() as u16;
                    for idx in &mut pi {
                        *idx += panel_offset;
                    }
                    v.extend(pv);
                    i.extend(pi);
                    (v, i)
                },
            };
            
            // Offset indices for this panel
            let vertex_offset = all_vertices.len() as u16;
            for index in &mut indices {
                *index += vertex_offset;
            }
            
            all_vertices.extend(vertices);
            all_indices.extend(indices);
        }
        
        (all_vertices, all_indices)
    }
    
    pub fn handle_interaction(&mut self, ray_origin: Vec3, ray_direction: Vec3) -> Option<u32> {
        // Simple ray-panel intersection
        for panel in &mut self.panels {
            let panel_id = match panel {
                PanelWrapper::Portfolio(p) => {
                    if p.base_panel.contains_point(ray_origin + ray_direction * 5.0) {
                        p.base_panel.on_click();
                        p.base_panel.id
                    } else { continue; }
                },
                PanelWrapper::OrderBook(p) => {
                    if p.base_panel.contains_point(ray_origin + ray_direction * 5.0) {
                        p.base_panel.on_click();
                        p.base_panel.id
                    } else { continue; }
                },
                PanelWrapper::MarketHeatmap(p) => {
                    if p.base_panel.contains_point(ray_origin + ray_direction * 5.0) {
                        p.base_panel.on_click();
                        p.base_panel.id
                    } else { continue; }
                },
                PanelWrapper::TradeStream(p) => {
                    if p.base_panel.contains_point(ray_origin + ray_direction * 5.0) {
                        p.base_panel.on_click();
                        p.base_panel.id
                    } else { continue; }
                },
            };
            
            self.active_panel = Some(panel_id);
            return Some(panel_id);
        }
        
        None
    }
    
    pub fn set_layout(&mut self, layout: PanelLayout) {
        self.layout = layout;
        self.arrange_panels();
    }
    
    pub fn toggle_auto_arrange(&mut self) {
        self.auto_arrange = !self.auto_arrange;
    }
    
    pub fn get_portfolio_panel(&mut self) -> Option<&mut PortfolioSphere> {
        for panel in &mut self.panels {
            if let PanelWrapper::Portfolio(p) = panel {
                return Some(p);
            }
        }
        None
    }
    
    pub fn get_orderbook_panel(&mut self) -> Option<&mut OrderBookWall> {
        for panel in &mut self.panels {
            if let PanelWrapper::OrderBook(p) = panel {
                return Some(p);
            }
        }
        None
    }
    
    pub fn get_heatmap_panel(&mut self) -> Option<&mut MarketHeatmap> {
        for panel in &mut self.panels {
            if let PanelWrapper::MarketHeatmap(p) = panel {
                return Some(p);
            }
        }
        None
    }
    
    pub fn get_stream_panel(&mut self) -> Option<&mut TradeStream> {
        for panel in &mut self.panels {
            if let PanelWrapper::TradeStream(p) = panel {
                return Some(p);
            }
        }
        None
    }
}