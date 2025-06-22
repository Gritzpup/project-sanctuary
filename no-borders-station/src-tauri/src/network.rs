use std::collections::HashMap;
use std::error::Error;
use std::fmt;
use serde::{Serialize, Deserialize};
use tokio::net::{UdpSocket, TcpListener, TcpStream};
use tokio::sync::mpsc;
use log::{info, warn, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMessage {
    pub message_type: String,
    pub data: serde_json::Value,
    pub timestamp: u64,
    pub source_id: String,
    pub target_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub address: String,
    pub port: u16,
    pub latency: f64,
    pub connected: bool,
    pub platform: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug)]
pub enum NetworkError {
    InitializationFailed(String),
    ConnectionFailed(String),
    SendFailed(String),
    ReceiveFailed(String),
    BindFailed(String),
}

impl fmt::Display for NetworkError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            NetworkError::InitializationFailed(msg) => write!(f, "Network initialization failed: {}", msg),
            NetworkError::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            NetworkError::SendFailed(msg) => write!(f, "Send failed: {}", msg),
            NetworkError::ReceiveFailed(msg) => write!(f, "Receive failed: {}", msg),
            NetworkError::BindFailed(msg) => write!(f, "Bind failed: {}", msg),
        }
    }
}

impl Error for NetworkError {}

pub struct NetworkTransport {
    udp_socket: Option<UdpSocket>,
    tcp_listener: Option<TcpListener>,
    connections: HashMap<String, ConnectionInfo>,
    message_queue: Vec<NetworkMessage>,
    incoming_messages: Vec<NetworkMessage>,
    is_host: bool,
    udp_port: u16,
    tcp_port: u16,
    broadcast_port: u16,
    message_sender: Option<mpsc::UnboundedSender<NetworkMessage>>,
    message_receiver: Option<mpsc::UnboundedReceiver<NetworkMessage>>,
}

impl NetworkTransport {
    pub fn new() -> Self {
        let (sender, receiver) = mpsc::unbounded_channel();
        
        Self {
            udp_socket: None,
            tcp_listener: None,
            connections: HashMap::new(),
            message_queue: Vec::new(),
            incoming_messages: Vec::new(),
            is_host: false,
            udp_port: 33445,
            tcp_port: 33446,
            broadcast_port: 33447,
            message_sender: Some(sender),
            message_receiver: Some(receiver),
        }
    }

    pub async fn initialize(&mut self, config: serde_json::Value) -> Result<(), NetworkError> {
        info!("Initializing network transport");

        // Parse configuration
        if let Some(udp_port) = config.get("udpPort").and_then(|v| v.as_u64()) {
            self.udp_port = udp_port as u16;
        }
        if let Some(tcp_port) = config.get("tcpPort").and_then(|v| v.as_u64()) {
            self.tcp_port = tcp_port as u16;
        }
        if let Some(broadcast_port) = config.get("broadcastPort").and_then(|v| v.as_u64()) {
            self.broadcast_port = broadcast_port as u16;
        }

        // Initialize UDP socket for fast input data
        match UdpSocket::bind(format!("0.0.0.0:{}", self.udp_port)).await {
            Ok(socket) => {
                // Enable broadcast for discovery
                if let Err(e) = socket.set_broadcast(true) {
                    warn!("Failed to enable UDP broadcast: {}", e);
                }
                
                self.udp_socket = Some(socket);
                info!("UDP socket bound to port {}", self.udp_port);
            },
            Err(e) => {
                error!("Failed to bind UDP socket: {}", e);
                return Err(NetworkError::BindFailed(format!("UDP port {}: {}", self.udp_port, e)));
            }
        }

        info!("Network transport initialized successfully");
        Ok(())
    }

    pub async fn start_host(&mut self) -> Result<(), NetworkError> {
        info!("Starting as network host on TCP port {}", self.tcp_port);

        // Bind TCP listener for incoming connections
        match TcpListener::bind(format!("0.0.0.0:{}", self.tcp_port)).await {
            Ok(listener) => {
                self.tcp_listener = Some(listener);
                self.is_host = true;
                
                // Start accepting connections in background
                self.start_connection_handler().await;
                
                info!("Network host started successfully");
                Ok(())
            },
            Err(e) => {
                error!("Failed to bind TCP listener: {}", e);
                Err(NetworkError::BindFailed(format!("TCP port {}: {}", self.tcp_port, e)))
            }
        }
    }

    pub async fn connect_to_host(&mut self, address: &str) -> Result<(), NetworkError> {
        info!("Connecting to host at {}", address);

        // Parse address (assume format "ip:port" or just "ip")
        let (host_ip, host_port) = if address.contains(':') {
            let parts: Vec<&str> = address.split(':').collect();
            (parts[0].to_string(), parts[1].parse::<u16>().unwrap_or(self.tcp_port))
        } else {
            (address.to_string(), self.tcp_port)
        };

        // Attempt TCP connection
        match TcpStream::connect(format!("{}:{}", host_ip, host_port)).await {
            Ok(_stream) => {
                // Add connection to our list
                let connection = ConnectionInfo {
                    id: format!("host-{}", host_ip),
                    address: host_ip,
                    port: host_port,
                    latency: 0.0,
                    connected: true,
                    platform: "unknown".to_string(),
                    capabilities: vec!["mouse".to_string(), "keyboard".to_string()],
                };
                
                self.connections.insert(connection.id.clone(), connection);
                
                info!("Successfully connected to host");
                Ok(())
            },
            Err(e) => {
                error!("Failed to connect to host: {}", e);
                Err(NetworkError::ConnectionFailed(e.to_string()))
            }
        }
    }

    async fn start_connection_handler(&mut self) {
        if let Some(_listener) = &self.tcp_listener {
            // In a real implementation, this would spawn a background task
            // to handle incoming TCP connections
            info!("Connection handler started");
        }
    }

    pub async fn send_message(&mut self, message: NetworkMessage) -> Result<(), NetworkError> {
        debug!("Sending message: {:?}", message.message_type);

        // For now, just queue the message
        // In a real implementation, this would send via UDP (for input data) or TCP (for control)
        self.message_queue.push(message);

        Ok(())
    }

    pub async fn get_messages(&mut self) -> Vec<NetworkMessage> {
        // In a real implementation, this would check for incoming UDP/TCP messages
        // and return them
        
        // For now, return any queued incoming messages and clear the queue
        let messages = self.incoming_messages.clone();
        self.incoming_messages.clear();
        
        // Simulate some heartbeat messages for testing
        if messages.is_empty() && !self.connections.is_empty() {
            for (id, _) in &self.connections {
                let heartbeat = NetworkMessage {
                    message_type: "heartbeat".to_string(),
                    data: serde_json::json!({
                        "platform": "windows",
                        "capabilities": ["mouse", "keyboard"],
                        "timestamp": chrono::Utc::now().timestamp_millis() as u64
                    }),
                    timestamp: chrono::Utc::now().timestamp_millis() as u64,
                    source_id: id.clone(),
                    target_id: None,
                };
                self.incoming_messages.push(heartbeat);
            }
        }
        
        messages
    }

    pub fn get_connections(&self) -> Vec<ConnectionInfo> {
        self.connections.values().cloned().collect()
    }

    pub fn is_connected(&self) -> bool {
        !self.connections.is_empty()
    }

    pub async fn send_mouse_data(&mut self, mouse_data: serde_json::Value) -> Result<(), NetworkError> {
        let message = NetworkMessage {
            message_type: "mouse".to_string(),
            data: mouse_data,
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            source_id: "local".to_string(),
            target_id: None,
        };

        self.send_message(message).await
    }

    pub async fn send_keyboard_data(&mut self, keyboard_data: serde_json::Value) -> Result<(), NetworkError> {
        let message = NetworkMessage {
            message_type: "keyboard".to_string(),
            data: keyboard_data,
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            source_id: "local".to_string(),
            target_id: None,
        };

        self.send_message(message).await
    }

    pub async fn broadcast_discovery(&mut self) -> Result<(), NetworkError> {
        if let Some(ref socket) = self.udp_socket {
            let discovery_message = serde_json::json!({
                "type": "discovery",
                "platform": std::env::consts::OS,
                "capabilities": ["mouse", "keyboard", "low_latency"],
                "tcp_port": self.tcp_port,
                "timestamp": chrono::Utc::now().timestamp_millis()
            });

            let message_bytes = discovery_message.to_string().into_bytes();
            let broadcast_addr = format!("255.255.255.255:{}", self.broadcast_port);

            match socket.send_to(&message_bytes, &broadcast_addr).await {
                Ok(_) => {
                    debug!("Discovery broadcast sent");
                    Ok(())
                },
                Err(e) => {
                    warn!("Failed to send discovery broadcast: {}", e);
                    Err(NetworkError::SendFailed(e.to_string()))
                }
            }
        } else {
            Err(NetworkError::SendFailed("UDP socket not initialized".to_string()))
        }
    }

    pub async fn listen_for_discovery(&mut self) -> Result<Vec<serde_json::Value>, NetworkError> {
        if let Some(ref socket) = self.udp_socket {
            let mut discoveries = Vec::new();
            let mut buffer = [0u8; 1024];

            // Non-blocking receive
            match socket.try_recv_from(&mut buffer) {
                Ok((len, addr)) => {
                    if let Ok(message_str) = std::str::from_utf8(&buffer[..len]) {
                        if let Ok(discovery) = serde_json::from_str::<serde_json::Value>(message_str) {
                            if discovery.get("type").and_then(|v| v.as_str()) == Some("discovery") {
                                let mut discovery_with_addr = discovery;
                                discovery_with_addr["address"] = serde_json::Value::String(addr.ip().to_string());
                                discoveries.push(discovery_with_addr);
                                info!("Received discovery from {}", addr);
                            }
                        }
                    }
                },
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No data available, this is normal
                },
                Err(e) => {
                    warn!("Error receiving discovery data: {}", e);
                }
            }

            Ok(discoveries)
        } else {
            Err(NetworkError::ReceiveFailed("UDP socket not initialized".to_string()))
        }
    }

    pub fn add_connection(&mut self, connection: ConnectionInfo) {
        info!("Adding connection: {} at {}", connection.id, connection.address);
        self.connections.insert(connection.id.clone(), connection);
    }

    pub fn remove_connection(&mut self, connection_id: &str) {
        if self.connections.remove(connection_id).is_some() {
            info!("Removed connection: {}", connection_id);
        }
    }

    pub fn get_connection(&self, connection_id: &str) -> Option<&ConnectionInfo> {
        self.connections.get(connection_id)
    }

    pub fn update_connection_latency(&mut self, connection_id: &str, latency: f64) {
        if let Some(connection) = self.connections.get_mut(connection_id) {
            connection.latency = latency;
        }
    }
}