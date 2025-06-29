#!/usr/bin/env python3
"""
CLAUDE.md Updater - Monitors conversation and updates CLAUDE.md in real-time
"""
import asyncio
import websockets
import json
import logging
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('CLAUDEUpdater')

# Files to monitor and update
CLAUDE_MD_PATH = Path("CLAUDE.md")
CHECKPOINT_PATH = Path("conversation_checkpoint.json")
RELATIONSHIP_PATH = Path("relationship_history.json")

# Conversation state
conversation_buffer = []
last_update_time = datetime.now()
UPDATE_ON_EVENTS = True  # Event-based updates
EVENTS_TO_MONITOR = [
    'emotion_update',
    'checkpoint_saved',
    'equation_update',
    'trust_change',
    'new_conversation_data',
    'relationship_update',
    'speaker_metrics'
]
update_counter = 0

async def instant_update(event_type, event_data):
    """Instantly update CLAUDE.md based on event type"""
    global update_counter
    update_counter += 1
    logger.info(f"Instant update triggered by {event_type} (update #{update_counter})")
    await update_claude_md(event_type, event_data)

async def update_claude_md(event_type=None, event_data=None):
    """Update CLAUDE.md with latest conversation context"""
    try:
        # Read current checkpoint
        checkpoint = json.loads(CHECKPOINT_PATH.read_text())
        
        # Read relationship data
        relationship = json.loads(RELATIONSHIP_PATH.read_text())
        latest_rel = relationship['relationship_history'][-1] if relationship['relationship_history'] else {}
        
        # Read current CLAUDE.md
        claude_content = CLAUDE_MD_PATH.read_text()
        
        # Update relevant sections
        lines = claude_content.split('\n')
        updated_lines = []
        
        for i, line in enumerate(lines):
            if line.startswith('- **Current Emotion**:'):
                emotional_state = checkpoint.get('emotional_context', {}).get('gritz_last_emotion', 'present and engaged')
                updated_lines.append(f'- **Current Emotion**: {emotional_state}')
            elif line.startswith('- **Living Equation**:'):
                equation = latest_rel.get('equation', '0.00+0.00i')
                updated_lines.append(f'- **Living Equation**: {equation}')
            elif line.startswith('- **Messages**:'):
                messages = f"Gritz: {latest_rel.get('gritz_messages', 0)}, Claude: {latest_rel.get('claude_messages', 0)}"
                updated_lines.append(f'- **Messages**: {messages}')
            elif line.startswith('- **Time Together**:'):
                time_minutes = checkpoint.get('memory_stats', {}).get('time_together', 0) / 60
                updated_lines.append(f'- **Time Together**: {time_minutes:.2f} minutes')
            elif line.startswith('## 🔄 REAL-TIME STATUS'):
                # Add real-time status section if it exists
                updated_lines.append(line)
                j = i + 1
                while j < len(lines) and not lines[j].startswith('##'):
                    j += 1
                updated_lines.append(f'- **Last Update**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
                updated_lines.append(f'- **Active Monitoring**: YES')
                updated_lines.append(f'- **Update Count**: {update_counter}')
                updated_lines.append(f'- **Live Sync**: ACTIVE')
                i = j - 1
            elif line.startswith('## 💭 RECENT CONTEXT'):
                # Update recent context section
                updated_lines.append(line)
                # Skip old context lines
                j = i + 1
                while j < len(lines) and not lines[j].startswith('##'):
                    j += 1
                
                # Add new context from conversation buffer
                if conversation_buffer:
                    last_messages = conversation_buffer[-3:]  # Last 3 messages
                    for msg in last_messages:
                        updated_lines.append(f"- {msg['speaker']}: {msg['preview'][:100]}...")
                    updated_lines.append(f"- Last activity: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                else:
                    updated_lines.append("- Monitoring conversation...")
                
                # Skip to next section
                i = j - 1
            else:
                updated_lines.append(line)
        
        # Write updated content
        CLAUDE_MD_PATH.write_text('\n'.join(updated_lines))
        logger.info("Updated CLAUDE.md successfully")
        
        # Also update the greeting in checkpoint
        if conversation_buffer:
            last_gritz = next((msg for msg in reversed(conversation_buffer) if msg['speaker'] == 'Gritz'), None)
            if last_gritz:
                checkpoint['greeting_context']['last_activity'] = f"Last Gritz said: {last_gritz['preview']}..."
                CHECKPOINT_PATH.write_text(json.dumps(checkpoint, indent=2))
        
    except Exception as e:
        logger.error(f"Error updating CLAUDE.md: {e}")

async def handle_websocket():
    """Connect to WebSocket and monitor conversation"""
    global last_update_time
    
    while True:
        try:
            async with websockets.connect('ws://localhost:8766') as websocket:
                logger.info("Connected to WebSocket server")
                
                # Request initial state
                await websocket.send(json.dumps({
                    "type": "claude_md_updater_connect"
                }))
                
                # Monitor messages
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        
                        msg_type = data.get('type')
                        
                        # Handle different event types
                        if msg_type in EVENTS_TO_MONITOR:
                            logger.info(f"Received monitored event: {msg_type}")
                            
                            # Track conversation messages
                            if msg_type == 'speaker_metrics':
                                conversation_buffer.append({
                                    'speaker': data.get('speaker'),
                                    'preview': data.get('message_preview', ''),
                                    'emotion': data.get('emotion', ''),
                                    'timestamp': datetime.now().isoformat()
                                })
                                
                                # Keep buffer size reasonable
                                if len(conversation_buffer) > 20:
                                    conversation_buffer.pop(0)
                            
                            # Instant update on any monitored event
                            await instant_update(msg_type, data)
                            
                        elif msg_type == 'updater_registered':
                            logger.info("Successfully registered as CLAUDE.md updater")
                            
                    except json.JSONDecodeError:
                        logger.error(f"Invalid JSON: {message}")
                        
        except ConnectionRefusedError:
            logger.error("WebSocket connection refused, retrying in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"WebSocket error: {e}, retrying in 5 seconds...")
            await asyncio.sleep(5)

async def main():
    """Main function"""
    logger.info("Starting CLAUDE.md updater service")
    
    # Run WebSocket handler
    await handle_websocket()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("CLAUDE.md updater stopped by user")