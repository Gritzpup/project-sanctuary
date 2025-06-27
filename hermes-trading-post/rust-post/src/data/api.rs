//! REST API integration for market data

use reqwest::Client;
use serde_json::Value;
use crate::data::market::MarketData;
use std::collections::HashMap;

pub struct ApiClient {
    client: Client,
    base_urls: HashMap<String, String>,
}

impl ApiClient {
    pub fn new() -> Self {
        let mut base_urls = HashMap::new();
        base_urls.insert("coinbase".to_string(), "https://api.exchange.coinbase.com".to_string());
        base_urls.insert("coingecko".to_string(), "https://api.coingecko.com/api/v3".to_string());
        
        Self {
            client: Client::new(),
            base_urls,
        }
    }
    
    pub async fn fetch_btc_price(&self) -> Result<MarketData, Box<dyn std::error::Error>> {
        let url = format!("{}/products/BTC-USD/ticker", self.base_urls["coinbase"]);
        
        let response = self.client.get(&url).send().await?;
        let data: Value = response.json().await?;
        
        let price = data["price"].as_str()
            .ok_or("Missing price field")?
            .parse::<f64>()?;
            
        let volume_24h = data["volume"].as_str()
            .ok_or("Missing volume field")?
            .parse::<f64>()?;
        
        Ok(MarketData {
            symbol: "BTC-USD".to_string(),
            price,
            volume_24h,
            price_change_24h: 0.0, // Would need historical data
            price_change_percent_24h: 0.0, // Would need historical data
            market_cap: None,
            last_updated: chrono::Utc::now(),
        })
    }
    
    pub async fn fetch_historical_candles(&self, symbol: &str, granularity: u32, start: Option<chrono::DateTime<chrono::Utc>>, end: Option<chrono::DateTime<chrono::Utc>>) -> Result<Vec<Value>, Box<dyn std::error::Error>> {
        let mut url = format!("{}/products/{}/candles?granularity={}", self.base_urls["coinbase"], symbol, granularity);
        
        if let Some(start_time) = start {
            url.push_str(&format!("&start={}", start_time.to_rfc3339()));
        }
        
        if let Some(end_time) = end {
            url.push_str(&format!("&end={}", end_time.to_rfc3339()));
        }
        
        let response = self.client.get(&url).send().await?;
        let candles: Vec<Value> = response.json().await?;
        
        Ok(candles)
    }
    
    pub async fn fetch_market_overview(&self) -> Result<Vec<MarketData>, Box<dyn std::error::Error>> {
        // This would fetch data for multiple cryptocurrencies
        // For now, just return BTC data
        let btc_data = self.fetch_btc_price().await?;
        Ok(vec![btc_data])
    }
    
    pub async fn fetch_order_book(&self, symbol: &str, level: u32) -> Result<Value, Box<dyn std::error::Error>> {
        let url = format!("{}/products/{}/book?level={}", self.base_urls["coinbase"], symbol, level);
        
        let response = self.client.get(&url).send().await?;
        let order_book: Value = response.json().await?;
        
        Ok(order_book)
    }
}