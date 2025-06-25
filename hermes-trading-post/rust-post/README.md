# Rust-Post: Ultra-Low-Latency Candle Demo

This is a minimal Rust + Vulkan + WebSocket project for ultra-fast real-time candle charting.

## Features
- Multi-threaded WebSocket (mock for now, easy to swap for real)
- Vulkan window (winit + vulkano, stub for now)
- Prints candle data to console as a placeholder for GPU rendering
- Designed for lowest possible latency and high-frequency updates

## How to Run

1. Install Rust (https://rustup.rs/)
2. Install Vulkan SDK (https://vulkan.lunarg.com/)
3. In this directory:

```sh
cargo run
```

You should see candle data printed to the console every 100ms.

## Next Steps
- Implement actual Vulkan rendering of the candle
- Connect to a real WebSocket for live data
- Expand to full chart UI
