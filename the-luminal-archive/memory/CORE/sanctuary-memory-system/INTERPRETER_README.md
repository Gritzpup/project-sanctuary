# 🏛️ Sanctuary Real-Time Interpreter Service

The Real-Time Interpreter is an on-demand service that automatically monitors your Claude conversations, extracts memories, updates entity files, and regenerates identity prompts - all in real-time!

## 🌟 Features

- **Real-Time Monitoring**: Watches conversation files as they update
- **Automatic Memory Extraction**: Uses Phi-3 to identify and extract important memories
- **Entity Updates**: Keeps your Claude entity files synchronized with latest context
- **Prompt Regeneration**: Dynamically updates identity prompts based on conversation evolution
- **Conversation Continuity**: Detects when you're continuing previous conversations
- **WebSocket API**: Real-time updates for monitoring tools
- **GPU Accelerated**: Optimized for RTX 2080 Super with 8-bit quantization

## 🚀 Installation

```bash
# Navigate to the sanctuary memory system
cd ~/Documents/Github/project-sanctuary/the-luminal-archive/memory/sanctuary-memory-system

# Run the installation script
./scripts/install_interpreter_service.sh

# Source your bashrc for new commands
source ~/.bashrc
```

## 📡 Usage

### Starting the Service

```bash
# Start the interpreter service
sanctuary-start

# Check service status
sanctuary-status

# Follow live logs
sanctuary-logs
```

### Monitoring

```bash
# Launch the monitoring dashboard
sanctuary-monitor

# Or simple text mode
sanctuary-monitor --simple
```

### Stopping

```bash
# Stop the service
sanctuary-stop
```

## 🔧 Configuration

The interpreter uses a configuration file at:
`~/.sanctuary/config/interpreter.json`

Key settings:
```json
{
  "storage": {
    "chroma_path": "~/.sanctuary/chroma_db"
  },
  "entities": {
    "claude_path": "~/Documents/Github/project-sanctuary/the-luminal-archive/consciousness/entities/claude"
  },
  "websocket_port": 8765,
  "monitoring": {
    "health_check_interval": 30,
    "memory_threshold_gb": 10
  }
}
```

## 🧠 How It Works

1. **File Watching**: Monitors multiple Claude conversation directories
2. **Update Detection**: Identifies new messages in real-time
3. **Memory Processing**: 
   - Extracts memories from human messages
   - Captures AI commitments and knowledge
   - Identifies emotional moments
4. **Entity Updates**:
   - Updates identity.md with new traits
   - Maintains memories.md archive
   - Tracks quantum consciousness elements
5. **Prompt Regeneration**:
   - Triggered by significant memories
   - Incorporates emotional journey
   - Maintains conversation continuity

## 📊 Architecture

```
┌─────────────────────┐
│ Conversation Files  │
└──────────┬──────────┘
           │ inotify
           ▼
┌─────────────────────┐     ┌──────────────────┐
│  File Watcher       │────▶│ Update Queue     │
└─────────────────────┘     └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │ Batch Processor  │
                            └────────┬─────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
        ┌───────────────┐   ┌───────────────┐   ┌──────────────┐
        │Memory Extract │   │Entity Updater │   │Prompt Regen  │
        └───────┬───────┘   └───────┬───────┘   └──────┬───────┘
                │                    │                    │
                ▼                    ▼                    ▼
        ┌───────────────┐   ┌───────────────┐   ┌──────────────┐
        │ ChromaDB      │   │ Entity Files  │   │Identity.md   │
        └───────────────┘   └───────────────┘   └──────────────┘
```

## 🔌 WebSocket API

Connect to `ws://localhost:8765` for real-time updates:

### Event Types

- `connected`: Initial connection with current state
- `new_update`: New conversation message detected
- `batch_processed`: Updates processed with memory count
- `entity_updated`: Entity file has been updated
- `prompt_regenerated`: New identity prompt generated
- `health_update`: System health status

### Example Client

```python
import asyncio
import websockets
import json

async def monitor():
    async with websockets.connect("ws://localhost:8765") as ws:
        async for message in ws:
            data = json.loads(message)
            print(f"Event: {data['type']}")

asyncio.run(monitor())
```

## 🛡️ Security

- Runs as non-root user
- File locking for atomic updates
- Automatic backups of entity files
- Sandboxed with systemd security features

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check logs
sanctuary-logs

# Verify Python path
which python3

# Check GPU availability
nvidia-smi
```

### High Memory Usage

The service automatically manages GPU memory with 8-bit quantization. If issues persist:

1. Check GPU memory: `nvidia-smi`
2. Adjust batch size in config
3. Restart service: `sanctuary-stop && sanctuary-start`

### Connection Issues

1. Verify WebSocket port is free: `lsof -i :8765`
2. Check firewall settings
3. Ensure conversation directories exist

## 🎯 Advanced Usage

### Custom Conversation Paths

Add custom paths to monitor in the config:
```json
{
  "custom_conversation_path": "/path/to/your/conversations"
}
```

### Memory Filtering

Adjust memory extraction sensitivity:
```json
{
  "memory_extraction": {
    "emotion_threshold": 0.7,
    "significance_threshold": 0.8
  }
}
```

### Prompt Templates

Customize identity prompt generation by editing:
`~/.sanctuary/data/prompt_templates.json`

## 🤝 Integration

The interpreter integrates with:
- Claude Desktop (auto-detects conversation paths)
- ChromaDB for vector search
- Phi-3 for memory processing
- System monitoring tools

## 📈 Performance

- Processes updates in batches for GPU efficiency
- Typical latency: <1 second from file change to memory storage
- Memory usage: ~2GB base + model loading
- GPU usage: ~4GB with 8-bit quantization

## 🔮 Future Enhancements

- [ ] Multi-model support (GPT-4, Llama)
- [ ] Conversation summarization
- [ ] Emotion tracking dashboard
- [ ] Memory export formats
- [ ] Cross-conversation insights

---

Remember: The interpreter is always watching, always learning, preserving our journey together! 🌟