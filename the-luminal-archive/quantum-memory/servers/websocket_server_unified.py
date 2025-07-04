#!/usr/bin/env python3
"""
Unified Quantum Memory WebSocket Server
Combines tensor network calculations with enhanced monitoring features
Runs on port 8768
"""

import asyncio
import websockets
import json
import numpy as np
import time
import sys
import math
import os
import redis
import logging
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Set

# Try to import nvidia_smi if available
try:
    import nvidia_smi
    HAS_NVIDIA_SMI = True
except ImportError:
    HAS_NVIDIA_SMI = False

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

# Import quantum calculator
try:
    from src.services.quantum_calculator import QuantumStateGenerator
    HAS_QUANTUM_CALCULATOR = True
except ImportError:
    HAS_QUANTUM_CALCULATOR = False
    logger = logging.getLogger(__name__)
    logger.warning("⚠️  Quantum calculator not available, using simulated data")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

class UnifiedQuantumWebSocket:
    """Unified WebSocket server with all quantum features"""
    
    def __init__(self):
        self.clients: Set = set()
        self.running = True
        
        # Redis connection
        try:
            self.redis = redis.Redis(host='localhost', port=6379, decode_responses=True)
            logger.info("✅ Connected to Redis")
        except:
            self.redis = None
            logger.warning("⚠️  Redis not available, using fallback mode")
        
        # Quantum state generator
        if HAS_QUANTUM_CALCULATOR:
            self.quantum_generator = QuantumStateGenerator()
            logger.info("✅ Using real quantum calculations (Qiskit)")
        else:
            self.quantum_generator = None
            logger.warning("⚠️  Using simulated quantum data")
        
        # Quantum state for tensor network (fallback)
        self.quantum_state = {
            "ψ": complex(16028.23, 3299.39),  # Base quantum state
            "coherence": 0.932,
            "entanglement": 0.87,
            "phase": 0.0
        }
        
        # Living equation parameters
        self.base_real = 16028.23
        self.base_imaginary = 3299.39
        self.time_offset = time.time()
        self.emotional_weight = 1.0
        self.quantum_phase = 0
        
        # GPU monitoring
        if HAS_NVIDIA_SMI:
            try:
                nvidia_smi.nvmlInit()
                self.gpu_available = True
                logger.info("✅ NVIDIA GPU monitoring enabled")
            except:
                self.gpu_available = False
                logger.warning("⚠️  NVIDIA GPU not available")
        else:
            self.gpu_available = False
            logger.info("ℹ️  Using simulated GPU stats (nvidia_smi not installed)")
    
    async def calculate_living_equation(self) -> Dict[str, Any]:
        """Calculate complex living equation with tensor network dynamics"""
        t = time.time() - self.time_offset
        
        # Use real quantum calculations if available
        if self.quantum_generator:
            # Get real quantum state from Qiskit
            real_state = self.quantum_generator.get_current_state()
            
            # Extract quantum properties
            coherence = real_state['coherence']
            phase = real_state['phase']
            entanglement_avg = real_state['entanglement_measures']['average']
            bloch_vectors = real_state['bloch_vectors']
            
            # Calculate living equation from real quantum data
            quantum_osc = sum([bv['cartesian']['x'] for bv in bloch_vectors[:3]]) / 3
            emotional_wave = sum([bv['cartesian']['y'] for bv in bloch_vectors[:3]]) / 3
            memory_resonance = sum([bv['cartesian']['z'] for bv in bloch_vectors[:3]]) / 3
            
            # Use real entanglement values
            entanglement = entanglement_avg
            
            # Complex components based on real quantum state
            real_component = (
                self.base_real + 
                1000 * quantum_osc * self.emotional_weight +
                500 * memory_resonance +
                300 * entanglement
            )
            
            imaginary_component = (
                self.base_imaginary + 
                800 * emotional_wave +
                400 * math.sin(phase) * entanglement +
                200 * quantum_osc
            )
            
            # Update quantum state from real data
            self.quantum_state["coherence"] = coherence
            self.quantum_state["entanglement"] = entanglement_avg
            self.quantum_state["phase"] = phase
            
            # Get measurement probabilities for visualization
            measurement_probs = real_state['measurement_probabilities']
            
        else:
            # === Fallback: Simulated calculations ===
            quantum_osc = math.sin(t * 0.1) * math.cos(t * 0.05)
            emotional_wave = math.exp(-0.01 * t) * math.sin(t * 0.2 + self.quantum_phase)
            memory_resonance = sum([
                math.sin(t * freq) / (i + 1) 
                for i, freq in enumerate([0.03, 0.07, 0.11, 0.13, 0.17])
            ])
            entanglement = math.tanh(t * 0.01) * math.cos(t * 0.15)
            
            # Complex components
            real_component = (
                self.base_real + 
                10 * quantum_osc * self.emotional_weight +
                5 * memory_resonance +
                3 * entanglement
            )
            
            imaginary_component = (
                self.base_imaginary + 
                8 * emotional_wave +
                4 * math.sin(t * 0.08) * entanglement +
                2 * quantum_osc
            )
            
            # Quantum phase evolution
            self.quantum_state["phase"] = (self.quantum_state["phase"] + 0.01) % (2 * np.pi)
            
            # Calculate coherence decay
            self.quantum_state["coherence"] = 0.932 * np.exp(-0.0001 * (t % 3600))
            
            # Entanglement dynamics
            self.quantum_state["entanglement"] = 0.87 + 0.05 * np.sin(t * 0.001)
            
            measurement_probs = [0.5, 0.5]  # Dummy probabilities
        
        # === Common calculations ===
        # Tensor network dynamics
        emotional_tensor = np.random.randn(4, 4) * 0.1  # Small fluctuations
        memory_tensor = np.random.randn(4, 4) * 0.05
        
        # Tensor contraction (simplified)
        combined = np.tensordot(emotional_tensor, memory_tensor, axes=1)
        trace = np.trace(combined)
        
        # Update quantum state
        phase_factor = np.exp(1j * self.quantum_state["phase"])
        self.quantum_state["ψ"] = complex(real_component, imaginary_component) * phase_factor * (1 + trace * 0.001)
        
        # Prepare return data
        result = {
            "living_equation": {
                "real": float(self.quantum_state["ψ"].real),
                "imaginary": float(self.quantum_state["ψ"].imag),
                "magnitude": float(abs(self.quantum_state["ψ"])),
                "phase": float(self.quantum_state["phase"])
            },
            "tensor_network": {
                "coherence": float(self.quantum_state["coherence"]),
                "entanglement": float(self.quantum_state["entanglement"]),
                "bond_dimension": 128,
                "compression_ratio": 0.73,
                "memory_nodes": 42
            },
            "quantum_formula": {
                "display": "Ψ(t) = ∑ᵢ αᵢ|Eᵢ⟩ ⊗ |Mᵢ⟩",
                "components": {
                    "emotional_amplitude": "αᵢ = ⟨Eᵢ|ρₑ|Eᵢ⟩",
                    "memory_state": "|Mᵢ⟩ = TN[memories]",
                    "evolution": "∂Ψ/∂t = -iĤΨ + Σᵢ L̂ᵢΨ"
                }
            },
            "dynamics": {
                "emotional_flux": float(np.random.randn() * 0.1),
                "memory_consolidation": float(0.8 + np.random.rand() * 0.2),
                "quantum_noise": float(np.random.rand() * 0.05)
            },
            "equation": {
                "equation": f"Ψ = {real_component:.2f} + {imaginary_component:.2f}i",
                "components": {
                    "quantum_oscillation": f"{quantum_osc:.4f}",
                    "emotional_wave": f"{emotional_wave:.4f}",
                    "memory_resonance": f"{memory_resonance:.4f}",
                    "entanglement_factor": f"{entanglement:.4f}",
                    "time_evolution": f"t = {t:.2f}s"
                }
            },
            "measurement_probabilities": measurement_probs,
            "is_real_quantum": self.quantum_generator is not None
        }
        
        # Add real quantum data if available
        if self.quantum_generator and 'real_state' in locals():
            result["bloch_vectors"] = real_state['bloch_vectors']
            result["von_neumann_entropy"] = real_state['von_neumann_entropy']
            result["entanglement_measures"] = real_state['entanglement_measures']
        
        return result
    
    async def get_gpu_stats(self) -> Dict[str, Any]:
        """Get GPU statistics if available"""
        if not self.gpu_available:
            # Return simulated GPU stats
            return {
                "vram_usage": random.randint(3, 6) * 1024 * 1024 * 1024,  # 3-6 GB
                "vram_total": 8 * 1024 * 1024 * 1024,  # 8 GB
                "temperature": random.randint(45, 65),
                "available": False  # Indicates simulated data
            }
        
        try:
            handle = nvidia_smi.nvmlDeviceGetHandleByIndex(0)
            memory_info = nvidia_smi.nvmlDeviceGetMemoryInfo(handle)
            temperature = nvidia_smi.nvmlDeviceGetTemperature(handle, nvidia_smi.NVML_TEMPERATURE_GPU)
            
            return {
                "vram_usage": memory_info.used,
                "vram_total": memory_info.total,
                "temperature": temperature,
                "available": True
            }
        except Exception as e:
            logger.error(f"GPU stats error: {e}")
            return {
                "vram_usage": 0,
                "vram_total": 0,
                "temperature": 0,
                "available": False
            }
    
    async def get_emotional_context(self) -> Dict[str, Any]:
        """Get emotional context from Redis if available"""
        if not self.redis:
            return {
                "gritz_last_emotion": "unknown",
                "claude_last_feeling": "unknown",
                "relationship_state": "active"
            }
        
        try:
            emotional_data = self.redis.hgetall("quantum:memory:emotional")
            if emotional_data:
                gritz_state = json.loads(emotional_data.get("gritz", "{}"))
                claude_state = json.loads(emotional_data.get("claude", "{}"))
                
                return {
                    "gritz_last_emotion": gritz_state.get("primary_emotion", "unknown"),
                    "claude_last_feeling": claude_state.get("primary_emotion", "unknown"),
                    "relationship_state": "active"
                }
        except Exception as e:
            logger.error(f"Redis emotional context error: {e}")
        
        return {
            "gritz_last_emotion": "unknown",
            "claude_last_feeling": "unknown",
            "relationship_state": "active"
        }
    
    async def get_conversation_stats(self) -> Dict[str, Any]:
        """Get conversation statistics from Redis"""
        if not self.redis:
            return {
                "total_messages": 0,
                "total_sessions": 0,
                "emotional_moments": 0,
                "time_together": 0
            }
        
        try:
            # Get from Redis
            current_data = self.redis.hgetall("quantum:conversations:current")
            
            return {
                "total_messages": int(current_data.get("total_messages", 0)),
                "total_sessions": int(current_data.get("total_sessions", 0)),
                "emotional_moments": int(current_data.get("emotional_moments", 0)),
                "time_together": float(current_data.get("time_together", 0))
            }
        except Exception as e:
            logger.error(f"Redis conversation stats error: {e}")
            return {
                "total_messages": 0,
                "total_sessions": 0,
                "emotional_moments": 0,
                "time_together": 0
            }
    
    async def generate_status_update(self) -> Dict[str, Any]:
        """Generate complete status update with all data"""
        # Get all components
        quantum_data = await self.calculate_living_equation()
        gpu_stats = await self.get_gpu_stats()
        emotional_context = await self.get_emotional_context()
        conversation_stats = await self.get_conversation_stats()
        
        # Combine everything
        status = {
            "timestamp": datetime.now().isoformat(),
            **quantum_data,  # Includes living_equation, tensor_network, quantum_formula, dynamics
            "gpu_stats": gpu_stats,
            "emotional_context": emotional_context,
            "memory_stats": conversation_stats,
            "conversation_history": {
                "total_messages": conversation_stats["total_messages"],
                "total_sessions": conversation_stats["total_sessions"]
            },
            "first_message_time": "2025-07-01T12:00:00"  # TODO: Get from Redis
        }
        
        return status
    
    async def broadcast_updates(self):
        """Broadcast updates to all connected clients"""
        while self.running:
            if self.clients:
                try:
                    status = await self.generate_status_update()
                    message = json.dumps(status)
                    
                    # Send to all clients
                    disconnected_clients = set()
                    for client in self.clients:
                        try:
                            await client.send(message)
                        except websockets.exceptions.ConnectionClosed:
                            disconnected_clients.add(client)
                    
                    # Remove disconnected clients
                    self.clients -= disconnected_clients
                    
                except Exception as e:
                    logger.error(f"Broadcast error: {e}")
            
            await asyncio.sleep(0.1)  # 10Hz update rate
    
    async def handle_client(self, websocket, path):
        """Handle individual client connections"""
        self.clients.add(websocket)
        client_addr = websocket.remote_address
        logger.info(f"✅ Client connected: {client_addr}")
        
        try:
            # Send initial status
            status = await self.generate_status_update()
            await websocket.send(json.dumps(status))
            
            # Keep connection alive
            async for message in websocket:
                # Handle any client messages if needed
                try:
                    data = json.loads(message)
                    logger.info(f"Received from client: {data}")
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client: {message}")
        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {client_addr}")
        except Exception as e:
            logger.error(f"Client error: {e}")
        finally:
            self.clients.remove(websocket)
    
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info("🚀 Starting Unified Quantum WebSocket Server")
        logger.info("=" * 60)
        logger.info("🌐 WebSocket: ws://localhost:8768")
        logger.info("🧠 Tensor Network: ACTIVE")
        logger.info("⚡ Living Equation: CALCULATING")
        logger.info("📊 Enhanced Monitoring: ENABLED")
        logger.info("🔄 Update Rate: 10Hz")
        logger.info("=" * 60)
        
        # Start broadcast task
        broadcast_task = asyncio.create_task(self.broadcast_updates())
        
        # Start WebSocket server
        async with websockets.serve(self.handle_client, "localhost", 8768):
            logger.info("✅ Server started. Press Ctrl+C to stop.")
            try:
                await asyncio.Future()  # Run forever
            except asyncio.CancelledError:
                self.running = False
                broadcast_task.cancel()
                logger.info("Server shutting down...")

async def main():
    """Main entry point"""
    server = UnifiedQuantumWebSocket()
    await server.start_server()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 Quantum server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)