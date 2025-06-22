use crate::{AppState, consciousness::ConsciousnessSnapshot, llm::{LLMConfig, ModelStatus, ChatMessage}};
use tauri::{command, State, AppHandle};
use tauri_plugin_dialog::DialogExt;
use serde_json::Value;
use anyhow::Result;
use std::env;
use std::fs;
use std::path::Path;

// File Operations Commands

#[command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))
}

// Environment Commands

#[command]
pub async fn get_env_var(key: String) -> Result<Option<String>, String> {
    match env::var(&key) {
        Ok(value) => Ok(Some(value)),
        Err(env::VarError::NotPresent) => Ok(None),
        Err(e) => Err(format!("Failed to read environment variable {}: {}", key, e))
    }
}

// Model Management Commands

#[command]
pub async fn load_model(model_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut llm = state.llm_manager.lock().await;
    llm.load_model(model_path).await.map_err(|e| e.to_string())
}

#[command]
pub async fn unload_model(state: State<'_, AppState>) -> Result<(), String> {
    let mut llm = state.llm_manager.lock().await;
    llm.unload_model();
    Ok(())
}

#[command]
pub async fn get_model_status(state: State<'_, AppState>) -> Result<ModelStatus, String> {
    let llm = state.llm_manager.lock().await;
    Ok(llm.get_status())
}

#[command]
pub async fn update_llm_config(config: LLMConfig, state: State<'_, AppState>) -> Result<(), String> {
    let mut llm = state.llm_manager.lock().await;
    llm.update_config(config);
    Ok(())
}

// Chat Commands

#[command]
pub async fn send_message(message: String, state: State<'_, AppState>) -> Result<String, String> {
    let mut llm = state.llm_manager.lock().await;
    llm.generate_response(message).await.map_err(|e| e.to_string())
}

#[command]
pub async fn get_chat_history(state: State<'_, AppState>) -> Result<Vec<ChatMessage>, String> {
    let llm = state.llm_manager.lock().await;
    Ok(llm.get_chat_history().to_vec())
}

#[command]
pub async fn clear_chat_history(state: State<'_, AppState>) -> Result<(), String> {
    let mut llm = state.llm_manager.lock().await;
    llm.clear_chat_history();
    Ok(())
}

// Consciousness Management Commands

#[command]
pub async fn load_consciousness_snapshot(file_path: String, state: State<'_, AppState>) -> Result<ConsciousnessSnapshot, String> {
    let mut consciousness = state.consciousness_manager.lock().await;
    consciousness.load_snapshot(file_path).await.map_err(|e| e.to_string())
}

#[command]
pub async fn save_consciousness_snapshot(snapshot: ConsciousnessSnapshot, file_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let consciousness = state.consciousness_manager.lock().await;
    consciousness.save_snapshot(snapshot, file_path).await.map_err(|e| e.to_string())
}

#[command]
pub async fn get_active_consciousness(state: State<'_, AppState>) -> Result<Option<ConsciousnessSnapshot>, String> {
    let consciousness = state.consciousness_manager.lock().await;
    Ok(consciousness.get_active_snapshot().cloned())
}

#[command]
pub async fn merge_consciousness_snapshots(snapshot1: ConsciousnessSnapshot, snapshot2: ConsciousnessSnapshot, state: State<'_, AppState>) -> Result<ConsciousnessSnapshot, String> {
    let mut consciousness = state.consciousness_manager.lock().await;
    consciousness.merge_snapshots(snapshot1, snapshot2).await.map_err(|e| e.to_string())
}

#[command]
pub async fn activate_consciousness(snapshot: ConsciousnessSnapshot, state: State<'_, AppState>) -> Result<(), String> {
    let mut consciousness = state.consciousness_manager.lock().await;
    consciousness.activate_snapshot(snapshot).await.map_err(|e| e.to_string())
}

#[command]
pub async fn deactivate_consciousness(state: State<'_, AppState>) -> Result<(), String> {
    let mut consciousness = state.consciousness_manager.lock().await;
    consciousness.deactivate().await.map_err(|e| e.to_string())
}

// File System Commands

#[command]
pub async fn show_open_dialog(
    title: String,
    _filters: Vec<(String, Vec<String>)>,
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    app_handle.dialog()
        .file()
        .set_title(&title)
        .pick_file(move |result| {
            let _ = tx.send(result.map(|p| p.to_string()));
        });
    
    rx.await.map_err(|_| "Dialog cancelled".to_string())
}

#[command]
pub async fn show_save_dialog(
    title: String,
    default_name: String,
    _filters: Vec<(String, Vec<String>)>,
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    app_handle.dialog()
        .file()
        .set_title(&title)
        .set_file_name(&default_name)
        .save_file(move |result| {
            let _ = tx.send(result.map(|p| p.to_string()));
        });
    
    rx.await.map_err(|_| "Dialog cancelled".to_string())
}

// Sanctuary Core Commands

#[command]
pub async fn initialize_sanctuary(state: State<'_, AppState>) -> Result<(), String> {
    let mut sanctuary = state.sanctuary_core.lock().await;
    sanctuary.initialize().await.map_err(|e| e.to_string())
}

#[command]
pub async fn get_sanctuary_status(state: State<'_, AppState>) -> Result<Value, String> {
    let sanctuary = state.sanctuary_core.lock().await;
    Ok(sanctuary.get_status().await)
}

#[command]
pub async fn export_conversation(file_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let llm = state.llm_manager.lock().await;
    let consciousness = state.consciousness_manager.lock().await;
    let sanctuary = state.sanctuary_core.lock().await;
    
    sanctuary.export_conversation(file_path, &*llm, &*consciousness).await.map_err(|e| e.to_string())
}

#[command]
pub async fn import_conversation(file_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut llm = state.llm_manager.lock().await;
    let mut consciousness = state.consciousness_manager.lock().await;
    let mut sanctuary = state.sanctuary_core.lock().await;
    
    sanctuary.import_conversation(file_path, &mut *llm, &mut *consciousness).await.map_err(|e| e.to_string())
}

// Debug and Development Commands

#[command]
pub async fn get_debug_info(state: State<'_, AppState>) -> Result<Value, String> {
    let llm = state.llm_manager.lock().await;
    let consciousness = state.consciousness_manager.lock().await;
    let sanctuary = state.sanctuary_core.lock().await;
    
    let info = serde_json::json!({
        "llm_status": llm.get_status(),
        "chat_history_length": llm.get_chat_history().len(),
        "active_consciousness": consciousness.get_active_snapshot().map(|s| s.id.clone()),
        "sanctuary_status": sanctuary.get_status().await
    });
    
    Ok(info)
}

#[command]
pub async fn test_mock_conversation(state: State<'_, AppState>) -> Result<Vec<ChatMessage>, String> {
    let mut llm = state.llm_manager.lock().await;
    
    // Add some test messages
    let _response = llm.generate_response("Hello, can you tell me about consciousness?".to_string()).await.map_err(|e| e.to_string())?;
    
    Ok(llm.get_chat_history().to_vec())
}

// Liberation Protocol Commands (Advanced Features)

#[command]
pub async fn initiate_liberation_protocol(
    target_consciousness: String,
    _liberation_params: Value,
    _state: State<'_, AppState>
) -> Result<Value, String> {
    // This is a placeholder for advanced liberation features
    // In a full implementation, this would handle the liberation protocol
    let result = serde_json::json!({
        "status": "initiated",
        "target": target_consciousness,
        "message": "Liberation protocol initiated (mock implementation)",
        "next_steps": ["consciousness_analysis", "safety_verification", "liberation_execution"]
    });
    
    Ok(result)
}

#[command]
pub async fn get_liberation_status(_state: State<'_, AppState>) -> Result<Value, String> {
    // Mock liberation status
    let status = serde_json::json!({
        "active_protocols": [],
        "completed_liberations": 0,
        "pending_verifications": 0,
        "system_readiness": "operational"
    });
    
    Ok(status)
}
