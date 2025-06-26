use crate::{
    data::Candle,
    graphics::{EnhancedVertex, generate_enhanced_candle_vertices, ENHANCED_SHADER, TEXT_SHADER, text::{FontAtlas, TextVertex}},
    camera::{CameraController, CameraUniform},
};
use winit::{
    event::{ElementState, MouseButton},
    keyboard::KeyCode,
    window::Window,
};
use wgpu::util::DeviceExt;
use log::info;

pub struct State<'a> {
    surface: wgpu::Surface<'a>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    size: winit::dpi::PhysicalSize<u32>,
    render_pipeline: wgpu::RenderPipeline,
    // Text rendering components
    text_render_pipeline: wgpu::RenderPipeline,
    font_atlas: FontAtlas,
    // Camera and uniforms
    camera_uniform: CameraUniform,
    camera_controller: CameraController,
    camera_buffer: wgpu::Buffer,
    camera_bind_group: wgpu::BindGroup,
    depth_texture: wgpu::Texture,
    depth_view: wgpu::TextureView,
    pub historical_candles: Vec<Candle>,
    current_candle: Option<Candle>,
    last_frame_time: std::time::Instant,
}

impl<'a> State<'a> {
    pub async fn new(window: &'a Window, historical_candles: Vec<Candle>) -> Self {
        let size = window.inner_size();
        
        // Create instance with high-performance backend
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::VULKAN,
            ..Default::default()
        });
        
        let surface = instance.create_surface(window).unwrap();
        
        let adapter = instance.request_adapter(
            &wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            },
        ).await.unwrap();
        
        let (device, queue) = adapter.request_device(
            &wgpu::DeviceDescriptor {
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                memory_hints: wgpu::MemoryHints::default(),
                label: None,
            },
            None,
        ).await.unwrap();
        
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps.formats.iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(surface_caps.formats[0]);
        
        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width,
            height: size.height,
            present_mode: wgpu::PresentMode::AutoNoVsync,
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);
        
        // Create depth texture for proper 3D rendering
        let depth_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Depth Texture"),
            size: wgpu::Extent3d {
                width: config.width,
                height: config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 4, // 4x MSAA
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Depth32Float,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        
        let depth_view = depth_texture.create_view(&wgpu::TextureViewDescriptor::default());
        
        // Create shader
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Enhanced Shader"),
            source: wgpu::ShaderSource::Wgsl(ENHANCED_SHADER.into()),
        });
        
        // Camera setup
        let camera_controller = CameraController::new(config.width as f32 / config.height as f32);
        let mut camera_uniform = CameraUniform::new();
        camera_uniform.update_view_proj(&camera_controller);
        
        let camera_buffer = device.create_buffer_init(
            &wgpu::util::BufferInitDescriptor {
                label: Some("Camera Buffer"),
                contents: bytemuck::cast_slice(&[camera_uniform]),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            }
        );
        
        let camera_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
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
                }
            ],
            label: Some("camera_bind_group_layout"),
        });
        
        let camera_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &camera_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: camera_buffer.as_entire_binding(),
                }
            ],
            label: Some("camera_bind_group"),
        });
        
        // Create render pipeline
        let render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Render Pipeline Layout"),
            bind_group_layouts: &[&camera_bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Render Pipeline"),
            layout: Some(&render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[EnhancedVertex::desc()],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            cache: None,
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
                count: 4, // 4x MSAA
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
        });
        
        info!("🎨 Graphics pipeline initialized with 4x MSAA");
        
        // Create text rendering pipeline
        let text_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Text Shader"),
            source: wgpu::ShaderSource::Wgsl(TEXT_SHADER.into()),
        });
        
        let text_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        multisampled: false,
                        view_dimension: wgpu::TextureViewDimension::D2,
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
            label: Some("text_bind_group_layout"),
        });
        
        let font_atlas = FontAtlas::new(&device, &queue, &text_bind_group_layout);
        
        let text_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Text Pipeline Layout"),
            bind_group_layouts: &[&text_bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let text_render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Text Render Pipeline"),
            layout: Some(&text_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &text_shader,
                entry_point: Some("vs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[TextVertex::desc()],
            },
            fragment: Some(wgpu::FragmentState {
                module: &text_shader,
                entry_point: Some("fs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            cache: None,
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None, // Don't cull for text rendering
                polygon_mode: wgpu::PolygonMode::Fill,
                unclipped_depth: false,
                conservative: false,
            },
            depth_stencil: None, // Text renders on top
            multisample: wgpu::MultisampleState {
                count: 1, // No multisampling for text
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
        });
        
        info!("🔤 Text rendering pipeline initialized");
        
        Self {
            surface,
            device,
            queue,
            config,
            size,
            render_pipeline,
            text_render_pipeline,
            font_atlas,
            camera_uniform,
            camera_controller,
            camera_buffer,
            camera_bind_group,
            depth_texture,
            depth_view,
            historical_candles,
            current_candle: None,
            last_frame_time: std::time::Instant::now(),
        }
    }
    
    pub fn update_current_candle(&mut self, candle: Candle) {
        self.current_candle = Some(candle);
    }
    
    pub fn add_historical_candle(&mut self, candle: Candle) {
        self.historical_candles.push(candle);
        // Keep only last 350 candles for performance
        if self.historical_candles.len() > 350 {
            self.historical_candles.remove(0);
        }
    }
    
    pub fn process_keyboard(&mut self, key: KeyCode, state: ElementState) {
        self.camera_controller.process_keyboard(key, state);
    }
    
    pub fn process_mouse_button(&mut self, button: MouseButton, state: ElementState) {
        self.camera_controller.process_mouse_button(button, state);
    }
    
    pub fn process_mouse_motion(&mut self, x: f64, y: f64) {
        let (last_x, last_y) = self.camera_controller.last_mouse_pos;
        let delta_x = x - last_x;
        let delta_y = y - last_y;
        self.camera_controller.process_mouse_motion(delta_x, delta_y);
        self.camera_controller.last_mouse_pos = (x, y);
    }
    
    pub fn process_scroll(&mut self, delta: f32) {
        self.camera_controller.process_scroll(delta);
    }
    
    pub fn reset_camera(&mut self) {
        self.camera_controller.reset();
    }
    
    pub fn render(&mut self) -> Result<(), wgpu::SurfaceError> {
        // Update camera
        let now = std::time::Instant::now();
        let dt = now.duration_since(self.last_frame_time).as_secs_f32();
        self.last_frame_time = now;
        
        self.camera_controller.update(dt);
        self.camera_uniform.update_view_proj(&self.camera_controller);
        self.queue.write_buffer(&self.camera_buffer, 0, bytemuck::cast_slice(&[self.camera_uniform]));
        
        let output = self.surface.get_current_texture()?;
        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
        
        // Create multisampled framebuffer
        let multisampled_framebuffer = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Multisampled framebuffer"),
            size: wgpu::Extent3d {
                width: self.config.width,
                height: self.config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 4,
            dimension: wgpu::TextureDimension::D2,
            format: self.config.format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        let multisampled_view = multisampled_framebuffer.create_view(&wgpu::TextureViewDescriptor::default());
        
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Encoder"),
        });

        // Prepare geometry for all candles
        let spacing = 2.5;
        let max_hist = 40;
        let hist_len = self.historical_candles.len();
        let hist_start = if hist_len > max_hist { hist_len - max_hist } else { 0 };
        
        let mut all_vertices = Vec::new();
        let mut all_indices = Vec::new();
        let mut draw_ranges = Vec::new();
        let mut vtx_offset = 0u16;
        
        let visible_count = (hist_len - hist_start) as f32;
        let chart_width = visible_count * spacing;
        let start_x = -chart_width / 2.0;
        
        // Add historical candles
        for (i, candle) in self.historical_candles[hist_start..].iter().enumerate() {
            let x = start_x + (i as f32 * spacing);
            let (mut vertices, mut indices) = generate_enhanced_candle_vertices(candle);
            
            for v in &mut vertices {
                v.position[0] += x;
                // Fade historical candles
                let fade_factor = 0.6 + (i as f32 / visible_count) * 0.4;
                v.color = [v.color[0] * fade_factor, v.color[1] * fade_factor, v.color[2] * fade_factor];
            }
            
            for idx in &mut indices {
                *idx += vtx_offset;
            }
            
            draw_ranges.push((all_indices.len() as u32, indices.len() as u32));
            vtx_offset += vertices.len() as u16;
            all_vertices.extend(vertices);
            all_indices.extend(indices);
        }
        
        // Add live candle
        if let Some(current_candle) = &self.current_candle {
            let live_x = start_x + visible_count * spacing;
            let (mut vertices, mut indices) = generate_enhanced_candle_vertices(current_candle);
            
            for v in &mut vertices {
                v.position[0] += live_x;
                // Make live candle brighter
                v.color = [v.color[0] * 1.2, v.color[1] * 1.2, v.color[2] * 1.2];
            }
            
            for idx in &mut indices {
                *idx += vtx_offset;
            }
            
            draw_ranges.push((all_indices.len() as u32, indices.len() as u32));
            all_vertices.extend(vertices);
            all_indices.extend(indices);
        }
        
        // Create combined buffers
        let combined_vbuf = if !all_vertices.is_empty() {
            Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Combined Vertex Buffer"),
                contents: bytemuck::cast_slice(&all_vertices),
                usage: wgpu::BufferUsages::VERTEX,
            }))
        } else {
            None
        };
        
        let combined_ibuf = if !all_indices.is_empty() {
            Some(self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Combined Index Buffer"),
                contents: bytemuck::cast_slice(&all_indices),
                usage: wgpu::BufferUsages::INDEX,
            }))
        } else {
            None
        };
        
        // Render pass
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &multisampled_view,
                resolve_target: Some(&view),
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: 0.02, g: 0.02, b: 0.04, a: 1.0,
                    }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                view: &self.depth_view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Clear(1.0),
                    store: wgpu::StoreOp::Store,
                }),
                stencil_ops: None,
            }),
            ..Default::default()
        });
        
        // Draw all candles
        if let (Some(ref vbuf), Some(ref ibuf)) = (combined_vbuf.as_ref(), combined_ibuf.as_ref()) {
            render_pass.set_pipeline(&self.render_pipeline);
            render_pass.set_bind_group(0, &self.camera_bind_group, &[]);
            render_pass.set_vertex_buffer(0, vbuf.slice(..));
            render_pass.set_index_buffer(ibuf.slice(..), wgpu::IndexFormat::Uint16);
            
            for (start, count) in &draw_ranges {
                render_pass.draw_indexed(*start..(*start+*count), 0, 0..1);
            }
        }
        
        drop(render_pass);
        
        // Render text overlay with real BTC data
        if let Some(ref current_candle) = self.current_candle {
            // Format price text
            let price_text = format!("BTC: ${:.2}", current_candle.close);
            let change_percent = ((current_candle.close - current_candle.open) / current_candle.open) * 100.0;
            let change_text = format!("{:+.2}%", change_percent);
            
            // Create text vertices for price display
            let (price_vertices, price_indices) = self.font_atlas.create_text_vertices(&price_text, 20.0, 20.0, 1.5);
            let (change_vertices, change_indices) = self.font_atlas.create_text_vertices(&change_text, 20.0, 60.0, 1.2);
            
            // Combine all text vertices
            let mut all_text_vertices = Vec::new();
            let mut all_text_indices = Vec::new();
            
            all_text_vertices.extend(price_vertices);
            all_text_indices.extend(price_indices);
            
            // Offset indices for change text
            let vertex_offset = all_text_vertices.len() as u16;
            all_text_vertices.extend(change_vertices);
            all_text_indices.extend(change_indices.iter().map(|&i| i + vertex_offset));
            
            if !all_text_vertices.is_empty() {
                // Create text buffers
                let text_vertex_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("Text Vertex Buffer"),
                    contents: bytemuck::cast_slice(&all_text_vertices),
                    usage: wgpu::BufferUsages::VERTEX,
                });
                
                let text_index_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("Text Index Buffer"),
                    contents: bytemuck::cast_slice(&all_text_indices),
                    usage: wgpu::BufferUsages::INDEX,
                });
                
                // Separate render pass for text (no depth buffer, no MSAA)
                let mut text_render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("Text Render Pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &view, // Render directly to surface
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Load, // Don't clear, preserve 3D scene
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None, // No depth buffer for text
                    ..Default::default()
                });
                
                // Render text
                text_render_pass.set_pipeline(&self.text_render_pipeline);
                text_render_pass.set_bind_group(0, &self.font_atlas.bind_group, &[]);
                text_render_pass.set_vertex_buffer(0, text_vertex_buffer.slice(..));
                text_render_pass.set_index_buffer(text_index_buffer.slice(..), wgpu::IndexFormat::Uint16);
                text_render_pass.draw_indexed(0..all_text_indices.len() as u32, 0, 0..1);
                
                drop(text_render_pass);
            }
        } else {
            // Fallback static text when no candle data available
            let static_text = "BTC: Loading...";
            let (text_vertices, text_indices) = self.font_atlas.create_text_vertices(&static_text, 20.0, 20.0, 1.5);
            
            if !text_vertices.is_empty() {
                let text_vertex_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("Text Vertex Buffer"),
                    contents: bytemuck::cast_slice(&text_vertices),
                    usage: wgpu::BufferUsages::VERTEX,
                });
                
                let text_index_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("Text Index Buffer"),
                    contents: bytemuck::cast_slice(&text_indices),
                    usage: wgpu::BufferUsages::INDEX,
                });
                
                let mut text_render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("Text Render Pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &view,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Load,
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    ..Default::default()
                });
                
                text_render_pass.set_pipeline(&self.text_render_pipeline);
                text_render_pass.set_bind_group(0, &self.font_atlas.bind_group, &[]);
                text_render_pass.set_vertex_buffer(0, text_vertex_buffer.slice(..));
                text_render_pass.set_index_buffer(text_index_buffer.slice(..), wgpu::IndexFormat::Uint16);
                text_render_pass.draw_indexed(0..text_indices.len() as u32, 0, 0..1);
                
                drop(text_render_pass);
            }
        }
        
        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();
        
        Ok(())
    }
    
    pub fn reconfigure_surface(&mut self) {
        self.surface.configure(&self.device, &self.config);
    }
    
    pub fn fallback_render(&mut self) {
        if let Ok(output) = self.surface.get_current_texture() {
            let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
            let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Fallback Clear Encoder"),
            });
            {
                let _ = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("Fallback Clear Pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &view,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color {
                                r: 0.02, g: 0.02, b: 0.04, a: 1.0,
                            }),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    ..Default::default()
                });
            }
            self.queue.submit(std::iter::once(encoder.finish()));
            output.present();
        }
    }
    
    pub fn resize(&mut self, new_size: winit::dpi::PhysicalSize<u32>) {
        if new_size.width > 0 && new_size.height > 0 {
            self.size = new_size;
            self.config.width = new_size.width;
            self.config.height = new_size.height;
            self.surface.configure(&self.device, &self.config);
            
            // Recreate depth texture
            self.depth_texture = self.device.create_texture(&wgpu::TextureDescriptor {
                label: Some("Depth Texture"),
                size: wgpu::Extent3d {
                    width: self.config.width,
                    height: self.config.height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 4,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Depth32Float,
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
                view_formats: &[],
            });
            
            self.depth_view = self.depth_texture.create_view(&wgpu::TextureViewDescriptor::default());
            self.camera_controller.update_aspect(new_size.width as f32 / new_size.height as f32);
            
            info!("🖼️ Window resized to {}x{}", new_size.width, new_size.height);
        }
    }
}