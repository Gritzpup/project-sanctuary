//! Application state management

use std::sync::{Arc, RwLock};
use tokio::sync::mpsc;
use crate::data::{
    market::{MarketDataManager, MarketData, Trade},
    websocket::{WebSocketManager, MarketDataEvent},
    api::ApiClient,
};

pub struct AppState {
    pub market_data: Arc<RwLock<MarketDataManager>>,
    pub websocket: WebSocketManager,
    pub api_client: ApiClient,
    pub event_receiver: Option<mpsc::UnboundedReceiver<MarketDataEvent>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            market_data: Arc::new(RwLock::new(MarketDataManager::new())),
            websocket: WebSocketManager::new(),
            api_client: ApiClient::new(),
            event_receiver: None,
        }
    }
    
    pub async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("🔄 Initializing application state...");
        
        // Start WebSocket feeds
        self.event_receiver = Some(self.websocket.start_coinbase_feed().await?);
        
        // Fetch initial market data
        if let Ok(btc_data) = self.api_client.fetch_btc_price().await {
            if let Ok(mut market_data) = self.market_data.write() {
                market_data.update_price("BTC-USD".to_string(), btc_data);
            }
        }
        
        log::info!("✅ Application state initialized");
        Ok(())
    }
    
    pub async fn update(&mut self) {
        // Process WebSocket events
        let mut events = Vec::new();
        if let Some(ref mut receiver) = self.event_receiver {
            while let Ok(event) = receiver.try_recv() {
                events.push(event);
            }
        }
        
        for event in events {
            self.handle_market_event(event).await;
        }
    }
    
    async fn handle_market_event(&self, event: MarketDataEvent) {
        if let Ok(mut market_data) = self.market_data.write() {
            match event {
                MarketDataEvent::PriceUpdate(data) => {
                    market_data.update_price(data.symbol.clone(), data);
                }
                MarketDataEvent::TradeUpdate(trade) => {
                    market_data.add_trade(trade);
                }
                MarketDataEvent::OrderBookUpdate(order_book) => {
                    market_data.update_order_book(order_book.symbol.clone(), order_book);
                }
                MarketDataEvent::ConnectionStatus(connected) => {
                    log::info!("📡 WebSocket connection status: {}", if connected { "Connected" } else { "Disconnected" });
                }
            }
        }
    }
    
    pub fn get_btc_price(&self) -> Option<f64> {
        if let Ok(market_data) = self.market_data.read() {
            market_data.get_price("BTC-USD").map(|data| data.price)
        } else {
            None
        }
    }
    
    pub fn get_market_data(&self, symbol: &str) -> Option<MarketData> {
        if let Ok(market_data) = self.market_data.read() {
            market_data.get_price(symbol).cloned()
        } else {
            None
        }
    }
    
    pub fn get_recent_trades(&self) -> Vec<Trade> {
        if let Ok(market_data) = self.market_data.read() {
            market_data.recent_trades.clone()
        } else {
            Vec::new()
        }
    }
}