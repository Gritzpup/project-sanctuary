pub mod data;
pub mod graphics;
pub mod camera;
pub mod ui;
pub mod rendering;

use env_logger;
use log::info;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use winit::{
    event::*,
    event_loop::{ControlFlow, EventLoop},
    window::WindowAttributes,
    keyboard::{KeyCode, PhysicalKey},
};

use data::{fetch_historical_candles, start_websocket_with_reconnect, CandleUpdate, Candle};
use rendering::State;
use ui::{print_trading_info, format_window_title};

pub async fn run_btc_chart() {
    env_logger::init();
    info!("🚀 BTC Chart - 3D Real-time Bitcoin Visualization");
    info!("Initializing application...");

    // Fetch historical candles before starting event loop
    let historical_candles = fetch_historical_candles().await.unwrap_or_default();
    info!("📊 Loaded {} historical candles", historical_candles.len());

    let event_loop = EventLoop::new().unwrap();
    
    // Create main window
    let window_attrs = WindowAttributes::default()
        .with_title("🚀 3D BTC Chart | Real-time Bitcoin Visualization")
        .with_inner_size(winit::dpi::LogicalSize::new(1200, 800));
    let window = event_loop.create_window(window_attrs).unwrap();

    let mut state = State::new(&window, historical_candles).await;
    
    // Initialize shared candle data
    let initial_candle = if let Some(last_candle) = state.historical_candles.last() {
        last_candle.clone()
    } else {
        Candle::new(106000.0, 106000.0, 106000.0, 106000.0, 0.0)
    };
    let candle_data = Arc::new(Mutex::new(initial_candle));
    
    // WebSocket channel for real-time updates
    let (tx, mut rx) = mpsc::channel::<CandleUpdate>(100);
    
    // Spawn WebSocket task with auto-reconnect
    tokio::spawn(async move {
        start_websocket_with_reconnect(tx).await;
    });
    
    let mut fps_counter = 0;
    let mut fps_timer = std::time::Instant::now();
    
    info!("🎮 Controls: Mouse=Rotate, Scroll=Zoom, Shift+Mouse=Pan, WASD=Move, R=Reset");
    info!("🔥 Application ready! Starting main loop...");
    
    event_loop.run(|event, target| {
        target.set_control_flow(ControlFlow::Poll);
        
        match event {
            Event::WindowEvent {
                ref event,
                window_id,
            } if window_id == window.id() => match event {
                WindowEvent::CloseRequested => {
                    info!("👋 Application closing...");
                    target.exit();
                }
                WindowEvent::Resized(physical_size) => {
                    state.resize(*physical_size);
                    window.request_redraw();
                }
                WindowEvent::KeyboardInput { event, .. } => {
                    if let PhysicalKey::Code(keycode) = event.physical_key {
                        state.process_keyboard(keycode, event.state);
                        
                        // Reset camera on R key
                        if keycode == KeyCode::KeyR && event.state == ElementState::Pressed {
                            state.reset_camera();
                            info!("📷 Camera reset to default position");
                        }
                    }
                }
                WindowEvent::MouseInput { button, state: btn_state, .. } => {
                    state.process_mouse_button(*button, *btn_state);
                }
                WindowEvent::CursorMoved { position, .. } => {
                    state.process_mouse_motion(position.x, position.y);
                }
                WindowEvent::MouseWheel { delta, .. } => {
                    let scroll_delta = match delta {
                        MouseScrollDelta::LineDelta(_, y) => *y,
                        MouseScrollDelta::PixelDelta(pos) => pos.y as f32 * 0.01,
                    };
                    state.process_scroll(scroll_delta);
                }
                WindowEvent::RedrawRequested => {
                    match state.render() {
                        Ok(_) => {}
                        Err(wgpu::SurfaceError::Lost) => {
                            state.reconfigure_surface();
                            window.request_redraw();
                        }
                        Err(wgpu::SurfaceError::OutOfMemory) => {
                            log::error!("💥 Out of memory!");
                            target.exit();
                        }
                        Err(e) => {
                            log::warn!("⚠️  Render error: {:?}", e);
                            state.fallback_render();
                        }
                    }
                }
                _ => {}
            },
            Event::AboutToWait => {
                // Process real-time data updates
                let mut updated = false;
                while let Ok(update) = rx.try_recv() {
                    match update {
                        CandleUpdate::LiveUpdate(new_candle) => {
                            if let Ok(mut candle) = candle_data.lock() {
                                *candle = new_candle.clone();
                                updated = true;
                            }
                            state.update_current_candle(new_candle);
                        }
                        CandleUpdate::NewMinuteCandle(completed_candle) => {
                            state.add_historical_candle(completed_candle);
                            updated = true;
                        }
                    }
                }
                
                // Update window title with current price
                if updated {
                    if let Ok(candle) = candle_data.lock() {
                        let title = format_window_title(&candle);
                        window.set_title(&title);
                        
                        // Print trading info occasionally
                        print_trading_info(&candle, fps_counter, state.historical_candles.len());
                    }
                }
                
                // Always render for smooth animation
                window.request_redraw();
                
                // FPS counter
                fps_counter += 1;
                if fps_timer.elapsed().as_secs() >= 1 {
                    fps_timer = std::time::Instant::now();
                    fps_counter = 0;
                }
            }
            _ => {}
        }
    }).unwrap();
}