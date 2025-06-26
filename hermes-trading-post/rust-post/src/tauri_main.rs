#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::process::{Command, Stdio};
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::sync::RwLock;
use std::collections::VecDeque;
use chrono::Local;

// Global log buffer
static LOG_BUFFER: RwLock<VecDeque<LogEntry>> = RwLock::new(VecDeque::new());
const MAX_LOG_ENTRIES: usize = 1000;

#[derive(Clone, serde::Serialize)]
struct LogEntry {
    timestamp: String,
    level: String,
    message: String,
}

// Helper macro to log with capture
macro_rules! log_println {
    ($($arg:tt)*) => {{
        let msg = format!($($arg)*);
        let timestamp = Local::now().format("%H:%M:%S%.3f").to_string();
        
        // Parse log level from message
        let level = if msg.contains("ERROR") || msg.contains("❌") {
            "error"
        } else if msg.contains("WARN") || msg.contains("⚠️") {
            "warning"
        } else if msg.contains("SUCCESS") || msg.contains("✅") {
            "success"
        } else if msg.contains("DEBUG") || msg.contains("🔍") {
            "debug"
        } else {
            "info"
        };
        
        // Add to buffer
        if let Ok(mut buffer) = LOG_BUFFER.write() {
            buffer.push_back(LogEntry {
                timestamp: timestamp.clone(),
                level: level.to_string(),
                message: msg.trim().to_string(),
            });
            
            // Keep buffer size limited
            while buffer.len() > MAX_LOG_ENTRIES {
                buffer.pop_front();
            }
        }
        
        // Also print to terminal
        println!("{}", msg);
    }};
}

#[derive(Clone, serde::Serialize)]
struct PriceUpdate {
    price: f64,
    change: f64,
    timestamp: u64,
}

// Shared state for the application
#[derive(Default)]
struct AppState {
    current_price: Arc<Mutex<Option<f64>>>,
}

#[tauri::command]
async fn get_current_price(state: tauri::State<'_, AppState>) -> Result<Option<f64>, ()> {
    let price = state.current_price.lock().await;
    Ok(*price)
}

#[tauri::command]
async fn launch_btc_chart() -> Result<String, String> {
    log_println!("\n{}", "=".repeat(60));
    log_println!("🚀 STARTING BTC CHART LAUNCH PROCESS");
    log_println!("{}\n", "=".repeat(60));
    
    // Log current working directory
    match std::env::current_dir() {
        Ok(cwd) => log_println!("📂 Current working directory: {:?}", cwd),
        Err(e) => log_println!("❌ Failed to get current directory: {}", e),
    }
    
    // Log current executable path
    let current_exe = match std::env::current_exe() {
        Ok(exe) => {
            log_println!("🔧 Current executable: {:?}", exe);
            exe
        }
        Err(e) => {
            let err_msg = format!("Failed to get current exe path: {}", e);
            log_println!("❌ {}", err_msg);
            return Err(err_msg);
        }
    };
    
    // Get parent directory
    let parent_dir = match current_exe.parent() {
        Some(parent) => {
            log_println!("📁 Parent directory: {:?}", parent);
            parent
        }
        None => {
            let err_msg = "Failed to get parent directory";
            log_println!("❌ {}", err_msg);
            return Err(err_msg.to_string());
        }
    };
    
    // Define possible paths for btc-chart
    let possible_paths = vec![
        parent_dir.join("btc-chart"),
        parent_dir.join("btc-chart.exe"),
        std::env::current_dir().unwrap_or_default().join("target/debug/btc-chart"),
        std::env::current_dir().unwrap_or_default().join("target/release/btc-chart"),
    ];
    
    log_println!("\n🔍 Searching for btc-chart binary in the following locations:");
    
    let mut found_path = None;
    for (idx, path) in possible_paths.iter().enumerate() {
        log_println!("  {}. {:?}", idx + 1, path);
        
        if path.exists() {
            log_println!("     ✅ EXISTS!");
            
            // Check if it's a file
            if path.is_file() {
                log_println!("     ✅ Is a file");
                
                // Check permissions on Unix
                #[cfg(unix)]
                {
                    match fs::metadata(&path) {
                        Ok(metadata) => {
                            let permissions = metadata.permissions();
                            let mode = permissions.mode();
                            log_println!("     📊 Permissions: {:o}", mode);
                            log_println!("     🔑 Executable: {}", mode & 0o111 != 0);
                        }
                        Err(e) => log_println!("     ❌ Failed to get metadata: {}", e),
                    }
                }
                
                if found_path.is_none() {
                    found_path = Some(path.clone());
                    log_println!("     🎯 Selected this path!");
                }
            } else {
                log_println!("     ❌ Not a file (might be directory)");
            }
        } else {
            log_println!("     ❌ Does not exist");
        }
    }
    
    let btc_chart_path = match found_path {
        Some(path) => {
            log_println!("\n✅ Found btc-chart binary at: {:?}", path);
            path
        }
        None => {
            let err_msg = "BTC Chart binary not found in any expected location!";
            log_println!("\n❌ {}", err_msg);
            log_println!("💡 Hint: Make sure you've built the btc-chart with:");
            log_println!("   cargo build -p btc-chart");
            return Err(err_msg.to_string());
        }
    };
    
    // Launch the binary with detailed logging
    log_println!("\n{}", "=".repeat(60));
    log_println!("🚀 LAUNCHING BINARY");
    log_println!("{}\n", "=".repeat(60));
    
    launch_binary_with_logging(&btc_chart_path).await
}

async fn launch_binary_with_logging(path: &std::path::Path) -> Result<String, String> {
    log_println!("📍 Binary path: {:?}", path);
    log_println!("🏃 Attempting to spawn process...");
    
    // Test if binary can even run
    log_println!("\n🧪 Testing binary execution first...");
    let test_output = Command::new(path)
        .arg("--version")
        .env("RUST_LOG", "error")
        .output();

    match test_output {
        Ok(output) => {
            if output.status.success() {
                log_println!("✅ Binary test passed");
            } else {
                log_println!("⚠️  Binary test failed with exit code: {:?}", output.status.code());
                log_println!("   Stdout: {}", String::from_utf8_lossy(&output.stdout));
                log_println!("   Stderr: {}", String::from_utf8_lossy(&output.stderr));
            }
        }
        Err(e) => {
            log_println!("❌ Binary test failed: {}", e);
        }
    }
    
    // Set up the command with extensive configuration
    let mut cmd = Command::new(path);
    
    // Set environment variables
    log_println!("\n📋 Setting environment variables:");
    cmd.env("RUST_LOG", "info,btc_chart=debug,wgpu=warn");
    log_println!("   RUST_LOG=info,btc_chart=debug,wgpu=warn");
    
    cmd.env("RUST_BACKTRACE", "1");
    log_println!("   RUST_BACKTRACE=1");
    
    // Set display environment variables
    log_println!("\n📺 Setting display environment:");
    
    // Get current DISPLAY variable
    if let Ok(display) = std::env::var("DISPLAY") {
        log_println!("   Current DISPLAY: {}", display);
        cmd.env("DISPLAY", display);
    } else {
        log_println!("   ⚠️  DISPLAY not set! Setting to :0");
        cmd.env("DISPLAY", ":0");
    }
    
    // Check for Wayland
    if let Ok(wayland_display) = std::env::var("WAYLAND_DISPLAY") {
        log_println!("   Wayland detected: {}", wayland_display);
        cmd.env("WAYLAND_DISPLAY", wayland_display);
    }
    
    // Check XDG_SESSION_TYPE
    if let Ok(session_type) = std::env::var("XDG_SESSION_TYPE") {
        log_println!("   Session type: {}", session_type);
        cmd.env("XDG_SESSION_TYPE", session_type);
    }
    
    // GPU debugging
    cmd.env("WGPU_BACKEND", "vulkan,gl,dx12");
    log_println!("   WGPU_BACKEND=vulkan,gl,dx12");
    
    // Enable wgpu validation
    cmd.env("WGPU_VALIDATION", "1");
    log_println!("   WGPU_VALIDATION=1");
    
    // Set working directory
    if let Ok(current_dir) = std::env::current_dir() {
        log_println!("   Working directory: {:?}", current_dir);
        cmd.current_dir(&current_dir);
    }
    
    // Configure stdio to inherit from parent
    cmd.stdout(Stdio::inherit())
       .stderr(Stdio::inherit())
       .stdin(Stdio::null());
    
    log_println!("\n🔧 Command configuration:");
    log_println!("   stdout: inherited (will show in terminal)");
    log_println!("   stderr: inherited (will show in terminal)");
    log_println!("   stdin: null");
    
    // Try to launch
    log_println!("\n🚀 Spawning process...");
    match cmd.spawn() {
        Ok(mut child) => {
            let pid = child.id();
            log_println!("\n{}", "=".repeat(60));
            log_println!("✅ SUCCESS! BTC Chart launched!");
            log_println!("{}", "=".repeat(60));
            log_println!("🆔 Process ID: {}", pid);
            log_println!("📊 Status: Running");
            log_println!("\n💡 The 3D chart should now be running in a separate window.");
            log_println!("   Check your taskbar/dock for a new window.");
            log_println!("   Any errors from btc-chart will appear below:\n");
            
            // Monitor the process for a bit longer
            log_println!("\n📊 Monitoring process for 3 seconds...");
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            
            // Check window list on Linux
            #[cfg(target_os = "linux")]
            {
                let wmctrl_output = Command::new("wmctrl")
                    .arg("-l")
                    .output();
                    
                if let Ok(output) = wmctrl_output {
                    let windows = String::from_utf8_lossy(&output.stdout);
                    if windows.contains("BTC Chart") || windows.contains("3D BTC") || windows.contains("Bitcoin") {
                        log_println!("✅ Window found in window list!");
                        log_println!("🎉 3D Chart is running successfully!");
                    } else {
                        log_println!("⚠️  Window not found in window list (this might be normal)");
                        log_println!("   The chart might still be running - check your taskbar");
                        log_println!("   Some window managers don't report all windows");
                    }
                } else {
                    log_println!("ℹ️  wmctrl not available - cannot check window list");
                    log_println!("   This is normal if wmctrl is not installed");
                }
            }
            
            match child.try_wait() {
                Ok(Some(status)) => {
                    log_println!("\n⚠️  WARNING: Process exited!");
                    log_println!("   Exit status: {:?}", status);
                    log_println!("   This usually means the btc-chart crashed.");
                    
                    // Try alternative launch method
                    log_println!("\n🔄 Trying alternative launch method...");
                    return launch_with_terminal_wrapper(path).await;
                }
                Ok(None) => {
                    log_println!("✅ Process still running after 3 seconds!");
                    Ok(format!("Chart launched successfully (PID: {})", pid))
                }
                Err(e) => {
                    log_println!("⚠️  Could not check process status: {}", e);
                    Ok(format!("Chart launched (PID: {}), but status unknown", pid))
                }
            }
        }
        Err(e) => {
            log_println!("\n{}", "=".repeat(60));
            log_println!("❌ FAILED TO LAUNCH!");
            log_println!("{}", "=".repeat(60));
            log_println!("Error: {}", e);
            log_println!("\n🔍 Debugging information:");
            log_println!("   Error kind: {:?}", e.kind());
            
            match e.kind() {
                std::io::ErrorKind::NotFound => {
                    log_println!("   → Binary not found at the specified path");
                    log_println!("   → Path might be incorrect");
                }
                std::io::ErrorKind::PermissionDenied => {
                    log_println!("   → Permission denied!");
                    log_println!("   → Try: chmod +x {:?}", path);
                }
                _ => {
                    log_println!("   → Unexpected error type");
                }
            }
            
            log_println!("\n💡 Troubleshooting steps:");
            log_println!("   1. Verify the binary exists: ls -la {:?}", path);
            log_println!("   2. Check permissions: file {:?}", path);
            log_println!("   3. Try running directly: {:?}", path);
            log_println!("   4. Rebuild: cargo build -p btc-chart");
            
            Err(format!("Failed to launch chart: {}", e))
        }
    }
}

// Alternative launch method
async fn launch_with_terminal_wrapper(path: &std::path::Path) -> Result<String, String> {
    log_println!("🔄 Attempting to launch with shell wrapper...");
    
    let shell_cmd = format!(
        "cd {} && RUST_LOG=debug DISPLAY=:0 {} 2>&1",
        std::env::current_dir().unwrap().display(),
        path.display()
    );
    
    let result = Command::new("sh")
        .arg("-c")
        .arg(&shell_cmd)
        .spawn();
        
    match result {
        Ok(child) => {
            log_println!("✅ Launched via shell wrapper (PID: {})", child.id());
            Ok(format!("Chart launched via shell (PID: {})", child.id()))
        }
        Err(e) => {
            log_println!("❌ Shell wrapper also failed: {}", e);
            Err(format!("All launch methods failed: {}", e))
        }
    }
}

#[tauri::command]
async fn get_console_logs() -> Result<Vec<LogEntry>, String> {
    match LOG_BUFFER.read() {
        Ok(buffer) => Ok(buffer.iter().cloned().collect()),
        Err(_) => Err("Failed to read log buffer".to_string()),
    }
}

#[tauri::command]
async fn clear_console_logs() -> Result<(), String> {
    match LOG_BUFFER.write() {
        Ok(mut buffer) => {
            buffer.clear();
            Ok(())
        }
        Err(_) => Err("Failed to clear log buffer".to_string()),
    }
}

#[tauri::command]
async fn debug_btc_chart() -> Result<String, String> {
    log_println!("\n🔍 DEBUG: Direct btc-chart test");
    
    let btc_chart_path = std::env::current_dir()
        .unwrap_or_default()
        .join("target/debug/btc-chart");
        
    // Run with output capture
    let output = Command::new(&btc_chart_path)
        .env("RUST_LOG", "debug")
        .env("RUST_BACKTRACE", "1")
        .env("DISPLAY", ":0")
        .output();
        
    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            log_println!("Exit status: {:?}", output.status);
            log_println!("STDOUT:\n{}", stdout);
            log_println!("STDERR:\n{}", stderr);
            Ok(format!("Exit: {:?}\nOut: {}\nErr: {}", output.status, stdout, stderr))
        }
        Err(e) => {
            Err(format!("Failed to run: {}", e))
        }
    }
}

#[tauri::command]
async fn test_console_logs() -> Result<String, String> {
    log_println!("\n{}", "=".repeat(60));
    log_println!("🧪 CONSOLE TEST TRIGGERED");
    log_println!("{}", "=".repeat(60));
    
    log_println!("✅ SUCCESS: Console is working properly!");
    log_println!("📊 INFO: This is an info message");
    log_println!("⚠️  WARN: This is a warning message");
    log_println!("❌ ERROR: This is an error message (test)");
    log_println!("🔍 DEBUG: This is a debug message");
    
    log_println!("\n📋 System Information:");
    log_println!("   Platform: {:?}", std::env::consts::OS);
    log_println!("   Architecture: {:?}", std::env::consts::ARCH);
    log_println!("   Current dir: {:?}", std::env::current_dir());
    
    log_println!("\n✅ Test completed successfully!");
    
    Ok("Console test completed - check the console for logs".to_string())
}

#[tauri::command]
async fn test_btc_chart_binary() -> Result<String, String> {
    log_println!("\n{}", "=".repeat(60));
    log_println!("🧪 TESTING BTC CHART BINARY");
    log_println!("{}\n", "=".repeat(60));
    
    // Find the binary
    let btc_chart_path = std::env::current_dir()
        .unwrap_or_default()
        .join("target/debug/btc-chart");
    
    if !btc_chart_path.exists() {
        return Err("Binary not found at expected location".to_string());
    }
    
    // Try to run it with --help or --version
    let output = Command::new(&btc_chart_path)
        .arg("--help")
        .output();
    
    match output {
        Ok(output) => {
            log_println!("✅ Binary executed successfully!");
            log_println!("Exit code: {:?}", output.status.code());
            log_println!("Stdout: {}", String::from_utf8_lossy(&output.stdout));
            log_println!("Stderr: {}", String::from_utf8_lossy(&output.stderr));
            Ok("Test passed".to_string())
        }
        Err(e) => {
            log_println!("❌ Failed to execute binary: {}", e);
            Err(format!("Test failed: {}", e))
        }
    }
}

#[tauri::command]
async fn set_current_price(price: f64, state: tauri::State<'_, AppState>) -> Result<(), ()> {
    let mut current_price = state.current_price.lock().await;
    *current_price = Some(price);
    Ok(())
}
fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_current_price,
            set_current_price,
            launch_btc_chart,
            test_btc_chart_binary,
            debug_btc_chart,
            get_console_logs,
            clear_console_logs,
            test_console_logs
        ])
        .setup(|app| {
            log_println!("\n{}", "=".repeat(80));
            log_println!("🚀 STARTING BTC TRADING DASHBOARD");
            log_println!("{}", "=".repeat(80));
            
            log_println!("📊 Initializing Tauri application...");
            log_println!("🔧 Platform: {}", std::env::consts::OS);
            log_println!("🔧 Architecture: {}", std::env::consts::ARCH);
            
            // Log current working directory
            if let Ok(cwd) = std::env::current_dir() {
                log_println!("📁 Working directory: {:?}", cwd);
            }
            
            // Setup is complete
            log_println!("\n✅ Dashboard ready!");
            log_println!("{}", "=".repeat(80));
            log_println!("💡 Console logging is active. Use the Test Tauri Bridge button to verify.");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}