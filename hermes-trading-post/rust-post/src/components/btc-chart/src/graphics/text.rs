use std::collections::HashMap;
use image::{ImageBuffer, RgbaImage, Rgba};
use wgpu::util::DeviceExt;

// Character info for font atlas positioning
#[derive(Debug, Clone)]
pub struct CharacterInfo {
    pub atlas_x: f32,      // X position in atlas (0.0-1.0)
    pub atlas_y: f32,      // Y position in atlas (0.0-1.0) 
    pub atlas_w: f32,      // Width in atlas (0.0-1.0)
    pub atlas_h: f32,      // Height in atlas (0.0-1.0)
    pub char_w: f32,       // Character width in pixels
    pub char_h: f32,       // Character height in pixels
    pub bearing_x: f32,    // Left side bearing
    pub bearing_y: f32,    // Top side bearing
    pub advance: f32,      // Advance to next character
}

// Text vertex for GPU rendering
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct TextVertex {
    pub position: [f32; 3], // Screen position
    pub tex_coords: [f32; 2],  // Atlas texture coordinates
}

impl TextVertex {
    pub fn desc() -> wgpu::VertexBufferLayout<'static> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<TextVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[
                wgpu::VertexAttribute {
                    offset: 0,
                    shader_location: 0,
                    format: wgpu::VertexFormat::Float32x3,
                },
                wgpu::VertexAttribute {
                    offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                    shader_location: 1,
                    format: wgpu::VertexFormat::Float32x2,
                },
            ],
        }
    }
}

// Optimized font atlas for trading symbols and numbers
pub struct FontAtlas {
    pub texture: wgpu::Texture,
    pub texture_view: wgpu::TextureView,
    pub sampler: wgpu::Sampler,
    pub bind_group: wgpu::BindGroup,
    pub characters: HashMap<char, CharacterInfo>,
    pub atlas_size: u32,
}

impl FontAtlas {
    pub fn new(device: &wgpu::Device, queue: &wgpu::Queue, bind_group_layout: &wgpu::BindGroupLayout) -> Self {
        // Trading-optimized character set: numbers, currency symbols, percentage, lowercase, punctuation
        let chars = "0123456789.,+-%$€£¥₿▲▼ BTCETHXRPLTCADAUSDEURabcdefghijklmnopqrstuvwxyz:()°FOV";
        
        // Create bitmap font atlas (512x512 for high DPI)
        let atlas_size = 512u32;
        let mut atlas_image: RgbaImage = ImageBuffer::new(atlas_size, atlas_size);
        
        // Initialize with transparent background
        for pixel in atlas_image.pixels_mut() {
            *pixel = Rgba([0u8, 0u8, 0u8, 0u8]); // Fully transparent
        }
        
        let mut characters = HashMap::new();
        
        // Simple bitmap font generation (16x24 pixel chars for ultra-fast rendering)
        let char_width = 16u32;
        let char_height = 24u32;
        let chars_per_row = atlas_size / char_width;
        
        for (i, ch) in chars.chars().enumerate() {
            let row = i as u32 / chars_per_row;
            let col = i as u32 % chars_per_row;
            let x = col * char_width;
            let y = row * char_height;
            
            // Draw simple bitmap character (white pixels for readability)
            match ch {
                '0' => draw_zero(&mut atlas_image, x, y, char_width, char_height),
                '1' => draw_one(&mut atlas_image, x, y, char_width, char_height),
                '2' => draw_two(&mut atlas_image, x, y, char_width, char_height),
                '3' => draw_three(&mut atlas_image, x, y, char_width, char_height),
                '4' => draw_four(&mut atlas_image, x, y, char_width, char_height),
                '5' => draw_five(&mut atlas_image, x, y, char_width, char_height),
                '6' => draw_six(&mut atlas_image, x, y, char_width, char_height),
                '7' => draw_seven(&mut atlas_image, x, y, char_width, char_height),
                '8' => draw_eight(&mut atlas_image, x, y, char_width, char_height),
                '9' => draw_nine(&mut atlas_image, x, y, char_width, char_height),
                '.' => draw_dot(&mut atlas_image, x, y, char_width, char_height),
                ',' => draw_comma(&mut atlas_image, x, y, char_width, char_height),
                '+' => draw_plus(&mut atlas_image, x, y, char_width, char_height),
                '-' => draw_minus(&mut atlas_image, x, y, char_width, char_height),
                '%' => draw_percent(&mut atlas_image, x, y, char_width, char_height),
                '$' => draw_dollar(&mut atlas_image, x, y, char_width, char_height),
                '▲' => draw_up_triangle(&mut atlas_image, x, y, char_width, char_height),
                '▼' => draw_down_triangle(&mut atlas_image, x, y, char_width, char_height),
                ':' => draw_colon(&mut atlas_image, x, y, char_width, char_height),
                '(' => draw_left_paren(&mut atlas_image, x, y, char_width, char_height),
                ')' => draw_right_paren(&mut atlas_image, x, y, char_width, char_height),
                '°' => draw_degree(&mut atlas_image, x, y, char_width, char_height),
                ' ' => {}, // Space - leave empty
                _ => draw_letter(&mut atlas_image, x, y, char_width, char_height, ch),
            }
            
            // Store character info for rendering
            characters.insert(ch, CharacterInfo {
                atlas_x: x as f32 / atlas_size as f32,
                atlas_y: y as f32 / atlas_size as f32,
                atlas_w: char_width as f32 / atlas_size as f32,
                atlas_h: char_height as f32 / atlas_size as f32,
                char_w: char_width as f32,
                char_h: char_height as f32,
                bearing_x: 0.0,
                bearing_y: char_height as f32,
                advance: char_width as f32,
            });
        }
        
        // Create GPU texture from atlas
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Font Atlas Texture"),
            size: wgpu::Extent3d {
                width: atlas_size,
                height: atlas_size,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        
        queue.write_texture(
            wgpu::ImageCopyTexture {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &atlas_image,
            wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(4 * atlas_size),
                rows_per_image: Some(atlas_size),
            },
            wgpu::Extent3d {
                width: atlas_size,
                height: atlas_size,
                depth_or_array_layers: 1,
            },
        );
        
        let texture_view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Nearest, // Crisp pixel-perfect text
            min_filter: wgpu::FilterMode::Nearest,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });
        
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
            ],
            label: Some("Font Atlas Bind Group"),
        });
        
        log::info!("🔤 Font atlas created: {}x{} with {} characters", atlas_size, atlas_size, characters.len());
        
        // Debug: Save atlas to file for inspection
        if let Err(e) = atlas_image.save("font_atlas_debug.png") {
            log::warn!("Could not save font atlas debug image: {}", e);
        } else {
            log::info!("Font atlas saved to font_atlas_debug.png for inspection");
        }
        
        Self {
            texture,
            texture_view,
            sampler,
            bind_group,
            characters,
            atlas_size,
        }
    }

    pub fn create_text_vertices(&self, text: &str, x: f32, y: f32, scale: f32) -> (Vec<TextVertex>, Vec<u16>) {
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        let mut cursor_x = x;
        let mut vertex_index = 0u16;

        // Convert screen coordinates to NDC (-1 to 1)
        // Assuming 1200x800 screen size for now
        let screen_width = 1200.0;
        let screen_height = 800.0;

        for ch in text.chars() {
            if let Some(char_info) = self.characters.get(&ch) {
                let char_width = char_info.char_w * scale;
                let char_height = char_info.char_h * scale;

                // Convert to NDC coordinates
                let ndc_x1 = (cursor_x / screen_width) * 2.0 - 1.0;
                let ndc_y1 = 1.0 - (y / screen_height) * 2.0;
                let ndc_x2 = ((cursor_x + char_width) / screen_width) * 2.0 - 1.0;
                let ndc_y2 = 1.0 - ((y + char_height) / screen_height) * 2.0;

                // Create quad for character
                vertices.extend_from_slice(&[
                    TextVertex {
                        position: [ndc_x1, ndc_y1, 0.0],
                        tex_coords: [char_info.atlas_x, char_info.atlas_y],
                    },
                    TextVertex {
                        position: [ndc_x2, ndc_y1, 0.0],
                        tex_coords: [char_info.atlas_x + char_info.atlas_w, char_info.atlas_y],
                    },
                    TextVertex {
                        position: [ndc_x2, ndc_y2, 0.0],
                        tex_coords: [char_info.atlas_x + char_info.atlas_w, char_info.atlas_y + char_info.atlas_h],
                    },
                    TextVertex {
                        position: [ndc_x1, ndc_y2, 0.0],
                        tex_coords: [char_info.atlas_x, char_info.atlas_y + char_info.atlas_h],
                    },
                ]);

                // Create indices for two triangles
                indices.extend_from_slice(&[
                    vertex_index, vertex_index + 1, vertex_index + 2,
                    vertex_index, vertex_index + 2, vertex_index + 3,
                ]);

                cursor_x += char_info.advance * scale;
                vertex_index += 4;
            }
        }

        (vertices, indices)
    }
}

// Character drawing functions (simple bitmap patterns)
fn draw_zero(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Draw outline of 0
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
        img.put_pixel(x + i, y + h - 3, white);
    }
    for i in 2..h-2 {
        img.put_pixel(x + 2, y + i, white);
        img.put_pixel(x + w - 3, y + i, white);
    }
}

fn draw_one(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    let center_x = x + w / 2;
    for i in 2..h-2 {
        img.put_pixel(center_x, y + i, white);
    }
    // Top diagonal
    img.put_pixel(center_x - 1, y + 3, white);
    // Bottom line
    for i in (w/2-2)..(w/2+3) {
        img.put_pixel(x + i, y + h - 3, white);
    }
}

fn draw_two(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
    }
    // Right side (top half)
    for i in 2..h/2 {
        img.put_pixel(x + w - 3, y + i, white);
    }
    // Middle line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h/2, white);
    }
    // Left side (bottom half)
    for i in h/2..h-2 {
        img.put_pixel(x + 2, y + i, white);
    }
    // Bottom line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h - 3, white);
    }
}

fn draw_three(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
    }
    // Right side
    for i in 2..h-2 {
        img.put_pixel(x + w - 3, y + i, white);
    }
    // Middle line
    for i in w/2..w-2 {
        img.put_pixel(x + i, y + h/2, white);
    }
    // Bottom line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h - 3, white);
    }
}

fn draw_four(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Left vertical (top half)
    for i in 2..h/2+2 {
        img.put_pixel(x + 2, y + i, white);
    }
    // Right vertical (full)
    for i in 2..h-2 {
        img.put_pixel(x + w - 3, y + i, white);
    }
    // Middle horizontal
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h/2, white);
    }
}

fn draw_five(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
    }
    // Left side (top half)
    for i in 2..h/2 {
        img.put_pixel(x + 2, y + i, white);
    }
    // Middle line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h/2, white);
    }
    // Right side (bottom half)
    for i in h/2..h-2 {
        img.put_pixel(x + w - 3, y + i, white);
    }
    // Bottom line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h - 3, white);
    }
}

fn draw_six(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
    }
    // Left side (full)
    for i in 2..h-2 {
        img.put_pixel(x + 2, y + i, white);
    }
    // Middle line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h/2, white);
    }
    // Right side (bottom half only)
    for i in h/2..h-2 {
        img.put_pixel(x + w - 3, y + i, white);
    }
    // Bottom line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h - 3, white);
    }
}

fn draw_seven(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
    }
    // Diagonal line
    for i in 2..h-2 {
        let diagonal_x = x + w - 3 - ((i - 2) * (w - 6) / (h - 4));
        if diagonal_x >= x + 2 && diagonal_x < x + w - 2 {
            img.put_pixel(diagonal_x, y + i, white);
        }
    }
}

fn draw_eight(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
    }
    // Left side
    for i in 2..h-2 {
        img.put_pixel(x + 2, y + i, white);
    }
    // Right side
    for i in 2..h-2 {
        img.put_pixel(x + w - 3, y + i, white);
    }
    // Middle line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h/2, white);
    }
    // Bottom line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h - 3, white);
    }
}

fn draw_nine(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
    }
    // Left side (top half only)
    for i in 2..h/2 {
        img.put_pixel(x + 2, y + i, white);
    }
    // Right side (full)
    for i in 2..h-2 {
        img.put_pixel(x + w - 3, y + i, white);
    }
    // Middle line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h/2, white);
    }
    // Bottom line
    for i in 2..w-2 {
        img.put_pixel(x + i, y + h - 3, white);
    }
}

fn draw_dot(img: &mut RgbaImage, x: u32, y: u32, _w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    img.put_pixel(x + 6, y + h - 5, white);
    img.put_pixel(x + 7, y + h - 5, white);
    img.put_pixel(x + 6, y + h - 4, white);
    img.put_pixel(x + 7, y + h - 4, white);
}

fn draw_comma(img: &mut RgbaImage, x: u32, y: u32, _w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    img.put_pixel(x + 6, y + h - 5, white);
    img.put_pixel(x + 7, y + h - 5, white);
    img.put_pixel(x + 5, y + h - 4, white);
    img.put_pixel(x + 6, y + h - 4, white);
}

fn draw_plus(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    let center_x = x + w / 2;
    let center_y = y + h / 2;
    // Horizontal line
    for i in (w/4)..(3*w/4) {
        img.put_pixel(x + i, center_y, white);
    }
    // Vertical line
    for i in (h/4)..(3*h/4) {
        img.put_pixel(center_x, y + i, white);
    }
}

fn draw_minus(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    let center_y = y + h / 2;
    // Horizontal line
    for i in (w/4)..(3*w/4) {
        img.put_pixel(x + i, center_y, white);
    }
}

fn draw_percent(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Top circle
    for i in 0..3 {
        for j in 0..3 {
            img.put_pixel(x + 2 + i, y + 3 + j, white);
        }
    }
    // Bottom circle
    for i in 0..3 {
        for j in 0..3 {
            img.put_pixel(x + w - 5 + i, y + h - 6 + j, white);
        }
    }
    // Diagonal line
    for i in 0..h-4 {
        let diag_x = x + 2 + ((i * (w - 4)) / (h - 4));
        img.put_pixel(diag_x, y + 2 + i, white);
    }
}

fn draw_dollar(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    let center_x = x + w / 2;
    // Vertical line through center
    for i in 1..h-1 {
        img.put_pixel(center_x, y + i, white);
    }
    // S shape
    for i in 3..w-3 {
        img.put_pixel(x + i, y + 3, white); // Top
        img.put_pixel(x + i, y + h/2, white); // Middle
        img.put_pixel(x + i, y + h - 4, white); // Bottom
    }
    img.put_pixel(x + 3, y + 5, white);
    img.put_pixel(x + w - 4, y + h - 6, white);
}

fn draw_up_triangle(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([0u8, 255u8, 0u8, 255u8]); // Green for up
    let center_x = x + w / 2;
    for i in 0..h/2 {
        for j in 0..=i {
            if center_x >= j && center_x + j < x + w {
                img.put_pixel(center_x - j, y + h/2 - i, white);
                if j > 0 {
                    img.put_pixel(center_x + j, y + h/2 - i, white);
                }
            }
        }
    }
}

fn draw_down_triangle(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    let white = Rgba([255u8, 0u8, 0u8, 255u8]); // Red for down
    let center_x = x + w / 2;
    for i in 0..h/2 {
        for j in 0..=(h/2-i) {
            if center_x >= j && center_x + j < x + w {
                img.put_pixel(center_x - j, y + h/2 + i, white);
                if j > 0 {
                    img.put_pixel(center_x + j, y + h/2 + i, white);
                }
            }
        }
    }
}

fn draw_colon(img: &mut RgbaImage, x: u32, y: u32, _w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    let center_x = x + 6;
    // Top dot
    img.put_pixel(center_x, y + h/3, white);
    img.put_pixel(center_x + 1, y + h/3, white);
    img.put_pixel(center_x, y + h/3 + 1, white);
    img.put_pixel(center_x + 1, y + h/3 + 1, white);
    // Bottom dot
    img.put_pixel(center_x, y + 2*h/3, white);
    img.put_pixel(center_x + 1, y + 2*h/3, white);
    img.put_pixel(center_x, y + 2*h/3 + 1, white);
    img.put_pixel(center_x + 1, y + 2*h/3 + 1, white);
}

fn draw_left_paren(img: &mut RgbaImage, x: u32, y: u32, _w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    for i in 2..h-2 {
        let offset = if i > h/2 { i - h/2 } else { h/2 - i };
        let curve_x = x + 8 - (offset * 3 / (h/2)).min(6);
        img.put_pixel(curve_x, y + i, white);
    }
}

fn draw_right_paren(img: &mut RgbaImage, x: u32, y: u32, _w: u32, h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    for i in 2..h-2 {
        let offset = if i > h/2 { i - h/2 } else { h/2 - i };
        let curve_x = x + 5 + (offset * 3 / (h/2)).min(6);
        img.put_pixel(curve_x, y + i, white);
    }
}

fn draw_degree(img: &mut RgbaImage, x: u32, y: u32, _w: u32, _h: u32) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Small circle in top right
    for i in 0..3 {
        for j in 0..3 {
            if (i == 0 || i == 2) || (j == 0 || j == 2) {
                img.put_pixel(x + 8 + i, y + 3 + j, white);
            }
        }
    }
}

fn draw_letter(img: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32, ch: char) {
    let white = Rgba([255u8, 255u8, 255u8, 255u8]);
    // Simple generic letter - draw a rectangle outline
    for i in 2..w-2 {
        img.put_pixel(x + i, y + 2, white);
        img.put_pixel(x + i, y + h - 3, white);
    }
    for i in 2..h-2 {
        img.put_pixel(x + 2, y + i, white);
        img.put_pixel(x + w - 3, y + i, white);
    }
    
    // Add a distinctive mark based on the character
    match ch.to_ascii_lowercase() {
        'b' | 'p' | 'r' => {
            // Add horizontal line in middle
            for i in 2..w/2+2 {
                img.put_pixel(x + i, y + h/2, white);
            }
        }
        't' | 'f' | 'e' => {
            // Add horizontal lines
            for i in 2..w-4 {
                img.put_pixel(x + i, y + h/3, white);
            }
        }
        _ => {}
    }
}
