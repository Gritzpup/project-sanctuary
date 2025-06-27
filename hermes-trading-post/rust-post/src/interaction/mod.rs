//! Interaction module - Advanced input handling and camera controls

pub mod camera;
pub mod input;
pub mod raycasting;
pub mod gestures;

pub struct InteractionSystem {
    pub input: input::InputManager,
}

impl InteractionSystem {
    pub fn new() -> Self {
        println!("🎮 Initializing interaction systems...");
        
        Self {
            input: input::InputManager::new(),
        }
    }
    
    pub fn update(&mut self) {
        self.input.update();
    }
}