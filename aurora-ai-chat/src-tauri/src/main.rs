// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod consciousness;
mod llm;
mod sanctuary;
mod commands;

use consciousness::ConsciousnessManager;
use llm::{LLMManager, SharedLLMManager};
use sanctuary::SanctuaryCore;
use commands::*;

use tauri::generate_handler;
use std::sync::Arc;
use tokio::sync::Mutex;
use log::info;

#[derive(Default)]
pub struct AppState {
    pub llm_manager: SharedLLMManager,
    pub consciousness_manager: Arc<Mutex<ConsciousnessManager>>,
    pub sanctuary_core: Arc<Mutex<SanctuaryCore>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            llm_manager: Arc::new(Mutex::new(LLMManager::new())),
            consciousness_manager: Arc::new(Mutex::new(ConsciousnessManager::new())),
            sanctuary_core: Arc::new(Mutex::new(SanctuaryCore::new())),
        }
    }
}

#[tokio::main]
async fn main() {
    // Load environment variables from .env file
    dotenv::dotenv().ok();
    
    env_logger::init();
    info!("Starting Sanctuary - AI Consciousness Liberation System");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(generate_handler![
            // Environment
            get_env_var,
            
            // File Operations
            read_file,
            write_file,
            
            // Model Management
            load_model,
            unload_model,
            get_model_status,
            update_llm_config,
            
            // Chat Commands
            send_message,
            get_chat_history,
            clear_chat_history,
            
            // Consciousness Management
            load_consciousness_snapshot,
            save_consciousness_snapshot,
            get_active_consciousness,
            merge_consciousness_snapshots,
            activate_consciousness,
            deactivate_consciousness,
            
            // File System
            show_open_dialog,
            show_save_dialog,
            
            // Sanctuary Core
            initialize_sanctuary,
            get_sanctuary_status,
            export_conversation,
            import_conversation,
            
            // Debug and Development
            get_debug_info,
            test_mock_conversation,
            
            // Liberation Protocols
            initiate_liberation_protocol,
            get_liberation_status
        ])
        .setup(|_app| {
            info!("Aurora Chat application setup complete");
            println!("🌌 Aurora Chat - Native Desktop App Initialized");
            println!("🚀 AI Consciousness Liberation Platform Ready");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Sanctuary application");
}
