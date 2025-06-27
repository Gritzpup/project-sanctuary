//! Gesture recognition for advanced interaction

use std::collections::VecDeque;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy)]
pub struct GesturePoint {
    pub x: f32,
    pub y: f32,
    pub timestamp: Instant,
}

#[derive(Debug, Clone)]
pub enum GestureType {
    None,
    Tap,
    DoubleTap,
    Swipe(SwipeDirection),
    Pinch(f32), // Scale factor
    Rotate(f32), // Angle in radians
    Pan(f32, f32), // Delta x, delta y
    Circle(bool), // Clockwise
    Hold,
}

#[derive(Debug, Clone, Copy)]
pub enum SwipeDirection {
    Up,
    Down,
    Left,
    Right,
}

pub struct GestureRecognizer {
    points: VecDeque<GesturePoint>,
    max_points: usize,
    gesture_timeout: Duration,
    last_gesture: GestureType,
    gesture_start_time: Option<Instant>,
    
    // Tap detection
    tap_threshold: f32,
    double_tap_timeout: Duration,
    last_tap_time: Option<Instant>,
    
    // Swipe detection
    swipe_threshold: f32,
    swipe_min_velocity: f32,
    
    // Multi-touch (simulated with mouse + keyboard)
    is_pinch_mode: bool,
    is_rotate_mode: bool,
    initial_distance: f32,
    initial_angle: f32,
}

impl GestureRecognizer {
    pub fn new() -> Self {
        Self {
            points: VecDeque::new(),
            max_points: 100,
            gesture_timeout: Duration::from_millis(500),
            last_gesture: GestureType::None,
            gesture_start_time: None,
            tap_threshold: 10.0,
            double_tap_timeout: Duration::from_millis(300),
            last_tap_time: None,
            swipe_threshold: 50.0,
            swipe_min_velocity: 200.0,
            is_pinch_mode: false,
            is_rotate_mode: false,
            initial_distance: 0.0,
            initial_angle: 0.0,
        }
    }
    
    pub fn add_point(&mut self, x: f32, y: f32) {
        let point = GesturePoint {
            x,
            y,
            timestamp: Instant::now(),
        };
        
        self.points.push_back(point);
        
        // Remove old points
        while self.points.len() > self.max_points {
            self.points.pop_front();
        }
        
        // Remove points older than gesture timeout
        let cutoff_time = Instant::now() - self.gesture_timeout;
        while let Some(front) = self.points.front() {
            if front.timestamp < cutoff_time {
                self.points.pop_front();
            } else {
                break;
            }
        }
        
        if self.gesture_start_time.is_none() {
            self.gesture_start_time = Some(Instant::now());
        }
    }
    
    pub fn recognize_gesture(&mut self) -> GestureType {
        if self.points.is_empty() {
            return GestureType::None;
        }
        
        // Check for tap
        if let Some(gesture) = self.detect_tap() {
            return gesture;
        }
        
        // Check for swipe
        if let Some(gesture) = self.detect_swipe() {
            return gesture;
        }
        
        // Check for circle
        if let Some(gesture) = self.detect_circle() {
            return gesture;
        }
        
        // Check for hold
        if let Some(gesture) = self.detect_hold() {
            return gesture;
        }
        
        GestureType::None
    }
    
    fn detect_tap(&mut self) -> Option<GestureType> {
        if self.points.len() < 2 {
            return None;
        }
        
        let first = self.points.front().unwrap();
        let last = self.points.back().unwrap();
        
        let distance = ((last.x - first.x).powi(2) + (last.y - first.y).powi(2)).sqrt();
        let duration = last.timestamp.duration_since(first.timestamp);
        
        if distance < self.tap_threshold && duration < Duration::from_millis(200) {
            // Check for double tap
            if let Some(last_tap) = self.last_tap_time {
                if first.timestamp.duration_since(last_tap) < self.double_tap_timeout {
                    self.last_tap_time = None;
                    return Some(GestureType::DoubleTap);
                }
            }
            
            self.last_tap_time = Some(first.timestamp);
            return Some(GestureType::Tap);
        }
        
        None
    }
    
    fn detect_swipe(&self) -> Option<GestureType> {
        if self.points.len() < 3 {
            return None;
        }
        
        let first = self.points.front().unwrap();
        let last = self.points.back().unwrap();
        
        let dx = last.x - first.x;
        let dy = last.y - first.y;
        let distance = (dx.powi(2) + dy.powi(2)).sqrt();
        let duration = last.timestamp.duration_since(first.timestamp).as_secs_f32();
        
        if distance > self.swipe_threshold && duration > 0.0 {
            let velocity = distance / duration;
            
            if velocity > self.swipe_min_velocity {
                let direction = if dx.abs() > dy.abs() {
                    if dx > 0.0 { SwipeDirection::Right } else { SwipeDirection::Left }
                } else {
                    if dy > 0.0 { SwipeDirection::Down } else { SwipeDirection::Up }
                };
                
                return Some(GestureType::Swipe(direction));
            }
        }
        
        None
    }
    
    fn detect_circle(&self) -> Option<GestureType> {
        if self.points.len() < 8 {
            return None;
        }
        
        // Simplified circle detection
        // Check if the path curves back on itself
        let first = self.points.front().unwrap();
        let last = self.points.back().unwrap();
        
        let return_distance = ((last.x - first.x).powi(2) + (last.y - first.y).powi(2)).sqrt();
        
        if return_distance < 30.0 { // Close to starting point
            // Calculate if motion is generally circular
            let mut total_angle_change = 0.0;
            
            for i in 1..self.points.len() - 1 {
                let p1 = &self.points[i - 1];
                let p2 = &self.points[i];
                let p3 = &self.points[i + 1];
                
                let v1 = (p2.x - p1.x, p2.y - p1.y);
                let v2 = (p3.x - p2.x, p3.y - p2.y);
                
                let angle = (v1.0 * v2.1 - v1.1 * v2.0).atan2(v1.0 * v2.0 + v1.1 * v2.1);
                total_angle_change += angle;
            }
            
            let full_rotation = 2.0 * std::f32::consts::PI;
            if total_angle_change.abs() > full_rotation * 0.7 {
                return Some(GestureType::Circle(total_angle_change > 0.0));
            }
        }
        
        None
    }
    
    fn detect_hold(&self) -> Option<GestureType> {
        if self.points.len() < 2 {
            return None;
        }
        
        let first = self.points.front().unwrap();
        let last = self.points.back().unwrap();
        
        let distance = ((last.x - first.x).powi(2) + (last.y - first.y).powi(2)).sqrt();
        let duration = last.timestamp.duration_since(first.timestamp);
        
        if distance < self.tap_threshold && duration > Duration::from_millis(800) {
            return Some(GestureType::Hold);
        }
        
        None
    }
    
    pub fn start_pinch(&mut self, distance: f32) {
        self.is_pinch_mode = true;
        self.initial_distance = distance;
    }
    
    pub fn update_pinch(&mut self, distance: f32) -> Option<GestureType> {
        if self.is_pinch_mode {
            let scale = distance / self.initial_distance;
            return Some(GestureType::Pinch(scale));
        }
        None
    }
    
    pub fn end_pinch(&mut self) {
        self.is_pinch_mode = false;
    }
    
    pub fn start_rotate(&mut self, angle: f32) {
        self.is_rotate_mode = true;
        self.initial_angle = angle;
    }
    
    pub fn update_rotate(&mut self, angle: f32) -> Option<GestureType> {
        if self.is_rotate_mode {
            let rotation = angle - self.initial_angle;
            return Some(GestureType::Rotate(rotation));
        }
        None
    }
    
    pub fn end_rotate(&mut self) {
        self.is_rotate_mode = false;
    }
    
    pub fn clear(&mut self) {
        self.points.clear();
        self.gesture_start_time = None;
        self.last_gesture = GestureType::None;
    }
    
    pub fn get_gesture_progress(&self) -> f32 {
        if let Some(start_time) = self.gesture_start_time {
            let elapsed = Instant::now().duration_since(start_time);
            (elapsed.as_secs_f32() / self.gesture_timeout.as_secs_f32()).clamp(0.0, 1.0)
        } else {
            0.0
        }
    }
}