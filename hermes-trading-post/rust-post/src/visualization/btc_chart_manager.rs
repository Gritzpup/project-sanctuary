//! BTC Chart Manager - Integrates existing 3D chart into main dashboard

use crate::visualization::chart::{
    data::{Candle, CandleUpdate, fetch_historical_candles, start_websocket_with_reconnect},
    graphics::vertices::{generate_enhanced_candle_vertices, EnhancedVertex},
    camera::{CameraController, CameraUniform},
};
use crate::core::types::Vec3;
use crate::rendering::Renderer;
use wgpu;
use wgpu::util::DeviceExt;
use tokio::sync::{mpsc, watch};
use std::sync::{Arc, Mutex};

pub struct BtcChartManager {
    pub historical_candles: Vec<Candle>,
    pub current_candle: Arc<Mutex<Candle>>,
    pub camera: CameraController,
    pub camera_uniform: CameraUniform,
    pub camera_buffer: wgpu::Buffer,
    pub camera_bind_group: wgpu::BindGroup,
    pub vertex_buffer: Option<wgpu::Buffer>,
    pub index_buffer: Option<wgpu::Buffer>,
    pub index_count: u32,
    pub render_pipeline: wgpu::RenderPipeline,
    pub websocket_receiver: Option<mpsc::Receiver<CandleUpdate>>,
    pub chart_position: Vec3,
    pub chart_scale: f32,
    shutdown_tx: Option<watch::Sender<bool>>,
    websocket_handle: Option<tokio::task::JoinHandle<()>>,
}

impl BtcChartManager {
    pub async fn new(renderer: &Renderer<'_>, chart_position: Vec3) -> Self {
        println!("📊 Initializing BTC Chart Manager...");
        
        // Fetch historical data
        let mut historical_candles = fetch_historical_candles().await.unwrap_or_default();
        
        // Keep only last 60 candles for 1hr view
        if historical_candles.len() > 60 {
            historical_candles = historical_candles.split_off(historical_candles.len() - 60);
        }
        println!("📈 Loaded {} historical candles (limited to 60 for 1hr view)", historical_candles.len());
        
        // Initialize current candle
        let initial_candle = if let Some(last_candle) = historical_candles.last() {
            last_candle.clone()
        } else {
            Candle::new(107000.0, 107000.0, 107000.0, 107000.0, 0.0)
        };
        let current_candle = Arc::new(Mutex::new(initial_candle));
        
        // Setup camera
        let camera = CameraController::new(renderer.config.width as f32 / renderer.config.height as f32);
        
        let camera_uniform = CameraUniform::new();
        let camera_buffer = renderer.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("BTC Chart Camera Buffer"),
            contents: bytemuck::cast_slice(&[camera_uniform]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        
        // Create render pipeline and bind group for enhanced vertices
        let (render_pipeline, camera_bind_group) = Self::create_render_pipeline_and_bind_group(renderer, &camera_buffer);
        
        // Setup WebSocket for real-time data
        let (tx, rx) = mpsc::channel::<CandleUpdate>(100);
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        
        let websocket_handle = tokio::spawn(async move {
            start_websocket_with_reconnect(tx, shutdown_rx).await;
        });
        
        let mut manager = Self {
            historical_candles,
            current_candle,
            camera,
            camera_uniform,
            camera_buffer,
            camera_bind_group,
            vertex_buffer: None,
            index_buffer: None,
            index_count: 0,
            render_pipeline,
            websocket_receiver: Some(rx),
            chart_position,
            chart_scale: 1.0,
            shutdown_tx: Some(shutdown_tx),
            websocket_handle: Some(websocket_handle),
        };
        
        // Generate initial chart geometry
        manager.update_chart_geometry(renderer);
        
        manager
    }
    
    fn create_render_pipeline_and_bind_group(renderer: &Renderer<'_>, camera_buffer: &wgpu::Buffer) -> (wgpu::RenderPipeline, wgpu::BindGroup) {
        let shader = renderer.device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("BTC Chart Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("../rendering/shaders/enhanced_chart.wgsl").into()),
        });
        
        // Create bind group layout for camera uniform
        let bind_group_layout = renderer.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
            label: Some("BTC Chart Bind Group Layout"),
        });
        
        // Create bind group
        let bind_group = renderer.device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: camera_buffer.as_entire_binding(),
                },
            ],
            label: Some("BTC Chart Bind Group"),
        });
        
        let render_pipeline_layout = renderer.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("BTC Chart Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let render_pipeline = renderer.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("BTC Chart Pipeline"),
            layout: Some(&render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[EnhancedVertex::desc()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: renderer.config.format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: Some(wgpu::Face::Back),
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth32Float,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::Less,
                stencil: wgpu::StencilState::default(),
                bias: wgpu::DepthBiasState::default(),
            }),
            multisample: wgpu::MultisampleState {
                count: 1,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
            cache: None,
        });
        
        (render_pipeline, bind_group)
    }
    
    pub fn update(&mut self, dt: f32, renderer: &Renderer<'_>) {
        // Update camera
        self.camera.update(dt);
        self.camera_uniform.update_view_proj(&self.camera);
        renderer.queue.write_buffer(&self.camera_buffer, 0, bytemuck::cast_slice(&[self.camera_uniform]));
        
        // Process WebSocket updates
        if let Some(ref mut rx) = self.websocket_receiver {
            let mut updated = false;
            while let Ok(update) = rx.try_recv() {
                match update {
                    CandleUpdate::LiveUpdate(new_candle) => {
                        if let Ok(mut current) = self.current_candle.lock() {
                            *current = new_candle;
                            updated = true;
                        }
                    }
                    CandleUpdate::NewMinuteCandle(completed_candle) => {
                        self.historical_candles.push(completed_candle);
                        // Keep only last 59 candles (59 + 1 current = 60 total)
                        if self.historical_candles.len() > 59 {
                            self.historical_candles.remove(0);
                        }
                        updated = true;
                    }
                }
            }
            
            if updated {
                self.update_chart_geometry(renderer);
            }
        }
    }
    
    fn update_chart_geometry(&mut self, renderer: &Renderer<'_>) {
        let mut all_vertices = Vec::new();
        let mut all_indices = Vec::new();
        
        // Generate vertices for historical candles
        for (i, candle) in self.historical_candles.iter().enumerate() {
            let (mut vertices, mut indices) = generate_enhanced_candle_vertices(candle);
            
            // Position candles in 3D space horizontally with better spacing
            let candle_spacing = 2.5; // Increased space between candles
            let total_width = self.historical_candles.len() as f32 * candle_spacing;
            let x_offset = self.chart_position.x + (i as f32 * candle_spacing) - (total_width / 2.0);
            for vertex in &mut vertices {
                vertex.position[0] += x_offset;
                vertex.position[1] += self.chart_position.y;
                vertex.position[2] += self.chart_position.z;
            }
            
            // Offset indices
            let vertex_offset = all_vertices.len() as u16;
            for index in &mut indices {
                *index += vertex_offset;
            }
            
            all_vertices.extend(vertices);
            all_indices.extend(indices);
        }
        
        // Add current candle if available
        if let Ok(current) = self.current_candle.lock() {
            let (mut vertices, mut indices) = generate_enhanced_candle_vertices(&current);
            
            // Position current candle at the end of the chart
            let candle_spacing = 2.5; // Match the spacing of historical candles
            let total_width = (self.historical_candles.len() + 1) as f32 * candle_spacing;
            let x_offset = self.chart_position.x + (self.historical_candles.len() as f32 * candle_spacing) - (total_width / 2.0);
            for vertex in &mut vertices {
                vertex.position[0] += x_offset;
                vertex.position[1] += self.chart_position.y;
                vertex.position[2] += self.chart_position.z;
                
                // Make current candle brighter
                vertex.color[0] *= 1.2;
                vertex.color[1] *= 1.2;
                vertex.color[2] *= 1.2;
            }
            
            let vertex_offset = all_vertices.len() as u16;
            for index in &mut indices {
                *index += vertex_offset;
            }
            
            all_vertices.extend(vertices);
            all_indices.extend(indices);
        }
        
        // Create/update vertex buffer
        if !all_vertices.is_empty() {
            self.vertex_buffer = Some(renderer.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("BTC Chart Vertex Buffer"),
                contents: bytemuck::cast_slice(&all_vertices),
                usage: wgpu::BufferUsages::VERTEX,
            }));
            
            self.index_buffer = Some(renderer.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("BTC Chart Index Buffer"),
                contents: bytemuck::cast_slice(&all_indices),
                usage: wgpu::BufferUsages::INDEX,
            }));
            
            self.index_count = all_indices.len() as u32;
        }
    }
    
    pub fn render(&self, encoder: &mut wgpu::CommandEncoder, view: &wgpu::TextureView, depth_view: &wgpu::TextureView, camera_bind_group: &wgpu::BindGroup) {
        if let (Some(vertex_buffer), Some(index_buffer)) = (&self.vertex_buffer, &self.index_buffer) {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("BTC Chart Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load, // Don't clear, we want to render on top
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
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            
            render_pass.set_pipeline(&self.render_pipeline);
            render_pass.set_bind_group(0, camera_bind_group, &[]); // Use external camera
            render_pass.set_vertex_buffer(0, vertex_buffer.slice(..));
            render_pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint16);
            render_pass.draw_indexed(0..self.index_count, 0, 0..1);
        }
    }
    
    pub fn handle_input(&mut self, input: &crate::interaction::input::InputManager) {
        // Forward camera controls
        use winit::event::{ElementState, MouseButton};
        
        if input.is_key_pressed(winit::keyboard::KeyCode::KeyW) {
            self.camera.process_keyboard(winit::keyboard::KeyCode::KeyW, ElementState::Pressed);
        }
        if input.is_key_pressed(winit::keyboard::KeyCode::KeyS) {
            self.camera.process_keyboard(winit::keyboard::KeyCode::KeyS, ElementState::Pressed);
        }
        if input.is_key_pressed(winit::keyboard::KeyCode::KeyA) {
            self.camera.process_keyboard(winit::keyboard::KeyCode::KeyA, ElementState::Pressed);
        }
        if input.is_key_pressed(winit::keyboard::KeyCode::KeyD) {
            self.camera.process_keyboard(winit::keyboard::KeyCode::KeyD, ElementState::Pressed);
        }
        if input.is_key_pressed(winit::keyboard::KeyCode::KeyR) {
            self.camera.reset();
        }
        
        // Mouse button handling
        if input.is_mouse_button_pressed(MouseButton::Left) {
            self.camera.process_mouse_button(MouseButton::Left, ElementState::Pressed);
        } else {
            self.camera.process_mouse_button(MouseButton::Left, ElementState::Released);
        }
        
        // Mouse controls
        let (mouse_dx, mouse_dy) = input.get_mouse_delta();
        if mouse_dx != 0.0 || mouse_dy != 0.0 {
            self.camera.process_mouse_motion(mouse_dx, mouse_dy);
        }
        
        let scroll_delta = input.get_scroll_delta();
        if scroll_delta != 0.0 {
            self.camera.process_scroll(scroll_delta);
        }
    }
    
    pub fn get_current_price(&self) -> Option<f64> {
        if let Ok(current) = self.current_candle.lock() {
            Some(current.close)
        } else {
            None
        }
    }
    
    pub fn get_price_change_24h(&self) -> Option<f32> {
        if self.historical_candles.len() >= 2 {
            let recent = &self.historical_candles[self.historical_candles.len() - 1];
            let day_ago = &self.historical_candles[0]; // Simplified
            let change = ((recent.close - day_ago.close) / day_ago.close * 100.0) as f32;
            Some(change)
        } else {
            None
        }
    }
}

impl Drop for BtcChartManager {
    fn drop(&mut self) {
        log::info!("🛑 Shutting down BTC Chart Manager...");
        
        // Signal shutdown to the WebSocket task
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            let _ = shutdown_tx.send(true);
        }
        
        // Don't block during drop - just abort the task
        if let Some(handle) = self.websocket_handle.take() {
            handle.abort();
            log::info!("✅ WebSocket task aborted");
        }
        
        log::info!("✅ BTC Chart Manager shutdown complete");
    }
}