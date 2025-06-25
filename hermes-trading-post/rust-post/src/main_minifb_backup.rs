//! Fast Rust+minifb+WebSocket candle demo (Coinbase live)
//! - Connects to Coinbase WebSocket
//! - Receives candle data
//! - Draws a single candle in a window, updating in real time

use std::sync::{Arc, Mutex};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use minifb::{Key, Window, WindowOptions};

const WIDTH: usize = 800;
const HEIGHT: usize = 600;

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
    let (ws_stream, _) = connect_async(url).await.expect("Failed to connect");
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
    write.send(Message::Text(subscribe_msg.to_string())).await.unwrap();

    while let Some(msg) = read.next().await {
        if let Ok(msg) = msg {
            if let Message::Text(txt) = msg {
                if let Ok(json) = serde_json::from_str::<Value>(&txt) {
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
                                let _ = tx.send(candle).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- Draw candle to buffer ---
fn draw_candle(buffer: &mut Vec<u32>, candle: &Candle) {
    // Clear to black
    buffer.fill(0xFF000000);
    
    // Use a fixed price range for BTC (e.g., $90k to $110k) for stable display
    let min_price = 90000.0;
    let max_price = 110000.0;
    let price_range = max_price - min_price;
    
    let candle_width = 40;
    let x_center = WIDTH / 2;
    let x_start = x_center - candle_width / 2;
    let x_end = x_center + candle_width / 2;
    
    // Map prices to screen coordinates
    let map_price = |price: f64| -> usize {
        let normalized = (price - min_price) / price_range;
        let y = HEIGHT as f64 * (1.0 - normalized) * 0.8 + HEIGHT as f64 * 0.1;
        y as usize
    };
    
    let y_open = map_price(candle.open);
    let y_close = map_price(candle.close);
    let y_high = map_price(candle.high);
    let y_low = map_price(candle.low);
    
    // Determine candle color (green if close > open, red otherwise)
    let color = if candle.close > candle.open {
        0xFF00FF00 // Green
    } else {
        0xFFFF0000 // Red
    };
    
    // Draw the wick (high to low) - white color
    let wick_x = x_center;
    for y in y_high.min(HEIGHT-1)..=y_low.min(HEIGHT-1) {
        if y < HEIGHT && wick_x < WIDTH {
            buffer[y * WIDTH + wick_x] = 0xFFFFFFFF;
        }
    }
    
    // Draw the body (open to close)
    let body_top = y_open.min(y_close);
    let body_bottom = y_open.max(y_close);
    
    for y in body_top.min(HEIGHT-1)..=body_bottom.min(HEIGHT-1) {
        for x in x_start..=x_end {
            if y < HEIGHT && x < WIDTH {
                buffer[y * WIDTH + x] = color;
            }
        }
    }
    
    // Draw price labels
    draw_text(buffer, 10, 10, &format!("O: ${:.0}", candle.open), 0xFFFFFFFF);
    draw_text(buffer, 10, 30, &format!("H: ${:.0}", candle.high), 0xFFFFFFFF);
    draw_text(buffer, 10, 50, &format!("L: ${:.0}", candle.low), 0xFFFFFFFF);
    draw_text(buffer, 10, 70, &format!("C: ${:.0}", candle.close), 0xFFFFFFFF);
}

// Simple text drawing (just indicators, not actual text rendering)
fn draw_text(buffer: &mut Vec<u32>, x: usize, y: usize, _text: &str, color: u32) {
    // For now, just draw a small indicator square
    for dy in 0..5 {
        for dx in 0..5 {
            let px = x + dx;
            let py = y + dy;
            if px < WIDTH && py < HEIGHT {
                buffer[py * WIDTH + px] = color;
            }
        }
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();
    
    let mut window = Window::new(
        "Rust Candle Fast Render Demo",
        WIDTH,
        HEIGHT,
        WindowOptions::default(),
    ).expect("Failed to create window");

    // Limit to max ~60 fps
    window.limit_update_rate(Some(std::time::Duration::from_micros(16600)));

    let mut buffer: Vec<u32> = vec![0; WIDTH * HEIGHT];

    // Shared state for the latest candle
    let candle_data = Arc::new(Mutex::new(Candle {
        open: 100000.0,
        high: 105000.0,
        low: 95000.0,
        close: 102000.0,
        volume: 1.0,
    }));

    // Channel for WebSocket -> UI
    let (tx, mut rx) = mpsc::channel::<Candle>(8);
    
    let candle_clone = candle_data.clone();
    tokio::spawn(async move {
        websocket_task(tx).await;
    });

    // Run the window event loop
    while window.is_open() && !window.is_key_down(Key::Escape) {
        // Check for new candle data
        while let Ok(new_candle) = rx.try_recv() {
            if let Ok(mut candle) = candle_clone.lock() {
                *candle = new_candle;
                println!("New candle: O:{:.0} H:{:.0} L:{:.0} C:{:.0}", 
                         candle.open, candle.high, candle.low, candle.close);
            }
        }
        
        // Draw current candle
        if let Ok(candle) = candle_data.lock() {
            draw_candle(&mut buffer, &*candle);
        }
        
        // Update window
        window.update_with_buffer(&buffer, WIDTH, HEIGHT).unwrap();
    }
}