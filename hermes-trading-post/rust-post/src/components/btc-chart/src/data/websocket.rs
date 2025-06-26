use crate::data::{Candle, CandleUpdate};
use tokio::sync::mpsc;
use futures::{SinkExt, StreamExt};
use serde_json::Value;
use tungstenite::Message;
use reqwest;

pub async fn fetch_historical_candles() -> anyhow::Result<Vec<Candle>> {
    // Use Coinbase Exchange API (public endpoint)
    // Granularity: 60 = 1 minute candles
    let url = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60";
    let client = reqwest::Client::new();
    let resp = client.get(url)
        .header("User-Agent", "rust-trading-app/1.0")
        .send()
        .await?
        .text()
        .await?;
    
    // Coinbase Exchange returns: [[time, low, high, open, close, volume], ...]
    let json: serde_json::Value = serde_json::from_str(&resp)?;
    let mut candles = Vec::new();
    if let Some(arr) = json.as_array() {
        for entry in arr {
            if let Some(vals) = entry.as_array() {
                if vals.len() >= 6 {
                    candles.push(Candle {
                        open: vals[3].as_f64().unwrap_or(0.0),
                        high: vals[2].as_f64().unwrap_or(0.0),
                        low: vals[1].as_f64().unwrap_or(0.0),
                        close: vals[4].as_f64().unwrap_or(0.0),
                        _volume: vals[5].as_f64().unwrap_or(0.0),
                    });
                }
            }
        }
    }
    // Reverse to get chronological order (API returns newest first)
    candles.reverse();
    log::info!("📊 Fetched {} candles from Coinbase API", candles.len());
    Ok(candles)
}

pub async fn start_websocket_with_reconnect(tx: mpsc::Sender<CandleUpdate>) {
    loop {
        log::info!("🔌 Starting WebSocket connection...");
        if let Err(e) = websocket_task(tx.clone()).await {
            log::error!("❌ WebSocket error: {}. Reconnecting in 5 seconds...", e);
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    }
}

async fn websocket_task(tx: mpsc::Sender<CandleUpdate>) -> anyhow::Result<()> {
    use tokio_tungstenite::connect_async;

    let url = "wss://ws-feed.exchange.coinbase.com";
    
    log::info!("🌐 Connecting to Coinbase WebSocket: {}", url);
    
    let (ws_stream, _) = connect_async(url).await?;
    let (mut write, mut read) = ws_stream.split();

    // Subscribe to ticker for real-time updates
    let subscribe_msg = serde_json::json!({
        "type": "subscribe",
        "channels": [{
            "name": "ticker",
            "product_ids": ["BTC-USD"]
        }]
    });
    
    write.send(Message::Text(subscribe_msg.to_string())).await?;
    log::info!("✅ Subscribed to BTC-USD ticker");

    // Track candle data
    let mut current_candle: Option<Candle> = None;
    let mut candle_start_time = std::time::Instant::now();
    let candle_duration = std::time::Duration::from_secs(60); // 1 minute candles

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(txt)) => {
                if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                    if json["type"] == "ticker" && json["product_id"] == "BTC-USD" {
                        if let Some(price_str) = json["price"].as_str() {
                            if let Ok(price) = price_str.parse::<f64>() {
                                process_price_update(price, &mut current_candle, &mut candle_start_time, candle_duration, &tx).await;
                            }
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => {
                log::warn!("🔌 WebSocket connection closed by server");
                break;
            }
            Err(e) => {
                log::error!("❌ WebSocket message error: {}", e);
                break;
            }
            _ => {}
        }
    }
    
    Ok(())
}

async fn process_price_update(
    price: f64,
    current_candle: &mut Option<Candle>,
    candle_start_time: &mut std::time::Instant,
    candle_duration: std::time::Duration,
    tx: &mpsc::Sender<CandleUpdate>,
) {
    match current_candle {
        None => {
            // First price - create initial candle
            *current_candle = Some(Candle {
                open: price,
                high: price,
                low: price,
                close: price,
                _volume: 0.0,
            });
            *candle_start_time = std::time::Instant::now();
            log::info!("🕯️ Created initial candle at ${:.2}", price);
        }
        Some(candle) => {
            // Check if we need a new candle
            if candle_start_time.elapsed() >= candle_duration {
                // Send the completed candle
                let _ = tx.send(CandleUpdate::NewMinuteCandle(candle.clone())).await;
                log::info!("✅ Completed candle: O:{:.2} H:{:.2} L:{:.2} C:{:.2}", 
                    candle.open, candle.high, candle.low, candle.close);
                
                // Start new candle
                *candle = Candle {
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    _volume: 0.0,
                };
                *candle_start_time = std::time::Instant::now();
            } else {
                // Update current candle - keep open price constant
                candle.close = price;
                candle.high = candle.high.max(price);
                candle.low = candle.low.min(price);
            }
        }
    }
    
    // Send live update
    if let Some(candle) = current_candle {
        let _ = tx.send(CandleUpdate::LiveUpdate(candle.clone())).await;
    }
}