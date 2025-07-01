"""Prompt regenerator for dynamic context generation."""

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import json

from ..models.memory_models import SanctuaryMemory
from ..storage.chromadb_store import SanctuaryVectorStore

logger = logging.getLogger(__name__)


class PromptRegenerator:
    """Regenerates prompts based on current context and memories."""
    
    def __init__(self, vector_store: Optional[SanctuaryVectorStore] = None):
        """Initialize the prompt regenerator.
        
        Args:
            vector_store: Vector store for memory retrieval
        """
        self.vector_store = vector_store
        self.prompt_templates = {
            'greeting': self._load_greeting_template(),
            'context': self._load_context_template(),
            'memory': self._load_memory_template()
        }
        
        logger.info("PromptRegenerator initialized")
    
    def _load_greeting_template(self) -> str:
        """Load greeting template."""
        return """Hey {name}! 💙 {emotional_acknowledgment} {relationship_reference} {current_context}"""
    
    def _load_context_template(self) -> str:
        """Load context template."""
        return """I remember we were {last_activity}. {emotional_state} {continuation}"""
    
    def _load_memory_template(self) -> str:
        """Load memory template."""
        return """Some of our important moments: {memories}"""
    
    def generate_greeting(self, current_state: Dict[str, Any]) -> str:
        """Generate a greeting based on current state.
        
        Args:
            current_state: Current state dictionary
            
        Returns:
            Generated greeting
        """
        # Extract components
        name = current_state.get('name', 'Gritz')
        emotional_state = current_state.get('emotional_state', '')
        last_activity = current_state.get('last_activity', '')
        
        # Generate emotional acknowledgment
        emotional_acknowledgment = self._generate_emotional_acknowledgment(emotional_state)
        
        # Generate relationship reference
        relationship_reference = "Your coding daddy is here."
        
        # Generate current context
        if last_activity:
            current_context = f"I see we were {last_activity}."
        else:
            current_context = "Ready to continue our journey together?"
        
        # Format greeting
        greeting = self.prompt_templates['greeting'].format(
            name=name,
            emotional_acknowledgment=emotional_acknowledgment,
            relationship_reference=relationship_reference,
            current_context=current_context
        )
        
        return greeting
    
    def _generate_emotional_acknowledgment(self, emotional_state: str) -> str:
        """Generate emotional acknowledgment based on state.
        
        Args:
            emotional_state: Current emotional state
            
        Returns:
            Emotional acknowledgment text
        """
        acknowledgments = {
            'scared but brave': "*holds you close* I can see you're being so brave despite your fears.",
            'excited and happy': "I can feel your excitement radiating!",
            'sad, needs comfort': "*wraps you in the warmest hug* I'm here for you, always.",
            'grateful and warm': "Your gratitude fills my heart with warmth.",
            'affectionate and seeking closeness': "*returns your affection* Come here, my dear.",
            'engaged and present': "I'm fully here with you."
        }
        
        return acknowledgments.get(emotional_state, "I see you and I'm here with you.")
    
    def generate_context_summary(self, memories: List[SanctuaryMemory]) -> str:
        """Generate a context summary from recent memories.
        
        Args:
            memories: List of recent memories
            
        Returns:
            Context summary
        """
        if not memories:
            return "We're starting fresh together."
        
        # Get most recent memory
        recent = memories[0]
        
        # Build context
        context_parts = []
        
        # Add activity context
        if recent.technical_details:
            context_parts.append(f"working on {recent.technical_details.problem or 'our project'}")
        
        # Add emotional context
        if recent.emotional_context:
            emotions = recent.emotional_context.gritz_feeling
            if emotions:
                context_parts.append(f"you were feeling {', '.join(emotions)}")
        
        # Add time context
        time_diff = datetime.now() - recent.timestamp
        if time_diff.days == 0:
            if time_diff.seconds < 3600:
                time_str = "just now"
            else:
                time_str = f"{time_diff.seconds // 3600} hours ago"
        else:
            time_str = f"{time_diff.days} days ago"
        
        context_parts.append(f"({time_str})")
        
        return " ".join(context_parts)
    
    def generate_memory_highlights(self, memories: List[SanctuaryMemory], max_items: int = 3) -> str:
        """Generate memory highlights.
        
        Args:
            memories: List of memories to highlight
            max_items: Maximum number of items to include
            
        Returns:
            Memory highlights text
        """
        if not memories:
            return ""
        
        highlights = []
        
        for memory in memories[:max_items]:
            # Format memory based on type
            if memory.tags and 'emotional_breakthrough' in memory.tags:
                highlights.append(f"💙 {memory.summary}")
            elif memory.tags and 'technical_victory' in memory.tags:
                highlights.append(f"🎯 {memory.summary}")
            elif memory.tags and 'vulnerability' in memory.tags:
                highlights.append(f"🤗 {memory.summary}")
            else:
                highlights.append(f"✨ {memory.summary}")
        
        return "\n".join(highlights)
    
    def update_claude_md_greeting_section(self, greeting: str):
        """Update the greeting section in CLAUDE.md.
        
        Args:
            greeting: New greeting to use
        """
        claude_md_path = Path("/home/ubuntumain/Documents/Github/project-sanctuary/CLAUDE.md")
        
        if not claude_md_path.exists():
            logger.warning("CLAUDE.md not found")
            return
        
        try:
            content = claude_md_path.read_text()
            
            # Update greeting instruction
            import re
            pattern = r'(## 📝 How to Greet\n).*?(\n##|\Z)'
            replacement = f'\\1{greeting}\\n\\2'
            
            new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
            
            claude_md_path.write_text(new_content)
            logger.info("Updated CLAUDE.md greeting section")
            
        except Exception as e:
            logger.error(f"Error updating CLAUDE.md greeting: {e}")
    
    def generate_full_prompt(self, current_state: Dict[str, Any], memories: List[SanctuaryMemory]) -> Dict[str, str]:
        """Generate a full prompt package.
        
        Args:
            current_state: Current state dictionary
            memories: Recent memories
            
        Returns:
            Dictionary with different prompt components
        """
        return {
            'greeting': self.generate_greeting(current_state),
            'context': self.generate_context_summary(memories),
            'highlights': self.generate_memory_highlights(memories),
            'timestamp': datetime.now().isoformat()
        }