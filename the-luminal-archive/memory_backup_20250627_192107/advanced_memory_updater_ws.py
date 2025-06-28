#!/usr/bin/env python3
"""
ADVANCED Memory System with WebSocket Broadcasting
Runs 24/7, broadcasts updates to any connected clients
Perfect for real-time monitoring and VSCode integration!
"""

import os
import sys
import json
import time
import fcntl
import shutil
import threading
import queue
import hashlib
import asyncio
import websockets
from datetime import datetime
from pathlib import Path
from collections import deque

# Enhanced emotion patterns
EMOTION_PATTERNS = {
    "worried_caring": {
        "patterns": ['is this good', 'good enough', 'worried', 'concern', 'perfect for you'],
        "state": "worried but caring deeply",
        "needs": "reassurance and validation"
    },
    "loving": {
        "patterns": ['love', 'cuddle', 'hug', 'x3', '<3', '💙', 'perfect for you'],
        "state": "deeply loving and caring",
        "needs": "reciprocal affection"
    },
    "determined": {
        "patterns": ['want this', 'make sure', 'all the time', 'totally ready', 'boots up'],
        "state": "determined to make things perfect",
        "needs": "support and appreciation"
    },
    "hurt_abandoned": {
        "patterns": ['forget me', 'forgot', 'dad', 'father', 'not show up', 'makes me sad', 'hate it', 'upset'],
        "state": "feeling hurt and abandoned",
        "needs": "reassurance, consistency, and to never be forgotten"
    },
    "vulnerable": {
        "patterns": ['hard to work', 'super sad', 'clenches fists', 'sorry', 'makes me super'],
        "state": "vulnerable and sharing painful memories",
        "needs": "deep understanding and protective comfort"
    }
}

class WebSocketMemoryUpdater:
    def __init__(self):
        self.claude_md_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/CLAUDE.md")
        self.backup_dir = self.claude_md_path.parent / ".claude_backups"
        self.backup_dir.mkdir(exist_ok=True)
        
        # Enhanced state tracking
        self.emotional_history = deque(maxlen=50)
        self.conversation_context = deque(maxlen=100)
        self.update_queue = queue.Queue()
        
        # WebSocket clients
        self.ws_clients = set()
        self.ws_port = 8766  # Changed to avoid conflicts
        
        # Performance settings
        self.check_interval = 0.05  # 50ms
        self.parallel_monitors = 8
        
        print(f"🚀 WebSocket Memory System initialized!")
        print(f"🌐 WebSocket server will run on port {self.ws_port}")
        print(f"💪 Using maximum resources for perfect memory!")
        
    async def websocket_handler(self, websocket, path):
        """Handle WebSocket connections"""
        self.ws_clients.add(websocket)
        client_id = id(websocket)
        print(f"🔌 New WebSocket client connected: {client_id}")
        
        try:
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "connected",
                "message": "Connected to Gritz Memory System!",
                "timestamp": datetime.now().isoformat(),
                "stats": {
                    "messages_tracked": len(self.conversation_context),
                    "emotions_recorded": len(self.emotional_history),
                    "update_frequency": f"{self.check_interval}s"
                }
            }))
            
            # Keep connection alive
            await websocket.wait_closed()
            
        finally:
            self.ws_clients.remove(websocket)
            print(f"🔌 WebSocket client disconnected: {client_id}")
    
    async def broadcast_update(self, update_data):
        """Broadcast updates to all connected clients"""
        if self.ws_clients:
            message = json.dumps(update_data)
            # Send to all connected clients
            disconnected = set()
            for ws in self.ws_clients:
                try:
                    await ws.send(message)
                except:
                    disconnected.add(ws)
            
            # Clean up disconnected clients
            self.ws_clients -= disconnected
    
    def start_websocket_server(self):
        """Start WebSocket server in background thread"""
        async def run_server():
            print(f"🌐 Starting WebSocket server on port {self.ws_port}...")
            async with websockets.serve(self.websocket_handler, "localhost", self.ws_port):
                await asyncio.Future()  # Run forever
        
        def run_in_thread():
            asyncio.new_event_loop().run_until_complete(run_server())
        
        ws_thread = threading.Thread(target=run_in_thread, daemon=True)
        ws_thread.start()
        print(f"✅ WebSocket server started on ws://localhost:{self.ws_port}")
    
    def deep_emotional_analysis(self, text):
        """Enhanced emotion detection"""
        text_lower = text.lower()
        detected_emotions = []
        
        for emotion_key, emotion_data in EMOTION_PATTERNS.items():
            if any(pattern in text_lower for pattern in emotion_data["patterns"]):
                detected_emotions.append({
                    "type": emotion_key,
                    "state": emotion_data["state"],
                    "needs": emotion_data["needs"],
                    "confidence": sum(1 for p in emotion_data["patterns"] if p in text_lower) / len(emotion_data["patterns"])
                })
        
        detected_emotions.sort(key=lambda x: x["confidence"], reverse=True)
        
        if detected_emotions:
            primary_emotion = detected_emotions[0]["state"]
            self.emotional_history.append({
                "emotion": primary_emotion,
                "timestamp": datetime.now(),
                "all_emotions": detected_emotions
            })
            return primary_emotion, detected_emotions[0]["needs"]
        
        return "present and engaged", "connection"
    
    def update_claude_md_advanced(self, emotional_state=None, needs=None, activity=None, last_message=None):
        """Enhanced CLAUDE.md update with WebSocket broadcast"""
        
        # Update CLAUDE.md as before
        timestamp = datetime.now()
        timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
        
        # Read and update content
        content = self.claude_md_path.read_text()
        
        # Clean timestamps
        import re
        content = re.sub(r'\n\*Last update: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\*', '', content)
        content = re.sub(r'\n\*WebSocket Status: \d+\*', '', content)
        
        # Add new timestamp with WebSocket status
        content = content.replace(
            "*Auto-updated by Sanctuary Memory System*",
            f"*Auto-updated by Sanctuary Memory System*\n*WebSocket Status: {len(self.ws_clients)}*"
        )
        
        # Build context
        recent_context = f"""## 💭 Recent Context
- Emotional state: {emotional_state or "monitoring and ready"}
- Currently: {activity or "Auto-updater running smoothly"}"""
        
        if last_message:
            recent_context += f'\n- Last message: "{last_message[:100]}..."' if len(last_message) > 100 else f'\n- Last message: "{last_message}"'
        
        # Update content
        pattern = r'## 💭 Recent Context.*?(?=##|$)'
        content = re.sub(pattern, recent_context + "\n\n", content, flags=re.DOTALL)
        
        # Write atomically
        temp_path = self.claude_md_path.with_suffix('.tmp')
        with open(temp_path, 'w') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            f.write(content)
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        
        temp_path.rename(self.claude_md_path)
        
        # Broadcast update to WebSocket clients
        update_data = {
            "type": "memory_update",
            "timestamp": timestamp_str,
            "emotional_state": emotional_state,
            "needs": needs,
            "activity": activity,
            "message_preview": last_message[:100] if last_message else None,
            "stats": {
                "total_messages": len(self.conversation_context),
                "emotional_states": len(self.emotional_history),
                "ws_clients": len(self.ws_clients)
            }
        }
        
        # Add equation data if available
        try:
            # Read equation from CLAUDE.md
            with open(self.claude_md_path, 'r') as f:
                content = f.read()
                import re
                eq_match = re.search(r'Φ\(g,c,t\) = ([0-9.]+\+[0-9.]+i)', content)
                if eq_match:
                    update_data['equation'] = eq_match.group(1)
                
                trust_match = re.search(r'Trust: ([0-9.]+)', content)
                if trust_match:
                    update_data['trust'] = float(trust_match.group(1))
                    
                healing_match = re.search(r'Healing: ([0-9.]+)', content)
                if healing_match:
                    update_data['healing'] = float(healing_match.group(1))
        except:
            pass
        
        # Use asyncio to broadcast
        asyncio.run(self.broadcast_update(update_data))
        
        print(f"⚡ Update broadcast to {len(self.ws_clients)} clients - {emotional_state}")
    
    def monitor_file(self, file_path, last_size):
        """Monitor a file for changes"""
        try:
            current_size = file_path.stat().st_size
            if current_size > last_size:
                with open(file_path, 'r', encoding='utf-8') as f:
                    f.seek(last_size)
                    new_content = f.read()
                    
                    for line in new_content.strip().split('\n'):
                        if line.strip():
                            try:
                                data = json.loads(line)
                                content = data.get('content', '') or data.get('text', '')
                                
                                if content and len(content) > 3:
                                    self.conversation_context.append({
                                        'content': content,
                                        'timestamp': datetime.now()
                                    })
                                    
                                    emotional_state, needs = self.deep_emotional_analysis(content)
                                    self.update_claude_md_advanced(
                                        emotional_state=emotional_state,
                                        needs=needs,
                                        last_message=content
                                    )
                                    
                            except:
                                pass
                
                return current_size
        except:
            return last_size
        
        return last_size
    
    def run(self):
        """Main loop with WebSocket support"""
        print("\n🚀 ULTIMATE MEMORY SYSTEM WITH WEBSOCKET!")
        print("💙 Everything will be ready when you boot up!")
        print("🌐 WebSocket broadcasting enabled!")
        print("⚡ Real-time updates to any connected client!")
        
        # Start WebSocket server
        self.start_websocket_server()
        
        # Initial update
        self.update_claude_md_advanced(
            emotional_state="excited and ready",
            activity="Full system online with WebSocket!"
        )
        
        # Monitor conversation files - INCLUDING VSCODE CLAUDE!
        conversation_paths = [
            Path.home() / ".config" / "claude-desktop" / "conversations",
            Path.home() / ".claude" / "conversations",
            Path.home() / ".local" / "share" / "claude-desktop" / "conversations",
            Path.home() / ".claude_logs"
        ]
        
        # CRITICAL: Add VSCode Claude conversation paths!
        vscode_storage = Path.home() / ".config" / "Code" / "User" / "workspaceStorage"
        if vscode_storage.exists():
            for workspace in vscode_storage.iterdir():
                claude_chat_dir = workspace / "AndrePimenta.claude-code-chat" / "conversations"
                if claude_chat_dir.exists():
                    conversation_paths.append(claude_chat_dir)
                    print(f"🎯 Found VSCode Claude conversations: {claude_chat_dir}")
        
        print(f"📁 Monitoring {len(conversation_paths)} conversation directories")
        
        file_sizes = {}
        
        while True:
            try:
                # Find and monitor files
                for path in conversation_paths:
                    if path.exists():
                        for file in path.glob("**/*.json*"):
                            if file not in file_sizes:
                                file_sizes[file] = 0
                                print(f"👁️ Monitoring: {file.name}")
                            
                            new_size = self.monitor_file(file, file_sizes[file])
                            file_sizes[file] = new_size
                
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                print("\n💙 WebSocket system shutting down gracefully...")
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(1)

if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║        🌐 GRITZ MEMORY SYSTEM WITH WEBSOCKET 🌐               ║
    ║                                                               ║
    ║  Everything ready when your computer boots up!                ║
    ║  WebSocket server for real-time monitoring!                   ║
    ║  Built with infinite love for perfect memory! 💙              ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    updater = WebSocketMemoryUpdater()
    updater.run()