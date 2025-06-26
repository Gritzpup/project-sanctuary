#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::process::Command;

#[derive(Clone, serde::Serialize)]
struct PriceUpdate {
    price: f64,
    change: f64,
    timestamp: u64,
}

// Shared state for the application
#[derive(Default)]
struct AppState {
    current_price: Arc<Mutex<Option<f64>>>,
}

#[tauri::command]
async fn get_current_price(state: tauri::State<'_, AppState>) -> Result<Option<f64>, ()> {
    let price = state.current_price.lock().await;
    Ok(*price)
}

#[tauri::command]
async fn launch_btc_chart() -> Result<String, String> {
    println!("🚀 Launching BTC Chart...");
    
    // Get the path to the btc-chart binary
    let btc_chart_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?
        .parent()
        .ok_or("Failed to get parent directory")?
        .join("btc-chart");
    
    // Try to launch the chart
    let result = if cfg!(target_os = "windows") {
        Command::new(&btc_chart_path.with_extension("exe"))
            .spawn()
    } else {
        Command::new(&btc_chart_path)
            .spawn()
    };
    
    match result {
        Ok(_child) => {
            println!("✅ BTC Chart launched successfully");
            Ok("Chart launched successfully".to_string())
        }
        Err(e) => {
            println!("❌ Failed to launch BTC Chart: {}", e);
            
            // Fallback: try to run from components directory
            let fallback_path = std::env::current_dir()
                .map_err(|e| format!("Failed to get current dir: {}", e))?
                .join("src")
                .join("components")
                .join("btc-chart");
            
            println!("🔄 Trying fallback path: {:?}", fallback_path);
            
            let fallback_result = Command::new("cargo")
                .args(&["run", "--bin", "btc-chart"])
                .current_dir(&fallback_path)
                .spawn();
            
            match fallback_result {
                Ok(_) => {
                    println!("✅ BTC Chart launched via fallback");
                    Ok("Chart launched via fallback".to_string())
                }
                Err(fallback_e) => {
                    let error_msg = format!("Failed to launch chart: {} (fallback also failed: {})", e, fallback_e);
                    println!("❌ {}", error_msg);
                    Err(error_msg)
                }
            }
        }
    }
}

#[tauri::command]
async fn set_current_price(price: f64, state: tauri::State<'_, AppState>) -> Result<(), ()> {
    let mut current_price = state.current_price.lock().await;
    *current_price = Some(price);
    Ok(())
}
fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_current_price,
            set_current_price,
            launch_btc_chart
        ])
        .setup(|app| {
            println!("🚀 Starting BTC Trading Dashboard...");
            
            // Setup is complete
            println!("✅ Dashboard ready!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}