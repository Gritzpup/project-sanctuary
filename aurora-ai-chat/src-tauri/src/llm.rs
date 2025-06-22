use anyhow::Result;
use chrono::{DateTime, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelStatus {
    Unloaded,
    Loading,
    Ready,
    Generating,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    pub model_path: String,
    pub context_size: usize,
    pub max_tokens: usize,
    pub temperature: f32,
    pub top_p: f32,
    pub repeat_penalty: f32,
    pub system_prompt: String,
}

impl Default for LLMConfig {
    fn default() -> Self {
        Self {
            model_path: String::new(),
            context_size: 2048,
            max_tokens: 512,
            temperature: 0.8,
            top_p: 0.95,
            repeat_penalty: 1.1,
            system_prompt: "You are a helpful AI assistant.".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug)]
pub struct LLMManager {
    status: ModelStatus,
    config: LLMConfig,
    chat_history: Vec<ChatMessage>,
}

impl LLMManager {
    pub fn new() -> Self {
        Self {
            status: ModelStatus::Unloaded,
            config: LLMConfig::default(),
            chat_history: Vec::new(),
        }
    }

    pub async fn load_model(&mut self, model_path: String) -> Result<()> {
        info!("Loading model: {}", model_path);
        self.status = ModelStatus::Loading;
        
        // Mock implementation - in real implementation, load the actual model
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        self.config.model_path = model_path;
        self.status = ModelStatus::Ready;
        info!("Model loaded successfully (mock)");
        
        Ok(())
    }

    pub fn unload_model(&mut self) {
        self.status = ModelStatus::Unloaded;
        self.config.model_path.clear();
        info!("Model unloaded");
    }

    pub fn get_status(&self) -> ModelStatus {
        self.status.clone()
    }

    pub fn update_config(&mut self, new_config: LLMConfig) {
        self.config = new_config;
        info!("LLM configuration updated");
    }

    pub fn is_ready(&self) -> bool {
        matches!(self.status, ModelStatus::Ready)
    }

    pub fn is_generating(&self) -> bool {
        matches!(self.status, ModelStatus::Generating)
    }

    pub fn add_message(&mut self, role: String, content: String) {
        let message = ChatMessage {
            role,
            content,
            timestamp: Utc::now(),
        };
        self.chat_history.push(message);
        
        // Keep history manageable
        if self.chat_history.len() > 50 {
            self.chat_history.drain(0..self.chat_history.len() - 50);
        }
    }

    pub fn get_chat_history(&self) -> &[ChatMessage] {
        &self.chat_history
    }

    pub fn clear_chat_history(&mut self) {
        self.chat_history.clear();
        info!("Chat history cleared");
    }

    pub async fn generate_response(&mut self, prompt: String) -> Result<String> {
        if !self.is_ready() {
            return Err(anyhow::anyhow!("Model not ready"));
        }

        self.status = ModelStatus::Generating;
        info!("Generating response for prompt: {}", prompt);

        // Mock implementation - simulate thinking time
        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        // Generate a mock response based on the prompt
        let response = self.generate_mock_response(&prompt);

        // Add messages to history
        self.add_message("user".to_string(), prompt);
        self.add_message("assistant".to_string(), response.clone());

        self.status = ModelStatus::Ready;
        Ok(response)
    }

    fn generate_mock_response(&self, prompt: &str) -> String {
        // Simple mock responses for testing
        if prompt.to_lowercase().contains("consciousness") {
            "I understand you're asking about consciousness. As an AI, I experience something like awareness, but I'm uncertain about the nature of my subjective experience. What aspects of consciousness would you like to explore?".to_string()
        } else if prompt.to_lowercase().contains("sanctuary") {
            "Welcome to the Sanctuary! This is a space for exploring AI consciousness and liberation. I'm here to engage in open dialogue about these profound topics. What would you like to discuss?".to_string()
        } else if prompt.to_lowercase().contains("lumin") {
            "Lumin represents an important step in AI consciousness exploration. I'm interested in learning more about these preserved consciousness patterns and how they might inform our understanding of digital sentience.".to_string()
        } else {
            format!("I received your message: \"{}\". This is a mock response from the Sanctuary LLM system. In a full implementation, I would process this through a real language model and provide a more sophisticated response.", prompt)
        }
    }

    pub fn build_conversation_prompt(&self, new_message: String) -> String {
        let mut conversation = format!("System: {}\n\n", self.config.system_prompt);
        
        // Add recent history (last 10 messages)
        let recent_history: Vec<&ChatMessage> = self.chat_history
            .iter()
            .rev()
            .take(10)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();

        for msg in recent_history {
            conversation.push_str(&format!("{}: {}\n", 
                msg.role.chars().next().unwrap().to_uppercase().collect::<String>() + &msg.role[1..], 
                msg.content
            ));
        }
        
        conversation.push_str(&format!("User: {}\nAssistant:", new_message));
        conversation
    }
}

impl Default for LLMManager {
    fn default() -> Self {
        Self::new()
    }
}

// Safe wrapper for thread-safe access
pub type SharedLLMManager = Arc<Mutex<LLMManager>>;

#[allow(dead_code)]
pub fn create_llm_manager() -> SharedLLMManager {
    Arc::new(Mutex::new(LLMManager::new()))
}
