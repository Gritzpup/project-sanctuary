pub const ENHANCED_SHADER: &str = r#"
// Vertex shader
struct CameraUniform {
    view_proj: mat4x4<f32>,
    view_pos: vec3<f32>,
    _padding: f32,
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
    @location(0) color: vec3<f32>,
    @location(1) world_pos: vec3<f32>,
    @location(2) normal: vec3<f32>,
    @location(3) ao: f32,
}

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.color = model.color;
    out.world_pos = model.position;
    out.normal = model.normal;
    out.ao = model.ao;
    out.clip_position = camera.view_proj * vec4<f32>(model.position, 1.0);
    return out;
}

// Fragment shader with enhanced metallic/glass finish and smooth shading
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Multiple light sources for better illumination
    let light_dir1 = normalize(vec3<f32>(0.6, 1.0, 0.4));   // Main light
    let light_dir2 = normalize(vec3<f32>(-0.3, 0.5, -0.2)); // Fill light
    let light_dir3 = normalize(vec3<f32>(0.0, -0.8, 0.6));  // Rim light
    
    let view_dir = normalize(camera.view_pos - in.world_pos);
    let n = normalize(in.normal);
    
    // Diffuse lighting from multiple sources
    let diff1 = max(dot(n, light_dir1), 0.0) * 0.8;
    let diff2 = max(dot(n, light_dir2), 0.0) * 0.4;
    let diff3 = max(dot(n, light_dir3), 0.0) * 0.3;
    let total_diffuse = diff1 + diff2 + diff3;
    
    // Enhanced specular with multiple highlights
    let reflect_dir1 = reflect(-light_dir1, n);
    let reflect_dir2 = reflect(-light_dir2, n);
    let spec1 = pow(max(dot(view_dir, reflect_dir1), 0.0), 64.0) * 0.8;
    let spec2 = pow(max(dot(view_dir, reflect_dir2), 0.0), 32.0) * 0.4;
    let total_spec = spec1 + spec2;
    
    // Fresnel effect for glass-like edges
    let fresnel = pow(1.0 - max(dot(view_dir, n), 0.0), 1.5);
    
    // Enhanced rim lighting for glowing edges
    let rim = 1.0 - max(dot(view_dir, n), 0.0);
    let rim_light = pow(rim, 2.0) * 0.6;
    
    // Improved ambient lighting
    let ambient = 0.15;
    
    // Combine all lighting components
    let lighting = ambient + total_diffuse + total_spec + rim_light;
    
    // Apply AO with smoother falloff
    let ao_factor = smoothstep(0.5, 1.0, in.ao);
    
    // Enhanced fresnel contribution
    let final_light = lighting * ao_factor * (1.0 + fresnel * 0.5);
    
    // Apply lighting to color with enhanced metallic boost
    let metallic_boost = vec3<f32>(total_spec * 0.6);
    let lit_color = in.color * final_light + metallic_boost;
    
    // Subtle color saturation boost for more vibrant appearance
    let enhanced_color = mix(lit_color, lit_color * lit_color, 0.1);
    
    return vec4<f32>(enhanced_color, 1.0);
}
"#;

pub const TEXT_SHADER: &str = r#"
// Text rendering shader for bitmap font atlas

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) tex_coords: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) tex_coords: vec2<f32>,
}

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = vec4<f32>(model.position, 1.0);
    out.tex_coords = model.tex_coords;
    return out;
}

@group(0) @binding(0)
var t_atlas: texture_2d<f32>;
@group(0) @binding(1)
var s_atlas: sampler;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(t_atlas, s_atlas, in.tex_coords);
    
    // Use alpha from texture for transparency, white text color
    if (color.a < 0.1) {
        discard;
    }
    
    // High contrast white text with alpha blending
    return vec4<f32>(1.0, 1.0, 1.0, color.a);
}
"#;