//! Trade stream visualization with flowing particle effects

use crate::core::types::{Vec3, Color};
use crate::ui3d::panels::holographic_panel::{HolographicPanel, HologramVertex};
use std::time::Instant;

#[derive(Clone, Debug)]
pub struct TradeStream {
    pub base_panel: HolographicPanel,
    pub recent_trades: Vec<TradeParticle>,
    pub max_particles: usize,
    pub spawn_rate: f32,
    pub last_spawn: Instant,
}

#[derive(Clone, Debug)]
pub struct TradeParticle {
    pub position: Vec3,
    pub velocity: Vec3,
    pub size: f32,
    pub color: Color,
    pub life_time: f32,
    pub max_life: f32,
    pub trade_type: TradeType,
    pub volume: f64,
}

#[derive(Clone, Debug)]
pub enum TradeType {
    Buy,
    Sell,
    Large, // Whale trades
}

impl TradeStream {
    pub fn new(panel: HolographicPanel) -> Self {
        Self {
            base_panel: panel,
            recent_trades: Vec::new(),
            max_particles: 200,
            spawn_rate: 2.0, // particles per second
            last_spawn: Instant::now(),
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        self.base_panel.update(dt);
        
        // Update existing particles
        self.recent_trades.retain_mut(|particle| {
            particle.life_time += dt;
            particle.position.x += particle.velocity.x * dt;
            particle.position.y += particle.velocity.y * dt;
            particle.position.z += particle.velocity.z * dt;
            
            // Apply gravity and air resistance
            particle.velocity.y -= 0.5 * dt; // Gravity
            particle.velocity.x *= 0.98; // Air resistance
            particle.velocity.z *= 0.98;
            
            // Fade out over time
            let life_ratio = particle.life_time / particle.max_life;
            particle.color.a = (1.0 - life_ratio).max(0.0);
            
            // Remove expired particles
            particle.life_time < particle.max_life
        });
        
        // Spawn new particles
        if self.last_spawn.elapsed().as_secs_f32() > 1.0 / self.spawn_rate {
            if self.recent_trades.len() < self.max_particles {
                self.spawn_trade_particle();
                self.last_spawn = Instant::now();
            }
        }
    }
    
    fn spawn_trade_particle(&mut self) {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        
        let center = self.base_panel.transform.position;
        
        // Random trade type
        let trade_type = match rng.gen_range(0..10) {
            0..=4 => TradeType::Buy,
            5..=8 => TradeType::Sell,
            9 => TradeType::Large,
            _ => TradeType::Buy,
        };
        
        // Color and size based on trade type
        let (color, size, volume) = match trade_type {
            TradeType::Buy => (
                Color::new(0.0, 1.0, 0.3, 0.8),
                rng.gen_range(0.02..0.08),
                rng.gen_range(0.01..1.0),
            ),
            TradeType::Sell => (
                Color::new(1.0, 0.2, 0.2, 0.8),
                rng.gen_range(0.02..0.08),
                rng.gen_range(0.01..1.0),
            ),
            TradeType::Large => (
                Color::new(1.0, 0.8, 0.0, 1.0), // Gold for whale trades
                rng.gen_range(0.1..0.2),
                rng.gen_range(5.0..50.0),
            ),
        };
        
        // Random spawn position around the panel
        let spawn_offset = rng.gen_range(-0.8..0.8);
        let position = Vec3::new(
            center.x + spawn_offset,
            center.y + rng.gen_range(-0.5..0.5),
            center.z + rng.gen_range(-0.3..0.3),
        );
        
        // Random velocity
        let velocity = Vec3::new(
            rng.gen_range(-0.5..0.5),
            rng.gen_range(0.2..0.8), // Generally upward
            rng.gen_range(-0.2..0.2),
        );
        
        self.recent_trades.push(TradeParticle {
            position,
            velocity,
            size,
            color,
            life_time: 0.0,
            max_life: rng.gen_range(3.0..8.0),
            trade_type,
            volume,
        });
    }
    
    pub fn generate_vertices(&self) -> (Vec<HologramVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        
        // Generate trade particles as small quads
        for particle in &self.recent_trades {
            self.generate_particle_quad(&mut vertices, &mut indices, particle);
        }
        
        // Generate stream lines connecting particles
        self.generate_stream_lines(&mut vertices, &mut indices);
        
        // Generate background flow grid
        self.generate_flow_grid(&mut vertices, &mut indices);
        
        (vertices, indices)
    }
    
    fn generate_particle_quad(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
        particle: &TradeParticle,
    ) {
        let start_idx = vertices.len() as u16;
        let half_size = particle.size / 2.0;
        let pos = particle.position;
        
        // Generate billboard quad (always faces camera)
        vertices.extend_from_slice(&[
            HologramVertex {
                position: [pos.x - half_size, pos.y - half_size, pos.z],
                color: [particle.color.r, particle.color.g, particle.color.b, particle.color.a],
                glow: self.base_panel.glow_intensity * 2.0,
            },
            HologramVertex {
                position: [pos.x + half_size, pos.y - half_size, pos.z],
                color: [particle.color.r, particle.color.g, particle.color.b, particle.color.a],
                glow: self.base_panel.glow_intensity * 2.0,
            },
            HologramVertex {
                position: [pos.x + half_size, pos.y + half_size, pos.z],
                color: [particle.color.r, particle.color.g, particle.color.b, particle.color.a],
                glow: self.base_panel.glow_intensity * 2.0,
            },
            HologramVertex {
                position: [pos.x - half_size, pos.y + half_size, pos.z],
                color: [particle.color.r, particle.color.g, particle.color.b, particle.color.a],
                glow: self.base_panel.glow_intensity * 2.0,
            },
        ]);
        
        indices.extend_from_slice(&[
            start_idx, start_idx + 1, start_idx + 2,
            start_idx + 2, start_idx + 3, start_idx,
        ]);
    }
    
    fn generate_stream_lines(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
    ) {
        let stream_color = self.base_panel.color_scheme.accent;
        let mut stream_color_faded = stream_color;
        stream_color_faded.a *= 0.3;
        
        // Connect recent particles with flowing lines
        for window in self.recent_trades.windows(2) {
            let p1 = &window[0];
            let p2 = &window[1];
            
            // Only connect particles of the same type that are close
            if std::mem::discriminant(&p1.trade_type) == std::mem::discriminant(&p2.trade_type) {
                let distance = ((p1.position.x - p2.position.x).powi(2) +
                               (p1.position.y - p2.position.y).powi(2) +
                               (p1.position.z - p2.position.z).powi(2)).sqrt();
                
                if distance < 0.5 {
                    let start_idx = vertices.len() as u16;
                    
                    vertices.extend_from_slice(&[
                        HologramVertex {
                            position: [p1.position.x, p1.position.y, p1.position.z],
                            color: [stream_color_faded.r, stream_color_faded.g, stream_color_faded.b, stream_color_faded.a],
                            glow: self.base_panel.glow_intensity * 0.5,
                        },
                        HologramVertex {
                            position: [p2.position.x, p2.position.y, p2.position.z],
                            color: [stream_color_faded.r, stream_color_faded.g, stream_color_faded.b, stream_color_faded.a],
                            glow: self.base_panel.glow_intensity * 0.5,
                        },
                    ]);
                    
                    indices.extend_from_slice(&[start_idx, start_idx + 1]);
                }
            }
        }
    }
    
    fn generate_flow_grid(
        &self,
        vertices: &mut Vec<HologramVertex>,
        indices: &mut Vec<u16>,
    ) {
        let center = self.base_panel.transform.position;
        let grid_color = self.base_panel.color_scheme.secondary;
        let mut grid_color_dim = grid_color;
        grid_color_dim.a *= 0.2;
        
        // Create flowing background pattern
        let grid_size = 0.2;
        let grid_width = 2.0;
        let grid_height = 1.5;
        
        // Vertical flow lines
        for i in 0..10 {
            let x = center.x - grid_width / 2.0 + (i as f32 / 9.0) * grid_width;
            let flow_offset = (self.base_panel.animation_time * 2.0 + i as f32 * 0.5).sin() * 0.1;
            
            let start_idx = vertices.len() as u16;
            
            vertices.extend_from_slice(&[
                HologramVertex {
                    position: [x + flow_offset, center.y - grid_height / 2.0, center.z],
                    color: [grid_color_dim.r, grid_color_dim.g, grid_color_dim.b, grid_color_dim.a],
                    glow: self.base_panel.glow_intensity * 0.3,
                },
                HologramVertex {
                    position: [x + flow_offset, center.y + grid_height / 2.0, center.z],
                    color: [grid_color_dim.r, grid_color_dim.g, grid_color_dim.b, grid_color_dim.a],
                    glow: self.base_panel.glow_intensity * 0.3,
                },
            ]);
            
            indices.extend_from_slice(&[start_idx, start_idx + 1]);
        }
    }
    
    pub fn add_trade(&mut self, trade_type: TradeType, volume: f64, price: f64) {
        let center = self.base_panel.transform.position;
        
        let (color, size) = match trade_type {
            TradeType::Buy => (Color::new(0.0, 1.0, 0.3, 0.9), 0.05 + (volume as f32 * 0.02)),
            TradeType::Sell => (Color::new(1.0, 0.2, 0.2, 0.9), 0.05 + (volume as f32 * 0.02)),
            TradeType::Large => (Color::new(1.0, 0.8, 0.0, 1.0), 0.1 + (volume as f32 * 0.01)),
        };
        
        // Spawn at random position near center
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let position = Vec3::new(
            center.x + rng.gen_range(-0.5..0.5),
            center.y + rng.gen_range(-0.3..0.3),
            center.z + rng.gen_range(-0.2..0.2),
        );
        
        let velocity = Vec3::new(
            rng.gen_range(-0.3..0.3),
            rng.gen_range(0.3..0.8),
            rng.gen_range(-0.1..0.1),
        );
        
        if self.recent_trades.len() < self.max_particles {
            self.recent_trades.push(TradeParticle {
                position,
                velocity,
                size: size.min(0.15),
                color,
                life_time: 0.0,
                max_life: 5.0 + (volume as f32 * 0.5),
                trade_type,
                volume,
            });
        }
    }
}