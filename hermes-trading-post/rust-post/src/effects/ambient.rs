//! Ambient effects like floating particles, grid backgrounds, etc.

use crate::core::types::{Vec3, Color};
use rand::Rng;

pub struct AmbientParticle {
    pub position: Vec3,
    pub velocity: Vec3,
    pub color: Color,
    pub size: f32,
    pub life: f32,
    pub max_life: f32,
    pub particle_type: ParticleType,
}

#[derive(Debug, Clone, Copy)]
pub enum ParticleType {
    Dust,
    Spark,
    Data,
    Energy,
    Static,
}

pub struct AmbientSystem {
    pub particles: Vec<AmbientParticle>,
    pub max_particles: usize,
    pub spawn_rate: f32,
    pub spawn_timer: f32,
    pub bounds: (Vec3, Vec3), // min, max
    pub enabled: bool,
    
    // Grid effect
    pub grid_enabled: bool,
    pub grid_size: f32,
    pub grid_opacity: f32,
    pub grid_color: Color,
    pub grid_pulse_speed: f32,
    pub grid_time: f32,
}

impl AmbientSystem {
    pub fn new(max_particles: usize) -> Self {
        Self {
            particles: Vec::with_capacity(max_particles),
            max_particles,
            spawn_rate: 2.0, // particles per second
            spawn_timer: 0.0,
            bounds: (
                Vec3::new(-20.0, -10.0, -20.0),
                Vec3::new(20.0, 10.0, 20.0),
            ),
            enabled: true,
            grid_enabled: true,
            grid_size: 2.0,
            grid_opacity: 0.3,
            grid_color: Color::new(0.0, 0.8, 1.0, 1.0),
            grid_pulse_speed: 1.0,
            grid_time: 0.0,
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        if !self.enabled {
            return;
        }
        
        self.grid_time += dt;
        
        // Spawn new particles
        self.spawn_timer += dt;
        let spawn_interval = 1.0 / self.spawn_rate;
        
        while self.spawn_timer >= spawn_interval && self.particles.len() < self.max_particles {
            self.spawn_particle();
            self.spawn_timer -= spawn_interval;
        }
        
        // Update existing particles
        for particle in &mut self.particles {
            particle.position += particle.velocity * dt;
            particle.life -= dt;
            
            // Update particle based on type
            match particle.particle_type {
                ParticleType::Dust => {
                    // Slow, gentle movement
                    particle.velocity *= 0.99;
                }
                ParticleType::Spark => {
                    // Fast, erratic movement with gravity
                    particle.velocity.y -= 2.0 * dt;
                    particle.velocity *= 0.98;
                }
                ParticleType::Data => {
                    // Straight line movement
                    // Velocity remains constant
                }
                ParticleType::Energy => {
                    // Pulsing movement
                    let pulse = (self.grid_time * 5.0).sin() * 0.1;
                    particle.velocity.y += pulse * dt;
                }
                ParticleType::Static => {
                    // No movement, just fades
                    particle.velocity *= 0.95;
                }
            }
            
            // Wrap around bounds
            if particle.position.x < self.bounds.0.x {
                particle.position.x = self.bounds.1.x;
            } else if particle.position.x > self.bounds.1.x {
                particle.position.x = self.bounds.0.x;
            }
            
            if particle.position.z < self.bounds.0.z {
                particle.position.z = self.bounds.1.z;
            } else if particle.position.z > self.bounds.1.z {
                particle.position.z = self.bounds.0.z;
            }
            
            // Update alpha based on life
            let life_ratio = particle.life / particle.max_life;
            particle.color.a = life_ratio.clamp(0.0, 1.0);
        }
        
        // Remove dead particles
        self.particles.retain(|p| p.life > 0.0);
    }
    
    fn spawn_particle(&mut self) {
        let mut rng = rand::thread_rng();
        
        let particle_type = match rng.gen_range(0..5) {
            0 => ParticleType::Dust,
            1 => ParticleType::Spark,
            2 => ParticleType::Data,
            3 => ParticleType::Energy,
            _ => ParticleType::Static,
        };
        
        let position = Vec3::new(
            rng.gen_range(self.bounds.0.x..self.bounds.1.x),
            rng.gen_range(self.bounds.0.y..self.bounds.1.y),
            rng.gen_range(self.bounds.0.z..self.bounds.1.z),
        );
        
        let (velocity, color, size, life) = match particle_type {
            ParticleType::Dust => (
                Vec3::new(
                    rng.gen_range(-0.5..0.5),
                    rng.gen_range(-0.2..0.2),
                    rng.gen_range(-0.5..0.5),
                ),
                Color::new(0.8, 0.8, 1.0, 0.3),
                rng.gen_range(0.01..0.03),
                rng.gen_range(5.0..15.0),
            ),
            ParticleType::Spark => (
                Vec3::new(
                    rng.gen_range(-2.0..2.0),
                    rng.gen_range(1.0..3.0),
                    rng.gen_range(-2.0..2.0),
                ),
                Color::new(1.0, 0.8, 0.0, 0.8),
                rng.gen_range(0.02..0.05),
                rng.gen_range(1.0..3.0),
            ),
            ParticleType::Data => (
                Vec3::new(
                    rng.gen_range(-1.0..1.0),
                    0.0,
                    rng.gen_range(-1.0..1.0),
                ),
                Color::new(0.0, 1.0, 0.8, 0.6),
                rng.gen_range(0.005..0.015),
                rng.gen_range(8.0..20.0),
            ),
            ParticleType::Energy => (
                Vec3::new(
                    rng.gen_range(-0.3..0.3),
                    rng.gen_range(-0.5..0.5),
                    rng.gen_range(-0.3..0.3),
                ),
                Color::new(1.0, 0.0, 1.0, 0.7),
                rng.gen_range(0.01..0.04),
                rng.gen_range(3.0..10.0),
            ),
            ParticleType::Static => (
                Vec3::new(0.0, 0.0, 0.0),
                Color::new(0.5, 0.5, 0.5, 0.2),
                rng.gen_range(0.002..0.01),
                rng.gen_range(10.0..30.0),
            ),
        };
        
        let particle = AmbientParticle {
            position,
            velocity,
            color,
            size,
            life,
            max_life: life,
            particle_type,
        };
        
        self.particles.push(particle);
    }
    
    pub fn get_grid_lines(&self) -> Vec<GridLine> {
        if !self.grid_enabled {
            return Vec::new();
        }
        
        let mut lines = Vec::new();
        let pulse = (self.grid_time * self.grid_pulse_speed).sin() * 0.1 + 0.9;
        let grid_color = Color::new(
            self.grid_color.r,
            self.grid_color.g,
            self.grid_color.b,
            self.grid_opacity * pulse,
        );
        
        // Generate grid lines
        let start_x = (self.bounds.0.x / self.grid_size).floor() * self.grid_size;
        let end_x = (self.bounds.1.x / self.grid_size).ceil() * self.grid_size;
        let start_z = (self.bounds.0.z / self.grid_size).floor() * self.grid_size;
        let end_z = (self.bounds.1.z / self.grid_size).ceil() * self.grid_size;
        
        // Vertical lines (parallel to Z axis)
        let mut x = start_x;
        while x <= end_x {
            lines.push(GridLine {
                start: Vec3::new(x, self.bounds.0.y, self.bounds.0.z),
                end: Vec3::new(x, self.bounds.0.y, self.bounds.1.z),
                color: grid_color,
            });
            x += self.grid_size;
        }
        
        // Horizontal lines (parallel to X axis)
        let mut z = start_z;
        while z <= end_z {
            lines.push(GridLine {
                start: Vec3::new(self.bounds.0.x, self.bounds.0.y, z),
                end: Vec3::new(self.bounds.1.x, self.bounds.0.y, z),
                color: grid_color,
            });
            z += self.grid_size;
        }
        
        lines
    }
    
    pub fn emit_burst(&mut self, position: Vec3, count: u32, particle_type: ParticleType) {
        let mut rng = rand::thread_rng();
        
        for _ in 0..count {
            if self.particles.len() >= self.max_particles {
                break;
            }
            
            let velocity = Vec3::new(
                rng.gen_range(-3.0..3.0),
                rng.gen_range(-1.0..3.0),
                rng.gen_range(-3.0..3.0),
            );
            
            let (color, size, life) = match particle_type {
                ParticleType::Spark => (
                    Color::new(1.0, 0.8, 0.0, 1.0),
                    rng.gen_range(0.02..0.05),
                    rng.gen_range(0.5..2.0),
                ),
                ParticleType::Energy => (
                    Color::new(1.0, 0.0, 1.0, 1.0),
                    rng.gen_range(0.01..0.04),
                    rng.gen_range(1.0..3.0),
                ),
                _ => (
                    Color::new(0.8, 0.8, 1.0, 0.8),
                    rng.gen_range(0.01..0.03),
                    rng.gen_range(1.0..4.0),
                ),
            };
            
            let particle = AmbientParticle {
                position,
                velocity,
                color,
                size,
                life,
                max_life: life,
                particle_type,
            };
            
            self.particles.push(particle);
        }
    }
    
    pub fn set_spawn_rate(&mut self, rate: f32) {
        self.spawn_rate = rate.clamp(0.0, 100.0);
    }
    
    pub fn set_grid_opacity(&mut self, opacity: f32) {
        self.grid_opacity = opacity.clamp(0.0, 1.0);
    }
    
    pub fn toggle_grid(&mut self) {
        self.grid_enabled = !self.grid_enabled;
    }
    
    pub fn toggle(&mut self) {
        self.enabled = !self.enabled;
    }
    
    pub fn clear_particles(&mut self) {
        self.particles.clear();
    }
}

#[derive(Debug, Clone, Copy)]
pub struct GridLine {
    pub start: Vec3,
    pub end: Vec3,
    pub color: Color,
}