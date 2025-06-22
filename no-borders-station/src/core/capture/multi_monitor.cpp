#include "multi_monitor.h"
#include <chrono>
#include <algorithm>
#include <cstring>
#include <unordered_set>
#include <thread>

#ifdef _WIN32
#include <windows.h>
#include <setupapi.h>
#elif __linux__
#include <X11/Xlib.h>
#include <X11/extensions/Xinerama.h>
#include <sys/sysinfo.h>
#elif __APPLE__
#include <CoreGraphics/CoreGraphics.h>
#endif

namespace no_borders {
namespace capture {

struct MultiMonitorCapture::Impl {
    std::unordered_map<uint32_t, MonitorInfo> monitors;
    std::unordered_map<uint32_t, bool> monitor_enabled;
    std::unordered_map<uint32_t, int> monitor_priority;
    std::unordered_map<uint32_t, double> monitor_fps;
    std::unordered_map<uint32_t, std::unique_ptr<DirtyRegionTracker>> dirty_trackers;
    
    // Simplified platform capture - just store frame data for now
    std::unordered_map<uint32_t, std::vector<uint8_t>> platform_frame_data;
    
    std::atomic<bool> is_capturing{false};
    std::atomic<bool> enable_adaptive_capture{true};
    std::atomic<bool> enable_dirty_optimization{true};
    double global_fps = 60.0;
    
    // Performance metrics
    std::atomic<uint64_t> total_frames_captured{0};
    std::atomic<uint64_t> total_bytes_transferred{0};
    std::chrono::steady_clock::time_point capture_start_time;
    std::unordered_map<uint32_t, uint64_t> per_monitor_frames;
    std::unordered_map<uint32_t, std::chrono::steady_clock::time_point> last_capture_times;
    
    // Async capture
    std::function<void(std::unique_ptr<MultiMonitorFrame>)> async_callback;
    std::thread capture_thread;
    std::atomic<bool> stop_capture_thread{false};
    
    std::string last_error;
};

MultiMonitorCapture::MultiMonitorCapture() : pImpl(std::make_unique<Impl>()) {}

MultiMonitorCapture::~MultiMonitorCapture() {
    Shutdown();
}

bool MultiMonitorCapture::Initialize() {
    return ScanMonitors();
}

void MultiMonitorCapture::Shutdown() {
    StopCapture();
    
    // Clean up platform frame data
    pImpl->platform_frame_data.clear();
    pImpl->dirty_trackers.clear();
    pImpl->monitors.clear();
}

bool MultiMonitorCapture::ScanMonitors() {
    pImpl->monitors.clear();
    
#ifdef _WIN32
    // Windows monitor enumeration (simplified)
    MonitorInfo info;
    info.id = 0;
    info.x = 0;
    info.y = 0;
    info.width = 1920;
    info.height = 1080;
    info.is_primary = true;
    info.scale_factor = 1.0;
    info.name = "Primary Monitor";
    
    pImpl->monitors[info.id] = info;
    pImpl->monitor_enabled[info.id] = true;
    pImpl->monitor_priority[info.id] = 0;
    pImpl->monitor_fps[info.id] = pImpl->global_fps;
    
#elif __linux__
    // Linux X11 monitor enumeration (simplified)
    Display* display = XOpenDisplay(nullptr);
    if (display) {
        MonitorInfo info;
        info.id = 0;
        info.x = 0;
        info.y = 0;
        info.width = DisplayWidth(display, DefaultScreen(display));
        info.height = DisplayHeight(display, DefaultScreen(display));
        info.is_primary = true;
        info.scale_factor = 1.0;
        info.name = "Primary Monitor";
        
        pImpl->monitors[info.id] = info;
        pImpl->monitor_enabled[info.id] = true;
        pImpl->monitor_priority[info.id] = 0;
        pImpl->monitor_fps[info.id] = pImpl->global_fps;
        
        XCloseDisplay(display);
    }
    
#elif __APPLE__
    // macOS monitor enumeration (simplified)
    MonitorInfo info;
    info.id = 0;
    info.x = 0;
    info.y = 0;
    info.width = 1920;
    info.height = 1080;
    info.is_primary = true;
    info.scale_factor = 1.0;
    info.name = "Primary Monitor";
    
    pImpl->monitors[info.id] = info;
    pImpl->monitor_enabled[info.id] = true;
    pImpl->monitor_priority[info.id] = 0;
    pImpl->monitor_fps[info.id] = pImpl->global_fps;
#endif
    
    // Initialize dirty region trackers
    for (const auto& [monitor_id, monitor_info] : pImpl->monitors) {
        auto tracker = std::make_unique<DirtyRegionTracker>();
        if (tracker->Initialize(monitor_id, monitor_info.width, monitor_info.height)) {
            pImpl->dirty_trackers[monitor_id] = std::move(tracker);
        }
    }
    
    return !pImpl->monitors.empty();
}

std::vector<MonitorInfo> MultiMonitorCapture::GetMonitors() const {
    std::vector<MonitorInfo> monitors;
    for (const auto& [id, info] : pImpl->monitors) {
        monitors.push_back(info);
    }
    
    // Sort by priority
    std::sort(monitors.begin(), monitors.end(),
              [this](const MonitorInfo& a, const MonitorInfo& b) {
                  auto it_a = pImpl->monitor_priority.find(a.id);
                  auto it_b = pImpl->monitor_priority.find(b.id);
                  int priority_a = (it_a != pImpl->monitor_priority.end()) ? it_a->second : 999;
                  int priority_b = (it_b != pImpl->monitor_priority.end()) ? it_b->second : 999;
                  return priority_a < priority_b;
              });
    
    return monitors;
}

bool MultiMonitorCapture::ConfigureMonitor(uint32_t monitor_id, bool enable) {
    if (pImpl->monitors.find(monitor_id) == pImpl->monitors.end()) {
        pImpl->last_error = "Invalid monitor ID";
        return false;
    }
    
    pImpl->monitor_enabled[monitor_id] = enable;
    
    if (enable) {
        return InitializeMonitorCapture(monitor_id);
    } else {
        CleanupMonitorCapture(monitor_id);
        return true;
    }
}

bool MultiMonitorCapture::SetMonitorPriority(uint32_t monitor_id, int priority) {
    if (pImpl->monitors.find(monitor_id) == pImpl->monitors.end()) {
        pImpl->last_error = "Invalid monitor ID";
        return false;
    }
    
    pImpl->monitor_priority[monitor_id] = priority;
    return true;
}

bool MultiMonitorCapture::SetGlobalCaptureRate(double fps) {
    if (fps <= 0 || fps > 240) {
        pImpl->last_error = "Invalid capture rate";
        return false;
    }
    
    pImpl->global_fps = fps;
    
    // Update all monitor rates
    for (auto& [monitor_id, monitor_fps] : pImpl->monitor_fps) {
        monitor_fps = fps;
    }
    
    return true;
}

bool MultiMonitorCapture::SetMonitorCaptureRate(uint32_t monitor_id, double fps) {
    if (pImpl->monitors.find(monitor_id) == pImpl->monitors.end()) {
        pImpl->last_error = "Invalid monitor ID";
        return false;
    }
    
    if (fps <= 0 || fps > 240) {
        pImpl->last_error = "Invalid capture rate";
        return false;
    }
    
    pImpl->monitor_fps[monitor_id] = fps;
    return true;
}

bool MultiMonitorCapture::EnableAdaptiveCapture(bool enable) {
    pImpl->enable_adaptive_capture = enable;
    return true;
}

bool MultiMonitorCapture::EnableDirtyRegionOptimization(bool enable) {
    pImpl->enable_dirty_optimization = enable;
    return true;
}

bool MultiMonitorCapture::StartCapture() {
    if (pImpl->is_capturing) {
        return true;
    }
    
    // Initialize captures for enabled monitors
    for (const auto& [monitor_id, enabled] : pImpl->monitor_enabled) {
        if (enabled && !InitializeMonitorCapture(monitor_id)) {
            StopCapture();
            return false;
        }
    }
    
    pImpl->is_capturing = true;
    pImpl->capture_start_time = std::chrono::steady_clock::now();
    
    // Start capture thread for async operations
    pImpl->stop_capture_thread = false;
    pImpl->capture_thread = std::thread(&MultiMonitorCapture::ProcessCaptureQueue, this);
    
    return true;
}

void MultiMonitorCapture::StopCapture() {
    pImpl->is_capturing = false;
    
    // Stop capture thread
    pImpl->stop_capture_thread = true;
    if (pImpl->capture_thread.joinable()) {
        pImpl->capture_thread.join();
    }
    
    // Clean up platform captures
    for (const auto& [monitor_id, enabled] : pImpl->monitor_enabled) {
        if (enabled) {
            CleanupMonitorCapture(monitor_id);
        }
    }
}

bool MultiMonitorCapture::IsCapturing() const {
    return pImpl->is_capturing;
}

std::unique_ptr<MultiMonitorFrame> MultiMonitorCapture::CaptureAllMonitors() {
    if (!pImpl->is_capturing) {
        pImpl->last_error = "Capture not started";
        return nullptr;
    }
    
    auto frame = std::make_unique<MultiMonitorFrame>();
    frame->timestamp = std::chrono::duration_cast<std::chrono::microseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
    
    // Create dummy frame data for each enabled monitor
    for (const auto& [monitor_id, enabled] : pImpl->monitor_enabled) {
        if (enabled) {
            auto it = pImpl->monitors.find(monitor_id);
            if (it != pImpl->monitors.end()) {
                const auto& monitor_info = it->second;
                size_t frame_size = monitor_info.width * monitor_info.height * 4; // RGBA
                
                auto monitor_frame = std::make_unique<uint8_t[]>(frame_size);
                // Fill with dummy pattern
                for (size_t i = 0; i < frame_size; i += 4) {
                    monitor_frame[i] = (monitor_id * 50) % 255;     // R
                    monitor_frame[i+1] = (monitor_id * 100) % 255;  // G
                    monitor_frame[i+2] = (monitor_id * 150) % 255;  // B
                    monitor_frame[i+3] = 255;                       // A
                }
                
                frame->monitor_frames.push_back(std::move(monitor_frame));
                frame->monitor_info.push_back(monitor_info);
                frame->total_size += frame_size;
            }
        }
    }
    
    // Update performance metrics
    pImpl->total_frames_captured++;
    pImpl->total_bytes_transferred += frame->total_size;
    
    return frame;
}

bool MultiMonitorCapture::CaptureAllMonitorsAsync(
    std::function<void(std::unique_ptr<MultiMonitorFrame>)> callback) {
    if (!pImpl->is_capturing) {
        pImpl->last_error = "Capture not started";
        return false;
    }
    
    pImpl->async_callback = callback;
    return true;
}

std::vector<DirtyRegion> MultiMonitorCapture::GetDirtyRegions(uint32_t monitor_id) const {
    auto it = pImpl->dirty_trackers.find(monitor_id);
    if (it != pImpl->dirty_trackers.end()) {
        return it->second->GetDirtyRegions();
    }
    return {};
}

bool MultiMonitorCapture::MergeDirtyRegions(std::vector<DirtyRegion>& regions) {
    if (regions.size() <= 1) {
        return true;
    }
    
    // Simple merge algorithm - combine overlapping regions
    std::vector<DirtyRegion> merged;
    std::sort(regions.begin(), regions.end(),
              [](const DirtyRegion& a, const DirtyRegion& b) {
                  return a.x < b.x || (a.x == b.x && a.y < b.y);
              });
    
    for (const auto& region : regions) {
        if (merged.empty()) {
            merged.push_back(region);
            continue;
        }
        
        auto& last = merged.back();
        // Check if regions overlap or are adjacent
        if (region.x <= last.x + last.width && region.y <= last.y + last.height) {
            // Merge regions
            int32_t right = std::max(last.x + last.width, region.x + region.width);
            int32_t bottom = std::max(last.y + last.height, region.y + region.height);
            last.x = std::min(last.x, region.x);
            last.y = std::min(last.y, region.y);
            last.width = right - last.x;
            last.height = bottom - last.y;
            last.is_merged = true;
        } else {
            merged.push_back(region);
        }
    }
    
    regions = std::move(merged);
    return true;
}

void MultiMonitorCapture::ClearDirtyRegions(uint32_t monitor_id) {
    auto it = pImpl->dirty_trackers.find(monitor_id);
    if (it != pImpl->dirty_trackers.end()) {
        it->second->ClearDirtyRegions();
    }
}

double MultiMonitorCapture::GetAverageLatency() const {
    // Return a dummy latency value for now
    return 5.0; // 5ms average latency
}

uint64_t MultiMonitorCapture::GetTotalFramesCaptured() const {
    return pImpl->total_frames_captured;
}

uint64_t MultiMonitorCapture::GetTotalBytesTransferred() const {
    return pImpl->total_bytes_transferred;
}

std::unordered_map<uint32_t, double> MultiMonitorCapture::GetPerMonitorFPS() const {
    std::unordered_map<uint32_t, double> fps_map;
    auto now = std::chrono::steady_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(
        now - pImpl->capture_start_time).count();
    
    if (duration > 0) {
        for (const auto& [monitor_id, frame_count] : pImpl->per_monitor_frames) {
            fps_map[monitor_id] = static_cast<double>(frame_count) / duration;
        }
    }
    
    return fps_map;
}

const char* MultiMonitorCapture::GetLastError() const {
    return pImpl->last_error.c_str();
}

bool MultiMonitorCapture::InitializeMonitorCapture(uint32_t monitor_id) {
    // Simplified initialization - just allocate some dummy frame data
    auto it = pImpl->monitors.find(monitor_id);
    if (it != pImpl->monitors.end()) {
        const auto& monitor_info = it->second;
        size_t frame_size = monitor_info.width * monitor_info.height * 4; // RGBA
        pImpl->platform_frame_data[monitor_id] = std::vector<uint8_t>(frame_size, 0);
        return true;
    }
    return false;
}

void MultiMonitorCapture::CleanupMonitorCapture(uint32_t monitor_id) {
    pImpl->platform_frame_data.erase(monitor_id);
}

bool MultiMonitorCapture::UpdateDirtyRegionsForMonitor(uint32_t monitor_id) {
    // Implementation would track frame differences
    return true;
}

void MultiMonitorCapture::OptimizeCaptureRates() {
    if (!pImpl->enable_adaptive_capture) {
        return;
    }
    
    // Adaptive capture rate based on performance
    // This is a simplified implementation
    for (auto& [monitor_id, fps] : pImpl->monitor_fps) {
        double latency = GetAverageLatency();
        if (latency > 16.0) { // > 16ms latency
            fps = std::max(30.0, fps * 0.9); // Reduce FPS
        } else if (latency < 8.0) { // < 8ms latency
            fps = std::min(120.0, fps * 1.1); // Increase FPS
        }
    }
}

void MultiMonitorCapture::ProcessCaptureQueue() {
    while (!pImpl->stop_capture_thread && pImpl->is_capturing) {
        if (pImpl->async_callback) {
            auto frame = CaptureAllMonitors();
            if (frame) {
                pImpl->async_callback(std::move(frame));
            }
        }
        
        OptimizeCaptureRates();
        
        // Sleep based on global FPS
        auto sleep_duration = std::chrono::microseconds(
            static_cast<int64_t>(1000000.0 / pImpl->global_fps));
        std::this_thread::sleep_for(sleep_duration);
    }
}

// DirtyRegionTracker Implementation
struct DirtyRegionTracker::Impl {
    uint32_t monitor_id = 0;
    int32_t width = 0, height = 0;
    double detection_threshold = 0.02; // 2% difference threshold
    bool enable_region_merging = true;
    uint32_t min_region_width = 16, min_region_height = 16;
    uint32_t max_region_count = 64;
    
    std::vector<DirtyRegion> dirty_regions;
    std::unique_ptr<uint8_t[]> previous_frame;
    size_t frame_size = 0;
    
    // Performance metrics
    std::atomic<uint64_t> pixels_compared{0};
    std::atomic<uint64_t> regions_detected{0};
    std::chrono::steady_clock::time_point detection_start;
    double last_detection_time = 0.0;
};

DirtyRegionTracker::DirtyRegionTracker() : pImpl(std::make_unique<Impl>()) {}

DirtyRegionTracker::~DirtyRegionTracker() {
    Shutdown();
}

bool DirtyRegionTracker::Initialize(uint32_t monitor_id, int32_t width, int32_t height) {
    pImpl->monitor_id = monitor_id;
    pImpl->width = width;
    pImpl->height = height;
    pImpl->frame_size = width * height * 4; // Assuming 32-bit RGBA
    
    pImpl->previous_frame = std::make_unique<uint8_t[]>(pImpl->frame_size);
    std::memset(pImpl->previous_frame.get(), 0, pImpl->frame_size);
    
    return true;
}

void DirtyRegionTracker::Shutdown() {
    pImpl->previous_frame.reset();
    pImpl->dirty_regions.clear();
}

bool DirtyRegionTracker::TrackChanges(const uint8_t* current_frame, const uint8_t* previous_frame,
                                    uint32_t width, uint32_t height, uint32_t stride) {
    pImpl->detection_start = std::chrono::steady_clock::now();
    pImpl->dirty_regions.clear();
    
    const uint32_t block_size = 32; // Compare in 32x32 blocks
    
    for (uint32_t y = 0; y < height; y += block_size) {
        for (uint32_t x = 0; x < width; x += block_size) {
            uint32_t block_width = std::min(block_size, width - x);
            uint32_t block_height = std::min(block_size, height - y);
            
            if (CompareRegions(current_frame, previous_frame, x, y,
                             block_width, block_height, stride)) {
                DirtyRegion region;
                region.x = x;
                region.y = y;
                region.width = block_width;
                region.height = block_height;
                region.monitor_id = pImpl->monitor_id;
                region.timestamp = std::chrono::duration_cast<std::chrono::microseconds>(
                    std::chrono::steady_clock::now().time_since_epoch()).count();
                region.is_merged = false;
                
                pImpl->dirty_regions.push_back(region);
                pImpl->regions_detected++;
            }
            
            pImpl->pixels_compared += block_width * block_height;
        }
    }
    
    // Merge adjacent regions if enabled
    if (pImpl->enable_region_merging && pImpl->dirty_regions.size() > 1) {
        MergeAdjacentRegions();
    }
    
    // Limit number of regions
    if (pImpl->dirty_regions.size() > pImpl->max_region_count) {
        pImpl->dirty_regions.resize(pImpl->max_region_count);
    }
    
    // Update previous frame
    std::memcpy(pImpl->previous_frame.get(), current_frame, pImpl->frame_size);
    
    auto detection_end = std::chrono::steady_clock::now();
    pImpl->last_detection_time = std::chrono::duration_cast<std::chrono::microseconds>(
        detection_end - pImpl->detection_start).count() / 1000.0;
    
    return true;
}

std::vector<DirtyRegion> DirtyRegionTracker::GetDirtyRegions() const {
    return pImpl->dirty_regions;
}

void DirtyRegionTracker::ClearDirtyRegions() {
    pImpl->dirty_regions.clear();
}

bool DirtyRegionTracker::SetDetectionThreshold(double threshold) {
    if (threshold < 0.0 || threshold > 1.0) {
        return false;
    }
    pImpl->detection_threshold = threshold;
    return true;
}

bool DirtyRegionTracker::EnableRegionMerging(bool enable) {
    pImpl->enable_region_merging = enable;
    return true;
}

bool DirtyRegionTracker::SetMinRegionSize(uint32_t min_width, uint32_t min_height) {
    pImpl->min_region_width = min_width;
    pImpl->min_region_height = min_height;
    return true;
}

bool DirtyRegionTracker::SetMaxRegionCount(uint32_t max_regions) {
    pImpl->max_region_count = max_regions;
    return true;
}

uint64_t DirtyRegionTracker::GetPixelsCompared() const {
    return pImpl->pixels_compared;
}

uint64_t DirtyRegionTracker::GetRegionsDetected() const {
    return pImpl->regions_detected;
}

double DirtyRegionTracker::GetDetectionTime() const {
    return pImpl->last_detection_time;
}

bool DirtyRegionTracker::CompareRegions(const uint8_t* frame1, const uint8_t* frame2,
                                       int32_t x, int32_t y, uint32_t width, uint32_t height,
                                       uint32_t stride) {
    uint64_t total_diff = 0;
    uint64_t pixel_count = width * height;
    
    for (uint32_t row = 0; row < height; ++row) {
        const uint8_t* row1 = frame1 + ((y + row) * stride) + (x * 4);
        const uint8_t* row2 = frame2 + ((y + row) * stride) + (x * 4);
        
        for (uint32_t col = 0; col < width; ++col) {
            // Compare RGBA pixels
            uint32_t diff = 0;
            diff += abs(row1[col * 4 + 0] - row2[col * 4 + 0]); // R
            diff += abs(row1[col * 4 + 1] - row2[col * 4 + 1]); // G
            diff += abs(row1[col * 4 + 2] - row2[col * 4 + 2]); // B
            diff += abs(row1[col * 4 + 3] - row2[col * 4 + 3]); // A
            
            total_diff += diff;
        }
    }
    
    double diff_ratio = static_cast<double>(total_diff) / (pixel_count * 255 * 4);
    return diff_ratio > pImpl->detection_threshold;
}

void DirtyRegionTracker::MergeAdjacentRegions() {
    if (pImpl->dirty_regions.size() <= 1) {
        return;
    }
    
    std::vector<DirtyRegion> merged;
    std::vector<bool> used(pImpl->dirty_regions.size(), false);
    
    for (size_t i = 0; i < pImpl->dirty_regions.size(); ++i) {
        if (used[i]) continue;
        
        DirtyRegion current = pImpl->dirty_regions[i];
        used[i] = true;
        
        // Try to merge with other regions
        bool merged_any = true;
        while (merged_any) {
            merged_any = false;
            for (size_t j = 0; j < pImpl->dirty_regions.size(); ++j) {
                if (used[j]) continue;
                
                if (ShouldMergeRegions(current, pImpl->dirty_regions[j])) {
                    // Merge regions
                    int32_t right = std::max(current.x + current.width,
                                           pImpl->dirty_regions[j].x + pImpl->dirty_regions[j].width);
                    int32_t bottom = std::max(current.y + current.height,
                                            pImpl->dirty_regions[j].y + pImpl->dirty_regions[j].height);
                    
                    current.x = std::min(current.x, pImpl->dirty_regions[j].x);
                    current.y = std::min(current.y, pImpl->dirty_regions[j].y);
                    current.width = right - current.x;
                    current.height = bottom - current.y;
                    current.is_merged = true;
                    
                    used[j] = true;
                    merged_any = true;
                }
            }
        }
        
        merged.push_back(current);
    }
    
    pImpl->dirty_regions = std::move(merged);
}

bool DirtyRegionTracker::ShouldMergeRegions(const DirtyRegion& r1, const DirtyRegion& r2) {
    // Check if regions are adjacent or overlapping
    bool horizontal_adjacent = (r1.x + r1.width >= r2.x && r1.x <= r2.x + r2.width);
    bool vertical_adjacent = (r1.y + r1.height >= r2.y && r1.y <= r2.y + r2.height);
    
    return horizontal_adjacent && vertical_adjacent;
}

} // namespace capture
} // namespace no_borders
