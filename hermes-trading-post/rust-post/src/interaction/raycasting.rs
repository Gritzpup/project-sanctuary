//! Ray casting for 3D UI interaction

use crate::core::types::{Vec3, Bounds};
use cgmath::{Matrix4, Vector3, Vector4, InnerSpace, SquareMatrix};

pub struct Ray {
    pub origin: Vec3,
    pub direction: Vec3,
}

pub struct RaycastHit {
    pub point: Vec3,
    pub distance: f32,
    pub normal: Vec3,
    pub object_id: usize,
}

pub struct Raycaster {
    pub ray: Ray,
    pub max_distance: f32,
}

impl Raycaster {
    pub fn new() -> Self {
        Self {
            ray: Ray {
                origin: Vec3::new(0.0, 0.0, 0.0),
                direction: Vec3::new(0.0, 0.0, -1.0),
            },
            max_distance: 1000.0,
        }
    }
    
    pub fn set_from_camera(&mut self, mouse_x: f32, mouse_y: f32, view_matrix: &Matrix4<f32>, projection_matrix: &Matrix4<f32>, _viewport: (u32, u32)) {
        // Convert screen coordinates to world ray
        let inv_view_proj = (projection_matrix * view_matrix).invert().unwrap();
        
        // Normalized device coordinates
        let ndc_near = Vector4::new(mouse_x, mouse_y, -1.0, 1.0);
        let ndc_far = Vector4::new(mouse_x, mouse_y, 1.0, 1.0);
        
        // Transform to world space
        let world_near = inv_view_proj * ndc_near;
        let world_far = inv_view_proj * ndc_far;
        
        // Perspective divide
        let world_near = Vector3::new(
            world_near.x / world_near.w,
            world_near.y / world_near.w,
            world_near.z / world_near.w,
        );
        let world_far = Vector3::new(
            world_far.x / world_far.w,
            world_far.y / world_far.w,
            world_far.z / world_far.w,
        );
        
        self.ray.origin = Vec3::new(world_near.x, world_near.y, world_near.z);
        let direction = (world_far - world_near).normalize();
        self.ray.direction = Vec3::new(direction.x, direction.y, direction.z);
    }
    
    pub fn intersect_bounds(&self, bounds: &Bounds) -> Option<RaycastHit> {
        // AABB ray intersection
        let inv_dir = Vec3::new(
            1.0 / self.ray.direction.x,
            1.0 / self.ray.direction.y,
            1.0 / self.ray.direction.z,
        );
        
        let t1 = (bounds.min.x - self.ray.origin.x) * inv_dir.x;
        let t2 = (bounds.max.x - self.ray.origin.x) * inv_dir.x;
        let t3 = (bounds.min.y - self.ray.origin.y) * inv_dir.y;
        let t4 = (bounds.max.y - self.ray.origin.y) * inv_dir.y;
        let t5 = (bounds.min.z - self.ray.origin.z) * inv_dir.z;
        let t6 = (bounds.max.z - self.ray.origin.z) * inv_dir.z;
        
        let tmin = t1.min(t2).max(t3.min(t4)).max(t5.min(t6));
        let tmax = t1.max(t2).min(t3.max(t4)).min(t5.max(t6));
        
        if tmax < 0.0 || tmin > tmax || tmin > self.max_distance {
            return None;
        }
        
        let t = if tmin < 0.0 { tmax } else { tmin };
        let hit_point = self.ray.origin + self.ray.direction * t;
        
        // Calculate normal (simplified - assumes hit on face)
        let center = bounds.center();
        let local_hit = hit_point - center;
        let size = bounds.size();
        
        let normal = if (local_hit.x.abs() / size.x) > (local_hit.y.abs() / size.y) && (local_hit.x.abs() / size.x) > (local_hit.z.abs() / size.z) {
            Vec3::new(local_hit.x.signum(), 0.0, 0.0)
        } else if (local_hit.y.abs() / size.y) > (local_hit.z.abs() / size.z) {
            Vec3::new(0.0, local_hit.y.signum(), 0.0)
        } else {
            Vec3::new(0.0, 0.0, local_hit.z.signum())
        };
        
        Some(RaycastHit {
            point: hit_point,
            distance: t,
            normal,
            object_id: 0, // Would be set by the calling code
        })
    }
    
    pub fn intersect_sphere(&self, center: Vec3, radius: f32) -> Option<RaycastHit> {
        let oc = self.ray.origin - center;
        let a = self.ray.direction.dot(self.ray.direction);
        let b = 2.0 * oc.dot(self.ray.direction);
        let c = oc.dot(oc) - radius * radius;
        
        let discriminant = b * b - 4.0 * a * c;
        
        if discriminant < 0.0 {
            return None;
        }
        
        let sqrt_discriminant = discriminant.sqrt();
        let t1 = (-b - sqrt_discriminant) / (2.0 * a);
        let t2 = (-b + sqrt_discriminant) / (2.0 * a);
        
        let t = if t1 > 0.0 { t1 } else { t2 };
        
        if t < 0.0 || t > self.max_distance {
            return None;
        }
        
        let hit_point = self.ray.origin + self.ray.direction * t;
        let normal = (hit_point - center).normalize();
        
        Some(RaycastHit {
            point: hit_point,
            distance: t,
            normal,
            object_id: 0,
        })
    }
    
    pub fn intersect_plane(&self, plane_point: Vec3, plane_normal: Vec3) -> Option<RaycastHit> {
        let denom = plane_normal.dot(self.ray.direction);
        
        if denom.abs() < 1e-6 {
            return None; // Ray is parallel to plane
        }
        
        let t = (plane_point - self.ray.origin).dot(plane_normal) / denom;
        
        if t < 0.0 || t > self.max_distance {
            return None;
        }
        
        let hit_point = self.ray.origin + self.ray.direction * t;
        
        Some(RaycastHit {
            point: hit_point,
            distance: t,
            normal: plane_normal,
            object_id: 0,
        })
    }
}

impl Ray {
    pub fn new(origin: Vec3, direction: Vec3) -> Self {
        Self {
            origin,
            direction: direction.normalize(),
        }
    }
    
    pub fn point_at(&self, t: f32) -> Vec3 {
        self.origin + self.direction * t
    }
}