#ifndef X11_CAPTURE_H
#define X11_CAPTURE_H

#include <X11/Xlib.h>
#include <X11/extensions/Xdamage.h>
#include <X11/extensions/Xfixes.h>
#include <X11/extensions/XShm.h>
#include <sys/shm.h>
#include <vector>
#include <memory>
#include <chrono>
#include <string>

namespace no_borders {
namespace capture {
namespace linux_platform {

struct CaptureFrame {
    void* data;
    size_t size;
    uint32_t width;
    uint32_t height;
    uint32_t pitch;
    uint32_t depth;
    std::chrono::high_resolution_clock::time_point timestamp;
    std::vector<XRectangle> dirty_regions;
};

struct MonitorInfo {
    uint32_t monitor_id;
    int x, y;
    uint32_t width, height;
    bool is_primary;
    std::string name;
    Window root_window;
    Damage damage;
};

class X11Capture {
public:
    X11Capture();
    ~X11Capture();

    // Initialize capture system
    bool Initialize();
    void Shutdown();

    // Monitor management
    bool EnumerateMonitors();
    size_t GetMonitorCount() const { return monitors_.size(); }
    const MonitorInfo& GetMonitor(size_t index) const { return monitors_[index]; }

    // Capture operations
    bool StartCapture(uint32_t monitor_id = 0);
    bool StopCapture(uint32_t monitor_id = 0);
    
    // Frame capture with damage tracking
    bool CaptureMonitorFrame(uint32_t monitor_id, CaptureFrame& frame);
    
    // Performance optimizations
    void SetUseDamageExtension(bool use_damage = true);
    void SetUseSharedMemory(bool use_shm = true);
    void SetTargetFrameRate(uint32_t fps = 120);
    
    // Hardware acceleration status
    bool IsHardwareAccelerated() const { return use_shm_; }
    
    // Statistics
    double GetAverageFrameTime() const { return avg_frame_time_; }
    uint32_t GetFramesCaptured() const { return frames_captured_; }
    uint32_t GetDamageEvents() const { return damage_events_; }

private:
    std::vector<MonitorInfo> monitors_;
    bool initialized_;
    bool use_damage_;
    bool use_shm_;
    uint32_t target_fps_;
    
    // Performance tracking
    double avg_frame_time_;
    uint32_t frames_captured_;
    uint32_t damage_events_;
    std::chrono::high_resolution_clock::time_point last_capture_time_;
    
    // X11 resources
    Display* display_;
    int screen_;
    Window root_window_;
    XImage* ximage_;
    XShmSegmentInfo shm_info_;
    
    // Damage extension
    int damage_event_base_;
    int damage_error_base_;
    
    // Internal methods
    bool InitializeX11();
    bool InitializeDamageExtension();
    bool InitializeSharedMemory(uint32_t width, uint32_t height);
    bool CreateDamageForMonitor(MonitorInfo& monitor);
    bool ProcessDamageEvents(uint32_t monitor_id, std::vector<XRectangle>& damage_regions);
    void UpdatePerformanceStats();
    void CleanupResources();
    bool CaptureWithSharedMemory(const MonitorInfo& monitor, CaptureFrame& frame);
    bool CaptureWithXGetImage(const MonitorInfo& monitor, CaptureFrame& frame);
};

// Helper class for X11 error handling
class X11ErrorHandler {
public:
    static int HandleError(Display* display, XErrorEvent* event);
    static void InstallHandler();
    static void RemoveHandler();
};

} // namespace linux_platform
} // namespace capture
} // namespace no_borders

#endif // X11_CAPTURE_H
