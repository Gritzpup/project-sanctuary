//! Advanced 3D camera controller for the futuristic dashboard

use crate::core::types::Vec3;
use cgmath::{Matrix4, Point3, Vector3, perspective, Deg, Rad, InnerSpace, Transform};
use winit::keyboard::KeyCode;

pub struct FuturisticCamera {
    pub position: Vec3,
    pub target: Vec3,
    pub up: Vec3,
    pub fovy: f32,
    pub aspect: f32,
    pub znear: f32,
    pub zfar: f32,
    
    // Camera modes
    pub mode: CameraMode,
    pub transition_time: f32,
    pub transition_duration: f32,
    
    // Movement
    pub movement_speed: f32,
    pub rotation_speed: f32,
    pub zoom_speed: f32,
    
    // Smooth movement
    pub velocity: Vec3,
    pub angular_velocity: Vec3,
    pub damping: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CameraMode {
    Free,           // Free-flying camera
    Orbit,          // Orbit around target
    Focus(Vec3),    // Focus on specific point
    Cinematic,      // Automated cinematic movement
    FirstPerson,    // First person view
}

impl FuturisticCamera {
    pub fn new(aspect: f32) -> Self {
        Self {
            position: Vec3::new(0.0, 5.0, 10.0),
            target: Vec3::new(0.0, 0.0, 0.0),
            up: Vec3::new(0.0, 1.0, 0.0),
            fovy: 45.0,
            aspect,
            znear: 0.1,
            zfar: 1000.0,
            mode: CameraMode::Orbit,
            transition_time: 0.0,
            transition_duration: 2.0,
            movement_speed: 5.0,
            rotation_speed: 2.0,
            zoom_speed: 2.0,
            velocity: Vec3::new(0.0, 0.0, 0.0),
            angular_velocity: Vec3::new(0.0, 0.0, 0.0),
            damping: 0.9,
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        match self.mode {
            CameraMode::Orbit => self.update_orbit(dt),
            CameraMode::Free => self.update_free(dt),
            CameraMode::Focus(point) => self.update_focus(point, dt),
            CameraMode::Cinematic => self.update_cinematic(dt),
            CameraMode::FirstPerson => self.update_first_person(dt),
        }
        
        // Apply damping
        self.velocity *= self.damping;
        self.angular_velocity *= self.damping;
        
        // Update transition
        if self.transition_time > 0.0 {
            self.transition_time -= dt;
        }
    }
    
    fn update_orbit(&mut self, dt: f32) {
        // Orbital camera rotates around the target
        let relative = Vector3::new(
            self.position.x - self.target.x,
            self.position.y - self.target.y,
            self.position.z - self.target.z,
        );
        let _distance = relative.magnitude();
        let angle = dt * self.rotation_speed * 0.3; // Slow automatic rotation
        
        let rotation = Matrix4::from_angle_y(Rad(angle));
        let rotated_pos = rotation.transform_vector(relative);
        self.position = Vec3::new(
            self.target.x + rotated_pos.x,
            self.target.y + rotated_pos.y,
            self.target.z + rotated_pos.z,
        );
    }
    
    fn update_free(&mut self, _dt: f32) {
        // Free camera movement handled by input system
        self.position += self.velocity;
    }
    
    fn update_focus(&mut self, focus_point: Vec3, dt: f32) {
        // Smoothly move camera to focus on a specific point
        let desired_position = focus_point + Vec3::new(0.0, 2.0, 5.0);
        let lerp_factor = 1.0 - (-dt * 3.0).exp();
        
        self.position = self.position + (desired_position - self.position) * lerp_factor;
        self.target = self.target + (focus_point - self.target) * lerp_factor;
    }
    
    fn update_cinematic(&mut self, _dt: f32) {
        // Cinematic camera movements with predefined paths
        let time = self.transition_time;
        let radius = 15.0;
        let height = 5.0 + 3.0 * (time * 0.5).sin();
        
        self.position = Vec3::new(
            radius * (time * 0.2).cos(),
            height,
            radius * (time * 0.2).sin(),
        );
        
        self.target = Vec3::new(0.0, 0.0, 0.0);
    }
    
    fn update_first_person(&mut self, _dt: f32) {
        // First person camera (target follows position)
        // Implementation would be similar to free camera
    }
    
    pub fn process_keyboard(&mut self, key: KeyCode, delta_time: f32) {
        let speed = self.movement_speed * delta_time;
        
        match key {
            KeyCode::KeyW => self.velocity.z -= speed,
            KeyCode::KeyS => self.velocity.z += speed,
            KeyCode::KeyA => self.velocity.x -= speed,
            KeyCode::KeyD => self.velocity.x += speed,
            KeyCode::KeyQ => self.velocity.y -= speed,
            KeyCode::KeyE => self.velocity.y += speed,
            _ => {}
        }
    }
    
    pub fn process_mouse_motion(&mut self, delta_x: f64, delta_y: f64) {
        let sensitivity = 0.002;
        
        match self.mode {
            CameraMode::Free | CameraMode::FirstPerson => {
                // Rotate camera based on mouse movement
                self.angular_velocity.y += delta_x as f32 * sensitivity;
                self.angular_velocity.x += delta_y as f32 * sensitivity;
            }
            CameraMode::Orbit => {
                // Orbit around target
                let relative = Vector3::new(
                    self.position.x - self.target.x,
                    self.position.y - self.target.y,
                    self.position.z - self.target.z,
                );
                let angle_y = delta_x as f32 * sensitivity;
                
                // Rotate around Y axis
                let rotation_y = Matrix4::from_angle_y(Rad(angle_y));
                let rotated_pos = rotation_y.transform_vector(relative);
                self.position = Vec3::new(
                    self.target.x + rotated_pos.x,
                    self.target.y + rotated_pos.y,
                    self.target.z + rotated_pos.z,
                );
            }
            _ => {}
        }
    }
    
    pub fn process_scroll(&mut self, delta: f32) {
        let zoom_factor = 1.0 + delta * self.zoom_speed * 0.1;
        
        match self.mode {
            CameraMode::Orbit => {
                // Zoom in/out by moving closer/farther from target
                let relative = Vector3::new(
                    self.position.x - self.target.x,
                    self.position.y - self.target.y,
                    self.position.z - self.target.z,
                );
                let distance = relative.magnitude();
                let direction = relative.normalize();
                let new_distance = (distance / zoom_factor).clamp(1.0, 50.0);
                let new_relative = direction * new_distance;
                self.position = Vec3::new(
                    self.target.x + new_relative.x,
                    self.target.y + new_relative.y,
                    self.target.z + new_relative.z,
                );
            }
            CameraMode::Free | CameraMode::FirstPerson => {
                // Adjust movement speed
                self.movement_speed *= zoom_factor;
                self.movement_speed = self.movement_speed.clamp(0.1, 20.0);
            }
            _ => {}
        }
    }
    
    pub fn set_mode(&mut self, mode: CameraMode) {
        if self.mode != mode {
            self.mode = mode;
            self.transition_time = self.transition_duration;
            log::info!("Camera mode changed to: {:?}", mode);
        }
    }
    
    pub fn get_view_matrix(&self) -> Matrix4<f32> {
        Matrix4::look_at_rh(
            Point3::new(self.position.x, self.position.y, self.position.z),
            Point3::new(self.target.x, self.target.y, self.target.z),
            Vector3::new(self.up.x, self.up.y, self.up.z),
        )
    }
    
    pub fn get_projection_matrix(&self) -> Matrix4<f32> {
        perspective(Deg(self.fovy), self.aspect, self.znear, self.zfar)
    }
    
    pub fn get_view_projection_matrix(&self) -> Matrix4<f32> {
        self.get_projection_matrix() * self.get_view_matrix()
    }
    
    pub fn update_aspect(&mut self, aspect: f32) {
        self.aspect = aspect;
    }
    
    pub fn reset(&mut self) {
        self.position = Vec3::new(0.0, 5.0, 10.0);
        self.target = Vec3::new(0.0, 0.0, 0.0);
        self.velocity = Vec3::new(0.0, 0.0, 0.0);
        self.angular_velocity = Vec3::new(0.0, 0.0, 0.0);
        self.mode = CameraMode::Orbit;
    }
}