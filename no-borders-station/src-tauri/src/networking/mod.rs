use anyhow::Result;
use log::{info, warn, error};
use std::net::{SocketAddr, UdpSocket};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::net::UdpSocket as TokioUdpSocket;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum MessageType {
    Discovery,
    DiscoveryResponse,
    ScreenData,
    InputEvent,
    Heartbeat,
    HolographicData,
    TemporalPacket,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NetworkMessage {
    pub msg_type: MessageType,
    pub source_id: String,
    pub target_id: Option<String>,
    pub timestamp: u64,
    pub data: Vec<u8>,
}

pub struct NetworkManager {
    socket: Option<Arc<TokioUdpSocket>>,
    device_id: String,
    connected_peers: Arc<Mutex<Vec<SocketAddr>>>,
    is_server_running: Arc<Mutex<bool>>,
}

impl NetworkManager {
    pub fn new() -> Result<Self> {
        let device_id = format!("no-borders-{}", 
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs()
        );
        
        Ok(Self {
            socket: None,
            device_id,
            connected_peers: Arc::new(Mutex::new(Vec::new())),
            is_server_running: Arc::new(Mutex::new(false)),
        })
    }
    
    pub async fn start_server(&mut self) -> Result<()> {
        info!("Starting network server");
        
        let mut is_running = self.is_server_running.lock().await;
        if *is_running {
            warn!("Network server already running");
            return Ok(());
        }
        
        // Bind to default port
        let socket = TokioUdpSocket::bind("0.0.0.0:42069").await?;
        socket.set_broadcast(true)?;
        
        info!("Network server bound to port 42069");
        self.socket = Some(Arc::new(socket));
        *is_running = true;
        
        // Start listening for messages
        self.start_message_loop().await?;
        
        Ok(())
    }
    
    pub async fn stop_server(&mut self) -> Result<()> {
        info!("Stopping network server");
        
        let mut is_running = self.is_server_running.lock().await;
        if !*is_running {
            return Ok(());
        }
        
        *is_running = false;
        self.socket = None;
        
        info!("Network server stopped");
        Ok(())
    }
    
    pub async fn discover_devices(&self) -> Result<Vec<String>> {
        info!("Broadcasting device discovery");
        
        if let Some(socket) = &self.socket {
            let discovery_msg = NetworkMessage {
                msg_type: MessageType::Discovery,
                source_id: self.device_id.clone(),
                target_id: None,
                timestamp: self.get_timestamp(),
                data: b"no-borders-discovery".to_vec(),
            };
            
            let serialized = serde_json::to_vec(&discovery_msg)?;
            
            // Broadcast to common LAN ranges
            let broadcast_addresses = [
                "192.168.1.255:42069",
                "192.168.0.255:42069", 
                "10.0.0.255:42069",
                "172.16.255.255:42069",
            ];
            
            for addr in broadcast_addresses {
                if let Ok(sock_addr) = addr.parse::<SocketAddr>() {
                    let _ = socket.send_to(&serialized, sock_addr).await;
                }
            }
            
            // Wait a moment for responses
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            
            // Return list of discovered devices
            let peers = self.connected_peers.lock().await;
            Ok(peers.iter().map(|addr| addr.to_string()).collect())
        } else {
            Err(anyhow::anyhow!("Network server not running"))
        }
    }
    
    async fn start_message_loop(&self) -> Result<()> {
        if let Some(socket) = &self.socket {
            let socket_clone = socket.clone();
            let peers = self.connected_peers.clone();
            let device_id = self.device_id.clone();
            let is_running = self.is_server_running.clone();
            
            tokio::spawn(async move {
                let mut buffer = [0u8; 65507]; // Max UDP payload
                
                while *is_running.lock().await {
                    match socket_clone.recv_from(&mut buffer).await {
                        Ok((size, addr)) => {
                            if let Ok(message) = serde_json::from_slice::<NetworkMessage>(&buffer[..size]) {
                                Self::handle_message(message, addr, &peers, &device_id).await;
                            }
                        }
                        Err(e) => {
                            error!("Error receiving message: {}", e);
                        }
                    }
                }
            });
        }
        
        Ok(())
    }
    
    async fn handle_message(
        message: NetworkMessage, 
        sender: SocketAddr, 
        peers: &Arc<Mutex<Vec<SocketAddr>>>,
        device_id: &str
    ) {
        match message.msg_type {
            MessageType::Discovery => {
                info!("Received discovery from {}", sender);
                let mut peer_list = peers.lock().await;
                if !peer_list.contains(&sender) {
                    peer_list.push(sender);
                    info!("Added new peer: {}", sender);
                }
            }
            MessageType::ScreenData => {
                info!("Received screen data from {}", sender);
                // Handle screen data
            }
            MessageType::InputEvent => {
                info!("Received input event from {}", sender);
                // Handle input event
            }
            MessageType::HolographicData => {
                info!("Received holographic data from {}", sender);
                // Handle holographic tracking data
            }
            MessageType::TemporalPacket => {
                info!("Received temporal packet from {}", sender);
                // Handle time travel packet (with causality protection)
            }
            _ => {
                info!("Received message type {:?} from {}", message.msg_type, sender);
            }
        }
    }
    
    pub async fn send_message(&self, message: NetworkMessage, target: SocketAddr) -> Result<()> {
        if let Some(socket) = &self.socket {
            let serialized = serde_json::to_vec(&message)?;
            socket.send_to(&serialized, target).await?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Network server not running"))
        }
    }
    
    pub async fn broadcast_message(&self, message: NetworkMessage) -> Result<()> {
        let peers = self.connected_peers.lock().await;
        for peer in peers.iter() {
            if let Err(e) = self.send_message(message.clone(), *peer).await {
                warn!("Failed to send message to {}: {}", peer, e);
            }
        }
        Ok(())
    }
    
    fn get_timestamp(&self) -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}

impl Drop for NetworkManager {
    fn drop(&mut self) {
        info!("NetworkManager shutting down");
    }
}
