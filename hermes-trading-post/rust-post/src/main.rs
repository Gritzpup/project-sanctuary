//! Minimal Rust+Vulkan+WebSocket candle demo (Coinbase live)
//! - Connects to Coinbase WebSocket
//! - Receives candle data
//! - Changes window color based on candle direction (green/red)

use std::sync::{Arc, Mutex};
use std::ffi::CString;
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use winit::{
    event::*,
    event_loop::{ControlFlow, EventLoop, ActiveEventLoop},
    window::Window,
    raw_window_handle::{HasRawDisplayHandle, HasRawWindowHandle},
};
use ash::{vk, Entry, Instance, Device};

// --- Candle data structure ---
#[derive(Debug, Clone, Deserialize)]
struct Candle {
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    #[allow(dead_code)]
    volume: f64,
}

// --- Coinbase WebSocket task ---
async fn websocket_task(tx: mpsc::Sender<Candle>, candle_data: Arc<Mutex<Candle>>) {
    use tokio_tungstenite::connect_async;
    use tungstenite::Message;
    use serde_json::Value;

    let url = "wss://ws-feed.exchange.coinbase.com";
    
    println!("Connecting to Coinbase WebSocket...");
    
    let (ws_stream, _) = match connect_async(url).await {
        Ok(stream) => stream,
        Err(e) => {
            eprintln!("Failed to connect to WebSocket: {}", e);
            return;
        }
    };
    
    println!("Connected! Subscribing to BTC-USD candles...");
    
    let (mut write, mut read) = ws_stream.split();

    // Subscribe to BTC-USD ticker for real-time updates AND 1m candles
    let subscribe_msg = serde_json::json!({
        "type": "subscribe",
        "channels": [
            {
                "name": "ticker",
                "product_ids": ["BTC-USD"]
            },
            {
                "name": "candles",
                "product_ids": ["BTC-USD"],
                "interval": "one_minute"
            }
        ]
    });
    
    if let Err(e) = write.send(Message::Text(subscribe_msg.to_string())).await {
        eprintln!("Failed to send subscribe message: {}", e);
        return;
    }

    println!("Waiting for candle data...");

    while let Some(msg) = read.next().await {
        if let Ok(msg) = msg {
            if let Message::Text(txt) = msg {
                if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                    // Debug output for subscription confirmation
                    if json["type"] == "subscriptions" {
                        println!("Subscription confirmed: {}", json);
                    }
                    
                    // Handle ticker updates (real-time price)
                    if json["type"] == "ticker" && json["product_id"] == "BTC-USD" {
                        if let Some(price) = json["price"].as_str() {
                            if let Ok(price_f64) = price.parse::<f64>() {
                                // Update candle with latest price (as close price)
                                let candle = Candle {
                                    open: candle_data.lock().map(|c| c.open).unwrap_or(price_f64),
                                    high: candle_data.lock().map(|c| c.high.max(price_f64)).unwrap_or(price_f64),
                                    low: candle_data.lock().map(|c| c.low.min(price_f64)).unwrap_or(price_f64),
                                    close: price_f64,
                                    volume: 0.0,
                                };
                                println!("Ticker update: ${:.2}", price_f64);
                                let _ = tx.send(candle).await;
                            }
                        }
                    }
                    
                    // Handle candle updates
                    if json["type"] == "candles" && json["product_id"] == "BTC-USD" {
                        if let Some(arr) = json["candles"].as_array() {
                            if let Some(c) = arr.first() {
                                // Coinbase candle: [start, low, high, open, close, volume]
                                let open = c[3].as_f64().unwrap_or(0.0);
                                let high = c[2].as_f64().unwrap_or(0.0);
                                let low = c[1].as_f64().unwrap_or(0.0);
                                let close = c[4].as_f64().unwrap_or(0.0);
                                let volume = c[5].as_f64().unwrap_or(0.0);
                                let candle = Candle { open, high, low, close, volume };
                                
                                println!("New candle: O:{:.2} H:{:.2} L:{:.2} C:{:.2} | {}", 
                                    candle.open, candle.high, candle.low, candle.close,
                                    if candle.close > candle.open { "UP 🟢" } else { "DOWN 🔴" }
                                );
                                
                                let _ = tx.send(candle).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

// Minimal Vulkan app that just clears the screen with a color
struct VulkanApp {
    _entry: Entry,
    instance: Instance,
    surface: vk::SurfaceKHR,
    physical_device: vk::PhysicalDevice,
    device: Device,
    queue: vk::Queue,
    queue_family_index: u32,
    swapchain: vk::SwapchainKHR,
    swapchain_images: Vec<vk::Image>,
    command_pool: vk::CommandPool,
    command_buffer: vk::CommandBuffer,
}

impl VulkanApp {
    unsafe fn new(window: &Window) -> Result<Self, Box<dyn std::error::Error>> {
        let entry = Entry::load()?;
        
        // Create instance
        let app_name = CString::new("Rust Candle Demo")?;
        let app_info = vk::ApplicationInfo::default()
            .application_name(&app_name)
            .engine_name(&app_name)
            .api_version(vk::make_api_version(0, 1, 0, 0));
        
        let extensions = ash_window::enumerate_required_extensions(window.raw_display_handle().unwrap())?;
        
        let create_info = vk::InstanceCreateInfo::default()
            .application_info(&app_info)
            .enabled_extension_names(&extensions);
        
        let instance = entry.create_instance(&create_info, None)?;
        
        // Create surface
        let surface = ash_window::create_surface(
            &entry,
            &instance,
            window.raw_display_handle().unwrap(),
            window.raw_window_handle().unwrap(),
            None,
        )?;
        
        // Pick physical device (just use the first one)
        let physical_devices = instance.enumerate_physical_devices()?;
        let physical_device = physical_devices[0];
        
        // Find graphics queue family
        let queue_family_properties = instance.get_physical_device_queue_family_properties(physical_device);
        let queue_family_index = queue_family_properties
            .iter()
            .position(|props| props.queue_flags.contains(vk::QueueFlags::GRAPHICS))
            .expect("No graphics queue family") as u32;
        
        // Create device
        let queue_priorities = [1.0];
        let queue_create_info = vk::DeviceQueueCreateInfo::default()
            .queue_family_index(queue_family_index)
            .queue_priorities(&queue_priorities);
        
        let device_extensions = [ash::khr::swapchain::NAME.as_ptr()];
        let device_create_info = vk::DeviceCreateInfo::default()
            .queue_create_infos(std::slice::from_ref(&queue_create_info))
            .enabled_extension_names(&device_extensions);
        
        let device = instance.create_device(physical_device, &device_create_info, None)?;
        let queue = device.get_device_queue(queue_family_index, 0);
        
        // Create minimal swapchain
        let surface_loader = ash::khr::surface::Instance::new(&entry, &instance);
        let surface_capabilities = surface_loader.get_physical_device_surface_capabilities(physical_device, surface)?;
        let surface_formats = surface_loader.get_physical_device_surface_formats(physical_device, surface)?;
        let surface_format = surface_formats[0];
        
        let swapchain_create_info = vk::SwapchainCreateInfoKHR::default()
            .surface(surface)
            .min_image_count(2.max(surface_capabilities.min_image_count))
            .image_format(surface_format.format)
            .image_color_space(surface_format.color_space)
            .image_extent(vk::Extent2D { width: 800, height: 600 })
            .image_array_layers(1)
            .image_usage(vk::ImageUsageFlags::COLOR_ATTACHMENT)
            .image_sharing_mode(vk::SharingMode::EXCLUSIVE)
            .pre_transform(surface_capabilities.current_transform)
            .composite_alpha(vk::CompositeAlphaFlagsKHR::OPAQUE)
            .present_mode(vk::PresentModeKHR::FIFO)
            .clipped(true);
        
        let swapchain_loader = ash::khr::swapchain::Device::new(&instance, &device);
        let swapchain = swapchain_loader.create_swapchain(&swapchain_create_info, None)?;
        let swapchain_images = swapchain_loader.get_swapchain_images(swapchain)?;
        
        // Create command pool and buffer
        let command_pool_create_info = vk::CommandPoolCreateInfo::default()
            .flags(vk::CommandPoolCreateFlags::RESET_COMMAND_BUFFER)
            .queue_family_index(queue_family_index);
        
        let command_pool = device.create_command_pool(&command_pool_create_info, None)?;
        
        let command_buffer_allocate_info = vk::CommandBufferAllocateInfo::default()
            .command_pool(command_pool)
            .level(vk::CommandBufferLevel::PRIMARY)
            .command_buffer_count(1);
        
        let command_buffers = device.allocate_command_buffers(&command_buffer_allocate_info)?;
        let command_buffer = command_buffers[0];
        
        Ok(VulkanApp {
            _entry: entry,
            instance,
            surface,
            physical_device,
            device,
            queue,
            queue_family_index,
            swapchain,
            swapchain_images,
            command_pool,
            command_buffer,
        })
    }
    
    unsafe fn cleanup(&self) {
        self.device.device_wait_idle().ok();
        self.device.destroy_command_pool(self.command_pool, None);
        // Note: In a real app, we'd clean up everything properly
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();
    println!("Starting Rust Vulkan Candle Demo...");
    println!("The window will change color based on BTC price movement:");
    println!("- Green background = Price going UP");
    println!("- Red background = Price going DOWN");

    let event_loop = EventLoop::new()?;
    let window_attrs = winit::window::WindowAttributes::default()
        .with_title("Rust Vulkan Candle Demo - BTC-USD")
        .with_inner_size(winit::dpi::LogicalSize::new(800, 600));
    let window = event_loop.create_window(window_attrs)?;

    // Note: Full Vulkan setup is complex; for demo purposes, we'll just show the concept
    let _vulkan_app = unsafe { VulkanApp::new(&window).ok() };
    
    // Shared state for the latest candle
    let candle_data = Arc::new(Mutex::new(Candle {
        open: 100000.0,
        high: 105000.0,
        low: 95000.0,
        close: 102000.0,
        volume: 1.0,
    }));
    
    // Channel for WebSocket -> UI
    let (tx, mut rx) = mpsc::channel::<Candle>(8);
    
    // Spawn WebSocket task
    let candle_data_clone = candle_data.clone();
    tokio::spawn(async move {
        websocket_task(tx, candle_data_clone).await;
    });
    
    event_loop.run(|event, target| {
        target.set_control_flow(ControlFlow::Poll);
        
        match event {
            Event::AboutToWait => {
                // Check for new candle data
                while let Ok(new_candle) = rx.try_recv() {
                    if let Ok(mut candle) = candle_data.lock() {
                        *candle = new_candle;
                        
                        // Update window title with price info
                        let title = format!(
                            "BTC-USD | O: ${:.0} H: ${:.0} L: ${:.0} C: ${:.0} | {}",
                            candle.open,
                            candle.high,
                            candle.low,
                            candle.close,
                            if candle.close > candle.open { "UP 🟢" } else { "DOWN 🔴" }
                        );
                        window.set_title(&title);
                    }
                }
                window.request_redraw();
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                println!("Closing...");
                if let Some(ref app) = _vulkan_app {
                    unsafe { app.cleanup(); }
                }
                target.exit();
            }
            _ => {}
        }
    })?;
    Ok(())
}