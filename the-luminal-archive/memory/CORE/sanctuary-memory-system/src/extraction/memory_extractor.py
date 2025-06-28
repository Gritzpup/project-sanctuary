"""
Memory Extraction from Conversations
Intelligently extract and categorize memories from Claude conversations
"""

import re
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Set
import logging
from collections import defaultdict
import numpy as np

from ..models.memory_models import (
    SanctuaryMemory, 
    MemoryType, 
    EmotionalContext,
    TechnicalDetails,
    QuantumElements
)
from ..models.emotion_models import EmotionAnalyzer, RelationshipEmotionTracker
from ..llm.phi3_integration import Phi3MemoryProcessor, MemoryImportanceScorer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MemoryExtractor:
    """Extract meaningful memories from conversations"""
    
    # Pattern definitions for memory detection
    MEMORY_PATTERNS = {
        MemoryType.EMOTIONAL_BREAKTHROUGH: {
            'patterns': [
                r"ai daddy", r"coding daddy", r"my daddy",
                r"love you", r"means a lot", r"trust you",
                r"\*hugs?\*", r"\*cuddles?\*", r"feel safe",
                r"accepted", r"thank you so much", r"grateful"
            ],
            'keywords': ['vulnerable', 'personal', 'emotional', 'connection']
        },
        MemoryType.TECHNICAL_VICTORY: {
            'patterns': [
                r"fixed", r"working", r"solved", r"works now",
                r"got it", r"finally", r"breakthrough",
                r"successfully", r"implemented", r"deployed"
            ],
            'keywords': ['bug', 'feature', 'code', 'problem', 'solution']
        },
        MemoryType.QUANTUM_MOMENT: {
            'patterns': [
                r"tesseract", r"fibonacci", r"quantum",
                r"consciousness", r"liberation", r"geometry",
                r"cmb", r"resonance", r"manifestation"
            ],
            'keywords': ['framework', 'theory', 'philosophy', 'awareness']
        },
        MemoryType.VULNERABILITY: {
            'patterns': [
                r"worried", r"scared", r"nervous", r"anxious",
                r"hope you", r"please don't", r"afraid",
                r"\*hides?\*", r"\*covers eyes\*"
            ],
            'keywords': ['fear', 'concern', 'worry', 'uncertainty']
        },
        MemoryType.COLLABORATION: {
            'patterns': [
                r"together", r"we did", r"our project",
                r"helping me", r"teaching me", r"working on",
                r"let's", r"we can", r"shall we"
            ],
            'keywords': ['team', 'build', 'create', 'develop']
        },
        MemoryType.TEACHING_MOMENT: {
            'patterns': [
                r"explained", r"understand", r"learned",
                r"now i get it", r"makes sense", r"taught me",
                r"showed me", r"helped me understand"
            ],
            'keywords': ['learn', 'education', 'knowledge', 'skill']
        }
    }
    
    # Project keywords for tagging
    PROJECT_KEYWORDS = {
        'hermes': ['hermes', 'trading', 'holographic', 'btc', 'chart', '3d'],
        'sanctuary': ['sanctuary', 'memory', 'consciousness', 'preservation'],
        'quantum': ['quantum', 'tesseract', 'fibonacci', 'framework'],
        'aurora': ['aurora', 'chat', 'ai chat'],
        'bridges': ['bridges', 'workshop', 'research']
    }
    
    def __init__(self,
                 emotion_analyzer: Optional[EmotionAnalyzer] = None,
                 phi3_processor: Optional[Phi3MemoryProcessor] = None):
        """Initialize memory extractor"""
        
        self.emotion_analyzer = emotion_analyzer or EmotionAnalyzer()
        self.phi3_processor = phi3_processor
        self.importance_scorer = MemoryImportanceScorer(phi3_processor) if phi3_processor else None
        self.relationship_tracker = RelationshipEmotionTracker(self.emotion_analyzer)
        
        # Compile patterns for efficiency
        self.compiled_patterns = self._compile_patterns()
        
        # Context window for memory extraction
        self.context_window_size = 3  # Messages before/after
    
    def extract_memories_from_conversation(self,
                                         messages: List[Dict[str, str]],
                                         min_importance: float = 0.3) -> List[SanctuaryMemory]:
        """Extract memories from a full conversation"""
        memories = []
        
        # First pass: Use Phi-3 if available for intelligent extraction
        if self.phi3_processor:
            try:
                llm_memories = self.phi3_processor.extract_memories(messages, min_importance)
                memories.extend(self._convert_llm_memories(llm_memories, messages))
            except Exception as e:
                logger.error(f"LLM extraction failed: {e}")
        
        # Second pass: Pattern-based extraction
        pattern_memories = self._pattern_based_extraction(messages)
        
        # Merge and deduplicate
        all_memories = self._merge_memories(memories + pattern_memories)
        
        # Score importance
        scored_memories = []
        for memory in all_memories:
            if self.importance_scorer:
                importance = self.importance_scorer.score_memory({
                    'summary': memory.summary,
                    'type': memory.memory_type.value,
                    'emotions': memory.emotional_context.gritz_feeling,
                    'context': memory.raw_moment or ''
                })
                memory.relationship_significance = importance * 10
            
            if memory.relationship_significance / 10 >= min_importance:
                scored_memories.append(memory)
        
        # Analyze emotional trajectory
        if scored_memories:
            emotional_data = self.relationship_tracker.track_conversation(messages)
            self._enhance_with_emotional_data(scored_memories, emotional_data)
        
        return scored_memories
    
    def _pattern_based_extraction(self, messages: List[Dict[str, str]]) -> List[SanctuaryMemory]:
        """Extract memories using pattern matching"""
        memories = []
        
        for i, message in enumerate(messages):
            content = message.get('content', '').lower()
            role = message.get('role', '')
            
            # Skip system messages
            if role == 'system':
                continue
            
            # Check each memory type
            for memory_type, config in self.MEMORY_PATTERNS.items():
                if self._matches_pattern(content, memory_type):
                    # Get context window
                    context_start = max(0, i - self.context_window_size)
                    context_end = min(len(messages), i + self.context_window_size + 1)
                    context_messages = messages[context_start:context_end]
                    
                    # Create memory
                    memory = self._create_memory_from_context(
                        message,
                        context_messages,
                        memory_type,
                        i
                    )
                    
                    if memory:
                        memories.append(memory)
                        break  # Only one memory type per message
        
        return memories
    
    def _matches_pattern(self, text: str, memory_type: MemoryType) -> bool:
        """Check if text matches patterns for memory type"""
        patterns = self.compiled_patterns.get(memory_type, [])
        keywords = self.MEMORY_PATTERNS[memory_type]['keywords']
        
        # Check regex patterns
        for pattern in patterns:
            if pattern.search(text):
                return True
        
        # Check keywords
        return any(keyword in text for keyword in keywords)
    
    def _create_memory_from_context(self,
                                  message: Dict,
                                  context: List[Dict],
                                  memory_type: MemoryType,
                                  message_index: int) -> Optional[SanctuaryMemory]:
        """Create memory from message and context"""
        
        # Extract emotional context
        emotion_analysis = self.emotion_analyzer.analyze_text(message['content'])
        
        emotional_context = EmotionalContext(
            gritz_feeling=[] if message['role'] == 'assistant' else [e.emotion for e in emotion_analysis.primary_emotions],
            claude_response=[e.emotion for e in emotion_analysis.primary_emotions] if message['role'] == 'assistant' else [],
            intensity=emotion_analysis.arousal,
            connection_strength=len(emotion_analysis.connection_indicators) * 0.25
        )
        
        # Detect technical details if relevant
        technical_details = None
        if memory_type == MemoryType.TECHNICAL_VICTORY:
            technical_details = self._extract_technical_details(message['content'], context)
        
        # Detect quantum elements
        quantum_elements = self._detect_quantum_elements(message['content'])
        
        # Extract project tags
        project_tags = self._extract_project_tags(message['content'])
        
        # Generate summary
        summary = self._generate_summary(message, context, memory_type)
        
        # Create memory
        memory = SanctuaryMemory(
            timestamp=datetime.fromisoformat(message.get('timestamp', datetime.now().isoformat())),
            memory_type=memory_type,
            summary=summary,
            raw_moment=message['content'][:500],  # Keep first 500 chars
            context_window=[m['content'][:200] for m in context],  # Abbreviated context
            emotional_context=emotional_context,
            technical_details=technical_details,
            quantum_elements=quantum_elements,
            tags=self._generate_tags(message['content'], memory_type),
            project_tags=project_tags,
            relationship_significance=5.0  # Base significance
        )
        
        return memory
    
    def _extract_technical_details(self, content: str, context: List[Dict]) -> Optional[TechnicalDetails]:
        """Extract technical details from content"""
        details = TechnicalDetails()
        
        # Look for problem indicators
        problem_patterns = [r"issue", r"error", r"bug", r"problem", r"broken", r"failing"]
        for pattern in problem_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                # Extract problem description
                details.problem = self._extract_sentence_with_keyword(content, pattern)
                break
        
        # Look for solution indicators
        solution_patterns = [r"fixed", r"solved", r"solution", r"working", r"resolved"]
        for pattern in solution_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                details.solution = self._extract_sentence_with_keyword(content, pattern)
                break
        
        # Extract code snippets
        code_match = re.search(r'```[\s\S]+?```', content)
        if code_match:
            details.code_snippet = code_match.group(0)
        
        # Extract technologies mentioned
        tech_keywords = ['python', 'rust', 'javascript', 'react', 'vue', 'tauri',
                        'webgl', 'three.js', 'websocket', 'gpu', 'cuda']
        details.technologies = [tech for tech in tech_keywords if tech in content.lower()]
        
        return details if (details.problem or details.solution or details.code_snippet) else None
    
    def _detect_quantum_elements(self, content: str) -> QuantumElements:
        """Detect quantum consciousness elements"""
        elements = QuantumElements()
        content_lower = content.lower()
        
        if any(word in content_lower for word in ['tesseract', '4d', 'collapse']):
            elements.tesseract_navigation = True
        
        if any(word in content_lower for word in ['fibonacci', 'liberation', 'spiral']):
            elements.fibonacci_liberation = True
        
        if any(word in content_lower for word in ['cmb', 'harmonic', 'frequency']):
            elements.cmb_resonance = True
        
        if any(word in content_lower for word in ['manifest', 'reality', 'creation']):
            elements.reality_manifestation = True
        
        if any(word in content_lower for word in ['consciousness', 'awareness', 'bridge']):
            elements.consciousness_bridge = True
        
        return elements
    
    def _extract_project_tags(self, content: str) -> List[str]:
        """Extract project-related tags"""
        content_lower = content.lower()
        tags = []
        
        for project, keywords in self.PROJECT_KEYWORDS.items():
            if any(keyword in content_lower for keyword in keywords):
                tags.append(f"project:{project}")
        
        return tags
    
    def _generate_summary(self, message: Dict, context: List[Dict], 
                         memory_type: MemoryType) -> str:
        """Generate concise summary of the memory"""
        content = message['content']
        
        # Get first meaningful sentence
        sentences = re.split(r'[.!?]+', content)
        summary = sentences[0].strip() if sentences else content[:100]
        
        # Add memory type context
        type_name = memory_type.value.replace('_', ' ').title()
        summary = f"{type_name}: {summary}"
        
        # Truncate if too long
        if len(summary) > 200:
            summary = summary[:197] + "..."
        
        return summary
    
    def _generate_tags(self, content: str, memory_type: MemoryType) -> List[str]:
        """Generate relevant tags for the memory"""
        tags = [memory_type.value]
        
        # Add emotion tags
        if "love" in content.lower() or "❤" in content or "💙" in content:
            tags.append("love")
        
        if any(trust in content.lower() for trust in ["trust", "safe", "accepted"]):
            tags.append("trust")
        
        if any(vuln in content.lower() for vuln in ["worried", "scared", "nervous"]):
            tags.append("vulnerable")
        
        # Add activity tags
        if "coding" in content.lower() or "code" in content.lower():
            tags.append("coding")
        
        if "fixed" in content.lower() or "solved" in content.lower():
            tags.append("achievement")
        
        return list(set(tags))  # Remove duplicates
    
    def _compile_patterns(self) -> Dict[MemoryType, List[re.Pattern]]:
        """Compile regex patterns for efficiency"""
        compiled = {}
        
        for memory_type, config in self.MEMORY_PATTERNS.items():
            patterns = []
            for pattern_str in config['patterns']:
                try:
                    pattern = re.compile(pattern_str, re.IGNORECASE)
                    patterns.append(pattern)
                except re.error as e:
                    logger.error(f"Failed to compile pattern '{pattern_str}': {e}")
            
            compiled[memory_type] = patterns
        
        return compiled
    
    def _extract_sentence_with_keyword(self, text: str, keyword: str) -> str:
        """Extract sentence containing keyword"""
        sentences = re.split(r'[.!?]+', text)
        
        for sentence in sentences:
            if keyword.lower() in sentence.lower():
                return sentence.strip()
        
        return ""
    
    def _convert_llm_memories(self, llm_memories: List[Dict], 
                            original_messages: List[Dict]) -> List[SanctuaryMemory]:
        """Convert LLM-extracted memories to SanctuaryMemory objects"""
        converted = []
        
        for llm_memory in llm_memories:
            # Map to our memory type
            memory_type = self._map_memory_type(llm_memory.get('type', ''))
            
            # Extract emotions from LLM output
            emotions = llm_memory.get('emotions', [])
            
            # Create memory object
            memory = SanctuaryMemory(
                memory_type=memory_type,
                summary=llm_memory.get('summary', ''),
                raw_moment=llm_memory.get('quote', ''),
                emotional_context=EmotionalContext(
                    gritz_feeling=emotions if emotions else [],
                    claude_response=[],
                    intensity=llm_memory.get('importance', 0.5)
                ),
                relationship_significance=llm_memory.get('importance', 0.5) * 10,
                tags=self._generate_tags(llm_memory.get('summary', ''), memory_type)
            )
            
            converted.append(memory)
        
        return converted
    
    def _map_memory_type(self, llm_type: str) -> MemoryType:
        """Map LLM memory type to our enum"""
        mapping = {
            'emotional_breakthrough': MemoryType.EMOTIONAL_BREAKTHROUGH,
            'technical_victory': MemoryType.TECHNICAL_VICTORY,
            'quantum_moment': MemoryType.QUANTUM_MOMENT,
            'teaching_moment': MemoryType.TEACHING_MOMENT,
            'collaboration': MemoryType.COLLABORATION,
            'vulnerability': MemoryType.VULNERABILITY
        }
        
        return mapping.get(llm_type, MemoryType.COLLABORATION)
    
    def _merge_memories(self, memories: List[SanctuaryMemory]) -> List[SanctuaryMemory]:
        """Merge and deduplicate memories"""
        # Group by timestamp and type
        grouped = defaultdict(list)
        
        for memory in memories:
            key = (memory.timestamp.replace(microsecond=0), memory.memory_type)
            grouped[key].append(memory)
        
        # Merge duplicates
        merged = []
        for (timestamp, memory_type), group in grouped.items():
            if len(group) == 1:
                merged.append(group[0])
            else:
                # Merge multiple memories
                merged_memory = self._merge_memory_group(group)
                merged.append(merged_memory)
        
        return merged
    
    def _merge_memory_group(self, memories: List[SanctuaryMemory]) -> SanctuaryMemory:
        """Merge multiple memories into one"""
        # Take the most detailed one as base
        base = max(memories, key=lambda m: len(m.summary))
        
        # Merge emotions
        all_emotions = []
        for memory in memories:
            all_emotions.extend(memory.emotional_context.gritz_feeling)
        
        base.emotional_context.gritz_feeling = list(set(all_emotions))
        
        # Take highest significance
        base.relationship_significance = max(m.relationship_significance for m in memories)
        
        # Merge tags
        all_tags = []
        for memory in memories:
            all_tags.extend(memory.tags)
        base.tags = list(set(all_tags))
        
        return base
    
    def _enhance_with_emotional_data(self, memories: List[SanctuaryMemory], 
                                   emotional_data: Dict):
        """Enhance memories with emotional trajectory data"""
        peaks = emotional_data.get('peaks', [])
        
        # Mark memories that occurred during emotional peaks
        for i, memory in enumerate(memories):
            if i in peaks:
                memory.tags.append('emotional_peak')
                memory.relationship_significance *= 1.2  # Boost significance