//! Fast Rust candle visualization with live Coinbase data
//! - Connects to Coinbase WebSocket ticker for fastest updates
//! - Draws a candle that moves up/down with price in real-time
//! - Optimized for minimal latency

use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use minifb::{Key, Window, WindowOptions};

const WIDTH: usize = 800;
const HEIGHT: usize = 600;

#[derive(Debug, Clone)]
struct Candle {
    open: f64,
    high: f64,
    low: f64,
    close: f64,
}

// --- Coinbase WebSocket task ---
async fn websocket_task(tx: mpsc::Sender<f64>) {
    use tokio_tungstenite::connect_async;
    use tungstenite::Message;
    use serde_json::Value;

    let url = "wss://ws-feed.exchange.coinbase.com";
    
    println!("Connecting to Coinbase WebSocket...");
    
    let (ws_stream, _) = match connect_async(url).await {
        Ok(stream) => stream,
        Err(e) => {
            eprintln!("Failed to connect: {}", e);
            return;
        }
    };
    
    println!("Connected! Subscribing to BTC-USD ticker...");
    
    let (mut write, mut read) = ws_stream.split();

    // Subscribe to ticker for fastest price updates
    let subscribe_msg = serde_json::json!({
        "type": "subscribe",
        "channels": [{
            "name": "ticker",
            "product_ids": ["BTC-USD"]
        }]
    });
    
    if let Err(e) = write.send(Message::Text(subscribe_msg.to_string())).await {
        eprintln!("Failed to send subscribe: {}", e);
        return;
    }

    println!("Subscribed! Waiting for price updates...");

    while let Some(msg) = read.next().await {
        if let Ok(msg) = msg {
            if let Message::Text(txt) = msg {
                if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                    if json["type"] == "ticker" && json["product_id"] == "BTC-USD" {
                        if let Some(price_str) = json["price"].as_str() {
                            if let Ok(price) = price_str.parse::<f64>() {
                                let _ = tx.send(price).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- Ultra-fast candle drawing ---
fn draw_candle_ultra_fast(buffer: &mut Vec<u32>, candle: &Candle, price_range: (f64, f64)) {
    // Clear with dark background
    buffer.fill(0xFF111111);
    
    let (min_price, max_price) = price_range;
    if min_price >= max_price {
        return;
    }
    
    // Large candle for visibility
    let candle_width = 120i32;
    let x_center = (WIDTH / 2) as i32;
    let x_start = x_center - candle_width / 2;
    let x_end = x_center + candle_width / 2;
    
    // Map price to Y coordinate
    let price_to_y = |price: f64| -> i32 {
        let normalized = (price - min_price) / (max_price - min_price);
        let y = HEIGHT as f64 * (1.0 - normalized) * 0.8 + HEIGHT as f64 * 0.1;
        y as i32
    };
    
    let y_open = price_to_y(candle.open);
    let y_close = price_to_y(candle.close);
    let y_high = price_to_y(candle.high);
    let y_low = price_to_y(candle.low);
    
    // Dynamic color based on price movement
    let color = if candle.close > candle.open {
        0xFF00FF00 // Bright green
    } else if candle.close < candle.open {
        0xFFFF0000 // Bright red
    } else {
        0xFFFFFF00 // Yellow
    };
    
    // Draw wick (thick line)
    for y in y_high.max(0)..=y_low.min(HEIGHT as i32 - 1) {
        for dx in -3..=3 {
            let x = x_center as i32 + dx;
            if x >= 0 && x < WIDTH as i32 {
                buffer[(y * WIDTH as i32 + x) as usize] = 0xFFCCCCCC;
            }
        }
    }
    
    // Draw body with minimum height
    let body_top = y_open.min(y_close);
    let body_bottom = y_open.max(y_close).max(body_top + 5);
    
    for y in body_top.max(0)..=body_bottom.min(HEIGHT as i32 - 1) {
        for x in x_start.max(0)..=x_end.min(WIDTH as i32 - 1) {
            buffer[(y * WIDTH as i32 + x) as usize] = color;
        }
    }
    
    // Draw current price line with glow
    let y_current = price_to_y(candle.close);
    if y_current >= 0 && y_current < HEIGHT as i32 {
        // Main line
        for x in 0..WIDTH {
            buffer[(y_current * WIDTH as i32 + x as i32) as usize] = color;
        }
        // Glow effect
        for dy in -2..=2 {
            if dy != 0 {
                let y = y_current + dy;
                if y >= 0 && y < HEIGHT as i32 {
                    let alpha = 255 / (dy.abs() + 1);
                    let glow_color = (color & 0x00FFFFFF) | ((alpha as u32) << 24);
                    for x in 0..WIDTH {
                        buffer[(y * WIDTH as i32 + x as i32) as usize] = blend_colors(
                            buffer[(y * WIDTH as i32 + x as i32) as usize],
                            glow_color
                        );
                    }
                }
            }
        }
    }
    
    // Draw price text (simplified indicators)
    draw_price_indicator(buffer, 10, 10, candle.close, color);
    draw_price_change(buffer, 10, 40, candle.open, candle.close);
}

fn blend_colors(bg: u32, fg: u32) -> u32 {
    let alpha = (fg >> 24) & 0xFF;
    let inv_alpha = 255 - alpha;
    
    let r = (((fg >> 16) & 0xFF) * alpha + ((bg >> 16) & 0xFF) * inv_alpha) / 255;
    let g = (((fg >> 8) & 0xFF) * alpha + ((bg >> 8) & 0xFF) * inv_alpha) / 255;
    let b = ((fg & 0xFF) * alpha + (bg & 0xFF) * inv_alpha) / 255;
    
    0xFF000000 | (r << 16) | (g << 8) | b
}

fn draw_price_indicator(buffer: &mut Vec<u32>, x: usize, y: usize, price: f64, color: u32) {
    // Draw a simple price indicator
    let price_str = format!("${:.2}", price);
    let box_width = price_str.len() * 12;
    let box_height = 20;
    
    // Draw background box
    for dy in 0..box_height {
        for dx in 0..box_width {
            let px = x + dx;
            let py = y + dy;
            if px < WIDTH && py < HEIGHT {
                buffer[py * WIDTH + px] = 0xFF222222;
            }
        }
    }
    
    // Draw colored border
    for dx in 0..box_width {
        if x + dx < WIDTH {
            buffer[y * WIDTH + x + dx] = color;
            buffer[(y + box_height - 1) * WIDTH + x + dx] = color;
        }
    }
    for dy in 0..box_height {
        if y + dy < HEIGHT {
            buffer[(y + dy) * WIDTH + x] = color;
            buffer[(y + dy) * WIDTH + x + box_width - 1] = color;
        }
    }
}

fn draw_price_change(buffer: &mut Vec<u32>, x: usize, y: usize, open: f64, close: f64) {
    let change = close - open;
    let _change_pct = if open > 0.0 { (change / open) * 100.0 } else { 0.0 };
    let color = if change > 0.0 { 0xFF00FF00 } else if change < 0.0 { 0xFFFF0000 } else { 0xFFFFFF00 };
    
    // Draw change indicator
    let indicator_width = 150;
    let indicator_height = 20;
    
    for dy in 0..indicator_height {
        for dx in 0..indicator_width {
            let px = x + dx;
            let py = y + dy;
            if px < WIDTH && py < HEIGHT {
                if dy == 0 || dy == indicator_height - 1 || dx == 0 || dx == indicator_width - 1 {
                    buffer[py * WIDTH + px] = color;
                }
            }
        }
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();
    
    println!("=== BTC-USD Ultra-Fast Candle Visualization ===");
    println!("Optimized for minimum latency");
    println!("Press ESC to exit\n");
    
    let mut window = Window::new(
        "BTC-USD Live - Ultra Fast",
        WIDTH,
        HEIGHT,
        WindowOptions {
            resize: false,
            scale: minifb::Scale::X1,
            ..WindowOptions::default()
        },
    ).expect("Failed to create window");

    // No frame rate limit
    window.limit_update_rate(None);

    let mut buffer: Vec<u32> = vec![0; WIDTH * HEIGHT];

    // Price tracking
    let mut candle = Candle {
        open: 100000.0,
        high: 100000.0,
        low: 100000.0,
        close: 100000.0,
    };
    
    let mut price_history: Vec<f64> = Vec::with_capacity(1000);
    let mut candle_start_time = std::time::Instant::now();

    // Channel for WebSocket -> UI
    let (tx, mut rx) = mpsc::channel::<f64>(1000);
    
    // Spawn WebSocket task
    tokio::spawn(async move {
        websocket_task(tx).await;
    });

    let mut frame_count = 0u64;
    let mut update_count = 0u64;
    let start_time = std::time::Instant::now();
    let mut last_fps_print = std::time::Instant::now();
    
    // Main render loop
    while window.is_open() && !window.is_key_down(Key::Escape) {
        // Process all pending price updates
        let mut latest_price = None;
        while let Ok(price) = rx.try_recv() {
            latest_price = Some(price);
            update_count += 1;
        }
        
        // Update candle with latest price
        if let Some(price) = latest_price {
            price_history.push(price);
            
            // Update current candle
            candle.close = price;
            if price > candle.high {
                candle.high = price;
            }
            if price < candle.low {
                candle.low = price;
            }
            
            // Reset candle every minute
            if candle_start_time.elapsed().as_secs() >= 60 {
                candle.open = price;
                candle.high = price;
                candle.low = price;
                candle.close = price;
                candle_start_time = std::time::Instant::now();
                println!("New minute candle started at ${:.2}", price);
            }
        }
        
        // Calculate dynamic price range
        let price_range = if price_history.len() > 10 {
            let recent_prices = &price_history[price_history.len().saturating_sub(100)..];
            let min = recent_prices.iter().fold(f64::INFINITY, |a, &b| a.min(b));
            let max = recent_prices.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
            let padding = (max - min) * 0.1;
            (min - padding, max + padding)
        } else {
            (candle.close - 100.0, candle.close + 100.0)
        };
        
        // Draw
        draw_candle_ultra_fast(&mut buffer, &candle, price_range);
        
        // Update window
        window.update_with_buffer(&buffer, WIDTH, HEIGHT).unwrap();
        
        frame_count += 1;
        
        // Print stats every second
        if last_fps_print.elapsed().as_secs() >= 1 {
            let elapsed = start_time.elapsed().as_secs_f64();
            let fps = frame_count as f64 / elapsed;
            let ups = update_count as f64 / elapsed;
            println!("FPS: {:.0} | Updates/sec: {:.0} | Current: ${:.2}", 
                fps, ups, candle.close);
            last_fps_print = std::time::Instant::now();
        }
    }
    
    println!("\nShutting down...");
}