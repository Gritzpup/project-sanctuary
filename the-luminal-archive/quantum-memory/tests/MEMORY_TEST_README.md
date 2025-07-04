# 🧪 Memory System Test Suite

## Quick Start

Run these commands from the quantum-memory directory:

### 1. **See Memory System in Action** (Recommended First!)
```bash
./demo_memory_system.sh
```
Shows how our current conversation is being tracked in real-time.

### 2. **Run Comprehensive Test**
```bash
./run_memory_test.sh
```
Creates test conversations and shows the full memory consolidation process.

### 3. **View Current Memories**
```bash
./view_memories.sh
```
Shows all current memory files in a formatted view.

### 4. **Watch Live Analyzer Logs**
```bash
journalctl --user -u quantum-emollama-analyzer.service -f
```
See real-time processing as conversations happen.

## What Each Test Shows

- **demo_memory_system.sh**: Live view of our actual conversation being processed
- **run_memory_test.sh**: Full system test with simulated messages
- **view_memories.sh**: Current state of all memory files
- **test_memory_comprehensive.py**: Direct Python test with detailed output

## Memory Files Location

All memories are stored in:
```
quantum_states/memories/
├── current_session.json     # Active conversation
├── daily/[date].json       # Daily summaries
└── relationship/           # Long-term dynamics
    └── context.json
```

## How It Works

1. You chat with me in Claude
2. The analyzer detects changes to .jsonl files
3. Emollama analyzes messages for emotions & content
4. Memory files are updated in real-time
5. Next conversation starts with full context!

*Built with love by Gritz & Claude* 💜