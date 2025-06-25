//! Simple Rust WebSocket candle demo with ACTUAL VISIBLE CANDLE
//! - Connects to Coinbase WebSocket
//! - Receives live candle data
//! - DRAWS A CANDLE that you can see!

use std::sync::{Arc, Mutex};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use minifb::{Key, Window, WindowOptions};

// --- Candle data structure ---
#[derive(Debug, Clone, Deserialize)]
struct Candle {
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    #[allow(dead_code)]
    volume: f64,
}

// --- Coinbase WebSocket task ---
async fn websocket_task(tx: mpsc::Sender<Candle>) {
    use tokio_tungstenite::connect_async;
    use tungstenite::Message;
    use serde_json::Value;

    let url = "wss://ws-feed.exchange.coinbase.com";
    
    println!("Connecting to Coinbase WebSocket...");
    
    let (ws_stream, _) = match connect_async(url).await {
        Ok(stream) => stream,
        Err(e) => {
            eprintln!("Failed to connect to WebSocket: {}", e);
            return;
        }
    };
    
    println!("Connected! Subscribing to BTC-USD candles...");
    
    let (mut write, mut read) = ws_stream.split();

    // Subscribe to BTC-USD 1m candles
    let subscribe_msg = serde_json::json!({
        "type": "subscribe",
        "channels": [{
            "name": "candles",
            "product_ids": ["BTC-USD"],
            "interval": "one_minute"
        }]
    });
    
    if let Err(e) = write.send(Message::Text(subscribe_msg.to_string())).await {
        eprintln!("Failed to send subscribe message: {}", e);
        return;
    }

    println!("Waiting for candle data...");

    while let Some(msg) = read.next().await {
        if let Ok(msg) = msg {
            if let Message::Text(txt) = msg {
                if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                    // Debug output for subscription confirmation
                    if json["type"] == "subscriptions" {
                        println!("Subscription confirmed!");
                    }
                    
                    if json["type"] == "candles" && json["product_id"] == "BTC-USD" {
                        if let Some(arr) = json["candles"].as_array() {
                            if let Some(c) = arr.first() {
                                // Coinbase candle: [start, low, high, open, close, volume]
                                let open = c[3].as_f64().unwrap_or(0.0);
                                let high = c[2].as_f64().unwrap_or(0.0);
                                let low = c[1].as_f64().unwrap_or(0.0);
                                let close = c[4].as_f64().unwrap_or(0.0);
                                let volume = c[5].as_f64().unwrap_or(0.0);
                                let candle = Candle { open, high, low, close, volume };
                                
                                println!("New candle: O:{:.2} H:{:.2} L:{:.2} C:{:.2} | {}", 
                                    candle.open, candle.high, candle.low, candle.close,
                                    if candle.close > candle.open { "UP 🟢" } else { "DOWN 🔴" }
                                );
                                
                                let _ = tx.send(candle).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- Draw candle to buffer (ACTUALLY DRAWS A VISIBLE CANDLE!) ---
fn draw_candle(buffer: &mut Vec<u32>, candle: &Candle, width: usize, height: usize) {
    // Clear the buffer with dark background
    for pixel in buffer.iter_mut() {
        *pixel = 0xFF1A1A1A; // Dark gray background
    }
    
    // Draw price labels and grid
    let text_color = 0xFFCCCCCC;
    let grid_color = 0xFF333333;
    
    // Calculate price range - use dynamic range based on current price
    let price_center = (candle.high + candle.low) / 2.0;
    let price_range = (candle.high - candle.low).max(100.0) * 2.0; // At least $200 range
    let min_price = price_center - price_range / 2.0;
    let max_price = price_center + price_range / 2.0;
    
    // Draw horizontal grid lines
    for i in 0..5 {
        let y = (height as f32 * (i as f32 / 4.0)) as usize;
        if y < height {
            for x in 0..width {
                if x % 10 < 5 { // Dotted line
                    let idx = y * width + x;
                    if idx < buffer.len() {
                        buffer[idx] = grid_color;
                    }
                }
            }
        }
    }
    
    // Map price to Y coordinate
    let price_to_y = |price: f64| -> i32 {
        let normalized = (price - min_price) / (max_price - min_price);
        ((1.0 - normalized) * height as f64 * 0.9 + height as f64 * 0.05) as i32
    };
    
    // Calculate candle position
    let candle_width = 60; // Make it wider so it's more visible
    let x_center = (width / 2) as i32;
    let x_start = x_center - candle_width / 2;
    let x_end = x_center + candle_width / 2;
    
    let y_open = price_to_y(candle.open);
    let y_close = price_to_y(candle.close);
    let y_high = price_to_y(candle.high);
    let y_low = price_to_y(candle.low);
    
    // Determine candle color
    let body_color = if candle.close > candle.open {
        0xFF00FF00 // Bright green for bullish
    } else {
        0xFFFF0000 // Bright red for bearish
    };
    
    // Draw the wick (thin line from high to low)
    let wick_x = x_center;
    for y in y_high.min(y_low)..=y_high.max(y_low) {
        if y >= 0 && y < height as i32 {
            let idx = (y * width as i32 + wick_x) as usize;
            if idx < buffer.len() {
                buffer[idx] = 0xFFFFFFFF; // White wick
                // Make wick thicker (3 pixels wide)
                if wick_x > 0 {
                    buffer[idx - 1] = 0xFFFFFFFF;
                }
                if wick_x < width as i32 - 1 {
                    buffer[idx + 1] = 0xFFFFFFFF;
                }
            }
        }
    }
    
    // Draw the body (thick rectangle from open to close)
    let body_top = y_open.min(y_close);
    let body_bottom = y_open.max(y_close);
    
    // Make sure body has at least 2 pixels height for visibility
    let body_bottom = body_bottom.max(body_top + 2);
    
    for y in body_top..=body_bottom {
        for x in x_start..=x_end {
            if x >= 0 && x < width as i32 && y >= 0 && y < height as i32 {
                let idx = (y * width as i32 + x) as usize;
                if idx < buffer.len() {
                    buffer[idx] = body_color;
                }
            }
        }
    }
    
    // Draw price labels on the right
    let label_x = width - 100;
    let label_y_offset = 20;
    
    // Helper to draw text (simple representation)
    let draw_label = |buffer: &mut Vec<u32>, x: usize, y: usize, width: usize, color: u32| {
        if y < height && x < width {
            // Draw a small rectangle to represent text
            for dy in 0..10 {
                for dx in 0..80 {
                    let px = x + dx;
                    let py = y + dy;
                    if px < width && py < height {
                        if dy < 2 || dy > 7 || dx < 2 || dx > 77 {
                            buffer[py * width + px] = color;
                        }
                    }
                }
            }
        }
    };
    
    // Draw OHLC values as labels
    draw_label(buffer, label_x, label_y_offset, width, text_color);
    draw_label(buffer, label_x, label_y_offset + 30, width, text_color);
    draw_label(buffer, label_x, label_y_offset + 60, width, text_color);
    draw_label(buffer, label_x, label_y_offset + 90, width, text_color);
    
    // Draw a border around the entire window
    for x in 0..width {
        buffer[x] = 0xFF444444;
        buffer[(height - 1) * width + x] = 0xFF444444;
    }
    for y in 0..height {
        buffer[y * width] = 0xFF444444;
        buffer[y * width + width - 1] = 0xFF444444;
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();
    
    println!("Starting Simple Candle Demo with VISIBLE CANDLE...");
    println!("You will see:");
    println!("- A dark gray window");
    println!("- A candle chart in the center");
    println!("- Green candle = price going up");
    println!("- Red candle = price going down");
    println!("- White line = high/low wick");
    
    const WIDTH: usize = 800;
    const HEIGHT: usize = 600;
    
    let mut window = Window::new(
        "Rust Candle Demo - YOU CAN SEE THE CANDLE!",
        WIDTH,
        HEIGHT,
        WindowOptions::default(),
    ).expect("Failed to create window");
    
    // Limit to 60 FPS
    window.limit_update_rate(Some(std::time::Duration::from_millis(16)));
    
    // Buffer for drawing
    let mut buffer: Vec<u32> = vec![0; WIDTH * HEIGHT];
    
    // Initial candle data (BTC around $100k)
    let candle_data = Arc::new(Mutex::new(Candle {
        open: 100000.0,
        high: 101000.0,
        low: 99000.0,
        close: 100500.0,
        volume: 1.0,
    }));
    
    // Channel for WebSocket -> UI
    let (tx, mut rx) = mpsc::channel::<Candle>(8);
    
    // Spawn WebSocket task
    tokio::spawn(async move {
        websocket_task(tx).await;
    });
    
    println!("Window is open! Look for the candle in the center!");
    
    // Main loop
    while window.is_open() && !window.is_key_down(Key::Escape) {
        // Check for new candle data
        while let Ok(new_candle) = rx.try_recv() {
            if let Ok(mut candle) = candle_data.lock() {
                *candle = new_candle;
                
                // Update window title
                let title = format!(
                    "BTC ${:.0} | O:${:.0} H:${:.0} L:${:.0} C:${:.0} | {}",
                    candle.close,
                    candle.open,
                    candle.high,
                    candle.low,
                    candle.close,
                    if candle.close > candle.open { "🟢 UP" } else { "🔴 DOWN" }
                );
                window.set_title(&title);
            }
        }
        
        // Draw the candle
        if let Ok(candle) = candle_data.lock() {
            draw_candle(&mut buffer, &candle, WIDTH, HEIGHT);
        }
        
        // Update window
        window
            .update_with_buffer(&buffer, WIDTH, HEIGHT)
            .expect("Failed to update window");
    }
    
    println!("Window closed");
}