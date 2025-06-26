use reqwest;
use serde_json::Value;
use crate::data::candle::Candle;

/// Fetch historical candles from Coinbase REST API
pub async fn fetch_historical_candles() -> Result<Vec<Candle>, Box<dyn std::error::Error>> {
    // Use Coinbase Exchange API (public endpoint)
    // Granularity: 60 = 1 minute candles
    let url = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60";
    let client = reqwest::Client::new();
    
    let resp = client
        .get(url)
        .header("User-Agent", "btc-chart/1.0")
        .send()
        .await?
        .text()
        .await?;
    
    // Coinbase Exchange returns: [[time, low, high, open, close, volume], ...]
    let json: Value = serde_json::from_str(&resp)?;
    let mut candles = Vec::new();
    
    if let Some(arr) = json.as_array() {
        for entry in arr {
            if let Some(vals) = entry.as_array() {
                if vals.len() >= 6 {
                    candles.push(Candle::new(
                        vals[3].as_f64().unwrap_or(0.0), // open
                        vals[2].as_f64().unwrap_or(0.0), // high
                        vals[1].as_f64().unwrap_or(0.0), // low
                        vals[4].as_f64().unwrap_or(0.0), // close
                        vals[5].as_f64().unwrap_or(0.0), // volume
                    ));
                }
            }
        }
    }
    
    // Reverse to get chronological order (API returns newest first)
    candles.reverse();
    log::info!("Fetched {} historical candles from Coinbase API", candles.len());
    
    Ok(candles)
}

/// Supported timeframes for historical data
#[derive(Debug, Clone, Copy)]
pub enum Timeframe {
    OneMinute = 60,
    FiveMinutes = 300,
    FifteenMinutes = 900,
    OneHour = 3600,
    SixHours = 21600,
    OneDay = 86400,
}

impl Timeframe {
    pub fn to_seconds(self) -> u32 {
        self as u32
    }
    
    pub fn to_string(self) -> &'static str {
        match self {
            Timeframe::OneMinute => "1m",
            Timeframe::FiveMinutes => "5m",
            Timeframe::FifteenMinutes => "15m",
            Timeframe::OneHour => "1h",
            Timeframe::SixHours => "6h",
            Timeframe::OneDay => "1d",
        }
    }
}

/// Fetch historical candles with specific timeframe
pub async fn fetch_historical_candles_timeframe(
    timeframe: Timeframe,
) -> Result<Vec<Candle>, Box<dyn std::error::Error>> {
    let url = format!(
        "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity={}",
        timeframe.to_seconds()
    );
    
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "btc-chart/1.0")
        .send()
        .await?
        .text()
        .await?;
    
    let json: Value = serde_json::from_str(&resp)?;
    let mut candles = Vec::new();
    
    if let Some(arr) = json.as_array() {
        for entry in arr {
            if let Some(vals) = entry.as_array() {
                if vals.len() >= 6 {
                    candles.push(Candle::new(
                        vals[3].as_f64().unwrap_or(0.0),
                        vals[2].as_f64().unwrap_or(0.0),
                        vals[1].as_f64().unwrap_or(0.0),
                        vals[4].as_f64().unwrap_or(0.0),
                        vals[5].as_f64().unwrap_or(0.0),
                    ));
                }
            }
        }
    }
    
    candles.reverse();
    log::info!(
        "Fetched {} historical candles for timeframe {}",
        candles.len(),
        timeframe.to_string()
    );
    
    Ok(candles)
}