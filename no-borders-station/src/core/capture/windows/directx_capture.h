#ifndef DIRECTX_CAPTURE_H
#define DIRECTX_CAPTURE_H

#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <vector>
#include <memory>
#include <chrono>

namespace no_borders {
namespace capture {
namespace windows {

struct CaptureFrame {
    void* data;
    size_t size;
    uint32_t width;
    uint32_t height;
    uint32_t pitch;
    std::chrono::high_resolution_clock::time_point timestamp;
    std::vector<RECT> dirty_regions;
};

struct MonitorInfo {
    uint32_t monitor_id;
    RECT bounds;
    bool is_primary;
    std::wstring device_name;
    ID3D11Device* d3d_device;
    IDXGIOutputDuplication* duplication;
};

class DirectXCapture {
public:
    DirectXCapture();
    ~DirectXCapture();

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
    
    // Frame capture with dirty region detection
    bool CaptureFrame(uint32_t monitor_id, CaptureFrame& frame);
    
    // Performance optimizations
    void SetCaptureMode(bool use_dirty_regions = true);
    void SetTargetFrameRate(uint32_t fps = 120);
    
    // Hardware acceleration
    bool IsHardwareAccelerated() const { return hardware_accelerated_; }
    
    // Statistics
    double GetAverageFrameTime() const { return avg_frame_time_; }
    uint32_t GetFramesCaptured() const { return frames_captured_; }

private:
    std::vector<MonitorInfo> monitors_;
    bool initialized_;
    bool hardware_accelerated_;
    bool use_dirty_regions_;
    uint32_t target_fps_;
    
    // Performance tracking
    double avg_frame_time_;
    uint32_t frames_captured_;
    std::chrono::high_resolution_clock::time_point last_capture_time_;
    
    // DirectX resources
    ID3D11Device* d3d_device_;
    ID3D11DeviceContext* d3d_context_;
    IDXGIFactory1* dxgi_factory_;
    
    // Internal methods
    bool InitializeDirectX();
    bool CreateDuplicationForMonitor(MonitorInfo& monitor);
    bool ProcessDirtyRegions(const DXGI_OUTDUPL_FRAME_INFO& frame_info, 
                           std::vector<RECT>& dirty_regions);
    void UpdatePerformanceStats();
    void CleanupResources();
};

// Helper functions for performance monitoring
class CapturePerformanceMonitor {
public:
    static void StartTiming(const std::string& operation);
    static void EndTiming(const std::string& operation);
    static double GetAverageTime(const std::string& operation);
    static void LogPerformanceStats();
};

} // namespace windows
} // namespace capture
} // namespace no_borders

#endif // DIRECTX_CAPTURE_H
