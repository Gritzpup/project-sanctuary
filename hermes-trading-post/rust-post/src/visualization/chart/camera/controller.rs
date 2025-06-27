use cgmath::{Matrix4, Deg, perspective, Point3, Vector3, InnerSpace, SquareMatrix};
use winit::event::{ElementState, KeyEvent, MouseButton, MouseScrollDelta};
use winit::keyboard::{KeyCode, PhysicalKey};
use bytemuck::{Pod, Zeroable};
use std::collections::HashSet;

/// Camera uniform buffer data
#[repr(C)]
#[derive(Debug, Copy, Clone, Pod, Zeroable)]
pub struct CameraUniform {
    pub view_proj: [[f32; 4]; 4],
    pub view_pos: [f32; 3],
    pub _padding: f32,
}

impl CameraUniform {
    pub fn new() -> Self {
        Self {
            view_proj: Matrix4::identity().into(),
            view_pos: [0.0, 0.0, 0.0],
            _padding: 0.0,
        }
    }

    pub fn update_view_proj(&mut self, camera_controller: &CameraController) {
        self.view_proj = camera_controller.build_view_projection_matrix().into();
        self.view_pos = [
            camera_controller.eye.x,
            camera_controller.eye.y,
            camera_controller.eye.z,
        ];
    }
}

/// Camera controller for smooth movement and interaction
#[derive(Debug)]
pub struct CameraController {
    pub eye: Point3<f32>,
    pub target: Point3<f32>,
    pub up: Vector3<f32>,
    pub fov: f32,
    pub aspect: f32,
    pub znear: f32,
    pub zfar: f32,
    
    // Controls
    pub forward_speed: f32,
    pub rotation_speed: f32,
    pub zoom_speed: f32,
    
    // Input state
    pub keys_pressed: HashSet<KeyCode>,
    pub mouse_pressed: bool,
    pub shift_pressed: bool,
    pub last_mouse_pos: (f64, f64),
}

impl CameraController {
    pub fn new(aspect: f32) -> Self {
        Self {
            eye: Point3::new(0.0, 10.0, 15.0), // Better front-facing view
            target: Point3::new(0.0, 0.0, 0.0), // Look at center of chart
            up: Vector3::unit_y(),
            fov: 45.0,
            aspect,
            znear: 0.1,
            zfar: 400.0,
            
            forward_speed: 5.0,
            rotation_speed: 0.015,
            zoom_speed: 2.0,
            
            keys_pressed: HashSet::new(),
            mouse_pressed: false,
            shift_pressed: false,
            last_mouse_pos: (0.0, 0.0),
        }
    }
    
    pub fn update_aspect(&mut self, aspect: f32) {
        self.aspect = aspect;
    }
    
    pub fn process_keyboard(&mut self, key: KeyCode, state: ElementState) {
        match state {
            ElementState::Pressed => {
                self.keys_pressed.insert(key);
                if key == KeyCode::ShiftLeft || key == KeyCode::ShiftRight {
                    self.shift_pressed = true;
                }
            }
            ElementState::Released => {
                self.keys_pressed.remove(&key);
                if key == KeyCode::ShiftLeft || key == KeyCode::ShiftRight {
                    self.shift_pressed = false;
                }
            }
        }
    }
    
    pub fn process_mouse_motion(&mut self, delta_x: f64, delta_y: f64) {
        let dx = delta_x as f32;
        let dy = delta_y as f32;
        
        // Only process significant mouse movements to avoid jitter
        if dx.abs() < 0.1 && dy.abs() < 0.1 {
            return;
        }
        
        if self.mouse_pressed {
            if self.shift_pressed {
                // Panning mode - move both eye and target together
                let pan_speed = 0.05;
                let forward = (self.target - self.eye).normalize();
                let right = forward.cross(self.up).normalize();
                let up = right.cross(forward).normalize();
                
                let pan_movement = right * (-dx * pan_speed) + up * (dy * pan_speed);
                
                self.eye += pan_movement;
                self.target += pan_movement;
            } else {
                // Rotation mode - rotate around target
                let dx = dx * self.rotation_speed;
                let dy = dy * self.rotation_speed;
                
                let radius = (self.eye - self.target).magnitude();
                
                let forward = (self.target - self.eye).normalize();
                let right = forward.cross(self.up).normalize();
                let up = right.cross(forward).normalize();
                
                // Apply rotations
                let new_forward = Matrix4::from_axis_angle(up, Deg(-dx)) * 
                                 Matrix4::from_axis_angle(right, Deg(-dy)) * 
                                 forward.extend(0.0);

                self.eye = self.target - Vector3::new(new_forward.x, new_forward.y, new_forward.z) * radius;
            }
        } else {
            // Free look mode - just mouse movement for rotation (more responsive)
            let sensitivity = 0.005;
            let dx = dx * sensitivity;
            let dy = dy * sensitivity;
            
            let radius = (self.eye - self.target).magnitude();
            
            let forward = (self.target - self.eye).normalize();
            let right = forward.cross(self.up).normalize();
            let up = right.cross(forward).normalize();
            
            // Apply rotations
            let new_forward = Matrix4::from_axis_angle(up, Deg(-dx)) * 
                             Matrix4::from_axis_angle(right, Deg(-dy)) * 
                             forward.extend(0.0);

            self.eye = self.target - Vector3::new(new_forward.x, new_forward.y, new_forward.z) * radius;
        }
    }
    
    pub fn process_mouse_button(&mut self, button: MouseButton, state: ElementState) {
        if button == MouseButton::Left {
            self.mouse_pressed = state == ElementState::Pressed;
        }
    }
    
    pub fn process_scroll(&mut self, delta: f32) {
        let forward = (self.target - self.eye).normalize();
        self.eye += forward * delta * self.zoom_speed;
        
        // Prevent getting too close
        let distance = (self.eye - self.target).magnitude();
        if distance < 5.0 {
            self.eye = self.target - forward * 5.0;
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        let forward = (self.target - self.eye).normalize();
        let right = forward.cross(self.up).normalize();
        let up = right.cross(forward).normalize();
        
        let mut movement = Vector3::new(0.0, 0.0, 0.0);
        
        // WASD movement
        if self.keys_pressed.contains(&KeyCode::KeyW) {
            movement += forward;
        }
        if self.keys_pressed.contains(&KeyCode::KeyS) {
            movement -= forward;
        }
        if self.keys_pressed.contains(&KeyCode::KeyA) {
            movement -= right;
        }
        if self.keys_pressed.contains(&KeyCode::KeyD) {
            movement += right;
        }
        if self.keys_pressed.contains(&KeyCode::KeyQ) {
            movement += up;
        }
        if self.keys_pressed.contains(&KeyCode::KeyE) {
            movement -= up;
        }
        
        // Apply movement
        if movement.magnitude() > 0.0 {
            movement = movement.normalize() * self.forward_speed * dt;
            self.eye += movement;
            self.target += movement;
        }
    }
    
    pub fn build_view_projection_matrix(&self) -> Matrix4<f32> {
        let view = Matrix4::look_at_rh(self.eye, self.target, self.up);
        let proj = perspective(Deg(self.fov), self.aspect, self.znear, self.zfar);
        proj * view
    }
    
    pub fn get_camera_info(&self) -> String {
        format!(
            "Camera: Eye({:.1}, {:.1}, {:.1}) Target({:.1}, {:.1}, {:.1}) FOV: {:.1}°",
            self.eye.x, self.eye.y, self.eye.z,
            self.target.x, self.target.y, self.target.z,
            self.fov
        )
    }
    
    /// Reset camera to default position
    pub fn reset(&mut self) {
        self.eye = Point3::new(0.0, 10.0, 15.0);
        self.target = Point3::new(0.0, 0.0, 0.0);
        self.up = Vector3::unit_y();
        self.fov = 45.0;
    }
}