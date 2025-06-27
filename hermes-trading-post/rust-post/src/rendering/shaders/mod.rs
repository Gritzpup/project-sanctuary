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

@group(0) @binding(0)
var<uniform> camera: CameraUniform;

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
    
    // Add scan line effect based on world position
    let scan = sin(in.world_pos.y * 0.5) * 0.05 + 0.95;
    color *= scan;
    
    // Add subtle flicker
    let time = camera.view_pos.x * 0.001; // Use camera position as time proxy
    let flicker = sin(time * 10.0) * 0.02 + 0.98;
    color *= flicker;
    
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