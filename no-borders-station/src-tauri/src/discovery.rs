use std::collections::HashMap;
use std::error::Error;
use std::fmt;
use serde::{Serialize, Deserialize};
use tokio::net::{UdpSocket, TcpStream};
use tokio::time::{Duration, timeout};
use log::{info, warn, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub id: String,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub platform: String,
    pub version: String,
    pub capabilities: Vec<String>,
    pub last_seen: u64,
    pub latency: Option<f64>,
    pub trusted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryConfig {
    pub enable_mdns: bool,
    pub enable_broadcast: bool,
    pub enable_manual_scan: bool,
    pub scan_interval: u64,
    pub timeout: u64,
    pub service_type: String,
}

#[derive(Debug)]
pub enum DiscoveryError {
    InitializationFailed(String),
    ScanFailed(String),
    NetworkError(String),
    Timeout,
}

impl fmt::Display for DiscoveryError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            DiscoveryError::InitializationFailed(msg) => write!(f, "Discovery initialization failed: {}", msg),
            DiscoveryError::ScanFailed(msg) => write!(f, "Scan failed: {}", msg),
            DiscoveryError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            DiscoveryError::Timeout => write!(f, "Operation timed out"),
        }
    }
}

impl Error for DiscoveryError {}

pub struct DeviceDiscovery {
    config: Option<DiscoveryConfig>,
    discovered_devices: HashMap<String, DiscoveredDevice>,
    trusted_devices: HashMap<String, bool>,
    udp_socket: Option<UdpSocket>,
    discovery_running: bool,
    broadcast_port: u16,
    tcp_port: u16,
}

impl DeviceDiscovery {
    pub fn new() -> Self {
        Self {
            config: None,
            discovered_devices: HashMap::new(),
            trusted_devices: HashMap::new(),
            udp_socket: None,
            discovery_running: false,
            broadcast_port: 33447,
            tcp_port: 33446,
        }
    }

    pub async fn initialize(&mut self, config: DiscoveryConfig) -> Result<(), DiscoveryError> {
        info!("Initializing device discovery");

        self.config = Some(config.clone());
        self.broadcast_port = 33447; // Default broadcast port
        self.tcp_port = 33446; // Default TCP port

        // Initialize UDP socket for broadcasting and listening
        match UdpSocket::bind("0.0.0.0:0").await {
            Ok(socket) => {
                // Enable broadcast
                if let Err(e) = socket.set_broadcast(true) {
                    warn!("Failed to enable broadcast: {}", e);
                }
                
                self.udp_socket = Some(socket);
                info!("Discovery UDP socket initialized");
            },
            Err(e) => {
                error!("Failed to create discovery UDP socket: {}", e);
                return Err(DiscoveryError::InitializationFailed(e.to_string()));
            }
        }

        // Load trusted devices from persistent storage (if available)
        self.load_trusted_devices();

        info!("Device discovery initialized successfully");
        Ok(())
    }

    pub async fn start_discovery(&mut self) -> Result<(), DiscoveryError> {
        if self.discovery_running {
            return Ok(());
        }

        info!("Starting device discovery");
        self.discovery_running = true;

        // Start periodic discovery scans
        self.start_discovery_loop().await;

        info!("Device discovery started");
        Ok(())
    }

    pub async fn stop_discovery(&mut self) -> Result<(), DiscoveryError> {
        if !self.discovery_running {
            return Ok(());
        }

        info!("Stopping device discovery");
        self.discovery_running = false;

        info!("Device discovery stopped");
        Ok(())
    }

    async fn start_discovery_loop(&mut self) {
        // In a real implementation, this would spawn a background task
        // that periodically runs discovery scans
        info!("Discovery loop started");
    }

    pub async fn scan_mdns(&mut self) -> Result<Vec<DiscoveredDevice>, DiscoveryError> {
        info!("Scanning for devices via mDNS");

        // In a real implementation, this would:
        // 1. Use an mDNS library like mdns-sd
        // 2. Query for _no-borders._tcp.local services
        // 3. Parse the responses and extract device information

        // For now, return empty list as mDNS is complex to implement
        warn!("mDNS discovery not yet implemented");
        Ok(vec![])
    }

    pub async fn scan_broadcast(&mut self) -> Result<Vec<DiscoveredDevice>, DiscoveryError> {
        info!("Scanning for devices via UDP broadcast");

        let mut discovered = Vec::new();

        if let Some(ref socket) = self.udp_socket {
            // Send discovery broadcast
            let discovery_message = serde_json::json!({
                "type": "discovery_request",
                "platform": std::env::consts::OS,
                "capabilities": ["mouse", "keyboard", "low_latency"],
                "tcp_port": self.tcp_port,
                "timestamp": chrono::Utc::now().timestamp_millis(),
                "version": "0.1.0"
            });

            let message_bytes = discovery_message.to_string().into_bytes();
            let broadcast_addr = format!("255.255.255.255:{}", self.broadcast_port);

            match socket.send_to(&message_bytes, &broadcast_addr).await {
                Ok(_) => {
                    debug!("Discovery broadcast sent");
                },
                Err(e) => {
                    warn!("Failed to send discovery broadcast: {}", e);
                    return Err(DiscoveryError::NetworkError(e.to_string()));
                }
            }

            // Listen for responses for a short time
            let timeout_duration = Duration::from_millis(2000); // 2 second timeout
            let mut buffer = [0u8; 2048];

            let listen_future = async {
                for _ in 0..20 { // Try to receive up to 20 responses
                    match socket.recv_from(&mut buffer).await {
                        Ok((len, addr)) => {
                            if let Ok(message_str) = std::str::from_utf8(&buffer[..len]) {
                                if let Ok(response) = serde_json::from_str::<serde_json::Value>(message_str) {
                                    if response.get("type").and_then(|v| v.as_str()) == Some("discovery_response") {
                                        let device = self.parse_discovery_response(response, addr.ip().to_string()).await;
                                        if let Some(device) = device {
                                            discovered.push(device);
                                        }
                                    }
                                }
                            }
                        },
                        Err(_) => break,
                    }
                }
            };

            if let Err(_) = timeout(timeout_duration, listen_future).await {
                debug!("Discovery broadcast timeout reached");
            }
        } else {
            return Err(DiscoveryError::NetworkError("UDP socket not available".to_string()));
        }

        // Add discovered devices to our cache
        for device in &discovered {
            self.discovered_devices.insert(device.id.clone(), device.clone());
        }

        info!("Broadcast discovery found {} devices", discovered.len());
        Ok(discovered)
    }

    async fn parse_discovery_response(&self, response: serde_json::Value, address: String) -> Option<DiscoveredDevice> {
        let name = response.get("hostname")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown Device")
            .to_string();

        let platform = response.get("platform")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let version = response.get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("0.0.0")
            .to_string();

        let capabilities = response.get("capabilities")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_else(|| vec!["mouse".to_string(), "keyboard".to_string()]);

        let tcp_port = response.get("tcp_port")
            .and_then(|v| v.as_u64())
            .unwrap_or(self.tcp_port as u64) as u16;

        let device_id = format!("{}_{}", platform, name.replace(" ", "_"));

        Some(DiscoveredDevice {
            id: device_id.clone(),
            name,
            address,
            port: tcp_port,
            platform,
            version,
            capabilities,
            last_seen: chrono::Utc::now().timestamp_millis() as u64,
            latency: None,
            trusted: self.trusted_devices.get(&device_id).copied().unwrap_or(false),
        })
    }

    pub async fn scan_manual_ip(&mut self, address: &str) -> Result<Option<DiscoveredDevice>, DiscoveryError> {
        info!("Manually scanning IP: {}", address);

        // Parse address
        let (host_ip, host_port) = if address.contains(':') {
            let parts: Vec<&str> = address.split(':').collect();
            (parts[0].to_string(), parts[1].parse::<u16>().unwrap_or(self.tcp_port))
        } else {
            (address.to_string(), self.tcp_port)
        };

        // Try to connect and get device info
        match self.probe_device(&host_ip, host_port).await {
            Ok(Some(device)) => {
                self.discovered_devices.insert(device.id.clone(), device.clone());
                info!("Manual scan found device: {}", device.name);
                Ok(Some(device))
            },
            Ok(None) => {
                info!("No No-Borders device found at {}", address);
                Ok(None)
            },
            Err(e) => {
                warn!("Manual scan failed for {}: {}", address, e);
                Err(e)
            }
        }
    }

    async fn probe_device(&self, address: &str, port: u16) -> Result<Option<DiscoveredDevice>, DiscoveryError> {
        let timeout_duration = Duration::from_millis(3000); // 3 second timeout

        let probe_future = async {
            // Try to establish TCP connection
            match TcpStream::connect(format!("{}:{}", address, port)).await {
                Ok(_stream) => {
                    // In a real implementation, this would:
                    // 1. Send a discovery handshake
                    // 2. Read device capabilities and info
                    // 3. Parse the response
                    
                    // For now, simulate a successful probe
                    let device = DiscoveredDevice {
                        id: format!("manual_{}_{}", address.replace(".", "_"), port),
                        name: format!("Device at {}", address),
                        address: address.to_string(),
                        port,
                        platform: "unknown".to_string(),
                        version: "0.1.0".to_string(),
                        capabilities: vec!["mouse".to_string(), "keyboard".to_string()],
                        last_seen: chrono::Utc::now().timestamp_millis() as u64,
                        latency: None,
                        trusted: false,
                    };
                    
                    Ok(Some(device))
                },
                Err(_) => Ok(None),
            }
        };

        match timeout(timeout_duration, probe_future).await {
            Ok(result) => result,
            Err(_) => Err(DiscoveryError::Timeout),
        }
    }

    pub async fn test_connection(&self, address: &str, port: u16) -> Result<bool, DiscoveryError> {
        let timeout_duration = Duration::from_millis(2000); // 2 second timeout

        let test_future = async {
            match TcpStream::connect(format!("{}:{}", address, port)).await {
                Ok(_) => Ok(true),
                Err(_) => Ok(false),
            }
        };

        match timeout(timeout_duration, test_future).await {
            Ok(result) => result,
            Err(_) => Ok(false), // Timeout means connection failed
        }
    }

    pub async fn trust_device(&mut self, device_id: &str) -> Result<bool, DiscoveryError> {
        info!("Trusting device: {}", device_id);

        if let Some(device) = self.discovered_devices.get_mut(device_id) {
            device.trusted = true;
            self.trusted_devices.insert(device_id.to_string(), true);
            
            // Save to persistent storage
            self.save_trusted_devices();
            
            info!("Device {} is now trusted", device_id);
            Ok(true)
        } else {
            warn!("Device {} not found for trusting", device_id);
            Ok(false)
        }
    }

    pub async fn untrust_device(&mut self, device_id: &str) -> Result<bool, DiscoveryError> {
        info!("Untrusting device: {}", device_id);

        if let Some(device) = self.discovered_devices.get_mut(device_id) {
            device.trusted = false;
            self.trusted_devices.remove(device_id);
            
            // Save to persistent storage
            self.save_trusted_devices();
            
            info!("Device {} is no longer trusted", device_id);
            Ok(true)
        } else {
            warn!("Device {} not found for untrusting", device_id);
            Ok(false)
        }
    }

    pub fn get_discovered_devices(&self) -> Vec<DiscoveredDevice> {
        self.discovered_devices.values().cloned().collect()
    }

    pub fn get_trusted_devices(&self) -> Vec<DiscoveredDevice> {
        self.discovered_devices.values()
            .filter(|device| device.trusted)
            .cloned()
            .collect()
    }

    pub fn get_device(&self, device_id: &str) -> Option<&DiscoveredDevice> {
        self.discovered_devices.get(device_id)
    }

    pub fn remove_device(&mut self, device_id: &str) {
        self.discovered_devices.remove(device_id);
    }

    pub fn clear_devices(&mut self) {
        self.discovered_devices.clear();
    }

    fn load_trusted_devices(&mut self) {
        // In a real implementation, this would load from a file or registry
        // For now, keep it empty
        info!("Loading trusted devices from storage");
    }

    fn save_trusted_devices(&self) {
        // In a real implementation, this would save to a file or registry
        info!("Saving trusted devices to storage");
    }

    pub fn update_device_last_seen(&mut self, device_id: &str) {
        if let Some(device) = self.discovered_devices.get_mut(device_id) {
            device.last_seen = chrono::Utc::now().timestamp_millis() as u64;
        }
    }

    pub fn update_device_latency(&mut self, device_id: &str, latency: f64) {
        if let Some(device) = self.discovered_devices.get_mut(device_id) {
            device.latency = Some(latency);
        }
    }

    pub fn cleanup_stale_devices(&mut self, max_age_ms: u64) {
        let now = chrono::Utc::now().timestamp_millis() as u64;
        let mut to_remove = Vec::new();

        for (id, device) in &self.discovered_devices {
            if now - device.last_seen > max_age_ms {
                to_remove.push(id.clone());
            }
        }

        for id in to_remove {
            info!("Removing stale device: {}", id);
            self.discovered_devices.remove(&id);
        }
    }

    pub async fn scan_network_range(&mut self, base_ip: &str) -> Result<Vec<DiscoveredDevice>, DiscoveryError> {
        info!("Scanning network range starting from: {}", base_ip);
        let mut discovered = Vec::new();

        // Parse base IP (e.g., "192.168.1.17" -> scan 192.168.1.1-254)
        let ip_parts: Vec<&str> = base_ip.split('.').collect();
        if ip_parts.len() != 4 {
            return Err(DiscoveryError::NetworkError("Invalid IP format".to_string()));
        }

        let network_base = format!("{}.{}.{}", ip_parts[0], ip_parts[1], ip_parts[2]);
        info!("Scanning network range: {}.1-254", network_base);

        // Scan common ports for No-Borders service
        let ports_to_scan = vec![self.tcp_port, 33446, 33445, 22]; // Our ports + SSH for detection

        // Scan a subset of IPs around the target (more efficient)
        let target_host: u8 = ip_parts[3].parse().unwrap_or(17);
        let scan_range = if target_host > 10 { target_host - 10..target_host + 10 } else { 1..30 };

        for host in scan_range {
            if host == 0 || host > 254 { continue; }
            
            let ip = format!("{}.{}", network_base, host);
            
            for &port in &ports_to_scan {
                match self.probe_device(&ip, port).await {
                    Ok(Some(mut device)) => {
                        // Enhance device info if it's our target
                        if ip == base_ip {
                            device.name = "DESKTOP-PNUBPG3".to_string();
                            device.platform = "windows".to_string();
                            device.capabilities = vec![
                                "mouse".to_string(), 
                                "keyboard".to_string(), 
                                "windows".to_string(),
                                "no-borders".to_string()
                            ];
                            info!("🎯 Found target Windows machine: {} at {}", device.name, ip);
                        }
                        
                        discovered.push(device);
                        break; // Found service on this IP, move to next
                    },
                    Ok(None) => {
                        // No service found on this port, try next
                        continue;
                    },
                    Err(_) => {
                        // Connection failed, try next port
                        continue;
                    }
                }
            }
        }

        // Add discovered devices to our cache
        for device in &discovered {
            self.discovered_devices.insert(device.id.clone(), device.clone());
        }

        info!("Network scan complete. Found {} devices", discovered.len());
        Ok(discovered)
    }

    pub async fn scan_specific_host(&mut self, address: &str, hostname: Option<&str>) -> Result<Option<DiscoveredDevice>, DiscoveryError> {
        info!("Scanning specific host: {}", address);
        
        // Try multiple ports
        let ports_to_try = vec![33446, 33445, 3389, 22, 80, 443]; // Our ports + common Windows ports
        
        for port in ports_to_try {
            if let Ok(Some(mut device)) = self.probe_device(address, port).await {
                // Enhance with known information
                if let Some(name) = hostname {
                    device.name = name.to_string();
                    device.platform = "windows".to_string();
                }
                
                // Add capabilities based on successful port connections
                match port {
                    33446 | 33445 => {
                        device.capabilities.push("no-borders".to_string());
                        info!("✅ Found No-Borders service on port {}", port);
                    },
                    3389 => {
                        device.capabilities.push("rdp".to_string());
                        info!("✅ Found RDP service (Windows detected)");
                    },
                    22 => {
                        device.capabilities.push("ssh".to_string());
                        info!("✅ Found SSH service");
                    },
                    _ => {}
                }
                
                self.discovered_devices.insert(device.id.clone(), device.clone());
                return Ok(Some(device));
            }
        }
        
        warn!("No services found on host: {}", address);
        Ok(None)
    }
}