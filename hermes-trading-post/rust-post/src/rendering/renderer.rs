//! Main renderer handling GPU resources and render passes

use winit::window::Window;
use wgpu::*;

pub struct Renderer<'a> {
    pub device: Device,
    pub queue: Queue,
    pub surface: wgpu::Surface<'a>,
    pub config: SurfaceConfiguration,
    pub size: winit::dpi::PhysicalSize<u32>,
    depth_texture: Texture,
    depth_view: TextureView,
    msaa_texture: Option<Texture>,
    msaa_view: Option<TextureView>,
}

impl<'a> Renderer<'a> {
    pub async fn new(window: &'a Window) -> Self {
        let size = window.inner_size();
        
        // Create WGPU instance with high-performance backend
        let instance = Instance::new(InstanceDescriptor {
            backends: Backends::VULKAN | Backends::METAL | Backends::DX12,
            ..Default::default()
        });
        
        let surface = instance.create_surface(window).expect("Failed to create surface");
        
        let adapter = instance.request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            compatible_surface: Some(&surface),
        }).await.unwrap();
        
        let (device, queue) = adapter.request_device(
            &DeviceDescriptor {
                label: Some("Futuristic Dashboard Device"),
                required_features: Features::empty(),
                required_limits: Limits::default(),
                memory_hints: MemoryHints::default(),
            },
            None,
        ).await.unwrap();
        
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps.formats.iter()
            .find(|f| f.is_srgb())
            .copied()
            .unwrap_or(surface_caps.formats[0]);
        
        let config = SurfaceConfiguration {
            usage: TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width,
            height: size.height,
            present_mode: PresentMode::AutoNoVsync,
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        
        surface.configure(&device, &config);
        
        // Create depth texture
        let depth_texture = Self::create_depth_texture(&device, &config, 4);
        let depth_view = depth_texture.create_view(&TextureViewDescriptor::default());
        
        // Create MSAA texture
        let (msaa_texture, msaa_view) = Self::create_msaa_framebuffer(&device, &config, 4);
        
        Self {
            device,
            queue,
            surface,
            config,
            size,
            depth_texture,
            depth_view,
            msaa_texture: Some(msaa_texture),
            msaa_view: Some(msaa_view),
        }
    }
    
    fn create_depth_texture(device: &Device, config: &SurfaceConfiguration, sample_count: u32) -> Texture {
        device.create_texture(&TextureDescriptor {
            label: Some("Depth Texture"),
            size: Extent3d {
                width: config.width,
                height: config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count,
            dimension: TextureDimension::D2,
            format: TextureFormat::Depth32Float,
            usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        })
    }
    
    fn create_msaa_framebuffer(device: &Device, config: &SurfaceConfiguration, sample_count: u32) -> (Texture, TextureView) {
        let texture = device.create_texture(&TextureDescriptor {
            label: Some("MSAA Framebuffer"),
            size: Extent3d {
                width: config.width,
                height: config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count,
            dimension: TextureDimension::D2,
            format: config.format,
            usage: TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });
        
        let view = texture.create_view(&TextureViewDescriptor::default());
        (texture, view)
    }
    
    pub fn resize(&mut self, new_size: winit::dpi::PhysicalSize<u32>) {
        if new_size.width > 0 && new_size.height > 0 {
            self.size = new_size;
            self.config.width = new_size.width;
            self.config.height = new_size.height;
            self.surface.configure(&self.device, &self.config);
            
            // Recreate depth and MSAA textures
            self.depth_texture = Self::create_depth_texture(&self.device, &self.config, 4);
            self.depth_view = self.depth_texture.create_view(&TextureViewDescriptor::default());
            
            let (msaa_texture, msaa_view) = Self::create_msaa_framebuffer(&self.device, &self.config, 4);
            self.msaa_texture = Some(msaa_texture);
            self.msaa_view = Some(msaa_view);
        }
    }
    
    pub fn begin_frame(&self) -> Result<(SurfaceTexture, TextureView), SurfaceError> {
        let output = self.surface.get_current_texture()?;
        let view = output.texture.create_view(&TextureViewDescriptor::default());
        Ok((output, view))
    }
}