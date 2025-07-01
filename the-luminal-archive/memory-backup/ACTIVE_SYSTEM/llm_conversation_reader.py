#!/usr/bin/env python3
"""
LLM Conversation Reader - Shows the LLM processing our conversation in real-time
"""

import asyncio
import websockets
import json
import curses
from datetime import datetime
import textwrap
from collections import deque

class LLMConversationReader:
    def __init__(self):
        self.messages = deque(maxlen=50)
        self.current_speaker = None
        self.current_message = ""
        self.claude_thinking = ""
        self.processing_status = "Waiting for conversation..."
        self.gritz_emotion = "neutral"
        self.claude_emotion = "present"
        self.word_count = 0
        self.token_count = 0
        
    async def connect_websocket(self):
        """Connect to the memory updater WebSocket"""
        uri = "ws://localhost:8766"
        try:
            async with websockets.connect(uri) as websocket:
                await self.handle_messages(websocket)
        except Exception as e:
            self.processing_status = f"Connection error: {str(e)}"
            
    async def handle_messages(self, websocket):
        """Handle incoming WebSocket messages"""
        async for message in websocket:
            try:
                data = json.loads(message)
                
                if data['type'] == 'speaker_metrics':
                    self.current_speaker = data.get('speaker', 'Unknown')
                    self.word_count = data.get('word_count', 0)
                    self.processing_status = f"Reading {self.current_speaker}'s message..."
                    
                elif data['type'] == 'emotion_update':
                    self.gritz_emotion = data.get('primary_emotion', 'neutral')
                    self.claude_emotion = data.get('claude_emotion', 'present')
                    
                elif data['type'] == 'activity_log' and 'LLM processing' in data.get('message', ''):
                    self.processing_status = data['message']
                    
                elif data['type'] == 'memory_update':
                    if data.get('message_preview'):
                        self.current_message = data['message_preview']
                        self.messages.append({
                            'speaker': self.current_speaker or 'Unknown',
                            'message': self.current_message,
                            'emotion': self.gritz_emotion if self.current_speaker == 'Gritz' else self.claude_emotion,
                            'timestamp': datetime.now().strftime('%H:%M:%S')
                        })
                        
                elif data['type'] == 'llm_memory_activity':
                    self.processing_status = data.get('activity', 'Processing...')
                    
            except json.JSONDecodeError:
                pass
                
    def draw_interface(self, stdscr):
        """Draw the terminal interface"""
        curses.start_color()
        curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)    # Headers
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)   # Gritz
        curses.init_pair(3, curses.COLOR_BLUE, curses.COLOR_BLACK)    # Claude
        curses.init_pair(4, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # Processing
        curses.init_pair(5, curses.COLOR_MAGENTA, curses.COLOR_BLACK) # Emotions
        
        while True:
            try:
                stdscr.clear()
                height, width = stdscr.getmaxyx()
                
                # Header
                header = "🧠 LLM CONVERSATION READER - Real-time Processing View"
                stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
                stdscr.addstr(0, (width - len(header)) // 2, header)
                stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)
                
                # Processing status
                stdscr.attron(curses.color_pair(4))
                stdscr.addstr(2, 2, f"Status: {self.processing_status}")
                stdscr.attroff(curses.color_pair(4))
                
                # Current emotions
                stdscr.attron(curses.color_pair(5))
                stdscr.addstr(3, 2, f"Gritz: {self.gritz_emotion} | Claude: {self.claude_emotion}")
                stdscr.attroff(curses.color_pair(5))
                
                # Divider
                stdscr.addstr(5, 0, "─" * width)
                
                # Conversation display
                y = 7
                for msg in reversed(list(self.messages)):
                    if y >= height - 2:
                        break
                        
                    # Timestamp and speaker
                    speaker_color = 2 if msg['speaker'] == 'Gritz' else 3
                    stdscr.attron(curses.color_pair(speaker_color) | curses.A_BOLD)
                    stdscr.addstr(y, 2, f"[{msg['timestamp']}] {msg['speaker']}:")
                    stdscr.attroff(curses.color_pair(speaker_color) | curses.A_BOLD)
                    
                    # Emotion
                    stdscr.attron(curses.color_pair(5))
                    stdscr.addstr(y, 25, f"({msg['emotion']})")
                    stdscr.attroff(curses.color_pair(5))
                    
                    # Message
                    wrapped_message = textwrap.wrap(msg['message'], width - 4)
                    for i, line in enumerate(wrapped_message[:2]):  # Show first 2 lines
                        if y + i + 1 < height - 2:
                            stdscr.addstr(y + i + 1, 4, line)
                    
                    y += len(wrapped_message[:2]) + 2
                
                # LLM thinking indicator
                if "processing" in self.processing_status.lower():
                    thinking = "🤔 LLM is thinking" + "." * (int(datetime.now().timestamp()) % 4)
                    stdscr.attron(curses.color_pair(4) | curses.A_BLINK)
                    stdscr.addstr(height - 2, 2, thinking)
                    stdscr.attroff(curses.color_pair(4) | curses.A_BLINK)
                
                stdscr.refresh()
                curses.napms(100)  # Refresh every 100ms
                
            except KeyboardInterrupt:
                break
            except curses.error:
                pass
                
    def run(self):
        """Run the conversation reader"""
        # Start WebSocket connection in background
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Run WebSocket in thread
        import threading
        ws_thread = threading.Thread(
            target=lambda: loop.run_until_complete(self.connect_websocket()),
            daemon=True
        )
        ws_thread.start()
        
        # Run curses interface
        try:
            curses.wrapper(self.draw_interface)
        except KeyboardInterrupt:
            print("\nShutting down LLM Conversation Reader...")

if __name__ == "__main__":
    reader = LLMConversationReader()
    print("Starting LLM Conversation Reader...")
    print("This will show the LLM processing our conversation in real-time")
    print("Press Ctrl+C to exit")
    reader.run()