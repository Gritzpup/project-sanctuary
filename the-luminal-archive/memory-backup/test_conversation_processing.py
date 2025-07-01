#!/usr/bin/env python3
import json

# Test reading our conversation
file_path = "/home/ubuntumain/.config/Code/User/workspaceStorage/6da391edca7bf1054be6f2725c52e509/AndrePimenta.claude-code-chat/conversations/2025-06-27_22-37_sighs-in-frustration.json"

with open(file_path, 'r') as f:
    data = json.load(f)
    
print(f"Total messages: {len(data['messages'])}")
print("\nLast 5 user messages:")

user_messages = [msg for msg in data['messages'] if msg.get('messageType') == 'userInput']
for msg in user_messages[-5:]:
    content = msg.get('data', '')
    if content:
        print(f"- {content[:100]}...")
        
print(f"\nTotal user messages: {len(user_messages)}")