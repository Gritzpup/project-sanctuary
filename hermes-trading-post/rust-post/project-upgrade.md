# 3D Candle Chart Enhancement Plan

This document outlines the comprehensive improvements planned for the 3D BTC candle chart, including UI layout, performance monitoring, and visual enhancements.

---

## Implementation Phases & Checklist

### Phase 1: Performance Monitoring Foundation
- [ ] Add `PerformanceMetrics` struct
- [ ] Implement frame timing
- [ ] Update window title with metrics
- [ ] Add WebSocket latency tracking

### Phase 2: UI Layout Structure
- [ ] Define `UILayout` constants and struct
- [ ] Implement viewport clipping
- [ ] Render placeholder rectangles for UI regions
- [ ] Adjust camera for new viewport

### Phase 3: Visual Improvements
- [ ] Enable 4x MSAA (Multisample Anti-Aliasing)
- [ ] Implement face-based shading (per-face color/normal)
- [ ] Update color scheme for candles and UI
- [ ] Fine-tune camera angle and FOV

### Phase 4: Polish & Optimization
- [ ] Add gradient effects to candles
- [ ] Implement depth-based fading/fog
- [ ] Optimize render passes (instancing, culling)
- [ ] Add performance logging options

### Phase 5: Future Enhancements
- [ ] Shadow mapping for depth
- [ ] SSAO (Screen Space Ambient Occlusion)
- [ ] Bloom effect for bright candles
- [ ] Depth of field blur
- [ ] Interactive tooltips & overlays
- [ ] Crosshair with price/time
- [ ] Drawing tools overlay
- [ ] Multi-timeframe display
- [ ] GPU timing queries
- [ ] Memory usage tracking
- [ ] Network latency graph
- [ ] Frame time histogram

---

## 1. UI Layout Structure

#### 1.1 Layout Regions
```
┌─────────────────────────────────────────────────────────┐
│ HEADER BAR (50px)                                      │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ SIDEBAR  │ 3D CANDLE CHART VIEWPORT                     │
│ (250px)  │                                              │
├──────────┼──────────────────────────────────────────────┤
│          │ FOOTER/TIMELINE (80px)                       │
└──────────┴──────────────────────────────────────────────┘
```

#### 1.2 Component Specifications
- **Sidebar (Left):**
  - Width: 250px
  - Background: `[0.015, 0.015, 0.025, 1.0]` (dark gray)
  - Future Content: Timeframe selector, chart type toggle, indicators, volume toggle, price stats
- **Header Bar (Top):**
  - Height: 50px
  - Background: `[0.02, 0.02, 0.03, 1.0]`
  - Content: `[BTC/USD] [$106,424.09] [↑ +0.24%] | [706 FPS] [1.42ms] [R: 0.89ms] [U: 0.03ms] [WS: 0.12ms]`
- **Footer/Timeline (Bottom):**
  - Height: 80px
  - Background: `[0.015, 0.015, 0.025, 1.0]`
  - Future Content: Time axis, zoom, date range
- **Chart Viewport:**
  - Position: `(250, 50)` to `(window_width, window_height - 80)`
  - Background: `[0.01, 0.012, 0.02, 1.0]`
  - Padding: 10px

---

## 2. Performance Monitoring

#### 2.1 Metrics Structure
```rust
struct PerformanceMetrics {
    // Timing measurements
    frame_start: Instant,
    last_frame_time: Duration,
    render_time: Duration,
    update_time: Duration,
    websocket_latency: Duration,
    // Rolling averages (60 frames)
    frame_times: VecDeque, // ms
    render_times: VecDeque,
    update_times: VecDeque,
    // Statistics
    fps: f64,
    avg_frame_time_ms: f64,
    min_frame_time_ms: f64,
    max_frame_time_ms: f64,
}
```

#### 2.2 Performance Targets
| Metric        | Excellent | Good  | Warning   | Critical   |
|--------------|-----------|-------|-----------|------------|
| Frame Time   | < 1ms     | < 5ms | < 16.67ms | > 16.67ms  |
| FPS          | > 1000    | > 200 | > 60      | < 60       |
| Render Time  | < 0.5ms   | < 2ms | < 8ms     | > 8ms      |
| Update Time  | < 0.1ms   | < 0.5ms| < 2ms    | > 2ms      |
| WS Latency   | < 0.5ms   | < 2ms | < 10ms    | > 10ms     |

#### 2.3 Display Format
- Window Title: `3D BTC 1m | $106,424.09 | 🟢 | FPS: 706 (1.42ms) | Render: 0.89ms | Update: 0.03ms | Candles: 350`

---

## 3. Visual Enhancements

#### 3.1 Anti-Aliasing
- Type: 4x MSAA (Multisample Anti-Aliasing)
- Implementation: Enable in `MultisampleState`
- Impact: Smooth edges, ~10-20% perf cost

#### 3.2 Face-Based Shading
```rust
const FACE_MULTIPLIERS: [f32; 6] = [
    1.0,   // Front
    0.75,  // Right
    0.6,   // Back
    0.85,  // Left
    0.9,   // Top
    0.5,   // Bottom
];
```

#### 3.3 Enhanced Color Scheme
- Bullish: `[0.1, 0.9, 0.3]` (gradient: lighter top, darker bottom)
- Bearish: `[0.95, 0.15, 0.2]` (gradient: lighter top, darker bottom)
- Neutral: `[0.6, 0.6, 0.6]`

#### 3.4 Camera Configuration
```rust
let distance = 45.0;
let height = 12.0;
let x_offset = -3.0;
let fov = 32.0;
// Position relative to candle center
eye: Point3::new(center_x + x_offset, height, distance)
target: Point3::new(center_x, -1.0, 0.0)
```

---

## 4. Core Architecture Changes

#### 4.1 New Structures and Types
```rust
#[derive(Debug, Clone)]
struct UILayout {
    sidebar_width: f32,
    header_height: f32,
    footer_height: f32,
    chart_padding: f32,
    chart_x: f32,
    chart_y: f32,
    chart_width: f32,
    chart_height: f32,
    sidebar_color: [f32; 4],
    header_color: [f32; 4],
    footer_color: [f32; 4],
    chart_bg_color: [f32; 4],
    grid_color: [f32; 4],
    text_color: [f32; 4],
}

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct EnhancedVertex {
    position: [f32; 3],
    color: [f32; 3],
    normal: [f32; 3],
    ambient_occlusion: f32,
}

enum RenderPassType {
    UIBackground,
    ChartBackground,
    GridLines,
    Candles,
    Overlays,
}
```

#### 4.2 State Structure Updates
```rust
struct State<'a> {
    // ...existing fields...
    ui_layout: UILayout,
    ui_vertex_buffer: wgpu::Buffer,
    ui_pipeline: wgpu::RenderPipeline,
    multisampled_framebuffer: wgpu::TextureView,
    grid_vertex_buffer: wgpu::Buffer,
    grid_pipeline: wgpu::RenderPipeline,
    text_instances: Vec,
}
```

---

## 5. Shader Enhancements

#### 5.1 Enhanced Vertex Shader
```wgsl
struct CameraUniform {
    view_proj: mat4x4,
    view_pos: vec3,
}
struct VertexInput {
    @location(0) position: vec3,
    @location(1) color: vec3,
    @location(2) normal: vec3,
    @location(3) ao: f32,
}
struct VertexOutput {
    @builtin(position) clip_position: vec4,
    @location(0) color: vec3,
    @location(1) world_pos: vec3,
    @location(2) normal: vec3,
    @location(3) ao: f32,
}
@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let world_pos = vec4(model.position, 1.0);
    out.clip_position = camera.view_proj * world_pos;
    out.world_pos = model.position;
    out.normal = model.normal;
    out.color = model.color;
    out.ao = model.ao;
    return out;
}
```

#### 5.2 Enhanced Fragment Shader with Fake Lighting
```wgsl
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4 {
    let light_dir = normalize(vec3(0.5, 0.8, 0.3));
    let ambient_strength = 0.3;
    let diffuse_strength = 0.7;
    let n_dot_l = max(dot(in.normal, light_dir), 0.0);
    let ambient = ambient_strength * in.color;
    let diffuse = diffuse_strength * n_dot_l * in.color;
    var final_color = (ambient + diffuse) * in.ao;
    let distance = length(camera.view_pos - in.world_pos);
    let fog_factor = 1.0 - smoothstep(20.0, 80.0, distance);
    final_color = mix(vec3(0.01, 0.012, 0.02), final_color, fog_factor);
    return vec4(final_color, 1.0);
}
```

---

## 6. Candle Generation Improvements

#### 6.1 Enhanced Candle Vertices with Normals and AO
```rust
fn generate_enhanced_candle_vertices(candle: &Candle) -> (Vec<EnhancedVertex>, Vec<u16>) {
    // Price calculations (same as before)
    let base_price = 106000.0;
    let price_scale: f32 = 0.1;
    let open_y = (candle.open as f32 - base_price) * price_scale;
    let close_y = (candle.close as f32 - base_price) * price_scale;
    let high_y = (candle.high as f32 - base_price) * price_scale;
    let low_y = (candle.low as f32 - base_price) * price_scale;
    // Ensure minimum body height
    let mut body_bottom = open_y.min(close_y);
    let mut body_top = open_y.max(close_y);
    if (body_top - body_bottom).abs() < 0.15 {
        let mid = (body_top + body_bottom) / 2.0;
        body_top = mid + 0.075;
        body_bottom = mid - 0.075;
    }
    // Dimensions
    let s = 0.35; // Body half-width
    let ws = 0.06; // Wick half-width
    // Enhanced colors with gradients
    let is_green = candle.close > candle.open;
    let base_color = if is_green {
        [0.1, 0.85, 0.35] // Vibrant green
    } else if candle.close < candle.open {
        [0.9, 0.15, 0.25] // Vibrant red
    } else {
        [0.6, 0.6, 0.65] // Neutral gray
    };
    // Face-specific color multipliers for depth
    let face_colors = [
        multiply_color(base_color, 1.0), // Front (brightest)
        multiply_color(base_color, 0.75), // Right
        multiply_color(base_color, 0.55), // Back (darkest)
        multiply_color(base_color, 0.85), // Left
        multiply_color(base_color, 0.95), // Top
        multiply_color(base_color, 0.45), // Bottom
    ];
    // Normals for each face
    let normals = [
        [0.0, 0.0, 1.0], // Front
        [1.0, 0.0, 0.0], // Right
        [0.0, 0.0, -1.0], // Back
        [-1.0, 0.0, 0.0], // Left
        [0.0, 1.0, 0.0], // Top
        [0.0, -1.0, 0.0], // Bottom
    ];
    // Generate body vertices with AO
    let mut vertices = vec![];
    // Front face (4 vertices)
    vertices.extend_from_slice(&[
        EnhancedVertex {
            position: [-s, body_bottom, s],
            color: face_colors[0],
            normal: normals[0],
            ambient_occlusion: 0.8, // Corners darker
        },
        EnhancedVertex {
            position: [s, body_bottom, s],
            color: face_colors[0],
            normal: normals[0],
            ambient_occlusion: 0.8,
        },
        EnhancedVertex {
            position: [s, body_top, s],
            color: face_colors[0],
            normal: normals[0],
            ambient_occlusion: 0.9,
        },
        EnhancedVertex {
            position: [-s, body_top, s],
            color: face_colors[0],
            normal: normals[0],
            ambient_occlusion: 0.9,
        },
    ]);
    // (Continue for other 5 faces...)
    // Each face gets its own normal and color
    // Indices for body
    let indices = vec![
        // Front face
        0, 1, 2, 2, 3, 0,
        // Right face
        4, 5, 6, 6, 7, 4,
        // ... etc for all faces
    ];
    // Add wicks with darker color and smaller AO
    if high_y > body_top + 0.01 {
        // Top wick vertices
        let wick_color = multiply_color(base_color, 0.4);
        // Add 8 vertices for top wick box
    }
    if low_y < body_bottom - 0.01 {
        // Bottom wick vertices
        let wick_color = multiply_color(base_color, 0.4);
        // Add 8 vertices for bottom wick box
    }
    (vertices, indices)
}
```

---

## 7. UI Rendering Implementation

#### 7.1 UI Background Rendering
```rust
fn render_ui_backgrounds(&mut self) {
    // Create simple 2D vertices for UI rectangles
    let ui_vertices = vec![
        // Sidebar
        UIVertex { position: [0.0, 0.0], color: self.ui_layout.sidebar_color },
        UIVertex { position: [self.ui_layout.sidebar_width, 0.0], color: self.ui_layout.sidebar_color },
        UIVertex { position: [self.ui_layout.sidebar_width, self.size.height as f32], color: self.ui_layout.sidebar_color },
        UIVertex { position: [0.0, self.size.height as f32], color: self.ui_layout.sidebar_color },
        // Header
        UIVertex { position: [0.0, 0.0], color: self.ui_layout.header_color },
        UIVertex { position: [self.size.width as f32, 0.0], color: self.ui_layout.header_color },
        UIVertex { position: [self.size.width as f32, self.ui_layout.header_height], color: self.ui_layout.header_color },
        UIVertex { position: [0.0, self.ui_layout.header_height], color: self.ui_layout.header_color },
        // Footer
        // ... similar vertices
    ];
    // Update UI vertex buffer
    self.queue.write_buffer(&self.ui_vertex_buffer, 0, bytemuck::cast_slice(&ui_vertices));
}
```

#### 7.2 Grid Lines for Chart
```rust
fn generate_grid_lines(&self) -> Vec<GridVertex> {
    let mut vertices = vec![];
    let grid_color = [0.2, 0.2, 0.25, 0.1]; // Very subtle
    // Horizontal price lines
    let price_steps = 10;
    let price_range = 20.0; // In scaled units
    for i in 0..=price_steps {
        let y = -price_range/2.0 + (i as f32 / price_steps as f32) * price_range;
        vertices.push(GridVertex { position: [-100.0, y, 0.0], color: grid_color });
        vertices.push(GridVertex { position: [100.0, y, 0.0], color: grid_color });
    }
    // Vertical time lines
    let time_steps = 12; // Every 5 minutes
    let spacing = 1.5;
    for i in 0..=time_steps {
        let x = -60.0 + (i as f32 5.0 spacing);
        vertices.push(GridVertex { position: [x, -20.0, 0.0], color: grid_color });
        vertices.push(GridVertex { position: [x, 20.0, 0.0], color: grid_color });
    }
    vertices
}
```

---

## 8. Multi-Sample Anti-Aliasing Setup

#### 8.1 MSAA Framebuffer Creation
```rust
fn create_multisampled_framebuffer(
    device: &wgpu::Device,
    config: &wgpu::SurfaceConfiguration,
    sample_count: u32,
) -> wgpu::TextureView {
    let multisampled_texture_extent = wgpu::Extent3d {
        width: config.width,
        height: config.height,
        depth_or_array_layers: 1,
    };
    let multisampled_frame_descriptor = &wgpu::TextureDescriptor {
        label: Some("Multisampled frame descriptor"),
        size: multisampled_texture_extent,
        mip_level_count: 1,
        sample_count,
        dimension: wgpu::TextureDimension::D2,
        format: config.format,
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
        view_formats: &[],
    };
    device.create_texture(multisampled_frame_descriptor)
        .create_view(&wgpu::TextureViewDescriptor::default())
}
```

---

## 9. Render Pipeline Configuration

#### 9.1 Main Render Loop Structure
```rust
fn render(&mut self) -> Result<(), wgpu::SurfaceError> {
    let output = self.surface.get_current_texture()?;
    let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
    let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("Render Encoder"),
    });
    // Pass 1: Clear and render UI backgrounds
    {
        let mut ui_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("UI Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &self.multisampled_framebuffer,
                resolve_target: Some(&view),
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: 0.01, g: 0.012, b: 0.02, a: 1.0,
                    }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });
        ui_pass.set_pipeline(&self.ui_pipeline);
        ui_pass.set_vertex_buffer(0, self.ui_vertex_buffer.slice(..));
        ui_pass.draw(0..ui_vertex_count, 0..1);
    }
    // Pass 2: Render chart with viewport
    {
        let mut chart_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Chart Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &self.multisampled_framebuffer,
                resolve_target: Some(&view),
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Load, // Don't clear
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                view: &self.depth_texture.view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Clear(1.0),
                    store: wgpu::StoreOp::Store,
                }),
                stencil_ops: None,
            }),
            timestamp_writes: None,
            occlusion_query_set: None,
        });
        // Set viewport for chart area
        chart_pass.set_viewport(
            self.ui_layout.chart_x,
            self.ui_layout.chart_y,
            self.ui_layout.chart_width,
            self.ui_layout.chart_height,
            0.0,
            1.0,
        );
        // Render grid
        chart_pass.set_pipeline(&self.grid_pipeline);
        chart_pass.set_bind_group(0, &self.camera_bind_group, &[]);
        chart_pass.set_vertex_buffer(0, self.grid_vertex_buffer.slice(..));
        chart_pass.draw(0..grid_vertex_count, 0..1);
        // Render candles
        chart_pass.set_pipeline(&self.render_pipeline);
        // ... render historical and live candles
    }
    self.queue.submit(std::iter::once(encoder.finish()));
    output.present();
    Ok(())
}
```

---

## 10. Camera and Perspective Updates

#### 10.1 Optimized Camera Settings
```rust
fn update_view_proj(&mut self, ui_layout: &UILayout) {
    // Calculate aspect ratio for chart area only
    let chart_aspect = ui_layout.chart_width / ui_layout.chart_height;
    // Optimal viewing angle for trading chart
    let spacing = 1.0;
    let num_candles = 60.0;
    let center_x = -(num_candles * spacing) / 2.0 + 25.0;
    // Camera position for best 3D effect without distortion
    let distance = 40.0;
    let height = 8.0; // Lower for less dramatic angle
    let lateral_offset = -2.0; // Slight left offset to see right faces
    let eye = Point3::new(center_x + lateral_offset, height, distance);
    let target = Point3::new(center_x, -0.5, 0.0); // Look slightly below center
    let up = Vector3::unit_y();
    let view = Matrix4::look_at_rh(eye, target, up);
    let proj = perspective(Deg(28.0), chart_aspect, 0.1, 200.0); // Narrow FOV
    self.view_proj = (proj * view).into();
    self.view_pos = [eye.x, eye.y, eye.z]; // For lighting calculations
}
```

---

## 11. Performance Optimizations

#### 11.1 Instanced Rendering for Candles
```rust
struct CandleInstance {
    position: [f32; 3],
    scale: [f32; 3],
    color: [f32; 3],
}
// Create one candle mesh, render many instances
let instance_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
    label: Some("Instance Buffer"),
    contents: bytemuck::cast_slice(&candle_instances),
    usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
});
```

---

## 12. Visual Polish Details

#### 12.1 Color Scheme
```rust
const COLOR_SCHEME: ColorScheme = ColorScheme {
    green_candle: [0.0, 0.88, 0.4],
    red_candle: [0.95, 0.1, 0.2],
    neutral_candle: [0.65, 0.65, 0.7],
    background: [0.01, 0.012, 0.02],
    sidebar: [0.015, 0.015, 0.025],
    header: [0.02, 0.02, 0.03],
    footer: [0.015, 0.015, 0.025],
    grid_lines: [0.2, 0.2, 0.25, 0.1],
    axis_text: [0.7, 0.7, 0.75],
    price_marker: [0.9, 0.9, 0.95],
    selection: [0.2, 0.4, 0.8, 0.3],
    crosshair: [0.8, 0.8, 0.85, 0.5],
};
```

---

## 13. Future-Ready Structure

#### 13.1 Placeholder Methods
```rust
impl State {
    // Ready for text rendering
    fn queue_text(&mut self, text: &str, position: [f32; 2], size: f32, color: [f32; 4]) {
        self.text_instances.push(TextInstance {
            text: text.to_string(),
            position,
            size,
            color,
        });
    }
    // Ready for interactive elements
    fn handle_mouse_in_chart(&mut self, x: f32, y: f32) {
        let chart_x = x - self.ui_layout.chart_x;
        let chart_y = y - self.ui_layout.chart_y;
        // Convert to chart coordinates
        // Update crosshair position
        // Show price/time tooltip
    }
    // Ready for UI controls
    fn handle_sidebar_click(&mut self, y: f32) {
        // Determine which control was clicked
        // Update chart settings
    }
}
```

---

## 14. Success Criteria

- [ ] **Performance:** Sub-millisecond frame times on modern hardware
- [ ] **Visual Quality:** Smooth edges, clear 3D depth, professional appearance
- [ ] **Layout:** Clean separation of UI areas with proper viewport management
- [ ] **Monitoring:** Real-time performance metrics visible at all times
- [ ] **Responsiveness:** Immediate reflection of WebSocket data (< 1ms latency)

---

**Summary:**
- Complete UI layout system with configurable regions
- Enhanced shaders with fake lighting and ambient occlusion
- Multi-sample anti-aliasing for smooth edges
- Professional color scheme with face-based shading
- Optimized camera angle specifically for trading charts
- Grid lines and visual guides
- Performance optimizations with instancing ready
- Modular render passes for different elements
- Future-ready structure for text and interactive elements
- Responsive design that handles window resizing

This will create a professional-grade trading chart interface that looks like it belongs in a high-end trading platform, with smooth 3D candles that have proper depth and lighting, all within a well-organized UI layout.