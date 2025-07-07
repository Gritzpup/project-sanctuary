//! Main application orchestrator for the 3D dashboard

use winit::{
    event::*,
    event_loop::{EventLoop, ControlFlow},
    window::Window,
};
use wgpu::*;
use crate::{
    rendering::{Renderer, grid::{create_grid_vertices, GridVertex}},
    ui3d::UI3DSystem,
    visualization::{VisualizationManager, chart::camera::{CameraController, CameraUniform}},
    data::DataManager,
    interaction::InteractionSystem,
    effects::EffectsManager,
    core::config::DashboardConfig,
};
use std::time::Instant;
use wgpu::util::DeviceExt;

pub struct FuturisticDashboard<'a> {
    renderer: Renderer<'a>,
    ui_system: UI3DSystem,
    visualizations: VisualizationManager,
    data_feeds: DataManager,
    interaction: InteractionSystem,
    effects: EffectsManager,
    config: DashboardConfig,
    last_update: Instant,
    depth_texture: wgpu::Texture,
    depth_view: wgpu::TextureView,
    // Main dashboard camera
    main_camera: CameraController,
    camera_uniform: CameraUniform,
    camera_buffer: wgpu::Buffer,
    camera_bind_group: wgpu::BindGroup,
    // Grid rendering
    grid_vertex_buffer: wgpu::Buffer,
    grid_index_buffer: wgpu::Buffer,
    grid_index_count: u32,
    grid_pipeline: wgpu::RenderPipeline,
    // Holographic panel rendering
    holographic_panel_pipeline: wgpu::RenderPipeline,
    holographic_vertex_buffer: Option<wgpu::Buffer>,
    holographic_index_buffer: Option<wgpu::Buffer>,
    holographic_index_count: u32,
    // Time tracking for shader effects
    start_time: Instant,
    time_buffer: wgpu::Buffer,
    holographic_bind_group: wgpu::BindGroup,
}

impl<'a> FuturisticDashboard<'a> {
    pub async fn new(window: &'a Window) -> Self {
        println!("🎆 Initializing 3D rendering engine...");
        let renderer = Renderer::new(&window).await;
        
        println!("🌌 Creating futuristic UI system...");
        let ui_system = UI3DSystem::new(&renderer);
        
        println!("📊 Setting up visualizations...");
        let visualizations = VisualizationManager::new(&renderer).await;
        
        println!("📡 Connecting data feeds...");
        let data_feeds = DataManager::new().await;
        
        println!("🎮 Initializing interaction system...");
        let interaction = InteractionSystem::new();
        
        println!("✨ Loading visual effects...");
        let effects = EffectsManager::new(&renderer);
        
        let config = DashboardConfig::default();
        
        // Create main dashboard camera positioned to see entire scene
        let mut main_camera = CameraController::new(renderer.config.width as f32 / renderer.config.height as f32);
        // Position camera for a direct front view of the chart
        main_camera.eye = cgmath::Point3::new(0.0, 0.0, 150.0); // Front view, centered
        main_camera.target = cgmath::Point3::new(0.0, 0.0, 0.0); // Look at center
        main_camera.zfar = 2000.0; // Match the increased far plane
        
        // Create camera uniform and buffer
        let mut camera_uniform = CameraUniform::new();
        camera_uniform.update_view_proj(&main_camera);
        
        let camera_buffer = renderer.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Main Camera Buffer"),
            contents: bytemuck::cast_slice(&[camera_uniform]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        
        // Create camera bind group layout and bind group
        let camera_bind_group_layout = renderer.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: Some(std::num::NonZeroU64::new(80).unwrap()), // CameraUniform size
                    },
                    count: None,
                },
            ],
            label: Some("Camera Bind Group Layout"),
        });
        
        let camera_bind_group = renderer.device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &camera_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: camera_buffer.as_entire_binding(),
                },
            ],
            label: Some("Camera Bind Group"),
        });
        
        // Create depth texture for 3D rendering
        let depth_texture = renderer.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Depth Texture"),
            size: wgpu::Extent3d {
                width: renderer.config.width,
                height: renderer.config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth32Float,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        
        let depth_view = depth_texture.create_view(&wgpu::TextureViewDescriptor::default());
        
        // Create grid
        let (grid_vertices, grid_indices) = create_grid_vertices(400.0, 40);
        let grid_vertex_buffer = renderer.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Grid Vertex Buffer"),
            contents: bytemuck::cast_slice(&grid_vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });
        let grid_index_buffer = renderer.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Grid Index Buffer"),
            contents: bytemuck::cast_slice(&grid_indices),
            usage: wgpu::BufferUsages::INDEX,
        });
        let grid_index_count = grid_indices.len() as u32;
        
        // Create grid pipeline
        let grid_shader = renderer.device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Grid Shader"),
            source: wgpu::ShaderSource::Wgsl(crate::rendering::shaders::GRID_SHADER.into()),
        });
        
        let grid_pipeline_layout = renderer.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Grid Pipeline Layout"),
            bind_group_layouts: &[&camera_bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let grid_pipeline = renderer.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Grid Pipeline"),
            layout: Some(&grid_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &grid_shader,
                entry_point: Some("vs_main"),
                buffers: &[GridVertex::desc()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &grid_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: renderer.config.format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::LineList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
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
        
        // Create holographic panel pipeline
        let holographic_shader = renderer.device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Holographic Panel Shader"),
            source: wgpu::ShaderSource::Wgsl(crate::rendering::shaders::HOLOGRAPHIC_PANEL_SHADER.into()),
        });
        
        // Create time uniform buffer
        // WGSL alignment: TimeUniform { time: f32, _padding: vec3<f32> } = 32 bytes due to vec3 alignment
        let start_time = Instant::now();
        let time_uniform = [0.0f32; 8]; // 8 floats = 32 bytes to match WGSL alignment
        let time_buffer = renderer.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Time Uniform Buffer"),
            contents: bytemuck::cast_slice(&time_uniform),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        
        // Create holographic bind group layout with camera and time
        let holographic_bind_group_layout = renderer.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: Some(std::num::NonZeroU64::new(80).unwrap()), // CameraUniform size
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: Some(std::num::NonZeroU64::new(32).unwrap()), // TimeUniform size with WGSL alignment
                    },
                    count: None,
                },
            ],
            label: Some("Holographic Bind Group Layout"),
        });
        
        // Create holographic bind group
        let holographic_bind_group = renderer.device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &holographic_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: camera_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: time_buffer.as_entire_binding(),
                },
            ],
            label: Some("Holographic Bind Group"),
        });
        
        let holographic_pipeline_layout = renderer.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Holographic Panel Pipeline Layout"),
            bind_group_layouts: &[&holographic_bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let holographic_panel_pipeline = renderer.device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Holographic Panel Pipeline"),
            layout: Some(&holographic_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &holographic_shader,
                entry_point: Some("vs_main"),
                buffers: &[crate::ui3d::panels::HologramVertex::desc()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &holographic_shader,
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
        
        Self {
            renderer,
            ui_system,
            visualizations,
            data_feeds,
            interaction,
            effects,
            config,
            last_update: Instant::now(),
            depth_texture,
            depth_view,
            main_camera,
            camera_uniform,
            camera_buffer,
            camera_bind_group,
            grid_vertex_buffer,
            grid_index_buffer,
            grid_index_count,
            grid_pipeline,
            holographic_panel_pipeline,
            holographic_vertex_buffer: None,
            holographic_index_buffer: None,
            holographic_index_count: 0,
            start_time,
            time_buffer,
            holographic_bind_group,
        }
    }
    
    pub async fn run(mut self, event_loop: EventLoop<()>, window: &Window) {
        println!("🚀 Dashboard ready! Entering main loop...");
        
        event_loop.run(move |event, target| {
            // Pass all events to input manager first
            self.interaction.input.handle_event(&event);
            
            match event {
                Event::WindowEvent { ref event, window_id: _ } => {
                    match event {
                        WindowEvent::CloseRequested => {
                            println!("👋 Shutting down dashboard...");
                            target.exit();
                        }
                        WindowEvent::Resized(physical_size) => {
                            self.renderer.resize(*physical_size);
                            self.resize_depth_texture(*physical_size);
                        }
                        WindowEvent::RedrawRequested => {
                            self.update();
                            self.render();
                        }
                        _ => {}
                    }
                }
                Event::AboutToWait => {
                    // Continuously request redraws for smooth animation
                    target.set_control_flow(ControlFlow::Poll);
                    // Request redraw for next frame
                    window.request_redraw();
                }
                _ => {}
            }
        }).unwrap();
    }
    
    fn update(&mut self) {
        let now = Instant::now();
        let dt = now.duration_since(self.last_update).as_secs_f32();
        self.last_update = now;
        
        // Update time uniform for shader effects
        let elapsed = now.duration_since(self.start_time).as_secs_f32();
        let time_uniform = [elapsed, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]; // 8 floats = 32 bytes
        self.renderer.queue.write_buffer(&self.time_buffer, 0, bytemuck::cast_slice(&time_uniform));
        
        // Update all systems
        // self.ui_system.update(dt); // Panels disabled
        self.visualizations.update(dt, &self.renderer);
        self.interaction.update();
        
        // Handle input for main dashboard camera
        self.handle_camera_input();
        
        // Update main camera
        self.main_camera.update(dt);
        self.camera_uniform.update_view_proj(&self.main_camera);
        self.renderer.queue.write_buffer(&self.camera_buffer, 0, bytemuck::cast_slice(&[self.camera_uniform]));
        
        // Clear input deltas after camera has used them
        self.interaction.input.end_frame();
    }
    
    fn resize_depth_texture(&mut self, new_size: winit::dpi::PhysicalSize<u32>) {
        // Update main camera aspect ratio
        self.main_camera.aspect = new_size.width as f32 / new_size.height as f32;
        
        self.depth_texture = self.renderer.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Depth Texture"),
            size: wgpu::Extent3d {
                width: new_size.width,
                height: new_size.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth32Float,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        
        self.depth_view = self.depth_texture.create_view(&wgpu::TextureViewDescriptor::default());
    }
    
    fn handle_camera_input(&mut self) {
        use winit::event::{ElementState, MouseButton};
        use winit::keyboard::KeyCode;
        
        let input = &self.interaction.input;
        
        // Keyboard controls with proper press/release handling
        let keys = [
            (KeyCode::KeyW, input.is_key_pressed(KeyCode::KeyW)),
            (KeyCode::KeyS, input.is_key_pressed(KeyCode::KeyS)),
            (KeyCode::KeyA, input.is_key_pressed(KeyCode::KeyA)),
            (KeyCode::KeyD, input.is_key_pressed(KeyCode::KeyD)),
            (KeyCode::KeyQ, input.is_key_pressed(KeyCode::KeyQ)),
            (KeyCode::KeyE, input.is_key_pressed(KeyCode::KeyE)),
        ];
        
        for (key, pressed) in keys {
            if pressed {
                self.main_camera.process_keyboard(key, ElementState::Pressed);
            } else {
                self.main_camera.process_keyboard(key, ElementState::Released);
            }
        }
        
        if input.is_key_pressed(KeyCode::KeyR) {
            self.main_camera.reset();
        }
        
        // Mouse button handling
        if input.is_mouse_button_pressed(MouseButton::Left) {
            self.main_camera.process_mouse_button(MouseButton::Left, ElementState::Pressed);
        } else {
            self.main_camera.process_mouse_button(MouseButton::Left, ElementState::Released);
        }
        
        // Mouse movement
        let (mouse_dx, mouse_dy) = input.get_mouse_delta();
        if mouse_dx != 0.0 || mouse_dy != 0.0 {
            self.main_camera.process_mouse_motion(mouse_dx, mouse_dy);
        }
        
        // Mouse scroll
        let scroll_delta = input.get_scroll_delta();
        if scroll_delta != 0.0 {
            self.main_camera.process_scroll(scroll_delta);
        }
    }
    
    fn render(&mut self) {
        match self.renderer.begin_frame() {
            Ok((output, view)) => {
                let mut encoder = self.renderer.device.create_command_encoder(&CommandEncoderDescriptor {
                    label: Some("Render Encoder"),
                });
                
                // Clear background with futuristic dark blue
                {
                    let _render_pass = encoder.begin_render_pass(&RenderPassDescriptor {
                        label: Some("Background Clear Pass"),
                        color_attachments: &[Some(RenderPassColorAttachment {
                            view: &view,
                            resolve_target: None,
                            ops: Operations {
                                load: LoadOp::Clear(Color {
                                    r: 0.05, // Dark blue/cyan background
                                    g: 0.1,
                                    b: 0.2,
                                    a: 1.0,
                                }),
                                store: StoreOp::Store,
                            },
                        })],
                        depth_stencil_attachment: Some(RenderPassDepthStencilAttachment {
                            view: &self.depth_view,
                            depth_ops: Some(Operations {
                                load: LoadOp::Clear(1.0),
                                store: StoreOp::Store,
                            }),
                            stencil_ops: None,
                        }),
                        occlusion_query_set: None,
                        timestamp_writes: None,
                    });
                }
                
                // Render grid floor
                {
                    let mut render_pass = encoder.begin_render_pass(&RenderPassDescriptor {
                        label: Some("Grid Render Pass"),
                        color_attachments: &[Some(RenderPassColorAttachment {
                            view: &view,
                            resolve_target: None,
                            ops: Operations {
                                load: LoadOp::Load,
                                store: StoreOp::Store,
                            },
                        })],
                        depth_stencil_attachment: Some(RenderPassDepthStencilAttachment {
                            view: &self.depth_view,
                            depth_ops: Some(Operations {
                                load: LoadOp::Load,
                                store: StoreOp::Store,
                            }),
                            stencil_ops: None,
                        }),
                        occlusion_query_set: None,
                        timestamp_writes: None,
                    });
                    
                    render_pass.set_pipeline(&self.grid_pipeline);
                    render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
                    render_pass.set_vertex_buffer(0, self.grid_vertex_buffer.slice(..));
                    render_pass.set_index_buffer(self.grid_index_buffer.slice(..), wgpu::IndexFormat::Uint16);
                    render_pass.draw_indexed(0..self.grid_index_count, 0, 0..1);
                }
                
                // Render BTC chart and visualizations with main dashboard camera
                self.visualizations.render(&mut encoder, &view, &self.depth_view, &self.camera_bind_group);
                
                // Render holographic UI panels - DISABLED
                /*
                self.ui_system.render(
                    &mut encoder,
                    &view,
                    &self.depth_view,
                    &self.holographic_bind_group,
                    &self.holographic_panel_pipeline,
                    &self.renderer.device,
                    &mut self.holographic_vertex_buffer,
                    &mut self.holographic_index_buffer,
                    &mut self.holographic_index_count,
                );
                */
                
                // Submit commands and present
                self.renderer.queue.submit(std::iter::once(encoder.finish()));
                output.present();
            }
            Err(SurfaceError::Lost) => {
                // Surface lost, reconfigure
                self.renderer.surface.configure(&self.renderer.device, &self.renderer.config);
            }
            Err(SurfaceError::OutOfMemory) => {
                println!("❌ Out of memory!");
                // Could exit here or try to recover
            }
            Err(e) => {
                eprintln!("❌ Render error: {:?}", e);
            }
        }
    }
}