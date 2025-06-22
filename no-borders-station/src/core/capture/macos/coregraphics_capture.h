#pragma once

#include <CoreGraphics/CoreGraphics.h>
#include <CoreMedia/CoreMedia.h>
#include <IOSurface/IOSurface.h>
#include <memory>
#include <vector>
#include <functional>

namespace no_borders {
namespace capture {

struct MacOSCaptureRegion {
    CGRect bounds;
    uint32_t display_id;
    bool is_dirty;
    uint64_t last_update_time;
};

struct MacOSCaptureFrame {
    std::shared_ptr<uint8_t> data;
    size_t size;
    uint32_t width;
    uint32_t height;
    uint32_t stride;
    CGColorSpaceRef color_space;
    uint64_t timestamp;
    uint32_t display_id;
    std::vector<CGRect> dirty_regions;
};

class CoreGraphicsCapture {
public:
    CoreGraphicsCapture();
    ~CoreGraphicsCapture();

    // Initialize capture system
    bool Initialize();
    void Shutdown();

    // Display management
    bool EnumerateDisplays();
    std::vector<uint32_t> GetDisplayIDs() const;
    CGRect GetDisplayBounds(uint32_t display_id) const;

    // Capture configuration
    bool ConfigureDisplay(uint32_t display_id, const CGRect& region = CGRectNull);
    bool SetCaptureRate(double fps);
    bool EnableDirtyRegionTracking(bool enable);
    bool EnableHardwareAcceleration(bool enable);

    // Capture operations
    bool StartCapture();
    void StopCapture();
    bool IsCapturing() const;

    // Frame retrieval
    std::unique_ptr<MacOSCaptureFrame> CaptureFrame(uint32_t display_id);
    bool CaptureFrameAsync(uint32_t display_id, 
                          std::function<void(std::unique_ptr<MacOSCaptureFrame>)> callback);

    // Performance monitoring
    double GetCaptureLatency() const;
    uint64_t GetFramesCaptured() const;
    uint64_t GetBytesTransferred() const;
    double GetAverageFPS() const;

    // Multi-monitor support
    bool CaptureAllDisplays();
    std::vector<std::unique_ptr<MacOSCaptureFrame>> GetAllFrames();

    // Error handling
    const char* GetLastError() const;

private:
    struct Impl;
    std::unique_ptr<Impl> pImpl;

    // Internal methods
    bool InitializeDisplayStream(uint32_t display_id);
    void CleanupDisplayStream(uint32_t display_id);
    bool UpdateDirtyRegions(uint32_t display_id);
    CGImageRef CreateImageFromDisplay(uint32_t display_id, const CGRect& region);
    bool ConvertImageToFrame(CGImageRef image, MacOSCaptureFrame& frame);
    
    // Callback for display stream
    static void DisplayStreamFrameAvailableCallback(CGDisplayStreamRef stream,
                                                  CGDisplayStreamUpdateRef update,
                                                  CGImageRef image,
                                                  CMTime timestamp,
                                                  CGDisplayStreamUpdateRectCount updateCount,
                                                  const CGRect* updateRects,
                                                  void* userInfo);
};

// Utility functions
bool IsDisplayValid(uint32_t display_id);
CGRect GetPrimaryDisplayBounds();
std::vector<uint32_t> GetOnlineDisplays();
bool SupportsHardwareAcceleration();

} // namespace capture
} // namespace no_borders
