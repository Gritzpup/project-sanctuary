//! Particle System for Trade Flow and Effects

use crate::core::types::{Vec3, Color};

pub struct ParticleSystem {
    pub particles: Vec<Particle>,
    pub emitters: Vec<ParticleEmitter>,
    pub max_particles: usize,
}

#[derive(Debug, Clone)]
pub struct Particle {
    pub position: Vec3,
    pub velocity: Vec3,
    pub color: Color,
    pub life: f32,
    pub size: f32,
}

#[derive(Debug, Clone)]
pub struct ParticleEmitter {
    pub position: Vec3,
    pub rate: f32,
    pub velocity_range: (Vec3, Vec3),
    pub color_range: (Color, Color),
    pub life_range: (f32, f32),
}

impl ParticleSystem {
    pub fn new(max_particles: usize) -> Self {
        Self {
            particles: Vec::with_capacity(max_particles),
            emitters: Vec::new(),
            max_particles,
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        // Update particles
        for particle in &mut self.particles {
            particle.position += particle.velocity * dt;
            particle.life -= dt;
        }
        
        // Remove dead particles
        self.particles.retain(|p| p.life > 0.0);
    }
    
    pub fn emit_trade_flow(&mut self, from: Vec3, to: Vec3, value: f64) {
        // Create particles for trade visualization
        let color = if value > 0.0 {
            Color::NEON_GREEN
        } else {
            Color::new(1.0, 0.0, 0.0, 1.0)
        };
        
        let diff = to - from;
        let length = (diff.x * diff.x + diff.y * diff.y + diff.z * diff.z).sqrt();
        let direction = if length > 0.0 {
            Vec3::new(diff.x / length, diff.y / length, diff.z / length)
        } else {
            Vec3::new(0.0, 0.0, 1.0)
        };
        let particle = Particle {
            position: from,
            velocity: direction * 5.0,
            color,
            life: 3.0,
            size: (value.abs() as f32 * 0.1).clamp(0.1, 1.0),
        };
        
        if self.particles.len() < self.max_particles {
            self.particles.push(particle);
        }
    }
}