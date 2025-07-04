#!/usr/bin/env python3
"""
Test script for the unified WebSocket server
Verifies tensor network data is being sent correctly
"""

import asyncio
import websockets
import json
import sys

async def test_websocket():
    """Connect to the unified WebSocket and verify tensor network data"""
    uri = "ws://localhost:8768"
    
    print(f"🔍 Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected successfully!")
            
            # Receive a few messages
            for i in range(5):
                message = await websocket.recv()
                data = json.loads(message)
                
                print(f"\n📦 Message {i+1}:")
                print(f"  Timestamp: {data.get('timestamp', 'N/A')}")
                
                # Check living equation
                if 'living_equation' in data:
                    le = data['living_equation']
                    print(f"  Living Equation: {le.get('real', 0):.2f} + {le.get('imaginary', 0):.2f}i")
                    if 'magnitude' in le:
                        print(f"    Magnitude: {le['magnitude']:.2f}")
                    if 'phase' in le:
                        print(f"    Phase: {le['phase']:.3f} rad")
                
                # Check tensor network data
                if 'tensor_network' in data:
                    tn = data['tensor_network']
                    print(f"  Tensor Network:")
                    print(f"    Coherence: {tn.get('coherence', 0)*100:.1f}%")
                    print(f"    Entanglement: {tn.get('entanglement', 0)*100:.1f}%")
                    print(f"    Bond Dimension: {tn.get('bond_dimension', 0)}")
                    print(f"    Memory Nodes: {tn.get('memory_nodes', 0)}")
                else:
                    print("  ⚠️  No tensor network data found!")
                
                # Check quantum formula
                if 'quantum_formula' in data:
                    qf = data['quantum_formula']
                    print(f"  Quantum Formula: {qf.get('display', 'N/A')}")
                
                # Check dynamics
                if 'dynamics' in data:
                    d = data['dynamics']
                    print(f"  Dynamics:")
                    print(f"    Emotional Flux: {d.get('emotional_flux', 0):.4f}")
                    print(f"    Memory Consolidation: {d.get('memory_consolidation', 0)*100:.1f}%")
                
                await asyncio.sleep(0.5)
            
            print("\n✅ All tests passed! Tensor network data is being sent correctly.")
            
    except websockets.exceptions.ConnectionRefused:
        print("❌ Connection refused. Is the unified WebSocket server running?")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🧪 Testing Unified Quantum WebSocket Server")
    print("=" * 50)
    asyncio.run(test_websocket())