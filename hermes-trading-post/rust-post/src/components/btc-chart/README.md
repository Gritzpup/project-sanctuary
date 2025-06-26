# BTC Chart - 3D Real-time Bitcoin Candlestick Visualization

A high-performance 3D Bitcoin candlestick chart application built with Rust, WGPU, and real-time Coinbase data.

## Features

- 🚀 **Real-time Data**: Live Bitcoin price updates via Coinbase WebSocket
- 🎨 **3D Visualization**: Beautiful 3D candlestick charts with lighting and shadows
- ⚡ **High Performance**: 60+ FPS rendering with WGPU and Vulkan backend
- 📊 **Interactive**: Mouse controls for camera movement and zoom
- 🖥️ **Multiple Platforms**: Native desktop app with optional Tauri integration

## Architecture

The application is modularly structured:

```
src/
├── main.rs              # Main application entry point
├── tauri_main.rs        # Tauri wrapper (optional)
├── data/
│   ├── mod.rs
│   ├── candle.rs        # Candle data structures
│   ├── websocket.rs     # Real-time data fetching
│   └── api.rs           # REST API integration
├── graphics/
│   ├── mod.rs
│   ├── vertices.rs      # 3D geometry generation
│   ├── shaders.rs       # WGSL shader definitions
│   └── pipeline.rs      # Render pipeline setup
├── ui/
│   ├── mod.rs
│   ├── text.rs          # High-performance text rendering
│   ├── layout.rs        # UI layout management
│   └── font_atlas.rs    # Bitmap font system
├── camera/
│   ├── mod.rs
│   ├── controller.rs    # Camera movement and controls
│   └── uniform.rs       # Camera uniform buffer
└── rendering/
    ├── mod.rs
    ├── state.rs         # Main render state
    └── window.rs        # Window management
```

## Running the Application

### Standard Native App
```bash
cargo run --bin btc-chart
```

### Tauri App (Enhanced native features)
```bash
cargo run --bin btc-chart-tauri --features tauri-app
```

## Application Hosting Options

### 1. **Tauri** (Recommended for Desktop)
- Native performance with web technologies
- Small bundle size (~10-20MB)
- System integration (notifications, file access)
- Auto-updater support
- Cross-platform (Windows, macOS, Linux)

### 2. **Native Binary**
- Pure Rust performance
- Direct GPU access
- Minimal dependencies
- Fastest execution

### 3. **Electron Alternative**
- Could wrap with Tauri for web-like experience
- Better than Electron (smaller, faster)

### 4. **WebAssembly + Web**
- Browser compatibility
- Easy distribution
- Limited GPU access (WebGL only)

### 5. **Server + Web Client**
- Remote rendering via WebSocket
- Multiple client support
- Resource sharing

## Controls

- **Mouse**: Rotate camera around chart
- **Scroll**: Zoom in/out
- **Shift + Mouse**: Pan camera
- **WASD**: Move camera position
- **QE**: Move camera up/down
- **R**: Reset camera position

## Performance Notes

- Uses Vulkan backend for maximum GPU performance
- 4x MSAA for high-quality anti-aliasing
- Efficient vertex buffer management
- Real-time geometry updates for live data
- Bitmap font rendering for ultra-fast text

## Dependencies

- **WGPU**: Modern graphics API abstraction
- **Winit**: Cross-platform windowing
- **Tokio**: Async runtime for WebSocket
- **CGMath**: Linear algebra for 3D math
- **Serde**: Data serialization

## Future Enhancements

- [ ] Multiple timeframes (1m, 5m, 1h, 1d)
- [ ] Technical indicators overlay
- [ ] Multiple cryptocurrency support
- [ ] Portfolio tracking
- [ ] Alert system
- [ ] Trading integration