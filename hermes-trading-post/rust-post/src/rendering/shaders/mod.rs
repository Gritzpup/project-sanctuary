//! Shader definitions for the futuristic dashboard

pub const UI_3D_SHADER: &str = r#"
// 3D UI Vertex Shader
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.clip_position = vec4<f32>(input.position, 1.0);
    output.color = input.color;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return input.color;
}
"#;

pub const HOLOGRAM_SHADER: &str = r#"
// Hologram Effect Shader
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.clip_position = vec4<f32>(input.position, 1.0);
    output.uv = input.uv;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let scan_line = sin(input.uv.y * 100.0) * 0.1 + 0.9;
    let base_color = vec4<f32>(0.0, 1.0, 1.0, 0.8);
    return base_color * scan_line;
}
"#;

pub const HOLOGRAPHIC_PANEL_SHADER: &str = r#"
struct CameraUniform {
    view_proj: mat4x4<f32>,
    view_pos: vec3<f32>,
    _padding: f32,
}

struct TimeUniform {
    time: f32,
    _padding: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

@group(0) @binding(1)
var<uniform> time_uniform: TimeUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec4<f32>,
    @location(2) glow: f32,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) glow: f32,
    @location(2) world_pos: vec3<f32>,
}

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.world_pos = model.position;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    out.color = model.color;
    out.glow = model.glow;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Base color with glow
    var color = in.color;
    
    // Add holographic glow effect
    let glow_factor = in.glow * 1.5;
    color = vec4<f32>(
        color.r + glow_factor * 0.3,
        color.g + glow_factor * 0.5,
        color.b + glow_factor * 0.8,
        color.a
    );
    
    // Add distance-based fading
    let distance = length(camera.view_pos - in.world_pos);
    let fade = 1.0 - smoothstep(100.0, 500.0, distance);
    color.a *= fade;
    
    // Calculate effect intensity based on glow (higher glow = stronger effects)
    let effect_strength = in.glow * 0.5; // Scale effects by glow value
    
    // Add animated scan line effect (reduced intensity)
    let scan_position = fract(time_uniform.time * 0.1); // Slower scan
    let scan_distance = abs(in.world_pos.y * 0.01 - scan_position);
    let scan_intensity = smoothstep(0.1, 0.0, scan_distance) * 0.1 * effect_strength; // Scaled by effect_strength
    let scan_color = vec3<f32>(0.0, 0.5, 1.0) * scan_intensity;
    color = vec4<f32>(color.r + scan_color.x, color.g + scan_color.y, color.b + scan_color.z, color.a);
    
    // Add subtle flicker effect (reduced intensity)
    let flicker = sin(time_uniform.time * 4.0) * 0.005 * effect_strength + (1.0 - 0.005 * effect_strength);
    color *= flicker;
    
    // Add holographic noise (reduced intensity)
    let noise = sin(in.world_pos.x * 5.0 + time_uniform.time * 2.0) * 
                sin(in.world_pos.y * 5.0 - time_uniform.time * 1.5) * 0.005 * effect_strength;
    color = vec4<f32>(color.r + noise, color.g + noise, color.b + noise, color.a);
    
    return color;
}
"#;

pub const BLOOM_EXTRACT_SHADER: &str = r#"
// Bloom Extract Shader
struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Extract bright pixels for bloom effect
    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}
"#;

pub const GRID_SHADER: &str = r#"
struct CameraUniform {
    view_proj: mat4x4<f32>,
    view_pos: vec3<f32>,
    _padding: f32,
}

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec4<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) world_pos: vec3<f32>,
}

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.world_pos = model.position;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    out.color = model.color;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Add distance-based fading
    let distance = length(camera.view_pos - in.world_pos);
    let fade = 1.0 - smoothstep(200.0, 800.0, distance);
    
    // Add subtle glow effect
    var color = in.color;
    color.a *= fade;
    
    return color;
}
"#;

pub const CHART_BACKDROP_SHADER: &str = r#"
// Chart Backdrop Shader
struct CameraUniform {
    view_proj: mat4x4<f32>,
    view_pos: vec3<f32>,
};

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) world_pos: vec3<f32>,
};

struct InstanceInput {
    @location(5) model_matrix_0: vec4<f32>,
    @location(6) model_matrix_1: vec4<f32>,
    @location(7) model_matrix_2: vec4<f32>,
    @location(8) model_matrix_3: vec4<f32>,
};

@vertex
fn vs_main(
    vertex: VertexInput,
    instance: InstanceInput,
) -> VertexOutput {
    let model_matrix = mat4x4<f32>(
        instance.model_matrix_0,
        instance.model_matrix_1,
        instance.model_matrix_2,
        instance.model_matrix_3,
    );
    
    var out: VertexOutput;
    let world_pos = (model_matrix * vec4<f32>(vertex.position, 1.0)).xyz;
    out.world_pos = world_pos;
    out.clip_position = camera.view_proj * vec4<f32>(world_pos, 1.0);
    
    // Calculate UV coordinates from vertex position
    out.uv = vertex.position.xy * 0.5 + 0.5;
    
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Create gradient from dark at edges to slightly lighter in center
    let center = vec2<f32>(0.5, 0.5);
    let dist_from_center = length(in.uv - center) / 0.707; // Normalize to 0-1
    
    // Base color - dark blue/black gradient
    let edge_color = vec3<f32>(0.02, 0.02, 0.04);
    let center_color = vec3<f32>(0.05, 0.08, 0.12);
    let base_color = mix(center_color, edge_color, pow(dist_from_center, 2.0));
    
    // Add subtle edge glow
    let edge_glow_strength = pow(1.0 - dist_from_center, 8.0) * 0.2;
    let edge_glow = vec3<f32>(0.1, 0.3, 0.6) * edge_glow_strength;
    
    // Combine effects
    var final_color = base_color + edge_glow;
    
    return vec4<f32>(final_color, 0.9); // Slightly transparent
}
"#;