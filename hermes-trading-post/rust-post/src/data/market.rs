//! Market data structures and management

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    pub symbol: String,
    pub price: f64,
    pub volume_24h: f64,
    pub price_change_24h: f64,
    pub price_change_percent_24h: f64,
    pub market_cap: Option<f64>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookSnapshot {
    pub symbol: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub bids: Vec<(f64, f64)>, // (price, quantity)
    pub asks: Vec<(f64, f64)>, // (price, quantity)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub symbol: String,
    pub price: f64,
    pub quantity: f64,
    pub side: TradeSide,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TradeSide {
    Buy,
    Sell,
}

pub struct MarketDataManager {
    pub current_prices: HashMap<String, MarketData>,
    pub order_books: HashMap<String, OrderBookSnapshot>,
    pub recent_trades: Vec<Trade>,
    pub subscribers: Vec<String>,
}

impl MarketDataManager {
    pub fn new() -> Self {
        Self {
            current_prices: HashMap::new(),
            order_books: HashMap::new(),
            recent_trades: Vec::new(),
            subscribers: Vec::new(),
        }
    }
    
    pub fn update_price(&mut self, symbol: String, market_data: MarketData) {
        self.current_prices.insert(symbol, market_data);
    }
    
    pub fn update_order_book(&mut self, symbol: String, order_book: OrderBookSnapshot) {
        self.order_books.insert(symbol, order_book);
    }
    
    pub fn add_trade(&mut self, trade: Trade) {
        self.recent_trades.push(trade);
        
        // Keep only last 1000 trades
        if self.recent_trades.len() > 1000 {
            self.recent_trades.remove(0);
        }
    }
    
    pub fn get_price(&self, symbol: &str) -> Option<&MarketData> {
        self.current_prices.get(symbol)
    }
    
    pub fn get_order_book(&self, symbol: &str) -> Option<&OrderBookSnapshot> {
        self.order_books.get(symbol)
    }
}