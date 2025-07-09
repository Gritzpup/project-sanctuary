//! Visualization module - 3D data visualizations

pub mod chart;
pub mod orderbook;
pub mod portfolio;
pub mod particles;
pub mod heatmap;
pub mod btc_chart_manager;
pub mod chart_backdrop;

use crate::rendering::Renderer;
use crate::core::types::Vec3;
use crate::visualization::btc_chart_manager::BtcChartManager;
use crate::visualization::chart_backdrop::ChartBackdrop;

pub struct VisualizationManager {
    pub btc_chart: Option<BtcChartManager>,
    pub chart_backdrop: Option<ChartBackdrop>,
}

impl VisualizationManager {
    pub async fn new(renderer: &Renderer<'_>) -> Self {
        println!("📊 Initializing data visualizations...");
        println!("📈 Setting up BTC chart...");
        
        // Create backdrop positioned behind the chart
        // TODO: Need camera bind group layout from app.rs to create backdrop
        // let backdrop_position = Vec3::new(0.0, 0.0, -50.0);
        // let backdrop_size = Vec2::new(120.0, 80.0); // Large enough to frame the chart
        // let chart_backdrop = ChartBackdrop::new(&renderer.device, backdrop_position, backdrop_size);
        
        // Initialize BTC chart moved back in Z-space
        let btc_chart = BtcChartManager::new(renderer, Vec3::new(0.0, -45.0, -200.0)).await;
        
        Self {
            btc_chart: Some(btc_chart),
            chart_backdrop: None, // Temporarily disabled until we can pass camera bind group layout
        }
    }
    
    pub fn update(&mut self, dt: f32, renderer: &Renderer<'_>) {
        // Update BTC chart
        if let Some(ref mut chart) = self.btc_chart {
            chart.update(dt, renderer);
        }
    }
    
    pub fn render(&self, encoder: &mut wgpu::CommandEncoder, view: &wgpu::TextureView, depth_view: &wgpu::TextureView, camera_bind_group: &wgpu::BindGroup) {
        // Render backdrop first (behind everything)
        if let Some(ref backdrop) = self.chart_backdrop {
            let render_pass = &mut encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Backdrop Render Pass"),
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
            
            backdrop.render(render_pass, camera_bind_group);
        }
        
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