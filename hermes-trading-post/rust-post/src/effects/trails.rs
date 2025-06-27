//! Motion trails and particle trails

use crate::core::types::{Vec3, Color};
use std::collections::VecDeque;

pub struct MotionTrail {
    pub points: VecDeque<TrailPoint>,
    pub max_points: usize,
    pub width: f32,
    pub color: Color,
    pub fade_time: f32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct TrailPoint {
    pub position: Vec3,
    pub timestamp: f32,
    pub alpha: f32,
}

impl MotionTrail {
    pub fn new(max_points: usize, width: f32, color: Color, fade_time: f32) -> Self {
        Self {
            points: VecDeque::with_capacity(max_points),
            max_points,
            width,
            color,
            fade_time,
            enabled: true,
        }
    }
    
    pub fn add_point(&mut self, position: Vec3, current_time: f32) {
        if !self.enabled {
            return;
        }
        
        let point = TrailPoint {
            position,
            timestamp: current_time,
            alpha: 1.0,
        };
        
        self.points.push_back(point);
        
        // Remove excess points
        while self.points.len() > self.max_points {
            self.points.pop_front();
        }
    }
    
    pub fn update(&mut self, current_time: f32) {
        // Update alpha based on age and remove old points
        self.points.retain_mut(|point| {
            let age = current_time - point.timestamp;
            if age > self.fade_time {
                false
            } else {
                point.alpha = 1.0 - (age / self.fade_time);
                true
            }
        });
    }
    
    pub fn clear(&mut self) {
        self.points.clear();
    }
    
    pub fn get_trail_segments(&self) -> Vec<TrailSegment> {
        let mut segments = Vec::new();
        
        for i in 1..self.points.len() {
            let p1 = &self.points[i - 1];
            let p2 = &self.points[i];
            
            segments.push(TrailSegment {
                start: p1.position,
                end: p2.position,
                start_alpha: p1.alpha,
                end_alpha: p2.alpha,
                width: self.width,
                color: self.color,
            });
        }
        
        segments
    }
}

#[derive(Debug, Clone, Copy)]
pub struct TrailSegment {
    pub start: Vec3,
    pub end: Vec3,
    pub start_alpha: f32,
    pub end_alpha: f32,
    pub width: f32,
    pub color: Color,
}

pub struct TrailManager {
    pub trails: Vec<MotionTrail>,
    pub current_time: f32,
}

impl TrailManager {
    pub fn new() -> Self {
        Self {
            trails: Vec::new(),
            current_time: 0.0,
        }
    }
    
    pub fn create_trail(&mut self, max_points: usize, width: f32, color: Color, fade_time: f32) -> usize {
        let trail = MotionTrail::new(max_points, width, color, fade_time);
        self.trails.push(trail);
        self.trails.len() - 1
    }
    
    pub fn add_point_to_trail(&mut self, trail_id: usize, position: Vec3) {
        if let Some(trail) = self.trails.get_mut(trail_id) {
            trail.add_point(position, self.current_time);
        }
    }
    
    pub fn update(&mut self, dt: f32) {
        self.current_time += dt;
        
        for trail in &mut self.trails {
            trail.update(self.current_time);
        }
    }
    
    pub fn get_all_segments(&self) -> Vec<TrailSegment> {
        let mut all_segments = Vec::new();
        
        for trail in &self.trails {
            if trail.enabled {
                all_segments.extend(trail.get_trail_segments());
            }
        }
        
        all_segments
    }
    
    pub fn clear_trail(&mut self, trail_id: usize) {
        if let Some(trail) = self.trails.get_mut(trail_id) {
            trail.clear();
        }
    }
    
    pub fn clear_all(&mut self) {
        for trail in &mut self.trails {
            trail.clear();
        }
    }
    
    pub fn toggle_trail(&mut self, trail_id: usize) {
        if let Some(trail) = self.trails.get_mut(trail_id) {
            trail.enabled = !trail.enabled;
        }
    }
}

// Predefined trail types for common use cases
pub struct TrailPresets;

impl TrailPresets {
    pub fn price_movement() -> (usize, f32, Color, f32) {
        (50, 0.1, Color::CYAN, 2.0)
    }
    
    pub fn trade_flow() -> (usize, f32, Color, f32) {
        (30, 0.05, Color::NEON_GREEN, 1.5)
    }
    
    pub fn cursor_trail() -> (usize, f32, Color, f32) {
        (20, 0.02, Color::new(1.0, 1.0, 1.0, 0.8), 1.0)
    }
    
    pub fn particle_trail() -> (usize, f32, Color, f32) {
        (15, 0.01, Color::YELLOW, 0.5)
    }
}