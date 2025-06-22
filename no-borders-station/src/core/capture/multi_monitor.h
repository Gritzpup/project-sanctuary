#pragma once

#include <memory>
#include <vector>
#include <unordered_map>
#include <functional>
#include <atomic>
#include <thread>
#include <string>

namespace no_borders {
namespace capture {

struct MonitorInfo {
    uint32_t id;
    int32_t x, y, width, height;
    bool is_primary;
    double scale_factor;
    std::string name;
};

struct MultiMonitorFrame {
    std::vector<std::unique_ptr<uint8_t[]>> monitor_frames;
    std::vector<MonitorInfo> monitor_info;
    uint64_t timestamp;
    size_t total_size;
};

struct DirtyRegion {
    int32_t x, y, width, height;
    uint32_t monitor_id;
    uint64_t timestamp;
    bool is_merged;
};

class MultiMonitorCapture {
public:
    MultiMonitorCapture();
    ~MultiMonitorCapture();

    // Initialization
    bool Initialize();
    void Shutdown();

    // Monitor management
    bool ScanMonitors();
    std::vector<MonitorInfo> GetMonitors() const;
    bool ConfigureMonitor(uint32_t monitor_id, bool enable);
    bool SetMonitorPriority(uint32_t monitor_id, int priority);

    // Capture configuration
    bool SetGlobalCaptureRate(double fps);
    bool SetMonitorCaptureRate(uint32_t monitor_id, double fps);
    bool EnableAdaptiveCapture(bool enable);
    bool EnableDirtyRegionOptimization(bool enable);

    // Capture operations
    bool StartCapture();
    void StopCapture();
    bool IsCapturing() const;

    // Frame retrieval
    std::unique_ptr<MultiMonitorFrame> CaptureAllMonitors();
    bool CaptureAllMonitorsAsync(std::function<void(std::unique_ptr<MultiMonitorFrame>)> callback);

    // Dirty region management
    std::vector<DirtyRegion> GetDirtyRegions(uint32_t monitor_id) const;
    bool MergeDirtyRegions(std::vector<DirtyRegion>& regions);
    void ClearDirtyRegions(uint32_t monitor_id);

    // Performance monitoring
    double GetAverageLatency() const;
    uint64_t GetTotalFramesCaptured() const;
    uint64_t GetTotalBytesTransferred() const;
    std::unordered_map<uint32_t, double> GetPerMonitorFPS() const;

    // Error handling
    const char* GetLastError() const;

private:
    struct Impl;
    std::unique_ptr<Impl> pImpl;

    // Internal methods
    bool InitializeMonitorCapture(uint32_t monitor_id);
    void CleanupMonitorCapture(uint32_t monitor_id);
    bool UpdateDirtyRegionsForMonitor(uint32_t monitor_id);
    void OptimizeCaptureRates();
    void ProcessCaptureQueue();
};

// Cross-platform dirty region tracker
class DirtyRegionTracker {
public:
    DirtyRegionTracker();
    ~DirtyRegionTracker();

    bool Initialize(uint32_t monitor_id, int32_t width, int32_t height);
    void Shutdown();

    // Region tracking
    bool TrackChanges(const uint8_t* current_frame, const uint8_t* previous_frame,
                     uint32_t width, uint32_t height, uint32_t stride);
    std::vector<DirtyRegion> GetDirtyRegions() const;
    void ClearDirtyRegions();

    // Optimization
    bool SetDetectionThreshold(double threshold);
    bool EnableRegionMerging(bool enable);
    bool SetMinRegionSize(uint32_t min_width, uint32_t min_height);
    bool SetMaxRegionCount(uint32_t max_regions);

    // Performance
    uint64_t GetPixelsCompared() const;
    uint64_t GetRegionsDetected() const;
    double GetDetectionTime() const;

private:
    struct Impl;
    std::unique_ptr<Impl> pImpl;

    // Internal methods
    bool CompareRegions(const uint8_t* frame1, const uint8_t* frame2,
                       int32_t x, int32_t y, uint32_t width, uint32_t height,
                       uint32_t stride);
    void MergeAdjacentRegions();
    bool ShouldMergeRegions(const DirtyRegion& r1, const DirtyRegion& r2);
};

} // namespace capture
} // namespace no_borders
