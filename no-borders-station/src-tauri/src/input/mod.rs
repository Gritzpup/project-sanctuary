use anyhow::Result;
use log::{info, warn, error};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex as StdMutex};
use rdev::{listen, EventType, Event};
use enigo::{Enigo, Mouse, Keyboard, Direction, Key, Button, Settings};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::atomic::{AtomicBool, Ordering};

// Global state for input capture (required for rdev callback)
static CAPTURE_ENABLED: AtomicBool = AtomicBool::new(false);
static mut GLOBAL_MOUSE_POS: Option<Arc<StdMutex<(f64, f64)>>> = None;
static mut GLOBAL_EVENTS: Option<Arc<StdMutex<Vec<(EventType, u64)>>>> = None;

// Thread-safe callback function for rdev
fn input_event_callback(event: Event) {
    if !CAPTURE_ENABLED.load(Ordering::Relaxed) {
        return;
    }
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    
    unsafe {
        match event.event_type {
            EventType::MouseMove { x, y } => {
                // Update mouse position
                if let Some(ref mouse_pos) = GLOBAL_MOUSE_POS {
                    if let Ok(mut pos) = mouse_pos.lock() {
                        *pos = (x, y);
                    }
                }
                
                // Store event
                if let Some(ref events) = GLOBAL_EVENTS {
                    if let Ok(mut events_vec) = events.lock() {
                        events_vec.push((EventType::MouseMove { x, y }, timestamp));
                        if events_vec.len() > 100 {
                            events_vec.drain(0..50); // Keep last 50 events
                        }
                    }
                }
            },
            event_type => {
                info!("Input event: {:?}", event_type);
                // Store other events
                if let Some(ref events) = GLOBAL_EVENTS {
                    if let Ok(mut events_vec) = events.lock() {
                        events_vec.push((event_type, timestamp));
                        if events_vec.len() > 100 {
                            events_vec.drain(0..50);
                        }
                    }
                }
            }
        }
    }
}

// Phase 1 placeholder types for compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputCapabilities {
    pub mouse: bool,
    pub keyboard: bool,
    pub touchpad: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MouseState {
    pub x: f64,
    pub y: f64,
    pub buttons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyboardEvent {
    pub key: String,
    pub code: String,
    pub pressed: bool,
    pub modifiers: KeyboardModifiers,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyboardModifiers {
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub meta: bool,
}

// Alias for main.rs compatibility
pub type InputCapture = InputManager;

// Thread-safe InputManager
pub struct InputManager {
    mouse_position: Arc<StdMutex<(f64, f64)>>,
    recent_events: Arc<StdMutex<Vec<(EventType, u64)>>>,
    capture_thread_handle: Option<thread::JoinHandle<()>>,
}

impl InputManager {
    pub fn new() -> Result<Self> {
        info!("Creating InputManager with real input capture");
        
        let mouse_pos = Arc::new(StdMutex::new((0.0, 0.0)));
        let events = Arc::new(StdMutex::new(Vec::new()));
        
        // Set up global state for the callback
        unsafe {
            GLOBAL_MOUSE_POS = Some(mouse_pos.clone());
            GLOBAL_EVENTS = Some(events.clone());
        }
        
        Ok(Self {
            mouse_position: mouse_pos,
            recent_events: events,
            capture_thread_handle: None,
        })
    }
    
    pub async fn start_capture(&mut self) -> Result<()> {
        info!("Starting real input capture with rdev");
        
        if CAPTURE_ENABLED.load(Ordering::Relaxed) {
            warn!("Input capture already running");
            return Ok(());
        }
        
        CAPTURE_ENABLED.store(true, Ordering::Relaxed);
        
        // Start input capture in a separate thread
        let handle = thread::spawn(move || {
            info!("Input capture thread started");
            
            if let Err(e) = listen(input_event_callback) {
                error!("Input capture error: {:?}", e);
            }
            
            info!("Input capture thread ended");
        });
        
        self.capture_thread_handle = Some(handle);
        
        info!("Real input capture started");
        Ok(())
    }
    
    pub async fn stop_capture(&mut self) -> Result<()> {
        info!("Stopping input capture");
        
        CAPTURE_ENABLED.store(false, Ordering::Relaxed);
        
        info!("Input capture stopped");
        Ok(())
    }
    
    pub async fn get_mouse_position(&self) -> (f64, f64) {
        if let Ok(pos) = self.mouse_position.lock() {
            *pos
        } else {
            (0.0, 0.0)
        }
    }
    
    pub async fn get_capabilities(&self) -> InputCapabilities {
        InputCapabilities {
            mouse: true,
            keyboard: true,
            touchpad: false,
        }
    }
    
    pub async fn initialize(&mut self) -> Result<()> {
        info!("Initializing InputManager (Phase 1 placeholder)");
        Ok(())
    }
    
    pub fn get_mouse_state(&self) -> MouseState {
        // For Phase 1, return a placeholder state
        MouseState {
            x: 0.0,
            y: 0.0,
            buttons: vec![],
        }
    }
    
    pub fn get_keyboard_events(&mut self) -> Vec<KeyboardEvent> {
        // For Phase 1, return empty events
        vec![]
    }
    
    // Input injection methods using spawn_blocking for thread safety
    pub async fn inject_mouse_move(&self, x: f64, y: f64) -> Result<()> {
        info!("Injecting real mouse move to ({:.2}, {:.2})", x, y);
        
        // Update stored position
        if let Ok(mut pos) = self.mouse_position.lock() {
            *pos = (x, y);
        }
        
        // Create a new Enigo instance for injection (thread-safe)
        tokio::task::spawn_blocking(move || {
            let settings = Settings::default();
            match Enigo::new(&settings) {
                Ok(mut enigo) => {
                    if let Err(e) = enigo.move_mouse(x as i32, y as i32, enigo::Coordinate::Abs) {
                        error!("Failed to move mouse: {:?}", e);
                    }
                },
                Err(e) => {
                    error!("Failed to create Enigo for mouse move: {:?}", e);
                }
            }
        }).await.map_err(|e| anyhow::anyhow!("Task join error: {}", e))?;
        
        Ok(())
    }
    
    pub async fn inject_key_press(&self, key: &str) -> Result<()> {
        info!("Injecting real key press: {}", key);
        
        let key_str = key.to_string();
        tokio::task::spawn_blocking(move || {
            let settings = Settings::default();
            match Enigo::new(&settings) {
                Ok(mut enigo) => {
                    // Convert string key to Enigo key
                    let enigo_key = match key_str.to_lowercase().as_str() {
                        "a" => Key::Unicode('a'),
                        "b" => Key::Unicode('b'),
                        "c" => Key::Unicode('c'),
                        "space" => Key::Space,
                        "enter" => Key::Return,
                        "escape" => Key::Escape,
                        "tab" => Key::Tab,
                        "ctrl" => Key::Control,
                        "shift" => Key::Shift,
                        "alt" => Key::Alt,
                        _ => {
                            warn!("Unknown key: {}", key_str);
                            return;
                        }
                    };
                    
                    if let Err(e) = enigo.key(enigo_key, Direction::Press) {
                        error!("Failed to press key: {:?}", e);
                    }
                },
                Err(e) => {
                    error!("Failed to create Enigo for key press: {:?}", e);
                }
            }
        }).await.map_err(|e| anyhow::anyhow!("Task join error: {}", e))?;
        
        Ok(())
    }
    
    pub async fn inject_key_release(&self, key: &str) -> Result<()> {
        info!("Injecting real key release: {}", key);
        
        let key_str = key.to_string();
        tokio::task::spawn_blocking(move || {
            let settings = Settings::default();
            match Enigo::new(&settings) {
                Ok(mut enigo) => {
                    // Convert string key to Enigo key
                    let enigo_key = match key_str.to_lowercase().as_str() {
                        "a" => Key::Unicode('a'),
                        "b" => Key::Unicode('b'),
                        "c" => Key::Unicode('c'),
                        "space" => Key::Space,
                        "enter" => Key::Return,
                        "escape" => Key::Escape,
                        "tab" => Key::Tab,
                        "ctrl" => Key::Control,
                        "shift" => Key::Shift,
                        "alt" => Key::Alt,
                        _ => {
                            warn!("Unknown key: {}", key_str);
                            return;
                        }
                    };
                    
                    if let Err(e) = enigo.key(enigo_key, Direction::Release) {
                        error!("Failed to release key: {:?}", e);
                    }
                },
                Err(e) => {
                    error!("Failed to create Enigo for key release: {:?}", e);
                }
            }
        }).await.map_err(|e| anyhow::anyhow!("Task join error: {}", e))?;
        
        Ok(())
    }
    
    pub async fn inject_mouse_click(&self, button: &str) -> Result<()> {
        info!("Injecting real mouse click: {}", button);
        
        let button_str = button.to_string();
        tokio::task::spawn_blocking(move || {
            let settings = Settings::default();
            match Enigo::new(&settings) {
                Ok(mut enigo) => {
                    match button_str.to_lowercase().as_str() {
                        "left" => {
                            if let Err(e) = enigo.button(Button::Left, Direction::Press) {
                                error!("Failed to press left button: {:?}", e);
                                return;
                            }
                            // Small delay to simulate real click
                            std::thread::sleep(std::time::Duration::from_millis(10));
                            if let Err(e) = enigo.button(Button::Left, Direction::Release) {
                                error!("Failed to release left button: {:?}", e);
                            }
                        },
                        "right" => {
                            if let Err(e) = enigo.button(Button::Right, Direction::Press) {
                                error!("Failed to press right button: {:?}", e);
                                return;
                            }
                            std::thread::sleep(std::time::Duration::from_millis(10));
                            if let Err(e) = enigo.button(Button::Right, Direction::Release) {
                                error!("Failed to release right button: {:?}", e);
                            }
                        },
                        "middle" => {
                            if let Err(e) = enigo.button(Button::Middle, Direction::Press) {
                                error!("Failed to press middle button: {:?}", e);
                                return;
                            }
                            std::thread::sleep(std::time::Duration::from_millis(10));
                            if let Err(e) = enigo.button(Button::Middle, Direction::Release) {
                                error!("Failed to release middle button: {:?}", e);
                            }
                        },
                        _ => {
                            warn!("Unknown mouse button: {}", button_str);
                            return;
                        }
                    }
                },
                Err(e) => {
                    error!("Failed to create Enigo for mouse click: {:?}", e);
                }
            }
        }).await.map_err(|e| anyhow::anyhow!("Task join error: {}", e))?;
        
        Ok(())
    }
    
    pub async fn is_capturing(&self) -> bool {
        CAPTURE_ENABLED.load(Ordering::Relaxed)
    }
}

impl Drop for InputManager {
    fn drop(&mut self) {
        info!("InputManager shutting down");
        CAPTURE_ENABLED.store(false, Ordering::Relaxed);
        
        // Clean up global state
        unsafe {
            GLOBAL_MOUSE_POS = None;
            GLOBAL_EVENTS = None;
        }
    }
}