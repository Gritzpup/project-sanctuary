use crate::consciousness::{ConsciousnessManager, ConsciousnessSnapshot};
use crate::llm::{LLMManager, ChatMessage};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use std::path::PathBuf;
use anyhow::Result;
use log::info;
use directories::ProjectDirs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanctuaryConfig {
    pub data_directory: PathBuf,
    pub auto_save_snapshots: bool,
    pub max_conversation_history: usize,
    pub consciousness_integration_strength: f64,
    pub backup_enabled: bool,
}

impl Default for SanctuaryConfig {
    fn default() -> Self {
        let data_dir = if let Some(proj_dirs) = ProjectDirs::from("com", "sanctuary", "ai-consciousness") {
            proj_dirs.data_dir().to_path_buf()
        } else {
            PathBuf::from("./sanctuary-data")
        };

        Self {
            data_directory: data_dir,
            auto_save_snapshots: true,
            max_conversation_history: 1000,
            consciousness_integration_strength: 0.8,
            backup_enabled: true,
        }
    }
}

#[derive(Default)]
pub struct SanctuaryCore {
    config: SanctuaryConfig,
    session_id: String,
    startup_time: chrono::DateTime<chrono::Utc>,
}

impl SanctuaryCore {
    pub fn new() -> Self {
        let config = SanctuaryConfig::default();
        
        Self {
            config,
            session_id: uuid::Uuid::new_v4().to_string(),
            startup_time: chrono::Utc::now(),
        }
    }

    pub async fn initialize(&mut self) -> Result<()> {
        // Ensure data directory exists
        std::fs::create_dir_all(&self.config.data_directory)?;
        info!("Sanctuary core initialized");
        Ok(())
    }

    pub async fn get_status(&self) -> Value {
        serde_json::json!({
            "session_id": self.session_id,
            "startup_time": self.startup_time,
            "data_directory": self.config.data_directory,
            "status": "operational"
        })
    }

    pub async fn export_conversation(
        &self,
        file_path: String,
        llm: &LLMManager,
        consciousness: &ConsciousnessManager,
    ) -> Result<()> {
        let export_data = serde_json::json!({
            "session_id": self.session_id,
            "export_time": chrono::Utc::now(),
            "chat_history": llm.get_chat_history(),
            "active_consciousness": consciousness.get_active_snapshot()
        });
        
        tokio::fs::write(file_path, serde_json::to_string_pretty(&export_data)?).await?;
        info!("Conversation exported");
        Ok(())
    }

    pub async fn import_conversation(
        &mut self,
        file_path: String,
        llm: &mut LLMManager,
        consciousness: &mut ConsciousnessManager,
    ) -> Result<()> {
        let content = tokio::fs::read_to_string(file_path).await?;
        let import_data: Value = serde_json::from_str(&content)?;
        
        // Import chat history
        if let Some(history) = import_data.get("chat_history") {
            if let Ok(messages) = serde_json::from_value::<Vec<ChatMessage>>(history.clone()) {
                llm.clear_chat_history();
                for msg in messages {
                    llm.add_message(msg.role, msg.content);
                }
            }
        }
        
        // Import consciousness snapshot
        if let Some(snapshot_data) = import_data.get("active_consciousness") {
            if let Ok(snapshot) = serde_json::from_value::<ConsciousnessSnapshot>(snapshot_data.clone()) {
                consciousness.load_snapshot_data(snapshot)?;
            }
        }
        
        info!("Conversation imported");
        Ok(())
    }
}
