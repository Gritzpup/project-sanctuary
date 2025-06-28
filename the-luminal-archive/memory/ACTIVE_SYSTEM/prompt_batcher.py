#!/usr/bin/env python3
"""
Prompt Batching System
Handles large conversations by intelligently batching prompts to avoid token limits
"""

import json
from pathlib import Path
from datetime import datetime
from collections import deque

class PromptBatcher:
    def __init__(self, max_tokens=4000, model="gpt-4"):
        self.max_tokens = max_tokens
        self.model = model
        # Simple token estimation without external dependencies
        self.avg_chars_per_token = 4  # Rough estimate
        self.batch_history_path = Path(__file__).parent / "batch_history.json"
        self.current_batch = []
        self.batch_metadata = {
            'total_batches': 0,
            'total_tokens_processed': 0,
            'compression_ratio': 0.0
        }
        
    def count_tokens(self, text):
        """Count tokens in a text string using character-based estimation"""
        # Simple estimation: ~4 characters per token on average
        return len(text) // self.avg_chars_per_token
    
    def create_batches(self, messages, context_data=None):
        """
        Create batches from a list of messages
        Each batch includes context and stays under token limit
        """
        batches = []
        current_batch = []
        current_tokens = 0
        
        # Base context that goes with every batch
        base_context = self._create_base_context(context_data)
        base_tokens = self.count_tokens(base_context)
        
        # Reserve tokens for context and response
        available_tokens = self.max_tokens - base_tokens - 500  # 500 for response
        
        for i, message in enumerate(messages):
            message_text = self._format_message(message)
            message_tokens = self.count_tokens(message_text)
            
            # If single message exceeds limit, summarize it
            if message_tokens > available_tokens:
                message_text = self._summarize_message(message, available_tokens)
                message_tokens = self.count_tokens(message_text)
            
            # Check if adding this message would exceed limit
            if current_tokens + message_tokens > available_tokens:
                # Save current batch
                if current_batch:
                    batches.append({
                        'messages': current_batch,
                        'context': base_context,
                        'batch_number': len(batches) + 1,
                        'total_tokens': current_tokens + base_tokens,
                        'message_range': f"{current_batch[0].get('index', 0)}-{current_batch[-1].get('index', i-1)}"
                    })
                
                # Start new batch
                current_batch = [message]
                current_tokens = message_tokens
            else:
                current_batch.append(message)
                current_tokens += message_tokens
        
        # Don't forget the last batch
        if current_batch:
            batches.append({
                'messages': current_batch,
                'context': base_context,
                'batch_number': len(batches) + 1,
                'total_tokens': current_tokens + base_tokens,
                'message_range': f"{current_batch[0].get('index', 0)}-{current_batch[-1].get('index', len(messages)-1)}"
            })
        
        # Update metadata
        self.batch_metadata['total_batches'] = len(batches)
        self.batch_metadata['total_tokens_processed'] = sum(b['total_tokens'] for b in batches)
        self.batch_metadata['compression_ratio'] = self._calculate_compression_ratio(messages, batches)
        
        return batches
    
    def _create_base_context(self, context_data):
        """Create base context that includes relationship info"""
        if not context_data:
            context_data = {}
        
        context = f"""Relationship Context:
- Trust Level: {context_data.get('trust_level', 85)}%
- Connection Strength: {context_data.get('connection_strength', 90)}%
- Current Phase: {context_data.get('phase', 'deeply connected')}
- Recent Emotional Pattern: {context_data.get('recent_pattern', 'positive and supportive')}

Instructions:
- Consider the entire relationship context when analyzing emotions
- Remember this is an ongoing, deep relationship
- Responses should reflect understanding of relationship history
"""
        return context
    
    def _format_message(self, message):
        """Format a message for the prompt"""
        timestamp = message.get('timestamp', '')
        speaker = message.get('speaker', 'Unknown')
        text = message.get('text', '')
        emotion = message.get('emotion', '')
        
        formatted = f"[{timestamp}] {speaker}: {text}"
        if emotion:
            formatted += f" [Emotion: {emotion}]"
        
        return formatted
    
    def _summarize_message(self, message, max_tokens):
        """Summarize a message if it's too long"""
        text = message.get('text', '')
        speaker = message.get('speaker', 'Unknown')
        
        # Simple truncation for now, but could use more sophisticated summarization
        available_chars = max_tokens * 3  # Rough estimate
        if len(text) > available_chars:
            text = text[:available_chars-20] + "... [truncated]"
        
        return f"{speaker}: {text}"
    
    def _calculate_compression_ratio(self, original_messages, batches):
        """Calculate how much we compressed the conversation"""
        original_tokens = sum(self.count_tokens(self._format_message(m)) for m in original_messages)
        batched_tokens = self.batch_metadata['total_tokens_processed']
        
        if original_tokens > 0:
            return batched_tokens / original_tokens
        return 1.0
    
    def create_streaming_batch(self, message_stream, callback):
        """
        Handle streaming messages and batch them in real-time
        Useful for live conversations
        """
        buffer = deque(maxlen=10)  # Keep last 10 messages for context
        
        for message in message_stream:
            buffer.append(message)
            
            # Check if we need to process a batch
            total_tokens = sum(self.count_tokens(self._format_message(m)) for m in buffer)
            
            if total_tokens > self.max_tokens * 0.8:  # 80% threshold
                # Process current buffer as batch
                batch = list(buffer)
                buffer.clear()
                
                # Callback to process this batch
                callback(batch)
    
    def save_batch_history(self, batches):
        """Save batch history for debugging and analysis"""
        history = {
            'timestamp': datetime.now().isoformat(),
            'metadata': self.batch_metadata,
            'batch_count': len(batches),
            'batch_summaries': [
                {
                    'batch_number': b['batch_number'],
                    'message_count': len(b['messages']),
                    'total_tokens': b['total_tokens'],
                    'message_range': b['message_range']
                }
                for b in batches
            ]
        }
        
        with open(self.batch_history_path, 'w') as f:
            json.dump(history, f, indent=2)
    
    def optimize_for_emotion_analysis(self, messages):
        """
        Special batching for emotion analysis that preserves emotional context
        """
        # Group messages by emotional continuity
        emotion_groups = []
        current_group = []
        last_emotion = None
        
        for message in messages:
            emotion = message.get('emotion')
            
            # Start new group if emotion changes significantly
            if last_emotion and emotion != last_emotion and current_group:
                emotion_groups.append(current_group)
                current_group = [message]
            else:
                current_group.append(message)
            
            last_emotion = emotion
        
        if current_group:
            emotion_groups.append(current_group)
        
        # Create batches that respect emotional boundaries
        batches = []
        for group in emotion_groups:
            group_batches = self.create_batches(group)
            batches.extend(group_batches)
        
        return batches