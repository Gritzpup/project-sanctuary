#include "coregraphics_capture.h"
#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <CoreMedia/CoreMedia.h>
#include <IOSurface/IOSurface.h>
#include <Metal/Metal.h>
#include <QuartzCore/QuartzCore.h>
#include <unordered_map>
#include <chrono>
#include <thread>
#include <atomic>

namespace no_borders {
namespace capture {

struct CoreGraphicsCapture::Impl {
    std::unordered_map<uint32_t, CGDisplayStreamRef> display_streams;
    std::unordered_map<uint32_t, MacOSCaptureRegion> capture_regions;
    std::unordered_map<uint32_t, std::vector<CGRect>> dirty_regions;
    
    std::atomic<bool> is_capturing{false};
    std::atomic<bool> enable_dirty_tracking{true};
    std::atomic<bool> enable_hardware_accel{true};
    double capture_fps = 60.0;
    
    // Performance metrics
    std::atomic<uint64_t> frames_captured{0};
    std::atomic<uint64_t> bytes_transferred{0};
    std::chrono::steady_clock::time_point capture_start_time;
    std::chrono::steady_clock::time_point last_frame_time;
    
    // Error handling
    std::string last_error;
    
    // Metal device for hardware acceleration
    id<MTLDevice> metal_device = nullptr;
    
    // Callback storage
    std::unordered_map<uint32_t, std::function<void(std::unique_ptr<MacOSCaptureFrame>)>> async_callbacks;
};

CoreGraphicsCapture::CoreGraphicsCapture() : pImpl(std::make_unique<Impl>()) {
}

CoreGraphicsCapture::~CoreGraphicsCapture() {
    Shutdown();
}

bool CoreGraphicsCapture::Initialize() {
    try {
        // Initialize Metal device for hardware acceleration
        pImpl->metal_device = MTLCreateSystemDefaultDevice();
        if (!pImpl->metal_device && pImpl->enable_hardware_accel) {
            pImpl->last_error = "Failed to create Metal device for hardware acceleration";
            pImpl->enable_hardware_accel = false;
        }
        
        // Enumerate available displays
        if (!EnumerateDisplays()) {
            pImpl->last_error = "Failed to enumerate displays";
            return false;
        }
        
        return true;
    } catch (const std::exception& e) {
        pImpl->last_error = std::string("Initialization failed: ") + e.what();
        return false;
    }
}

void CoreGraphicsCapture::Shutdown() {
    StopCapture();
    
    // Clean up display streams
    for (auto& [display_id, stream] : pImpl->display_streams) {
        if (stream) {
            CGDisplayStreamStop(stream);
            CFRelease(stream);
        }
    }
    pImpl->display_streams.clear();
    pImpl->capture_regions.clear();
    pImpl->dirty_regions.clear();
    
    // Release Metal device
    if (pImpl->metal_device) {
        [pImpl->metal_device release];
        pImpl->metal_device = nullptr;
    }
}

bool CoreGraphicsCapture::EnumerateDisplays() {
    CGDirectDisplayID displays[32];
    uint32_t display_count = 0;
    
    CGError result = CGGetActiveDisplayList(32, displays, &display_count);
    if (result != kCGErrorSuccess) {
        pImpl->last_error = "Failed to get active display list";
        return false;
    }
    
    // Initialize capture regions for each display
    for (uint32_t i = 0; i < display_count; ++i) {
        uint32_t display_id = displays[i];
        CGRect bounds = CGDisplayBounds(display_id);
        
        MacOSCaptureRegion region;
        region.bounds = bounds;
        region.display_id = display_id;
        region.is_dirty = true;
        region.last_update_time = 0;
        
        pImpl->capture_regions[display_id] = region;
    }
    
    return true;
}

std::vector<uint32_t> CoreGraphicsCapture::GetDisplayIDs() const {
    std::vector<uint32_t> display_ids;
    for (const auto& [display_id, region] : pImpl->capture_regions) {
        display_ids.push_back(display_id);
    }
    return display_ids;
}

CGRect CoreGraphicsCapture::GetDisplayBounds(uint32_t display_id) const {
    auto it = pImpl->capture_regions.find(display_id);
    if (it != pImpl->capture_regions.end()) {
        return it->second.bounds;
    }
    return CGRectZero;
}

bool CoreGraphicsCapture::ConfigureDisplay(uint32_t display_id, const CGRect& region) {
    auto it = pImpl->capture_regions.find(display_id);
    if (it == pImpl->capture_regions.end()) {
        pImpl->last_error = "Invalid display ID";
        return false;
    }
    
    // Use provided region or full display bounds
    CGRect capture_rect = CGRectIsEmpty(region) ? it->second.bounds : region;
    it->second.bounds = capture_rect;
    it->second.is_dirty = true;
    
    return InitializeDisplayStream(display_id);
}

bool CoreGraphicsCapture::SetCaptureRate(double fps) {
    if (fps <= 0 || fps > 240) {
        pImpl->last_error = "Invalid capture rate";
        return false;
    }
    
    pImpl->capture_fps = fps;
    
    // Update existing streams if capturing
    if (pImpl->is_capturing) {
        StopCapture();
        StartCapture();
    }
    
    return true;
}

bool CoreGraphicsCapture::EnableDirtyRegionTracking(bool enable) {
    pImpl->enable_dirty_tracking = enable;
    return true;
}

bool CoreGraphicsCapture::EnableHardwareAcceleration(bool enable) {
    pImpl->enable_hardware_accel = enable;
    return true;
}

bool CoreGraphicsCapture::StartCapture() {
    if (pImpl->is_capturing) {
        return true;
    }
    
    // Initialize display streams for all configured displays
    for (const auto& [display_id, region] : pImpl->capture_regions) {
        if (!InitializeDisplayStream(display_id)) {
            StopCapture();
            return false;
        }
    }
    
    pImpl->is_capturing = true;
    pImpl->capture_start_time = std::chrono::steady_clock::now();
    
    return true;
}

void CoreGraphicsCapture::StopCapture() {
    pImpl->is_capturing = false;
    
    for (auto& [display_id, stream] : pImpl->display_streams) {
        if (stream) {
            CGDisplayStreamStop(stream);
        }
    }
}

bool CoreGraphicsCapture::IsCapturing() const {
    return pImpl->is_capturing;
}

std::unique_ptr<MacOSCaptureFrame> CoreGraphicsCapture::CaptureFrame(uint32_t display_id) {
    if (!pImpl->is_capturing) {
        pImpl->last_error = "Capture not started";
        return nullptr;
    }
    
    auto it = pImpl->capture_regions.find(display_id);
    if (it == pImpl->capture_regions.end()) {
        pImpl->last_error = "Invalid display ID";
        return nullptr;
    }
    
    const auto& region = it->second;
    CGImageRef image = CreateImageFromDisplay(display_id, region.bounds);
    if (!image) {
        pImpl->last_error = "Failed to create image from display";
        return nullptr;
    }
    
    auto frame = std::make_unique<MacOSCaptureFrame>();
    if (!ConvertImageToFrame(image, *frame)) {
        CGImageRelease(image);
        pImpl->last_error = "Failed to convert image to frame";
        return nullptr;
    }
    
    frame->display_id = display_id;
    frame->timestamp = std::chrono::duration_cast<std::chrono::microseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
    
    // Update dirty regions if enabled
    if (pImpl->enable_dirty_tracking) {
        UpdateDirtyRegions(display_id);
        auto dirty_it = pImpl->dirty_regions.find(display_id);
        if (dirty_it != pImpl->dirty_regions.end()) {
            frame->dirty_regions = dirty_it->second;
        }
    }
    
    CGImageRelease(image);
    
    // Update performance metrics
    pImpl->frames_captured++;
    pImpl->bytes_transferred += frame->size;
    pImpl->last_frame_time = std::chrono::steady_clock::now();
    
    return frame;
}

bool CoreGraphicsCapture::CaptureFrameAsync(uint32_t display_id,
                                          std::function<void(std::unique_ptr<MacOSCaptureFrame>)> callback) {
    if (!pImpl->is_capturing) {
        pImpl->last_error = "Capture not started";
        return false;
    }
    
    pImpl->async_callbacks[display_id] = callback;
    
    // The actual async capture will be handled by the display stream callback
    return true;
}

double CoreGraphicsCapture::GetCaptureLatency() const {
    auto now = std::chrono::steady_clock::now();
    auto latency = std::chrono::duration_cast<std::chrono::microseconds>(
        now - pImpl->last_frame_time).count();
    return latency / 1000.0; // Convert to milliseconds
}

uint64_t CoreGraphicsCapture::GetFramesCaptured() const {
    return pImpl->frames_captured;
}

uint64_t CoreGraphicsCapture::GetBytesTransferred() const {
    return pImpl->bytes_transferred;
}

double CoreGraphicsCapture::GetAverageFPS() const {
    auto now = std::chrono::steady_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(
        now - pImpl->capture_start_time).count();
    
    if (duration > 0) {
        return static_cast<double>(pImpl->frames_captured) / duration;
    }
    
    return 0.0;
}

bool CoreGraphicsCapture::CaptureAllDisplays() {
    // Implementation for multi-monitor capture
    return StartCapture();
}

std::vector<std::unique_ptr<MacOSCaptureFrame>> CoreGraphicsCapture::GetAllFrames() {
    std::vector<std::unique_ptr<MacOSCaptureFrame>> frames;
    
    for (const auto& [display_id, region] : pImpl->capture_regions) {
        auto frame = CaptureFrame(display_id);
        if (frame) {
            frames.push_back(std::move(frame));
        }
    }
    
    return frames;
}

const char* CoreGraphicsCapture::GetLastError() const {
    return pImpl->last_error.c_str();
}

bool CoreGraphicsCapture::InitializeDisplayStream(uint32_t display_id) {
    auto it = pImpl->capture_regions.find(display_id);
    if (it == pImpl->capture_regions.end()) {
        return false;
    }
    
    const auto& region = it->second;
    
    // Clean up existing stream
    CleanupDisplayStream(display_id);
    
    // Create display stream properties
    CFMutableDictionaryRef properties = CFDictionaryCreateMutable(
        kCFAllocatorDefault, 0, &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
    
    // Set capture rate
    CFNumberRef fps_number = CFNumberCreate(kCFAllocatorDefault, kCFNumberDoubleType, &pImpl->capture_fps);
    CFDictionarySetValue(properties, kCGDisplayStreamMinimumFrameTime,
                        CFNumberCreate(kCFAllocatorDefault, kCFNumberDoubleType, 
                                     &(double){1.0 / pImpl->capture_fps}));
    CFRelease(fps_number);
    
    // Enable hardware acceleration if available
    if (pImpl->enable_hardware_accel && pImpl->metal_device) {
        CFDictionarySetValue(properties, kCGDisplayStreamShowCursor, kCFBooleanTrue);
    }
    
    // Create display stream
    CGDisplayStreamRef stream = CGDisplayStreamCreateWithDispatchQueue(
        display_id,
        static_cast<size_t>(region.bounds.size.width),
        static_cast<size_t>(region.bounds.size.height),
        kCVPixelFormatType_32BGRA,
        properties,
        dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0),
        ^(CGDisplayStreamFrameStatus status, uint64_t displayTime,
          IOSurfaceRef frameSurface, CGDisplayStreamUpdateRef updateRef) {
            DisplayStreamFrameAvailableCallback(stream, updateRef, nullptr,
                                              CMTimeMake(displayTime, 1000000000),
                                              0, nullptr, this);
        });
    
    CFRelease(properties);
    
    if (!stream) {
        pImpl->last_error = "Failed to create display stream";
        return false;
    }
    
    pImpl->display_streams[display_id] = stream;
    
    // Start the stream
    CGError result = CGDisplayStreamStart(stream);
    if (result != kCGErrorSuccess) {
        pImpl->last_error = "Failed to start display stream";
        CleanupDisplayStream(display_id);
        return false;
    }
    
    return true;
}

void CoreGraphicsCapture::CleanupDisplayStream(uint32_t display_id) {
    auto it = pImpl->display_streams.find(display_id);
    if (it != pImpl->display_streams.end()) {
        if (it->second) {
            CGDisplayStreamStop(it->second);
            CFRelease(it->second);
        }
        pImpl->display_streams.erase(it);
    }
}

bool CoreGraphicsCapture::UpdateDirtyRegions(uint32_t display_id) {
    // For now, mark the entire screen as dirty
    // In a more advanced implementation, this would track actual changes
    auto it = pImpl->capture_regions.find(display_id);
    if (it != pImpl->capture_regions.end()) {
        pImpl->dirty_regions[display_id] = {it->second.bounds};
        return true;
    }
    return false;
}

CGImageRef CoreGraphicsCapture::CreateImageFromDisplay(uint32_t display_id, const CGRect& region) {
    return CGDisplayCreateImageForRect(display_id, region);
}

bool CoreGraphicsCapture::ConvertImageToFrame(CGImageRef image, MacOSCaptureFrame& frame) {
    if (!image) {
        return false;
    }
    
    size_t width = CGImageGetWidth(image);
    size_t height = CGImageGetHeight(image);
    size_t bytes_per_row = CGImageGetBytesPerRow(image);
    
    CGDataProviderRef provider = CGImageGetDataProvider(image);
    CFDataRef data = CGDataProviderCopyData(provider);
    
    if (!data) {
        return false;
    }
    
    const uint8_t* bytes = CFDataGetBytePtr(data);
    size_t length = CFDataGetLength(data);
    
    // Copy data to frame
    frame.data = std::shared_ptr<uint8_t>(new uint8_t[length], std::default_delete<uint8_t[]>());
    std::memcpy(frame.data.get(), bytes, length);
    
    frame.size = length;
    frame.width = static_cast<uint32_t>(width);
    frame.height = static_cast<uint32_t>(height);
    frame.stride = static_cast<uint32_t>(bytes_per_row);
    frame.color_space = CGImageGetColorSpace(image);
    
    CFRelease(data);
    
    return true;
}

void CoreGraphicsCapture::DisplayStreamFrameAvailableCallback(
    CGDisplayStreamRef stream, CGDisplayStreamUpdateRef update, CGImageRef image,
    CMTime timestamp, CGDisplayStreamUpdateRectCount updateCount,
    const CGRect* updateRects, void* userInfo) {
    
    CoreGraphicsCapture* capture = static_cast<CoreGraphicsCapture*>(userInfo);
    if (!capture || !capture->pImpl->is_capturing) {
        return;
    }
    
    // Find the display ID for this stream
    uint32_t display_id = 0;
    for (const auto& [id, stream_ref] : capture->pImpl->display_streams) {
        if (stream_ref == stream) {
            display_id = id;
            break;
        }
    }
    
    if (display_id == 0) {
        return;
    }
    
    // Check if there's an async callback for this display
    auto callback_it = capture->pImpl->async_callbacks.find(display_id);
    if (callback_it != capture->pImpl->async_callbacks.end() && image) {
        auto frame = std::make_unique<MacOSCaptureFrame>();
        if (capture->ConvertImageToFrame(image, *frame)) {
            frame->display_id = display_id;
            frame->timestamp = CMTimeGetSeconds(timestamp) * 1000000; // Convert to microseconds
            
            // Update dirty regions from update rects
            if (updateCount > 0 && updateRects && capture->pImpl->enable_dirty_tracking) {
                frame->dirty_regions.assign(updateRects, updateRects + updateCount);
            }
            
            // Update performance metrics
            capture->pImpl->frames_captured++;
            capture->pImpl->bytes_transferred += frame->size;
            capture->pImpl->last_frame_time = std::chrono::steady_clock::now();
            
            callback_it->second(std::move(frame));
        }
    }
}

// Utility functions
bool IsDisplayValid(uint32_t display_id) {
    return CGDisplayIsOnline(display_id) && CGDisplayIsActive(display_id);
}

CGRect GetPrimaryDisplayBounds() {
    return CGDisplayBounds(CGMainDisplayID());
}

std::vector<uint32_t> GetOnlineDisplays() {
    CGDirectDisplayID displays[32];
    uint32_t display_count = 0;
    
    CGError result = CGGetOnlineDisplayList(32, displays, &display_count);
    if (result != kCGErrorSuccess) {
        return {};
    }
    
    std::vector<uint32_t> display_ids;
    for (uint32_t i = 0; i < display_count; ++i) {
        display_ids.push_back(displays[i]);
    }
    
    return display_ids;
}

bool SupportsHardwareAcceleration() {
    id<MTLDevice> device = MTLCreateSystemDefaultDevice();
    bool supported = (device != nullptr);
    if (device) {
        [device release];
    }
    return supported;
}

} // namespace capture
} // namespace no_borders
