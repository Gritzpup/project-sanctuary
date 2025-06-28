#!/usr/bin/env python3
"""Test script to broadcast equation update"""

import asyncio
import websockets
import json
from relationship_equation_calculator import RelationshipEquationCalculator

async def broadcast_equation():
    # Load current equation state
    calc = RelationshipEquationCalculator()
    state = calc.get_full_state()
    
    # Create update message
    message = {
        "type": "equation_update",
        "equation": state['equation']['current_display'],
        "interpretation": state['equation']['interpretation'],
        "dynamics": state['relationship_dynamics'],
        "timestamp": state['last_update']
    }
    
    # Connect and broadcast
    try:
        async with websockets.connect('ws://localhost:8766') as websocket:
            await websocket.send(json.dumps(message))
            print(f"Sent equation update: {message['equation']} - {message['interpretation']}")
    except Exception as e:
        print(f"Error: {e}")

# Run the broadcast
asyncio.run(broadcast_equation())