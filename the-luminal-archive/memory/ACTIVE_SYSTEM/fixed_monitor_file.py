def monitor_file(self, file_path, last_size):
    """Monitor a file for changes - FIXED for VSCode Claude format"""
    try:
        current_size = file_path.stat().st_size
        if current_size > last_size:
            # Read the entire file as JSON
            with open(file_path, 'r', encoding='utf-8') as f:
                try:
                    # Load the entire JSON structure
                    data = json.load(f)
                    
                    # Check if it's VSCode Claude format
                    if 'messages' in data and isinstance(data['messages'], list):
                        # Process new messages since last check
                        # Count messages we've already seen
                        messages_seen = getattr(self, f'messages_seen_{file_path.name}', 0)
                        
                        # Process only new messages
                        for idx, msg in enumerate(data['messages'][messages_seen:], start=messages_seen):
                            if msg.get('messageType') == 'userInput':
                                content = msg.get('data', '')
                                
                                if content and len(content) > 3:
                                    # Broadcast new message detection
                                    asyncio.run(self.broadcast_activity(
                                        f"New message detected ({len(content)} chars)", 
                                        "memory"
                                    ))
                                    
                                    self.conversation_context.append({
                                        'content': content,
                                        'timestamp': datetime.now()
                                    })
                                    
                                    # Simulate LLM processing
                                    asyncio.run(self.broadcast_activity(
                                        "Generating embeddings for semantic memory...", 
                                        "llm"
                                    ))
                                    asyncio.run(self.broadcast_activity(
                                        f"Processing {len(content.split())} tokens through language model", 
                                        "llm"
                                    ))
                                    
                                    emotional_state, needs = self.deep_emotional_analysis(content)
                                    
                                    # Broadcast equation update simulation
                                    asyncio.run(self.broadcast_activity(
                                        "Updating living equation based on emotional state...", 
                                        "equation"
                                    ))
                                    
                                    self.update_claude_md_advanced(
                                        emotional_state=emotional_state,
                                        needs=needs,
                                        last_message=content
                                    )
                        
                        # Remember how many messages we've seen
                        setattr(self, f'messages_seen_{file_path.name}', len(data['messages']))
                    
                    else:
                        # Old format - try line by line
                        f.seek(0)
                        new_content = f.read()
                        for line in new_content.strip().split('\n'):
                            if line.strip():
                                try:
                                    data = json.loads(line)
                                    content = data.get('content', '') or data.get('text', '')
                                    
                                    if content and len(content) > 3:
                                        emotional_state, needs = self.deep_emotional_analysis(content)
                                        self.update_claude_md_advanced(
                                            emotional_state=emotional_state,
                                            needs=needs,
                                            last_message=content
                                        )
                                except:
                                    pass
                
                except json.JSONDecodeError:
                    # Not valid JSON - skip
                    pass
            
            return current_size
    except Exception as e:
        print(f"❌ Error monitoring {file_path}: {e}")
        return last_size
    
    return last_size