//! 🚀 Futuristic 3D Trading Dashboard
//! A next-generation crypto trading interface with immersive 3D visualization

mod core;
mod rendering;
mod ui3d;
mod visualization;
mod data;
mod interaction;
mod effects;

use winit::{event_loop::EventLoop, window::WindowAttributes};
use crate::core::app::FuturisticDashboard;

#[tokio::main]
async fn main() {
    env_logger::init();
    
    println!("🚀 Initializing Futuristic 3D Trading Dashboard...");
    println!("🌟 Welcome to the future of crypto trading!");
    
    // Create event loop
    let event_loop = EventLoop::new().expect("Failed to create event loop");
    
    // Configure window with futuristic styling
    let window_attrs = WindowAttributes::default()
        .with_title("⚡ HERMES TRADING POST - 3D Dashboard")
        .with_inner_size(winit::dpi::LogicalSize::new(1920, 1080))
        .with_decorations(true)
        .with_transparent(false);
    
    // Create window
    let window = event_loop.create_window(window_attrs)
        .expect("Failed to create window");
    
    // Run the application
    let dashboard = FuturisticDashboard::new(&window).await;
    dashboard.run(event_loop, &window).await;
}