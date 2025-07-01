# 🏗️ Sanctuary Service Architecture

## Current Services Overview

### 💜 Old Memory System (DO NOT TOUCH)
- **Dashboard**: http://localhost:8082
- **WebSocket**: ws://localhost:8766 (gritz-memory-ultimate.service)
- **Purpose**: Original emotional memory tracking
- **Status**: LEGACY - Working fine, don't modify

### 🧠 Quantum Memory System (ACTIVE DEVELOPMENT)
- **Dashboard**: http://localhost:5175 (Note: Vite auto-incremented from 5174)
- **WebSocket**: ws://localhost:8768 (quantum-websocket-enhanced.service)
- **Purpose**: Neuroscience-based memory consolidation with quantum states
- **Status**: ACTIVE - All new features go here

### 📊 Supporting Services
- **LLM Analyzer**: PID varies 
  - **Old**: claude_folder_analyzer_watchdog.py (keyword-based)
  - **New**: claude_folder_analyzer_emollama.py (semantic analysis)
  - Monitors: ~/.claude folder
  - Updates: status.json in real-time with PAD values
- **Emollama-7B**: Loaded by analyzer (4-bit quantized)
  - Model: lzw1008/Emollama-chat-7b
  - Purpose: Semantic emotional analysis
  - Features: PAD extraction, living equation updates

## Service Organization Best Practices

### 1. **Port Allocation Strategy**
```
8000-8099: Legacy services (don't touch)
├── 8082: Old memory dashboard
└── 8766: Old memory websocket

8700-8799: Quantum memory services
├── 8768: Quantum websocket
└── 8769-8799: Reserved for future quantum services

5000-5199: Development dashboards
├── 5174: Quantum dashboard (Vite)
└── 5175-5199: Reserved for future dashboards

7000-7999: AI/ML services
└── 7860: Emollama
```

### 2. **Service Naming Convention**
- Legacy: `gritz-memory-*`
- Quantum: `quantum-*`
- Support: `sanctuary-*`

### 3. **Process Management**
Instead of Docker (resource heavy), use systemd services with clear names:

```bash
# List all sanctuary services
systemctl --user list-units | grep -E "(gritz|quantum|sanctuary)"

# Check specific service
systemctl --user status quantum-websocket-enhanced.service
```

### 4. **Configuration Files**
```
/home/ubuntumain/.config/systemd/user/
├── gritz-memory-ultimate.service     # Legacy (8766)
├── quantum-websocket-enhanced.service # Active (8768)
└── quantum-dashboard.service         # Active (5174)
```

### 5. **Quick Reference Commands**
```bash
# View all sanctuary ports in use
sudo lsof -i -P -n | grep -E "(8082|8766|8768|5174|7860)"

# Restart quantum services only
systemctl --user restart quantum-websocket-enhanced.service

# View quantum logs
journalctl --user -u quantum-websocket-enhanced.service -f
```

## Environment Variables for Clarity

Add to your ~/.bashrc:
```bash
# Sanctuary Service Ports
export SANCTUARY_LEGACY_DASH=8082
export SANCTUARY_LEGACY_WS=8766
export SANCTUARY_QUANTUM_DASH=5174
export SANCTUARY_QUANTUM_WS=8768
export SANCTUARY_EMOLLAMA=7860
```

## Visual Service Map
```
┌─────────────────────────────────────────────────────┐
│                  SANCTUARY SERVICES                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  LEGACY (Don't Touch)          QUANTUM (Active)    │
│  ┌─────────────────┐          ┌─────────────────┐ │
│  │ Dashboard :8082 │          │ Dashboard :5174 │ │
│  │       ↓         │          │       ↓         │ │
│  │ WebSocket :8766 │          │ WebSocket :8768 │ │
│  └─────────────────┘          └─────────────────┘ │
│                                         ↓          │
│                               ┌─────────────────┐ │
│                               │ Emollama-7B     │ │
│                               │ Analyzer        │ │
│                               │ ┌─────────────┐ │ │
│                               │ │PAD Analysis │ │ │
│                               │ │Living Eq.   │ │ │
│                               │ │Updates Both │ │ │
│                               │ └─────────────┘ │ │
│                               └─────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Why This Approach?
1. **Clear Separation**: Legacy vs Active development
2. **No Docker Overhead**: Direct systemd is lighter
3. **Easy Debugging**: Clear port ranges and naming
4. **Future Proof**: Reserved port ranges for expansion

---
*Last Updated: 2025-06-30 - Added Emollama-7B Semantic Analysis*
*Remember: When Claude gets confused, check this file!*