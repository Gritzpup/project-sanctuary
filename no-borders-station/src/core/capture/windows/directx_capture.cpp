#include "directx_capture.h"
#include <iostream>
#include <cassert>
#include <algorithm>

namespace no_borders {
namespace capture {
namespace windows {

DirectXCapture::DirectXCapture() 
    : initialized_(false)
    , hardware_accelerated_(false)
    , use_dirty_regions_(true)
    , target_fps_(120)
    , avg_frame_time_(0.0)
    , frames_captured_(0)
    , d3d_device_(nullptr)
    , d3d_context_(nullptr)
    , dxgi_factory_(nullptr) {
}

DirectXCapture::~DirectXCapture() {
    Shutdown();
}

bool DirectXCapture::Initialize() {
    if (initialized_) {
        return true;
    }

    std::cout << "[DirectXCapture] Initializing DirectX Desktop Duplication..." << std::endl;

    // Initialize DirectX 11
    if (!InitializeDirectX()) {
        std::cerr << "[DirectXCapture] Failed to initialize DirectX 11" << std::endl;
        return false;
    }

    // Enumerate available monitors
    if (!EnumerateMonitors()) {
        std::cerr << "[DirectXCapture] Failed to enumerate monitors" << std::endl;
        return false;
    }

    hardware_accelerated_ = true;
    initialized_ = true;

    std::cout << "[DirectXCapture] Successfully initialized with " 
              << monitors_.size() << " monitors" << std::endl;
    
    return true;
}

void DirectXCapture::Shutdown() {
    if (!initialized_) {
        return;
    }

    std::cout << "[DirectXCapture] Shutting down..." << std::endl;

    // Stop all captures
    for (const auto& monitor : monitors_) {
        StopCapture(monitor.monitor_id);
    }

    CleanupResources();
    initialized_ = false;
    hardware_accelerated_ = false;
}

bool DirectXCapture::InitializeDirectX() {
    HRESULT hr;

    // Create DXGI Factory
    hr = CreateDXGIFactory1(__uuidof(IDXGIFactory1), (void**)&dxgi_factory_);
    if (FAILED(hr)) {
        std::cerr << "[DirectXCapture] Failed to create DXGI Factory: " << std::hex << hr << std::endl;
        return false;
    }

    // Create D3D11 Device
    D3D_FEATURE_LEVEL feature_levels[] = {
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
        D3D_FEATURE_LEVEL_10_1,
        D3D_FEATURE_LEVEL_10_0
    };

    hr = D3D11CreateDevice(
        nullptr,                    // Default adapter
        D3D_DRIVER_TYPE_HARDWARE,   // Hardware acceleration
        nullptr,                    // No software module
        D3D11_CREATE_DEVICE_DEBUG,  // Debug flag for development
        feature_levels,
        ARRAYSIZE(feature_levels),
        D3D11_SDK_VERSION,
        &d3d_device_,
        nullptr,                    // Don't need feature level out
        &d3d_context_
    );

    if (FAILED(hr)) {
        std::cerr << "[DirectXCapture] Failed to create D3D11 Device: " << std::hex << hr << std::endl;
        return false;
    }

    std::cout << "[DirectXCapture] DirectX 11 device created successfully" << std::endl;
    return true;
}

bool DirectXCapture::EnumerateMonitors() {
    monitors_.clear();
    
    UINT adapter_index = 0;
    IDXGIAdapter1* adapter = nullptr;

    while (dxgi_factory_->EnumAdapters1(adapter_index, &adapter) != DXGI_ERROR_NOT_FOUND) {
        UINT output_index = 0;
        IDXGIOutput* output = nullptr;

        while (adapter->EnumOutputs(output_index, &output) != DXGI_ERROR_NOT_FOUND) {
            DXGI_OUTPUT_DESC output_desc;
            output->GetDesc(&output_desc);

            MonitorInfo monitor;
            monitor.monitor_id = static_cast<uint32_t>(monitors_.size());
            monitor.bounds = output_desc.DesktopCoordinates;
            monitor.is_primary = (output_desc.DesktopCoordinates.left == 0 && 
                                 output_desc.DesktopCoordinates.top == 0);
            monitor.device_name = output_desc.DeviceName;
            monitor.d3d_device = d3d_device_;
            monitor.duplication = nullptr;

            monitors_.push_back(monitor);

            std::wcout << L"[DirectXCapture] Found monitor: " << monitor.device_name 
                      << L" (" << monitor.bounds.right - monitor.bounds.left 
                      << L"x" << monitor.bounds.bottom - monitor.bounds.top << L")" << std::endl;

            output->Release();
            output_index++;
        }

        adapter->Release();
        adapter_index++;
    }

    return !monitors_.empty();
}

bool DirectXCapture::StartCapture(uint32_t monitor_id) {
    if (monitor_id >= monitors_.size()) {
        std::cerr << "[DirectXCapture] Invalid monitor ID: " << monitor_id << std::endl;
        return false;
    }

    MonitorInfo& monitor = monitors_[monitor_id];
    
    if (monitor.duplication != nullptr) {
        std::cout << "[DirectXCapture] Monitor " << monitor_id << " already being captured" << std::endl;
        return true;
    }

    if (!CreateDuplicationForMonitor(monitor)) {
        std::cerr << "[DirectXCapture] Failed to create duplication for monitor " << monitor_id << std::endl;
        return false;
    }

    std::cout << "[DirectXCapture] Started capture for monitor " << monitor_id << std::endl;
    return true;
}

bool DirectXCapture::CreateDuplicationForMonitor(MonitorInfo& monitor) {
    HRESULT hr;
    
    // Get DXGI Device
    IDXGIDevice* dxgi_device = nullptr;
    hr = d3d_device_->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgi_device);
    if (FAILED(hr)) {
        return false;
    }

    // Get DXGI Adapter
    IDXGIAdapter* dxgi_adapter = nullptr;
    hr = dxgi_device->GetParent(__uuidof(IDXGIAdapter), (void**)&dxgi_adapter);
    dxgi_device->Release();
    if (FAILED(hr)) {
        return false;
    }

    // Find the output for this monitor
    IDXGIOutput* output = nullptr;
    UINT output_index = 0;
    while (dxgi_adapter->EnumOutputs(output_index, &output) != DXGI_ERROR_NOT_FOUND) {
        DXGI_OUTPUT_DESC desc;
        output->GetDesc(&desc);
        
        if (desc.DesktopCoordinates.left == monitor.bounds.left &&
            desc.DesktopCoordinates.top == monitor.bounds.top) {
            break;
        }
        
        output->Release();
        output = nullptr;
        output_index++;
    }

    dxgi_adapter->Release();

    if (output == nullptr) {
        return false;
    }

    // Get Output1 interface for duplication
    IDXGIOutput1* output1 = nullptr;
    hr = output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&output1);
    output->Release();
    if (FAILED(hr)) {
        return false;
    }

    // Create duplication
    hr = output1->DuplicateOutput(d3d_device_, &monitor.duplication);
    output1->Release();
    
    if (FAILED(hr)) {
        std::cerr << "[DirectXCapture] Failed to duplicate output: " << std::hex << hr << std::endl;
        return false;
    }

    return true;
}

bool DirectXCapture::CaptureFrame(uint32_t monitor_id, CaptureFrame& frame) {
    if (monitor_id >= monitors_.size()) {
        return false;
    }

    auto start_time = std::chrono::high_resolution_clock::now();
    
    MonitorInfo& monitor = monitors_[monitor_id];
    if (monitor.duplication == nullptr) {
        return false;
    }

    HRESULT hr;
    IDXGIResource* desktop_resource = nullptr;
    DXGI_OUTDUPL_FRAME_INFO frame_info;

    // Acquire next frame
    hr = monitor.duplication->AcquireNextFrame(16, &frame_info, &desktop_resource); // 16ms timeout for 60fps
    
    if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
        // No new frame available
        return false;
    }
    
    if (FAILED(hr)) {
        std::cerr << "[DirectXCapture] Failed to acquire frame: " << std::hex << hr << std::endl;
        return false;
    }

    // Get the desktop texture
    ID3D11Texture2D* desktop_texture = nullptr;
    hr = desktop_resource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&desktop_texture);
    desktop_resource->Release();
    
    if (FAILED(hr)) {
        monitor.duplication->ReleaseFrame();
        return false;
    }

    // Get texture description
    D3D11_TEXTURE2D_DESC texture_desc;
    desktop_texture->GetDesc(&texture_desc);

    // Create staging texture for CPU access
    D3D11_TEXTURE2D_DESC staging_desc = texture_desc;
    staging_desc.Usage = D3D11_USAGE_STAGING;
    staging_desc.BindFlags = 0;
    staging_desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    staging_desc.MiscFlags = 0;

    ID3D11Texture2D* staging_texture = nullptr;
    hr = d3d_device_->CreateTexture2D(&staging_desc, nullptr, &staging_texture);
    
    if (FAILED(hr)) {
        desktop_texture->Release();
        monitor.duplication->ReleaseFrame();
        return false;
    }

    // Copy to staging texture
    d3d_context_->CopyResource(staging_texture, desktop_texture);

    // Map the staging texture
    D3D11_MAPPED_SUBRESOURCE mapped_resource;
    hr = d3d_context_->Map(staging_texture, 0, D3D11_MAP_READ, 0, &mapped_resource);
    
    if (SUCCEEDED(hr)) {
        // Fill frame data
        frame.data = mapped_resource.pData;
        frame.size = mapped_resource.DepthPitch;
        frame.width = texture_desc.Width;
        frame.height = texture_desc.Height;
        frame.pitch = mapped_resource.RowPitch;
        frame.timestamp = std::chrono::high_resolution_clock::now();

        // Process dirty regions if enabled
        if (use_dirty_regions_ && frame_info.TotalMetadataSize > 0) {
            ProcessDirtyRegions(frame_info, frame.dirty_regions);
        }

        d3d_context_->Unmap(staging_texture, 0);
    }

    // Cleanup
    staging_texture->Release();
    desktop_texture->Release();
    monitor.duplication->ReleaseFrame();

    // Update performance stats
    UpdatePerformanceStats();
    frames_captured_++;

    auto end_time = std::chrono::high_resolution_clock::now();
    auto frame_time = std::chrono::duration<double, std::milli>(end_time - start_time).count();
    
    // Update rolling average
    avg_frame_time_ = (avg_frame_time_ * 0.9) + (frame_time * 0.1);

    return SUCCEEDED(hr);
}

bool DirectXCapture::ProcessDirtyRegions(const DXGI_OUTDUPL_FRAME_INFO& frame_info, 
                                       std::vector<RECT>& dirty_regions) {
    // This would process the dirty region metadata to identify changed areas
    // For now, return the entire screen as dirty for simplicity
    RECT full_screen = {0, 0, static_cast<LONG>(frame_info.LastPresentTime), static_cast<LONG>(frame_info.LastMouseUpdateTime)};
    dirty_regions.push_back(full_screen);
    return true;
}

void DirectXCapture::UpdatePerformanceStats() {
    // Performance monitoring implementation
    CapturePerformanceMonitor::EndTiming("frame_capture");
    CapturePerformanceMonitor::StartTiming("frame_capture");
}

bool DirectXCapture::StopCapture(uint32_t monitor_id) {
    if (monitor_id >= monitors_.size()) {
        return false;
    }

    MonitorInfo& monitor = monitors_[monitor_id];
    if (monitor.duplication != nullptr) {
        monitor.duplication->Release();
        monitor.duplication = nullptr;
        std::cout << "[DirectXCapture] Stopped capture for monitor " << monitor_id << std::endl;
    }

    return true;
}

void DirectXCapture::CleanupResources() {
    for (auto& monitor : monitors_) {
        if (monitor.duplication != nullptr) {
            monitor.duplication->Release();
            monitor.duplication = nullptr;
        }
    }

    if (d3d_context_ != nullptr) {
        d3d_context_->Release();
        d3d_context_ = nullptr;
    }

    if (d3d_device_ != nullptr) {
        d3d_device_->Release();
        d3d_device_ = nullptr;
    }

    if (dxgi_factory_ != nullptr) {
        dxgi_factory_->Release();
        dxgi_factory_ = nullptr;
    }
}

void DirectXCapture::SetCaptureMode(bool use_dirty_regions) {
    use_dirty_regions_ = use_dirty_regions;
    std::cout << "[DirectXCapture] Dirty regions " 
              << (use_dirty_regions ? "enabled" : "disabled") << std::endl;
}

void DirectXCapture::SetTargetFrameRate(uint32_t fps) {
    target_fps_ = fps;
    std::cout << "[DirectXCapture] Target frame rate set to " << fps << " fps" << std::endl;
}

} // namespace windows
} // namespace capture
} // namespace no_borders
