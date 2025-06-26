mod websocket;

use serde::Deserialize;

pub use websocket::{fetch_historical_candles, start_websocket_with_reconnect};

#[derive(Debug, Clone, Deserialize)]
pub struct Candle {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub _volume: f64,
}

impl Candle {
    pub fn new(open: f64, high: f64, low: f64, close: f64, volume: f64) -> Self {
        Self {
            open,
            high,
            low,
            close,
            _volume: volume,
        }
    }

    pub fn is_bullish(&self) -> bool {
        self.close > self.open
    }

    pub fn is_bearish(&self) -> bool {
        self.close < self.open
    }

    pub fn percentage_change(&self) -> f64 {
        ((self.close - self.open) / self.open) * 100.0
    }
}

#[derive(Debug)]
pub enum CandleUpdate {
    LiveUpdate(Candle),
    NewMinuteCandle(Candle),
}