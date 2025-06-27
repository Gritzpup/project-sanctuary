//! Visualization module - 3D data visualizations

pub mod chart;
pub mod orderbook;
pub mod portfolio;
pub mod particles;
pub mod heatmap;
pub mod btc_chart_manager;

use crate::rendering::Renderer;
use crate::core::types::Vec3;
use crate::visualization::btc_chart_manager::BtcChartManager;

pub struct VisualizationManager {
    pub btc_chart: Option<BtcChartManager>,
    // Will hold all active visualizations
}

impl VisualizationManager {
    pub async fn new(renderer: &Renderer<'_>) -> Self {
        println!("📊 Initializing data visualizations...");
        println!("📈 Setting up BTC chart...");
        
        // Initialize BTC chart at center stage
        let btc_chart = BtcChartManager::new(renderer, Vec3::new(0.0, 0.0, 0.0)).await;
        
        Self {
            btc_chart: Some(btc_chart),
        }
    }
    
    pub fn update(&mut self, dt: f32, renderer: &Renderer<'_>) {
        // Update BTC chart
        if let Some(ref mut chart) = self.btc_chart {
            chart.update(dt, renderer);
        }
    }
    
    pub fn render(&self, encoder: &mut wgpu::CommandEncoder, view: &wgpu::TextureView, depth_view: &wgpu::TextureView, camera_bind_group: &wgpu::BindGroup) {
        // Render BTC chart with external camera
        if let Some(ref chart) = self.btc_chart {
            chart.render(encoder, view, depth_view, camera_bind_group);
        }
    }
    
    pub fn handle_input(&mut self, input: &crate::interaction::input::InputManager) {
        // Disabled - using main dashboard camera instead
        // if let Some(ref mut chart) = self.btc_chart {
        //     chart.handle_input(input);
        // }
    }
    
    pub fn get_btc_chart(&mut self) -> Option<&mut BtcChartManager> {
        self.btc_chart.as_mut()
    }
}