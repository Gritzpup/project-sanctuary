// Enhanced BTC Chart Shader with lighting and glow effects

struct CameraUniform {
    view_proj: mat4x4<f32>,
    view_pos: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) normal: vec3<f32>,
    @location(3) ao: f32,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_position: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) normal: vec3<f32>,
    @location(3) ao: f32,
}

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    
    out.world_position = model.position;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    out.color = model.color;
    out.normal = model.normal;
    out.ao = model.ao;
    
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Enhanced lighting calculation
    let light_dir = normalize(vec3<f32>(1.0, 2.0, 1.0));
    let view_dir = normalize(camera.view_pos - in.world_position);
    let normal = normalize(in.normal);
    
    // Diffuse lighting
    let diffuse = max(dot(normal, light_dir), 0.0);
    
    // Specular lighting with metallic reflection
    let reflect_dir = reflect(-light_dir, normal);
    let specular = pow(max(dot(view_dir, reflect_dir), 0.0), 32.0) * 0.5;
    
    // Ambient lighting with AO
    let ambient = 0.3 * in.ao;
    
    // Combine lighting
    let lighting = ambient + diffuse * 0.7 + specular;
    
    // Apply glow effect based on color intensity
    let color_intensity = (in.color.r + in.color.g + in.color.b) / 3.0;
    let glow_factor = 1.0 + color_intensity * 0.3;
    
    // Final color with enhanced brightness for cyberpunk feel
    var final_color = in.color * lighting * glow_factor;
    
    // Add slight emissive glow to bright colors
    if (color_intensity > 0.8) {
        final_color += in.color * 0.2;
    }
    
    // Ensure colors don't get too dim
    final_color = max(final_color, in.color * 0.4);
    
    return vec4<f32>(final_color, 1.0);
}