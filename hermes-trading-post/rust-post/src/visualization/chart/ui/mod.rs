// UI module for future expansion
// Currently using simple console output, but can be extended with egui or other UI frameworks

use crate::data::Candle;

pub fn print_trading_info(candle: &Candle, fps: u32, candle_count: usize) {
    if fps % 60 == 0 { // Print every 60 frames to avoid spam
        let price_change = candle.close - candle.open;
        let percent_change = (price_change / candle.open) * 100.0;
        
        println!(
            "📊 Trading Info | Price: ${:.2} | Change: {:.2}% | FPS: {} | Candles: {}", 
            candle.close, percent_change, fps, candle_count
        );
    }
}

pub fn format_window_title(candle: &Candle) -> String {
    let price_change_pct = candle.percentage_change();
    let direction_emoji = if candle.is_bullish() { 
        "🟢" 
    } else if candle.is_bearish() { 
        "🔴" 
    } else { 
        "⚪" 
    };
    
    format!(
        "🚀 3D BTC Chart | ${:.2} ({:+.2}%) {}",
        candle.close,
        price_change_pct,
        direction_emoji
    )
}