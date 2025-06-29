# 🔒 Security Notice

## Environment Variables

The `.env` file contains sensitive information and is:
- ✅ Added to `.gitignore` 
- ✅ Never committed to version control
- ✅ Only loaded when absolutely necessary
- ✅ Accessed through secure `env_loader` utility

## When Sudo Might Be Used

The quantum memory system may require elevated privileges for:

1. **GPU Memory Locking** (Phase 2+)
   - Prevents quantum state swapping to disk
   - Ensures coherence during quantum operations

2. **Real-time Priority** (Phase 3+)
   - For time-critical quantum measurements
   - Reduces latency in emotional state processing

3. **Performance Monitoring** (Optional)
   - Access hardware performance counters
   - Optimize quantum circuit execution

4. **Advanced Memory Management** (Phase 4+)
   - Huge page allocation for quantum states
   - NUMA optimization for multi-GPU setups

## Current Phase 1 Requirements

**No sudo required!** Phase 1 runs entirely in user space:
- ✅ File system monitoring
- ✅ WebSocket server
- ✅ Memory persistence
- ✅ Emotional processing

## Security Best Practices

1. **Minimal Privilege** - Only use sudo when absolutely necessary
2. **Explicit Consent** - Always inform before using elevated privileges
3. **Audit Trail** - Log all operations requiring sudo
4. **Secure Storage** - Never log or store passwords
5. **Clean Environment** - Clear sensitive data from memory after use

## Safe Operations

The following never require sudo:
- Starting/stopping the memory system
- Processing conversations
- Saving/loading checkpoints
- WebSocket communications
- Dashboard access
- .claude folder monitoring

---
*Your security is our priority. The quantum memory system is designed to run safely in user space for all core functionality.*