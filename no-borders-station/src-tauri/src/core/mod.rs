use anyhow::Result;
use log::{info, warn, error};
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod capture;
pub mod encoding;
pub mod transport;
pub mod display;

use crate::networking::NetworkManager;
use crate::input::InputManager;
use crate::ai::AIPredictor;
use crate::holographic::HolographicTracker;
use crate::temporal::TimeTravelNetwork;

/// Core No-Borders engine managing all subsystems
pub struct NoBordersCore {
    network_manager: Arc<Mutex<NetworkManager>>,
    input_manager: Arc<Mutex<InputManager>>,
    ai_predictor: Arc<Mutex<AIPredictor>>,
    holographic_tracker: Arc<Mutex<Option<HolographicTracker>>>,
    time_travel_network: Arc<Mutex<Option<TimeTravelNetwork>>>,
    is_running: Arc<Mutex<bool>>,
}

impl NoBordersCore {
    pub fn new() -> Result<Self> {
        info!("Initializing No-Borders Core");
        
        let network_manager = Arc::new(Mutex::new(NetworkManager::new()?));
        let input_manager = Arc::new(Mutex::new(InputManager::new()?));
        let ai_predictor = Arc::new(Mutex::new(AIPredictor::new()?));
        
        Ok(Self {
            network_manager,
            input_manager,
            ai_predictor,
            holographic_tracker: Arc::new(Mutex::new(None)),
            time_travel_network: Arc::new(Mutex::new(None)),
            is_running: Arc::new(Mutex::new(false)),
        })
    }
    
    pub async fn start_sharing(&mut self) -> Result<()> {
        info!("Starting screen sharing service");
        
        let mut is_running = self.is_running.lock().await;
        if *is_running {
            warn!("Sharing service already running");
            return Ok(());
        }
        
        // Initialize network manager
        let mut network = self.network_manager.lock().await;
        network.start_server().await?;
        
        // Start input capture
        let mut input = self.input_manager.lock().await;
        input.start_capture().await?;
        
        // Initialize AI predictor
        let mut ai = self.ai_predictor.lock().await;
        ai.start_prediction().await?;
        
        *is_running = true;
        info!("Screen sharing service started successfully");
        Ok(())
    }
    
    pub async fn stop_sharing(&mut self) -> Result<()> {
        info!("Stopping screen sharing service");
        
        let mut is_running = self.is_running.lock().await;
        if !*is_running {
            warn!("Sharing service not running");
            return Ok(());
        }
        
        // Stop all services
        if let Some(time_travel) = self.time_travel_network.lock().await.as_mut() {
            time_travel.stop().await?;
        }
        
        if let Some(holographic) = self.holographic_tracker.lock().await.as_mut() {
            holographic.stop().await?;
        }
        
        let mut ai = self.ai_predictor.lock().await;
        ai.stop_prediction().await?;
        
        let mut input = self.input_manager.lock().await;
        input.stop_capture().await?;
        
        let mut network = self.network_manager.lock().await;
        network.stop_server().await?;
        
        *is_running = false;
        info!("Screen sharing service stopped successfully");
        Ok(())
    }
    
    pub async fn discover_lan_devices(&self) -> Result<Vec<String>> {
        info!("Discovering devices on LAN");
        let network = self.network_manager.lock().await;
        network.discover_devices().await
    }
    
    pub async fn enable_holographic_tracking(&self) -> Result<()> {
        info!("Enabling holographic hand tracking");
        
        let mut holographic_guard = self.holographic_tracker.lock().await;
        if holographic_guard.is_some() {
            warn!("Holographic tracking already enabled");
            return Ok(());
        }
        
        let tracker = HolographicTracker::new().await?;
        tracker.start().await?;
        *holographic_guard = Some(tracker);
        
        info!("Holographic hand tracking enabled successfully");
        Ok(())
    }
    
    pub async fn activate_time_travel(&self) -> Result<()> {
        info!("Activating network time travel system");
        
        let mut time_travel_guard = self.time_travel_network.lock().await;
        if time_travel_guard.is_some() {
            warn!("Time travel network already active");
            return Ok(());
        }
        
        let time_travel = TimeTravelNetwork::new().await?;
        time_travel.activate().await?;
        *time_travel_guard = Some(time_travel);
        
        info!("Network time travel system activated - causality protection engaged");
        Ok(())
    }
}

impl Drop for NoBordersCore {
    fn drop(&mut self) {
        info!("No-Borders Core shutting down");
    }
}
