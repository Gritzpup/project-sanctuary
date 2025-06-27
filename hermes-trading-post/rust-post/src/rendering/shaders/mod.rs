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