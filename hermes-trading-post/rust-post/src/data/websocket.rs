//! WebSocket data feeds for real-time market data

use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tokio::sync::mpsc;
use crate::data::market::{MarketData, Trade, OrderBookSnapshot};

pub struct WebSocketManager {
    pub tx: Option<mpsc::UnboundedSender<MarketDataEvent>>,
}

#[derive(Debug, Clone)]
pub enum MarketDataEvent {
    PriceUpdate(MarketData),
    TradeUpdate(Trade),
    OrderBookUpdate(OrderBookSnapshot),
    ConnectionStatus(bool),
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self { tx: None }
    }
    
    pub async fn start_coinbase_feed(&mut self) -> Result<mpsc::UnboundedReceiver<MarketDataEvent>, Box<dyn std::error::Error>> {
        let (tx, rx) = mpsc::unbounded_channel();
        self.tx = Some(tx.clone());
        
        tokio::spawn(async move {
            if let Err(e) = Self::coinbase_websocket_loop(tx).await {
                log::error!("WebSocket error: {}", e);
            }
        });
        
        Ok(rx)
    }
    
    async fn coinbase_websocket_loop(tx: mpsc::UnboundedSender<MarketDataEvent>) -> Result<(), Box<dyn std::error::Error>> {
        let url = "wss://ws-feed.exchange.coinbase.com";
        
        loop {
            match connect_async(url).await {
                Ok((ws_stream, _)) => {
                    log::info!("🔗 Connected to Coinbase WebSocket");
                    let _ = tx.send(MarketDataEvent::ConnectionStatus(true));
                    
                    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
                    
                    // Subscribe to BTC-USD ticker
                    let subscribe_msg = serde_json::json!({
                        "type": "subscribe",
                        "product_ids": ["BTC-USD"],
                        "channels": ["ticker", "level2_batch"]
                    });
                    
                    if let Err(e) = ws_sender.send(Message::Text(subscribe_msg.to_string())).await {
                        log::error!("Failed to send subscribe message: {}", e);
                        continue;
                    }
                    
                    // Process incoming messages
                    while let Some(msg) = ws_receiver.next().await {
                        match msg {
                            Ok(Message::Text(text)) => {
                                if let Ok(data) = serde_json::from_str::<Value>(&text) {
                                    Self::process_coinbase_message(&tx, data).await;
                                }
                            }
                            Ok(Message::Close(_)) => {
                                log::warn!("WebSocket connection closed");
                                break;
                            }
                            Err(e) => {
                                log::error!("WebSocket error: {}", e);
                                break;
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to connect to WebSocket: {}", e);
                    let _ = tx.send(MarketDataEvent::ConnectionStatus(false));
                }
            }
            
            // Reconnect after 5 seconds
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    }
    
    async fn process_coinbase_message(tx: &mpsc::UnboundedSender<MarketDataEvent>, data: Value) {
        if let Some(msg_type) = data.get("type").and_then(|v| v.as_str()) {
            match msg_type {
                "ticker" => {
                    if let Some(market_data) = Self::parse_ticker_message(data) {
                        let _ = tx.send(MarketDataEvent::PriceUpdate(market_data));
                    }
                }
                "l2update" => {
                    if let Some(order_book) = Self::parse_order_book_message(data) {
                        let _ = tx.send(MarketDataEvent::OrderBookUpdate(order_book));
                    }
                }
                _ => {}
            }
        }
    }
    
    fn parse_ticker_message(data: Value) -> Option<MarketData> {
        let symbol = data.get("product_id")?.as_str()?.to_string();
        let price = data.get("price")?.as_str()?.parse::<f64>().ok()?;
        let volume_24h = data.get("volume_24h")?.as_str()?.parse::<f64>().ok()?;
        
        Some(MarketData {
            symbol,
            price,
            volume_24h,
            price_change_24h: 0.0, // Would need to calculate
            price_change_percent_24h: 0.0, // Would need to calculate
            market_cap: None,
            last_updated: chrono::Utc::now(),
        })
    }
    
    fn parse_order_book_message(data: Value) -> Option<OrderBookSnapshot> {
        let symbol = data.get("product_id")?.as_str()?.to_string();
        
        // This is a simplified version - real implementation would be more complex
        Some(OrderBookSnapshot {
            symbol,
            timestamp: chrono::Utc::now(),
            bids: Vec::new(),
            asks: Vec::new(),
        })
    }
}