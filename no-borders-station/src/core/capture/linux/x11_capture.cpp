#include "x11_capture.h"
#include <iostream>
#include <cstring>
#include <algorithm>
#include <X11/extensions/Xrandr.h>

namespace no_borders {
namespace capture {
namespace linux_platform {

static int x11_error_handler(Display* display, XErrorEvent* event) {
    return X11ErrorHandler::HandleError(display, event);
}

X11Capture::X11Capture()
    : initialized_(false)
    , use_damage_(true)
    , use_shm_(true)
    , target_fps_(120)
    , avg_frame_time_(0.0)
    , frames_captured_(0)
    , damage_events_(0)
    , display_(nullptr)
    , screen_(0)
    , root_window_(0)
    , ximage_(nullptr)
    , damage_event_base_(0)
    , damage_error_base_(0) {
    
    memset(&shm_info_, 0, sizeof(shm_info_));
}

X11Capture::~X11Capture() {
    Shutdown();
}

bool X11Capture::Initialize() {
    if (initialized_) {
        return true;
    }

    std::cout << "[X11Capture] Initializing X11 screen capture..." << std::endl;

    // Install error handler
    X11ErrorHandler::InstallHandler();

    // Initialize X11 connection
    if (!InitializeX11()) {
        std::cerr << "[X11Capture] Failed to initialize X11" << std::endl;
        return false;
    }

    // Initialize damage extension
    if (use_damage_ && !InitializeDamageExtension()) {
        std::cout << "[X11Capture] Damage extension not available, using full frame capture" << std::endl;
        use_damage_ = false;
    }

    // Enumerate available monitors
    if (!EnumerateMonitors()) {
        std::cerr << "[X11Capture] Failed to enumerate monitors" << std::endl;
        return false;
    }

    initialized_ = true;

    std::cout << "[X11Capture] Successfully initialized with " 
              << monitors_.size() << " monitors" << std::endl;
    std::cout << "[X11Capture] Damage extension: " << (use_damage_ ? "enabled" : "disabled") << std::endl;
    std::cout << "[X11Capture] Shared memory: " << (use_shm_ ? "enabled" : "disabled") << std::endl;
    
    return true;
}

void X11Capture::Shutdown() {
    if (!initialized_) {
        return;
    }

    std::cout << "[X11Capture] Shutting down..." << std::endl;

    // Stop all captures
    for (const auto& monitor : monitors_) {
        StopCapture(monitor.monitor_id);
    }

    CleanupResources();
    
    if (display_) {
        XCloseDisplay(display_);
        display_ = nullptr;
    }

    X11ErrorHandler::RemoveHandler();
    initialized_ = false;
}

bool X11Capture::InitializeX11() {
    // Open X11 display
    display_ = XOpenDisplay(nullptr);
    if (!display_) {
        std::cerr << "[X11Capture] Cannot open X11 display" << std::endl;
        return false;
    }

    screen_ = DefaultScreen(display_);
    root_window_ = RootWindow(display_, screen_);

    std::cout << "[X11Capture] Connected to X11 display" << std::endl;
    std::cout << "[X11Capture] Screen: " << screen_ << ", Root window: " << root_window_ << std::endl;

    return true;
}

bool X11Capture::InitializeDamageExtension() {
    // Check if Damage extension is available
    if (!XDamageQueryExtension(display_, &damage_event_base_, &damage_error_base_)) {
        return false;
    }

    int major, minor;
    if (!XDamageQueryVersion(display_, &major, &minor)) {
        return false;
    }

    std::cout << "[X11Capture] Damage extension version: " << major << "." << minor << std::endl;
    return true;
}

bool X11Capture::EnumerateMonitors() {
    monitors_.clear();

    // Use XRandR to enumerate monitors
    int num_sizes;
    XRRScreenSize* sizes = XRRSizes(display_, screen_, &num_sizes);
    
    if (!sizes || num_sizes == 0) {
        // Fallback to single screen
        MonitorInfo monitor;
        monitor.monitor_id = 0;
        monitor.x = 0;
        monitor.y = 0;
        monitor.width = DisplayWidth(display_, screen_);
        monitor.height = DisplayHeight(display_, screen_);
        monitor.is_primary = true;
        monitor.name = "Default";
        monitor.root_window = root_window_;
        monitor.damage = 0;
        
        monitors_.push_back(monitor);
        std::cout << "[X11Capture] Single monitor: " << monitor.width << "x" << monitor.height << std::endl;
        return true;
    }

    // Get current screen configuration
    XRRScreenConfiguration* config = XRRGetScreenInfo(display_, root_window_);
    Rotation current_rotation;
    SizeID current_size = XRRConfigCurrentConfiguration(config, &current_rotation);

    if (current_size < num_sizes) {
        MonitorInfo monitor;
        monitor.monitor_id = 0;
        monitor.x = 0;
        monitor.y = 0;
        monitor.width = sizes[current_size].width;
        monitor.height = sizes[current_size].height;
        monitor.is_primary = true;
        monitor.name = "Primary";
        monitor.root_window = root_window_;
        monitor.damage = 0;
        
        monitors_.push_back(monitor);
        
        std::cout << "[X11Capture] Monitor 0: " << monitor.width << "x" << monitor.height << std::endl;
    }

    XRRFreeScreenConfigInfo(config);
    return !monitors_.empty();
}

bool X11Capture::StartCapture(uint32_t monitor_id) {
    if (monitor_id >= monitors_.size()) {
        std::cerr << "[X11Capture] Invalid monitor ID: " << monitor_id << std::endl;
        return false;
    }

    MonitorInfo& monitor = monitors_[monitor_id];
    
    // Initialize shared memory if needed
    if (use_shm_ && !InitializeSharedMemory(monitor.width, monitor.height)) {
        std::cout << "[X11Capture] Shared memory initialization failed, falling back to XGetImage" << std::endl;
        use_shm_ = false;
    }

    // Create damage tracking if enabled
    if (use_damage_ && !CreateDamageForMonitor(monitor)) {
        std::cout << "[X11Capture] Damage tracking creation failed for monitor " << monitor_id << std::endl;
        use_damage_ = false;
    }

    std::cout << "[X11Capture] Started capture for monitor " << monitor_id << std::endl;
    return true;
}

bool X11Capture::InitializeSharedMemory(uint32_t width, uint32_t height) {
    // Create XImage with shared memory
    ximage_ = XShmCreateImage(display_, DefaultVisual(display_, screen_), 
                              DefaultDepth(display_, screen_), ZPixmap, 
                              nullptr, &shm_info_, width, height);
    
    if (!ximage_) {
        return false;
    }

    // Allocate shared memory
    shm_info_.shmid = shmget(IPC_PRIVATE, 
                             ximage_->bytes_per_line * ximage_->height, 
                             IPC_CREAT | 0777);
    
    if (shm_info_.shmid == -1) {
        XDestroyImage(ximage_);
        ximage_ = nullptr;
        return false;
    }

    // Attach shared memory
    shm_info_.shmaddr = ximage_->data = (char*)shmat(shm_info_.shmid, 0, 0);
    if (shm_info_.shmaddr == (char*)-1) {
        shmctl(shm_info_.shmid, IPC_RMID, 0);
        XDestroyImage(ximage_);
        ximage_ = nullptr;
        return false;
    }

    shm_info_.readOnly = False;

    // Attach to X server
    if (!XShmAttach(display_, &shm_info_)) {
        shmdt(shm_info_.shmaddr);
        shmctl(shm_info_.shmid, IPC_RMID, 0);
        XDestroyImage(ximage_);
        ximage_ = nullptr;
        return false;
    }

    // Sync to ensure attachment is complete
    XSync(display_, False);

    std::cout << "[X11Capture] Shared memory initialized: " 
              << width << "x" << height << " (" 
              << ximage_->bytes_per_line * ximage_->height << " bytes)" << std::endl;

    return true;
}

bool X11Capture::CreateDamageForMonitor(MonitorInfo& monitor) {
    if (!use_damage_) {
        return false;
    }

    // Create damage object for the root window
    monitor.damage = XDamageCreate(display_, monitor.root_window, XDamageReportNonEmpty);
    if (monitor.damage == 0) {
        return false;
    }

    std::cout << "[X11Capture] Created damage tracking for monitor " << monitor.monitor_id << std::endl;
    return true;
}

bool X11Capture::CaptureMonitorFrame(uint32_t monitor_id, CaptureFrame& frame) {
    if (monitor_id >= monitors_.size()) {
        return false;
    }

    auto start_time = std::chrono::high_resolution_clock::now();
    
    const MonitorInfo& monitor = monitors_[monitor_id];
    
    bool success = false;
    if (use_shm_ && ximage_) {
        success = CaptureWithSharedMemory(monitor, frame);
    } else {
        success = CaptureWithXGetImage(monitor, frame);
    }

    if (success) {
        frame.timestamp = std::chrono::high_resolution_clock::now();
        
        // Process damage events if enabled
        if (use_damage_ && monitor.damage != 0) {
            ProcessDamageEvents(monitor_id, frame.dirty_regions);
        }

        UpdatePerformanceStats();
        frames_captured_++;

        auto end_time = std::chrono::high_resolution_clock::now();
        auto frame_time = std::chrono::duration<double, std::milli>(end_time - start_time).count();
        
        // Update rolling average
        avg_frame_time_ = (avg_frame_time_ * 0.9) + (frame_time * 0.1);
    }

    return success;
}

bool X11Capture::CaptureWithSharedMemory(const MonitorInfo& monitor, CaptureFrame& frame) {
    // Capture using shared memory
    if (!XShmGetImage(display_, monitor.root_window, ximage_, 
                      monitor.x, monitor.y, AllPlanes)) {
        return false;
    }

    frame.data = ximage_->data;
    frame.size = ximage_->bytes_per_line * ximage_->height;
    frame.width = ximage_->width;
    frame.height = ximage_->height;
    frame.pitch = ximage_->bytes_per_line;
    frame.depth = ximage_->depth;

    return true;
}

bool X11Capture::CaptureWithXGetImage(const MonitorInfo& monitor, CaptureFrame& frame) {
    // Capture using XGetImage (slower but always works)
    XImage* image = XGetImage(display_, monitor.root_window, 
                              monitor.x, monitor.y, monitor.width, monitor.height,
                              AllPlanes, ZPixmap);
    
    if (!image) {
        return false;
    }

    frame.data = image->data;
    frame.size = image->bytes_per_line * image->height;
    frame.width = image->width;
    frame.height = image->height;
    frame.pitch = image->bytes_per_line;
    frame.depth = image->depth;

    // Note: Caller is responsible for calling XDestroyImage when done
    return true;
}

bool X11Capture::ProcessDamageEvents(uint32_t monitor_id, std::vector<XRectangle>& damage_regions) {
    if (!use_damage_ || monitor_id >= monitors_.size()) {
        return false;
    }

    const MonitorInfo& monitor = monitors_[monitor_id];
    
    // Check for pending damage events
    XEvent event;
    while (XCheckTypedEvent(display_, damage_event_base_ + XDamageNotify, &event)) {
        XDamageNotifyEvent* damage_event = (XDamageNotifyEvent*)&event;
        
        if (damage_event->damage == monitor.damage) {
            XRectangle rect;
            rect.x = damage_event->area.x;
            rect.y = damage_event->area.y;
            rect.width = damage_event->area.width;
            rect.height = damage_event->area.height;
            
            damage_regions.push_back(rect);
            damage_events_++;
        }
    }

    // Subtract the damage to reset for next frame
    if (!damage_regions.empty()) {
        XDamageSubtract(display_, monitor.damage, None, None);
    }

    return !damage_regions.empty();
}

void X11Capture::UpdatePerformanceStats() {
    // Performance monitoring could be enhanced here
}

bool X11Capture::StopCapture(uint32_t monitor_id) {
    if (monitor_id >= monitors_.size()) {
        return false;
    }

    MonitorInfo& monitor = monitors_[monitor_id];
    
    if (monitor.damage != 0) {
        XDamageDestroy(display_, monitor.damage);
        monitor.damage = 0;
    }

    std::cout << "[X11Capture] Stopped capture for monitor " << monitor_id << std::endl;
    return true;
}

void X11Capture::CleanupResources() {
    if (ximage_) {
        XShmDetach(display_, &shm_info_);
        XDestroyImage(ximage_);
        shmdt(shm_info_.shmaddr);
        shmctl(shm_info_.shmid, IPC_RMID, 0);
        ximage_ = nullptr;
    }

    for (auto& monitor : monitors_) {
        if (monitor.damage != 0) {
            XDamageDestroy(display_, monitor.damage);
            monitor.damage = 0;
        }
    }
}

void X11Capture::SetUseDamageExtension(bool use_damage) {
    use_damage_ = use_damage;
    std::cout << "[X11Capture] Damage extension " 
              << (use_damage ? "enabled" : "disabled") << std::endl;
}

void X11Capture::SetUseSharedMemory(bool use_shm) {
    use_shm_ = use_shm;
    std::cout << "[X11Capture] Shared memory " 
              << (use_shm ? "enabled" : "disabled") << std::endl;
}

void X11Capture::SetTargetFrameRate(uint32_t fps) {
    target_fps_ = fps;
    std::cout << "[X11Capture] Target frame rate set to " << fps << " fps" << std::endl;
}

// X11 Error Handler implementation
int X11ErrorHandler::HandleError(Display* display, XErrorEvent* event) {
    char error_text[256];
    XGetErrorText(display, event->error_code, error_text, sizeof(error_text));
    std::cerr << "[X11Capture] X11 Error: " << error_text 
              << " (code: " << (int)event->error_code << ")" << std::endl;
    return 0; // Don't exit on errors
}

void X11ErrorHandler::InstallHandler() {
    XSetErrorHandler(x11_error_handler);
}

void X11ErrorHandler::RemoveHandler() {
    XSetErrorHandler(nullptr);
}

} // namespace linux_platform
} // namespace capture
} // namespace no_borders
