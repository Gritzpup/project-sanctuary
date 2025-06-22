// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, AppHandle, generate_handler};
use std::sync::Arc;
use tokio::sync::Mutex;
use log::{info, warn, error};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

mod input;
mod network;
mod discovery;

use input::{InputCapture};
use network::{NetworkTransport, NetworkMessage, ConnectionInfo};
use discovery::{DeviceDiscovery, DiscoveredDevice, DiscoveryConfig};

// Application state for mouse/keyboard sharing
#[derive(Default)]
struct AppState {
    input_capture: Arc<Mutex<Option<InputCapture>>>,
    network: Arc<Mutex<Option<NetworkTransport>>>,
    discovery: Arc<Mutex<Option<DeviceDiscovery>>>,
    is_sharing: Arc<Mutex<bool>>,
    connected_devices: Arc<Mutex<HashMap<String, ConnectionInfo>>>,
    device_id: Arc<Mutex<String>>,
}

// Data structures for Tauri communication
#[derive(Serialize, Deserialize, Debug, Clone)]
struct InputCapabilitiesResponse {
    mouse_capture: bool,
    keyboard_capture: bool,
    high_frequency_polling: bool,
    raw_input: bool,
    platform: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct MouseStateResponse {
    x: i32,
    y: i32,
    buttons: u32,
    timestamp: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct KeyboardEventResponse {
    key: String,
    code: String,
    modifiers: HashMap<String, bool>,
    pressed: bool,
    timestamp: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct NetworkMessageResponse {
    message_type: String,
    data: serde_json::Value,
    timestamp: u64,
    source_id: String,
    target_id: Option<String>,
}

// Input Capture Commands
#[tauri::command]
async fn get_input_capabilities(app_handle: AppHandle) -> Result<InputCapabilitiesResponse, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut input_guard = state.input_capture.lock().await;
    
    if input_guard.is_none() {
        *input_guard = Some(InputCapture::new().map_err(|e| e.to_string())?);
    }
    
    let input = input_guard.as_ref().unwrap();
    let capabilities = input.get_capabilities().await;
    
    Ok(InputCapabilitiesResponse {
        mouse_capture: capabilities.mouse,
        keyboard_capture: capabilities.keyboard,
        high_frequency_polling: false, // Phase 1 placeholder
        raw_input: false, // Phase 1 placeholder
        platform: "placeholder".to_string(), // Phase 1 placeholder
    })
}

#[tauri::command]
async fn initialize_input_capture(app_handle: AppHandle) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut input_guard = state.input_capture.lock().await;
    
    if input_guard.is_none() {
        *input_guard = Some(InputCapture::new().map_err(|e| e.to_string())?);
    }
    
    let input = input_guard.as_mut().unwrap();
    match input.initialize().await {
        Ok(_) => {
            info!("Input capture initialized successfully");
            Ok(true)
        },
        Err(e) => {
            error!("Failed to initialize input capture: {}", e);
            Err(format!("Failed to initialize input capture: {}", e))
        }
    }
}

#[tauri::command]
async fn start_input_capture(app_handle: AppHandle) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_mut() {
        match input.start_capture().await {
            Ok(_) => {
                info!("Input capture started");
                Ok(true)
            },
            Err(e) => {
                error!("Failed to start input capture: {}", e);
                Err(format!("Failed to start input capture: {}", e))
            }
        }
    } else {
        Err("Input capture not initialized".to_string())
    }
}

#[tauri::command]
async fn stop_input_capture(app_handle: AppHandle) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_mut() {
        match input.stop_capture().await {
            Ok(_) => {
                info!("Input capture stopped");
                Ok(true)
            },
            Err(e) => {
                error!("Failed to stop input capture: {}", e);
                Err(format!("Failed to stop input capture: {}", e))
            }
        }
    } else {
        Err("Input capture not initialized".to_string())
    }
}

#[tauri::command]
async fn get_mouse_state(app_handle: AppHandle) -> Result<MouseStateResponse, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_ref() {
        let mouse_state = input.get_mouse_state();
        Ok(MouseStateResponse {
            x: mouse_state.x as i32,
            y: mouse_state.y as i32,
            buttons: 0, // Phase 1 placeholder 
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
        })
    } else {
        Err("Input capture not initialized".to_string())
    }
}

#[tauri::command]
async fn get_keyboard_events(app_handle: AppHandle) -> Result<Vec<KeyboardEventResponse>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_mut() {
        let events = input.get_keyboard_events();
        let response_events = events.into_iter().map(|event| {
            let mut modifiers = HashMap::new();
            modifiers.insert("ctrl".to_string(), event.modifiers.ctrl);
            modifiers.insert("shift".to_string(), event.modifiers.shift);
            modifiers.insert("alt".to_string(), event.modifiers.alt);
            modifiers.insert("meta".to_string(), event.modifiers.meta);
            
            KeyboardEventResponse {
                key: event.key,
                code: event.code,
                modifiers,
                pressed: event.pressed,
                timestamp: event.timestamp,
            }
        }).collect();
        
        Ok(response_events)
    } else {
        Err("Input capture not initialized".to_string())
    }
}

// Network Commands
#[tauri::command]
async fn initialize_network(app_handle: AppHandle, config: serde_json::Value) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut network_guard = state.network.lock().await;
    
    if network_guard.is_none() {
        *network_guard = Some(NetworkTransport::new());
    }
    
    let network = network_guard.as_mut().unwrap();
    match network.initialize(config).await {
        Ok(_) => {
            info!("Network transport initialized successfully");
            Ok(true)
        },
        Err(e) => {
            error!("Failed to initialize network: {}", e);
            Err(format!("Failed to initialize network: {}", e))
        }
    }
}

#[tauri::command]
async fn start_network_host(app_handle: AppHandle) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut network_guard = state.network.lock().await;
    
    if let Some(network) = network_guard.as_mut() {
        match network.start_host().await {
            Ok(_) => {
                info!("Network host started");
                Ok(true)
            },
            Err(e) => {
                error!("Failed to start network host: {}", e);
                Err(format!("Failed to start network host: {}", e))
            }
        }
    } else {
        Err("Network not initialized".to_string())
    }
}

#[tauri::command]
async fn connect_to_host(app_handle: AppHandle, address: String) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut network_guard = state.network.lock().await;
    
    if let Some(network) = network_guard.as_mut() {
        match network.connect_to_host(&address).await {
            Ok(_) => {
                info!("Connected to host at {}", address);
                Ok(true)
            },
            Err(e) => {
                error!("Failed to connect to host {}: {}", address, e);
                Err(format!("Failed to connect to host: {}", e))
            }
        }
    } else {
        Err("Network not initialized".to_string())
    }
}

#[tauri::command]
async fn send_network_messages(app_handle: AppHandle, messages: Vec<NetworkMessageResponse>) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut network_guard = state.network.lock().await;
    
    if let Some(network) = network_guard.as_mut() {
        for msg in messages {
            let network_msg = NetworkMessage {
                message_type: msg.message_type,
                data: msg.data,
                timestamp: msg.timestamp,
                source_id: msg.source_id,
                target_id: msg.target_id,
            };
            
            if let Err(e) = network.send_message(network_msg).await {
                warn!("Failed to send network message: {}", e);
            }
        }
        Ok(true)
    } else {
        Err("Network not initialized".to_string())
    }
}

#[tauri::command]
async fn get_network_messages(app_handle: AppHandle) -> Result<Vec<NetworkMessageResponse>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut network_guard = state.network.lock().await;
    
    if let Some(network) = network_guard.as_mut() {
        let messages = network.get_messages().await;
        let response_messages = messages.into_iter().map(|msg| {
            NetworkMessageResponse {
                message_type: msg.message_type,
                data: msg.data,
                timestamp: msg.timestamp,
                source_id: msg.source_id,
                target_id: msg.target_id,
            }
        }).collect();
        
        Ok(response_messages)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn get_active_connections(app_handle: AppHandle) -> Result<Vec<ConnectionInfo>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let network_guard = state.network.lock().await;
    
    if let Some(network) = network_guard.as_ref() {
        Ok(network.get_connections())
    } else {
        Ok(vec![])
    }
}

// Discovery Commands
#[tauri::command]
async fn initialize_discovery(app_handle: AppHandle, config: DiscoveryConfig) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if discovery_guard.is_none() {
        *discovery_guard = Some(DeviceDiscovery::new());
    }
    
    let discovery = discovery_guard.as_mut().unwrap();
    match discovery.initialize(config).await {
        Ok(_) => {
            info!("Device discovery initialized successfully");
            Ok(true)
        },
        Err(e) => {
            error!("Failed to initialize discovery: {}", e);
            Err(format!("Failed to initialize discovery: {}", e))
        }
    }
}

#[tauri::command]
async fn start_discovery(app_handle: AppHandle) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        match discovery.start_discovery().await {
            Ok(_) => {
                info!("Device discovery started");
                Ok(true)
            },
            Err(e) => {
                error!("Failed to start discovery: {}", e);
                Err(format!("Failed to start discovery: {}", e))
            }
        }
    } else {
        Err("Discovery not initialized".to_string())
    }
}

#[tauri::command]
async fn stop_discovery(app_handle: AppHandle) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        match discovery.stop_discovery().await {
            Ok(_) => {
                info!("Device discovery stopped");
                Ok(true)
            },
            Err(e) => {
                error!("Failed to stop discovery: {}", e);
                Err(format!("Failed to stop discovery: {}", e))
            }
        }
    } else {
        Err("Discovery not initialized".to_string())
    }
}

#[tauri::command]
async fn scan_mdns_devices(app_handle: AppHandle) -> Result<Vec<DiscoveredDevice>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        Ok(discovery.scan_mdns().await.unwrap_or_else(|_| vec![]))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn scan_broadcast_devices(app_handle: AppHandle) -> Result<Vec<DiscoveredDevice>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        Ok(discovery.scan_broadcast().await.unwrap_or_else(|_| vec![]))
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn scan_manual_ip(app_handle: AppHandle, address: String) -> Result<Option<DiscoveredDevice>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        Ok(discovery.scan_manual_ip(&address).await.unwrap_or(None))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn test_device_connection(app_handle: AppHandle, address: String, port: u16) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_ref() {
        Ok(discovery.test_connection(&address, port).await.unwrap_or(false))
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn trust_device(app_handle: AppHandle, device_id: String) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        Ok(discovery.trust_device(&device_id).await.unwrap_or(false))
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn untrust_device(app_handle: AppHandle, device_id: String) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        Ok(discovery.untrust_device(&device_id).await.unwrap_or(false))
    } else {
        Ok(false)
    }
}

// Input injection commands
#[tauri::command]
async fn inject_mouse_move(app_handle: AppHandle, x: f64, y: f64) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_ref() {
        match input.inject_mouse_move(x, y).await {
            Ok(_) => {
                info!("Mouse moved to ({:.2}, {:.2})", x, y);
                Ok(true)
            },
            Err(e) => {
                error!("Failed to inject mouse move: {}", e);
                Err(format!("Failed to inject mouse move: {}", e))
            }
        }
    } else {
        Err("Input capture not initialized".to_string())
    }
}

#[tauri::command]
async fn inject_mouse_click(app_handle: AppHandle, button: String) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_ref() {
        match input.inject_mouse_click(&button).await {
            Ok(_) => {
                info!("Mouse {} clicked", button);
                Ok(true)
            },
            Err(e) => {
                error!("Failed to inject mouse click: {}", e);
                Err(format!("Failed to inject mouse click: {}", e))
            }
        }
    } else {
        Err("Input capture not initialized".to_string())
    }
}

#[tauri::command]
async fn inject_key_press(app_handle: AppHandle, key: String) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_ref() {
        match input.inject_key_press(&key).await {
            Ok(_) => {
                info!("Key {} pressed", key);
                Ok(true)
            },
            Err(e) => {
                error!("Failed to inject key press: {}", e);
                Err(format!("Failed to inject key press: {}", e))
            }
        }
    } else {
        Err("Input capture not initialized".to_string())
    }
}

#[tauri::command]
async fn inject_key_release(app_handle: AppHandle, key: String) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let input_guard = state.input_capture.lock().await;
    
    if let Some(input) = input_guard.as_ref() {
        match input.inject_key_release(&key).await {
            Ok(_) => {
                info!("Key {} released", key);
                Ok(true)
            },
            Err(e) => {
                error!("Failed to inject key release: {}", e);
                Err(format!("Failed to inject key release: {}", e))
            }
        }
    } else {
        Err("Input capture not initialized".to_string())
    }
}

// Network discovery commands
#[tauri::command]
async fn broadcast_discovery(app_handle: AppHandle) -> Result<bool, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut network_guard = state.network.lock().await;
    
    if let Some(network) = network_guard.as_mut() {
        match network.broadcast_discovery().await {
            Ok(_) => {
                info!("Discovery broadcast sent");
                Ok(true)
            },
            Err(e) => {
                error!("Failed to broadcast discovery: {}", e);
                Err(format!("Failed to broadcast discovery: {}", e))
            }
        }
    } else {
        Err("Network not initialized".to_string())
    }
}

#[tauri::command]
async fn listen_for_discovery(app_handle: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut network_guard = state.network.lock().await;
    
    if let Some(network) = network_guard.as_mut() {
        match network.listen_for_discovery().await {
            Ok(discoveries) => {
                if !discoveries.is_empty() {
                    info!("Found {} discovery responses", discoveries.len());
                }
                Ok(discoveries)
            },
            Err(e) => {
                warn!("Failed to listen for discovery: {}", e);
                Ok(vec![]) // Return empty list on error
            }
        }
    } else {
        Ok(vec![])
    }
}

// Network scanning commands
#[tauri::command]
async fn scan_network_range(app_handle: AppHandle, base_ip: String) -> Result<Vec<serde_json::Value>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        match discovery.scan_network_range(&base_ip).await {
            Ok(devices) => {
                info!("Network scan found {} devices", devices.len());
                let devices_json: Vec<serde_json::Value> = devices.into_iter()
                    .map(|device| serde_json::json!({
                        "id": device.id,
                        "name": device.name,
                        "address": device.address,
                        "port": device.port,
                        "lastSeen": device.last_seen,
                        "trusted": device.trusted
                    }))
                    .collect();
                Ok(devices_json)
            },
            Err(e) => {
                error!("Network scan failed: {}", e);
                Err(format!("Network scan failed: {}", e))
            }
        }
    } else {
        Err("Discovery not initialized".to_string())
    }
}

#[tauri::command]
async fn scan_specific_host(app_handle: AppHandle, address: String, hostname: Option<String>) -> Result<Option<serde_json::Value>, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let mut discovery_guard = state.discovery.lock().await;
    
    if let Some(discovery) = discovery_guard.as_mut() {
        match discovery.scan_specific_host(&address, hostname.as_deref()).await {
            Ok(device_opt) => {
                if let Some(device) = device_opt {
                    info!("Found specific host: {} at {}", device.name, device.address);
                    let device_json = serde_json::json!({
                        "id": device.id,
                        "name": device.name,
                        "address": device.address,
                        "port": device.port,
                        "lastSeen": device.last_seen,
                        "trusted": device.trusted
                    });
                    Ok(Some(device_json))
                } else {
                    info!("Host {} not found or not responsive", address);
                    Ok(None)
                }
            },
            Err(e) => {
                error!("Host scan failed: {}", e);
                Err(format!("Host scan failed: {}", e))
            }
        }
    } else {
        Err("Discovery not initialized".to_string())
    }
}

// Utility Commands
#[tauri::command]
async fn get_device_id(app_handle: AppHandle) -> Result<String, String> {
    let state: tauri::State<AppState> = app_handle.state();
    let device_id_guard = state.device_id.lock().await;
    
    if device_id_guard.is_empty() {
        // Generate a device ID based on hostname and MAC address
        let hostname = hostname::get()
            .unwrap_or_else(|_| "unknown-host".into())
            .to_string_lossy()
            .to_string();
        
        let device_id = format!("no-borders-{}-{}", hostname, uuid::Uuid::new_v4().to_string()[..8].to_string());
        Ok(device_id)
    } else {
        Ok(device_id_guard.clone())
    }
}

// Legacy commands for compatibility
#[tauri::command]
async fn start_sharing(app_handle: AppHandle) -> Result<String, String> {
    info!("Starting mouse/keyboard sharing");
    let state: tauri::State<AppState> = app_handle.state();
    
    *state.is_sharing.lock().await = true;
    Ok("Mouse/keyboard sharing started".to_string())
}

#[tauri::command]
async fn stop_sharing(app_handle: AppHandle) -> Result<String, String> {
    info!("Stopping mouse/keyboard sharing");
    let state: tauri::State<AppState> = app_handle.state();
    
    *state.is_sharing.lock().await = false;
    Ok("Mouse/keyboard sharing stopped".to_string())
}

#[tauri::command]
async fn get_connection_status(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let state: tauri::State<AppState> = app_handle.state();
    
    let is_sharing = *state.is_sharing.lock().await;
    let connected_devices = state.connected_devices.lock().await;
    
    Ok(serde_json::json!({
        "isSharing": is_sharing,
        "connectedDevices": connected_devices.len(),
        "devices": connected_devices.values().collect::<Vec<_>>(),
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}

#[tokio::main]
async fn main() {
    env_logger::init();
    info!("Starting No-Borders mouse/keyboard sharing application");

    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(generate_handler![
            // Input capture commands
            get_input_capabilities,
            initialize_input_capture,
            start_input_capture,
            stop_input_capture,
            get_mouse_state,
            get_keyboard_events,
            // Input injection commands
            inject_mouse_move,
            inject_mouse_click,
            inject_key_press,
            inject_key_release,
            // Network commands
            initialize_network,
            start_network_host,
            connect_to_host,
            send_network_messages,
            get_network_messages,
            get_active_connections,
            broadcast_discovery,
            listen_for_discovery,
            // Discovery commands
            initialize_discovery,
            start_discovery,
            stop_discovery,
            scan_mdns_devices,
            scan_broadcast_devices,
            scan_manual_ip,
            test_device_connection,
            trust_device,
            untrust_device,
            // Network scanning commands
            scan_network_range,
            scan_specific_host,
            // Utility commands
            get_device_id,
            // Legacy commands
            start_sharing,
            stop_sharing,
            get_connection_status,
        ])
        .setup(|_app| {
            info!("Mouse/keyboard sharing application setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}