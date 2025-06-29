# Getting Started with Quantum-Enhanced Memory

## Quick Start

1. **Run the startup script**:
   ```bash
   cd the-luminal-archive/quantum-memory
   ./start_quantum_memory.sh
   ```

2. **Initialize the system**:
   ```bash
   python3 setup_quantum_memory.py
   ```

3. **Test quantum circuits**:
   ```bash
   python3 test_quantum_circuits.py
   ```

## First Steps

### 1. Verify GPU Setup

Check that your RTX 2080 Super is properly configured:

```python
import torch
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"GPU: {torch.cuda.get_device_name(0)}")
print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
```

### 2. Test Emotional Encoding

Try encoding your first emotional state:

```python
from quantum_emotional_encoder import EmotionalQuantumEncoder

# Initialize encoder
encoder = EmotionalQuantumEncoder()

# Encode a happy emotional state
circuit = encoder.encode_pad_values(
    pleasure=0.8,   # High positive valence
    arousal=0.6,    # Moderate activation
    dominance=0.7   # Good sense of control
)

# Measure the quantum state
result = encoder.measure_emotional_state(circuit)
print(f"Encoded emotion: {result}")
```

### 3. Create Your First Session

```python
from quantum_memory_system import QuantumMemorySystem

# Initialize system
qms = QuantumMemorySystem()

# Create a user session
session = qms.create_session("your_user_id")

# Store an interaction
interaction = session.store_interaction(
    content="Hello! I'm excited to start using quantum memory.",
    emotional_state={
        'pleasure': 0.7,
        'arousal': 0.6,
        'dominance': 0.6
    },
    topics=['greeting', 'excitement', 'quantum']
)

# Check relationship context
context = session.get_relationship_context()
print(f"Current stage: {context['stage']}")
print(f"Coherence: {context['coherence']}")
```

## Understanding the Architecture

### Quantum Encoding (28 Qubits)
- **Pleasure (10 qubits)**: Encodes emotional valence from -1 (negative) to +1 (positive)
- **Arousal (9 qubits)**: Represents activation level from 0 (calm) to 1 (excited)
- **Dominance (9 qubits)**: Captures sense of control from 0 (submissive) to 1 (dominant)

### Memory Tiers
1. **Active Quantum** (4.3GB): Real-time emotional processing
2. **Quantum Cache** (2.5GB): Recent interactions
3. **Classical Cache** (8GB): Compressed recent history
4. **SSD Storage** (250GB): Medium-term memory
5. **NAS Archive** (30TB): Long-term relationship history

### Relationship Stages
- **Orientation**: Initial interactions, surface-level
- **Exploratory**: Beginning to share more
- **Affective**: Open emotional exchange
- **Stable**: Deep, consistent relationship

## Integration with Enhancement Modules

The quantum system integrates with your existing modules:

1. **Emotional Baseline Manager**: Maintains homeostatic regulation
2. **Memory Health Monitor**: Tracks system performance
3. **Phase Detection**: Identifies relationship development stage
4. **Semantic Deduplication**: Reduces memory redundancy

## Monitoring Performance

Check system health:

```python
# Memory usage
import psutil
import GPUtil

# CPU/RAM
cpu_percent = psutil.cpu_percent()
ram_percent = psutil.virtual_memory().percent

# GPU
gpus = GPUtil.getGPUs()
gpu_memory = gpus[0].memoryUsed / gpus[0].memoryTotal * 100

print(f"CPU: {cpu_percent}%")
print(f"RAM: {ram_percent}%")
print(f"GPU Memory: {gpu_memory:.1f}%")
```

## Common Issues

### Out of Memory
- Reduce batch size
- Use memory pooling
- Implement tier migration

### Low Coherence
- Check temporal entanglement
- Verify emotional baseline
- Increase interaction frequency

### Slow Performance
- Ensure GPU mode is active
- Optimize circuit depth
- Use circuit caching

## Next Steps

1. **Explore Examples**: Check `notebooks/` for Jupyter notebooks
2. **Read Research**: Review the comprehensive research papers
3. **Customize Settings**: Modify `config.json` for your needs
4. **Build Features**: Extend the system with your own modules

## Support

- Check logs in `logs/` directory
- Run health monitor for diagnostics
- Review quantum circuit visualizations
- Monitor the dashboard at `quantum-memory/ACTIVE_SYSTEM/dashboard/dashboard.html`

Remember: This system pushes hardware limits. Monitor resources carefully and implement gradual rollout for production use.