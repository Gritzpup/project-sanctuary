//! Market Heatmap Floor Visualization

use crate::core::types::{Vec3, Color};

pub struct MarketHeatmap {
    pub grid_size: (u32, u32),
    pub cell_size: f32,
    pub height_scale: f32,
    pub cells: Vec<HeatmapCell>,
    pub position: Vec3,
}

#[derive(Debug, Clone)]
pub struct HeatmapCell {
    pub symbol: String,
    pub price_change: f64,
    pub volume: f64,
    pub position: Vec3,
    pub height: f32,
    pub color: Color,
}

impl MarketHeatmap {
    pub fn new(grid_size: (u32, u32), cell_size: f32) -> Self {
        let mut cells = Vec::new();
        
        // Create grid of cells
        for x in 0..grid_size.0 {
            for z in 0..grid_size.1 {
                let position = Vec3::new(
                    (x as f32 - grid_size.0 as f32 * 0.5) * cell_size,
                    0.0,
                    (z as f32 - grid_size.1 as f32 * 0.5) * cell_size,
                );
                
                cells.push(HeatmapCell {
                    symbol: format!("CELL_{}{}", x, z),
                    price_change: 0.0,
                    volume: 0.0,
                    position,
                    height: 0.1,
                    color: Color::new(0.2, 0.2, 0.8, 0.8),
                });
            }
        }
        
        Self {
            grid_size,
            cell_size,
            height_scale: 2.0,
            cells,
            position: Vec3::new(0.0, -5.0, 0.0),
        }
    }
    
    pub fn update(&mut self, _dt: f32) {
        // Update heatmap based on market data
        for cell in &mut self.cells {
            // Color based on price change
            let intensity = (cell.price_change.abs() as f32 * 10.0).clamp(0.0, 1.0);
            if cell.price_change > 0.0 {
                cell.color = Color::new(0.0, intensity, 0.0, 0.8); // Green for gains
            } else {
                cell.color = Color::new(intensity, 0.0, 0.0, 0.8); // Red for losses
            }
            
            // Height based on volume
            cell.height = 0.1 + (cell.volume as f32 * 0.001).clamp(0.0, 3.0);
        }
    }
    
    pub fn update_market_data(&mut self, symbol: &str, price_change: f64, volume: f64) {
        if let Some(cell) = self.cells.iter_mut().find(|c| c.symbol.contains(symbol)) {
            cell.price_change = price_change;
            cell.volume = volume;
        }
    }
}