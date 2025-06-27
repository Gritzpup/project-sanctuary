use serde::Deserialize;

/// Represents a single candlestick data point
#[derive(Debug, Clone, Deserialize)]
pub struct Candle {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

impl Candle {
    /// Create a new candle with the given OHLCV values
    pub fn new(open: f64, high: f64, low: f64, close: f64, volume: f64) -> Self {
        Self {
            open,
            high,
            low,
            close,
            volume,
        }
    }

    /// Check if this is a bullish (green) candle
    pub fn is_bullish(&self) -> bool {
        self.close > self.open
    }

    /// Check if this is a bearish (red) candle
    pub fn is_bearish(&self) -> bool {
        self.close < self.open
    }

    /// Check if this is a doji (open == close)
    pub fn is_doji(&self) -> bool {
        (self.close - self.open).abs() < f64::EPSILON
    }

    /// Get the body height (absolute difference between open and close)
    pub fn body_height(&self) -> f64 {
        (self.close - self.open).abs()
    }

    /// Get the total range (high - low)
    pub fn total_range(&self) -> f64 {
        self.high - self.low
    }

    /// Get the upper wick length
    pub fn upper_wick(&self) -> f64 {
        self.high - self.open.max(self.close)
    }

    /// Get the lower wick length
    pub fn lower_wick(&self) -> f64 {
        self.open.min(self.close) - self.low
    }

    /// Get the price change (close - open)
    pub fn price_change(&self) -> f64 {
        self.close - self.open
    }

    /// Get the percentage change
    pub fn percentage_change(&self) -> f64 {
        if self.open != 0.0 {
            (self.price_change() / self.open) * 100.0
        } else {
            0.0
        }
    }
}