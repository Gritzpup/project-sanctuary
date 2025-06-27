//! Input handling system for the 3D dashboard

use winit::{
    event::{DeviceEvent, ElementState, Event, KeyEvent, MouseButton, WindowEvent},
    keyboard::{KeyCode, PhysicalKey},
};
use std::collections::HashSet;

pub struct InputManager {
    pub keys_pressed: HashSet<KeyCode>,
    pub mouse_position: (f64, f64),
    pub last_mouse_position: (f64, f64),
    pub mouse_delta: (f64, f64),
    pub mouse_buttons: HashSet<MouseButton>,
    pub scroll_delta: f32,
    pub window_size: (u32, u32),
}

impl InputManager {
    pub fn new() -> Self {
        Self {
            keys_pressed: HashSet::new(),
            mouse_position: (0.0, 0.0),
            last_mouse_position: (0.0, 0.0),
            mouse_delta: (0.0, 0.0),
            mouse_buttons: HashSet::new(),
            scroll_delta: 0.0,
            window_size: (1920, 1080),
        }
    }
    
    pub fn handle_event(&mut self, event: &Event<()>) {
        match event {
            Event::WindowEvent { event, .. } => {
                self.handle_window_event(event);
            }
            Event::DeviceEvent { event, .. } => {
                self.handle_device_event(event);
            }
            _ => {}
        }
    }
    
    fn handle_window_event(&mut self, event: &WindowEvent) {
        match event {
            WindowEvent::KeyboardInput {
                event: KeyEvent {
                    physical_key: PhysicalKey::Code(key_code),
                    state,
                    ..
                },
                ..
            } => {
                match state {
                    ElementState::Pressed => {
                        self.keys_pressed.insert(*key_code);
                    }
                    ElementState::Released => {
                        self.keys_pressed.remove(key_code);
                    }
                }
            }
            WindowEvent::CursorMoved { position, .. } => {
                self.last_mouse_position = self.mouse_position;
                self.mouse_position = (position.x, position.y);
                self.mouse_delta = (
                    self.mouse_position.0 - self.last_mouse_position.0,
                    self.mouse_position.1 - self.last_mouse_position.1,
                );
            }
            WindowEvent::MouseInput { state, button, .. } => {
                match state {
                    ElementState::Pressed => {
                        self.mouse_buttons.insert(*button);
                    }
                    ElementState::Released => {
                        self.mouse_buttons.remove(button);
                    }
                }
            }
            WindowEvent::MouseWheel { delta, .. } => {
                self.scroll_delta = match delta {
                    winit::event::MouseScrollDelta::LineDelta(_, y) => *y,
                    winit::event::MouseScrollDelta::PixelDelta(pos) => pos.y as f32 * 0.01,
                };
            }
            WindowEvent::Resized(size) => {
                self.window_size = (size.width, size.height);
            }
            _ => {}
        }
    }
    
    fn handle_device_event(&mut self, event: &DeviceEvent) {
        match event {
            DeviceEvent::MouseMotion { delta } => {
                // Raw mouse movement for camera control
                self.mouse_delta = *delta;
            }
            _ => {}
        }
    }
    
    pub fn update(&mut self) {
        // Don't reset values here - they need to persist until after camera update
        // These will be reset at the beginning of the next frame instead
    }
    
    pub fn end_frame(&mut self) {
        // Reset per-frame values after they've been used
        self.mouse_delta = (0.0, 0.0);
        self.scroll_delta = 0.0;
    }
    
    pub fn is_key_pressed(&self, key: KeyCode) -> bool {
        self.keys_pressed.contains(&key)
    }
    
    pub fn is_mouse_button_pressed(&self, button: MouseButton) -> bool {
        self.mouse_buttons.contains(&button)
    }
    
    pub fn get_mouse_delta(&self) -> (f64, f64) {
        self.mouse_delta
    }
    
    pub fn get_scroll_delta(&self) -> f32 {
        self.scroll_delta
    }
    
    pub fn get_normalized_mouse_position(&self) -> (f32, f32) {
        (
            (self.mouse_position.0 / self.window_size.0 as f64) as f32 * 2.0 - 1.0,
            1.0 - (self.mouse_position.1 / self.window_size.1 as f64) as f32 * 2.0,
        )
    }
    
    pub fn get_movement_vector(&self) -> (f32, f32, f32) {
        let mut movement = (0.0, 0.0, 0.0);
        
        if self.is_key_pressed(KeyCode::KeyW) {
            movement.2 -= 1.0;
        }
        if self.is_key_pressed(KeyCode::KeyS) {
            movement.2 += 1.0;
        }
        if self.is_key_pressed(KeyCode::KeyA) {
            movement.0 -= 1.0;
        }
        if self.is_key_pressed(KeyCode::KeyD) {
            movement.0 += 1.0;
        }
        if self.is_key_pressed(KeyCode::KeyQ) {
            movement.1 -= 1.0;
        }
        if self.is_key_pressed(KeyCode::KeyE) {
            movement.1 += 1.0;
        }
        
        movement
    }
    
    pub fn is_modifier_pressed(&self, modifier: ModifierKey) -> bool {
        match modifier {
            ModifierKey::Shift => {
                self.is_key_pressed(KeyCode::ShiftLeft) || self.is_key_pressed(KeyCode::ShiftRight)
            }
            ModifierKey::Ctrl => {
                self.is_key_pressed(KeyCode::ControlLeft) || self.is_key_pressed(KeyCode::ControlRight)
            }
            ModifierKey::Alt => {
                self.is_key_pressed(KeyCode::AltLeft) || self.is_key_pressed(KeyCode::AltRight)
            }
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum ModifierKey {
    Shift,
    Ctrl,
    Alt,
}

#[derive(Debug, Clone, Copy)]
pub enum InputAction {
    MoveForward,
    MoveBackward,
    MoveLeft,
    MoveRight,
    MoveUp,
    MoveDown,
    RotateCamera,
    ZoomIn,
    ZoomOut,
    ResetCamera,
    ToggleUI,
    ToggleFullscreen,
    Screenshot,
}