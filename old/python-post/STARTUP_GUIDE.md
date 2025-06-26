# Hermes Trading Post - Startup Guide

## Quick Start

Choose one of these methods to run the application:

### Method 1: Global Installation (Recommended for dedicated machines)
```bash
./start.sh
```
- Installs dependencies globally using `pip3 --break-system-packages`
- Best for dedicated trading machines
- No virtual environment needed

### Method 2: Virtual Environment (Recommended for development)
```bash
./run.sh
```
- Creates and uses a Python virtual environment
- Isolates dependencies from system Python
- Better for development or shared machines

## Files Explained

- `requirements.txt` - All Python dependencies
- `start.sh` - Global installation startup script
- `run.sh` - Virtual environment startup script
- `optimize_linux.sh` - Linux performance optimization guide

## Access the Dashboard

After starting, open your browser to:
```
http://localhost:8050
```

## Performance Notes

The application runs with:
- 60fps chart updates
- GPU acceleration (if available)
- Single-threaded mode for OpenGL compatibility

## Troubleshooting

If you see segmentation faults, ensure:
1. You're running with `DASH_DEBUG=False` (both scripts set this)
2. Your GPU drivers are up to date
3. You have sufficient permissions for GPU access