// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct TestConfig {
    pub num_prompts: u32,
    pub test_speed: f32,
    pub selected_groups: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestResult {
    pub prompt_id: u32,
    pub prompt: String,
    pub category: String,
    pub personality_group: String,
    pub word_count: u32,
    pub complexity_score: f32,
    pub sentiment_score: f32,
    pub formality_score: f32,
    pub collaboration_indicators: u32,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestProgress {
    pub current_test: u32,
    pub total_tests: u32,
    pub current_prompt: String,
    pub current_category: String,
}

// Tauri command to start the Python backend server
#[tauri::command]
async fn start_python_backend() -> Result<String, String> {
    // Check if Python backend script exists
    let backend_path = "../behavioral_test_backend.py";
    
    if !Path::new(backend_path).exists() {
        return Err("Python backend script not found".to_string());
    }
    
    // Start Python backend (this would typically run in background)
    match Command::new("python3")
        .arg(backend_path)
        .spawn() {
        Ok(_) => Ok("Backend started successfully".to_string()),
        Err(e) => Err(format!("Failed to start backend: {}", e)),
    }
}

// Tauri command to run behavioral test
#[tauri::command]
async fn run_behavioral_test(config: TestConfig) -> Result<Vec<TestResult>, String> {
    // In a real implementation, this would communicate with the Python backend
    // For now, we'll simulate the test results
    
    let mut results = Vec::new();
    let personality_groups = vec!["Control", "High Conscientiousness", "High Openness", "High Extraversion"];
    
    // Simulate test execution
    for prompt_id in 0..config.num_prompts {
        for (group_idx, group) in personality_groups.iter().enumerate() {
            if config.selected_groups.contains(&group.to_string()) {
                let result = TestResult {
                    prompt_id,
                    prompt: format!("Test prompt {}", prompt_id + 1),
                    category: "simulation".to_string(),
                    personality_group: group.to_string(),
                    word_count: 100 + (group_idx as u32 * 25),
                    complexity_score: 5.0 + (group_idx as f32 * 1.5),
                    sentiment_score: -0.2 + (group_idx as f32 * 0.2),
                    formality_score: 0.3 + (group_idx as f32 * 0.15),
                    collaboration_indicators: 2 + (group_idx as u32),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                };
                results.push(result);
            }
        }
    }
    
    Ok(results)
}

// Tauri command to get test progress
#[tauri::command]
async fn get_test_progress() -> Result<TestProgress, String> {
    // This would typically query the Python backend for real progress
    Ok(TestProgress {
        current_test: 5,
        total_tests: 20,
        current_prompt: "How would you approach debugging a complex software issue?".to_string(),
        current_category: "problem_solving".to_string(),
    })
}

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_python_backend,
            run_behavioral_test,
            get_test_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}