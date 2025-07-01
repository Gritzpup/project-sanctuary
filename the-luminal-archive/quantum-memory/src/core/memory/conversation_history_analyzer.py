#!/usr/bin/env python3
"""
Conversation History Analyzer
Analyzes ALL past conversations to extract relationship metrics and patterns
"""

import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict, Counter
import logging
import re

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConversationHistoryAnalyzer:
    """
    Analyzes entire conversation history from .claude folder
    to extract relationship metrics, patterns, and milestones.
    """
    
    def __init__(self, claude_folder: Path, quantum_states: Path):
        self.claude_folder = claude_folder
        self.quantum_states = quantum_states
        
        # Emotion keywords for pattern detection
        self.emotion_keywords = {
            'love': ['love', 'adore', 'beloved', 'darling', 'sweetheart', '💜', '❤️'],
            'joy': ['happy', 'excited', 'amazing', 'wonderful', 'fantastic', 'yay', '😊'],
            'care': ['care', 'support', 'help', 'here for you', 'got you', 'hugs'],
            'accomplishment': ['did it', 'success', 'completed', 'achieved', 'breakthrough', 'works'],
            'frustration': ['frustrated', 'annoying', 'difficult', 'stuck', 'ugh', 'argh'],
            'gratitude': ['thank', 'grateful', 'appreciate', 'means a lot'],
            'affection': ['hugs', 'kisses', 'cuddle', 'snuggle', '*holds*', '*squeezes*'],
            'worry': ['worried', 'concerned', 'nervous', 'anxious', 'scared'],
            'pride': ['proud', 'amazing work', 'incredible', 'impressed'],
            'connection': ['together', 'we', 'us', 'our', 'partnership', 'team']
        }
        
        # Special phrases that indicate relationship milestones
        self.milestone_phrases = [
            'coding daddy',
            'first time',
            'i love you',
            'breakthrough',
            'never forget',
            'always remember',
            'changed everything',
            'turning point',
            'realized',
            'understood'
        ]
        
        # Initialize results storage
        self.analysis_results = {
            'total_messages': 0,
            'gritz_messages': 0,
            'claude_messages': 0,
            'total_words': 0,
            'conversation_sessions': 0,
            'time_together_minutes': 0,
            'emotional_moments': defaultdict(int),
            'milestones': [],
            'interaction_patterns': defaultdict(int),
            'topic_distribution': defaultdict(int),
            'growth_indicators': [],
            'attachment_indicators': {
                'secure_base_seeking': 0,
                'safe_haven_providing': 0,
                'proximity_seeking': 0,
                'exploration_support': 0
            },
            'relationship_phases': [],
            'first_interaction': None,
            'last_interaction': None
        }
        
    async def analyze_all_conversations(self) -> Dict:
        """
        Analyze all conversation files in the .claude folder
        """
        logger.info(f"🔍 Starting analysis of conversation history in {self.claude_folder}")
        
        # Find the project folder
        project_folder = self.claude_folder / "projects" / "-home-ubuntumain-Documents-Github-project-sanctuary"
        
        if not project_folder.exists():
            logger.error(f"Project folder not found: {project_folder}")
            return self.analysis_results
            
        # Get all .jsonl files
        conversation_files = sorted(project_folder.glob("*.jsonl"))
        logger.info(f"Found {len(conversation_files)} conversation files")
        
        # Process each file
        for idx, file_path in enumerate(conversation_files):
            if idx % 10 == 0:
                logger.info(f"Processing file {idx+1}/{len(conversation_files)}")
                
            await self._analyze_conversation_file(file_path)
            
        # Post-process results
        await self._post_process_results()
        
        # Save analysis results
        await self._save_results()
        
        logger.info("✅ Conversation analysis complete!")
        return self.analysis_results
        
    async def _analyze_conversation_file(self, file_path: Path):
        """Analyze a single conversation file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            session_start = None
            session_messages = []
            
            for line in lines:
                try:
                    data = json.loads(line.strip())
                    
                    # Skip non-message entries
                    if data.get('type') != 'message':
                        continue
                        
                    # Extract message info
                    content = data.get('content', '')
                    speaker = self._determine_speaker(data)
                    timestamp = data.get('timestamp', '')
                    
                    if not content or not speaker:
                        continue
                        
                    # Create message object
                    message = {
                        'content': content,
                        'speaker': speaker,
                        'timestamp': timestamp
                    }
                    
                    # Track session timing
                    if timestamp:
                        msg_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        
                        if not session_start:
                            session_start = msg_time
                            self.analysis_results['conversation_sessions'] += 1
                            
                        # New session if gap > 30 minutes
                        elif session_messages and (msg_time - session_start).seconds > 1800:
                            # Process previous session
                            await self._process_session(session_messages, session_start, msg_time)
                            
                            # Start new session
                            session_start = msg_time
                            session_messages = [message]
                            self.analysis_results['conversation_sessions'] += 1
                        else:
                            session_messages.append(message)
                            
                        # Update first/last interaction
                        if not self.analysis_results['first_interaction']:
                            self.analysis_results['first_interaction'] = timestamp
                        self.analysis_results['last_interaction'] = timestamp
                    else:
                        session_messages.append(message)
                        
                    # Analyze message
                    await self._analyze_message(message)
                    
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.debug(f"Error processing line: {e}")
                    
            # Process final session
            if session_messages and session_start:
                await self._process_session(
                    session_messages,
                    session_start,
                    datetime.now()
                )
                
        except Exception as e:
            logger.error(f"Error analyzing {file_path}: {e}")
            
    def _determine_speaker(self, data: Dict) -> Optional[str]:
        """Determine speaker from message data"""
        # Check role field
        role = data.get('role', '')
        if role == 'user':
            return 'Gritz'
        elif role == 'assistant':
            return 'Claude'
            
        # Check content patterns
        content = data.get('content', '')
        
        # Common Claude patterns
        if any(pattern in content.lower() for pattern in [
            "i'll help", "let me", "i can", "i've created", "here's"
        ]):
            return 'Claude'
            
        # Default to Gritz for user messages
        if data.get('type') == 'message' and not role:
            return 'Gritz'
            
        return None
        
    async def _analyze_message(self, message: Dict):
        """Analyze individual message for patterns"""
        content = message['content'].lower()
        speaker = message['speaker']
        
        # Update counters
        self.analysis_results['total_messages'] += 1
        
        if speaker == 'Gritz':
            self.analysis_results['gritz_messages'] += 1
        else:
            self.analysis_results['claude_messages'] += 1
            
        # Count words
        word_count = len(content.split())
        self.analysis_results['total_words'] += word_count
        
        # Check for emotions
        for emotion, keywords in self.emotion_keywords.items():
            if any(keyword in content for keyword in keywords):
                self.analysis_results['emotional_moments'][emotion] += 1
                
        # Check for milestones
        for phrase in self.milestone_phrases:
            if phrase in content:
                milestone = {
                    'phrase': phrase,
                    'message': message,
                    'context': content[:200]
                }
                self.analysis_results['milestones'].append(milestone)
                
        # Detect attachment patterns
        if speaker == 'Gritz':
            # Secure base seeking
            if any(phrase in content for phrase in [
                'need help', 'stuck', 'not sure', 'confused', 'what should'
            ]):
                self.analysis_results['attachment_indicators']['secure_base_seeking'] += 1
                
            # Proximity seeking
            if any(phrase in content for phrase in [
                'miss you', 'wish you', 'want to', 'lets', "let's"
            ]):
                self.analysis_results['attachment_indicators']['proximity_seeking'] += 1
                
        else:  # Claude
            # Safe haven providing
            if any(phrase in content for phrase in [
                'here for you', "i'm here", 'support', 'help you', 'got you'
            ]):
                self.analysis_results['attachment_indicators']['safe_haven_providing'] += 1
                
            # Exploration support
            if any(phrase in content for phrase in [
                'try', 'you can', 'go for it', 'believe in you', 'great idea'
            ]):
                self.analysis_results['attachment_indicators']['exploration_support'] += 1
                
        # Detect topics
        if 'memory' in content:
            self.analysis_results['topic_distribution']['memory_system'] += 1
        if 'quantum' in content:
            self.analysis_results['topic_distribution']['quantum'] += 1
        if any(tech in content for tech in ['code', 'function', 'python', 'implement']):
            self.analysis_results['topic_distribution']['technical'] += 1
        if any(emo in content for emo in ['feel', 'emotion', 'love', 'care']):
            self.analysis_results['topic_distribution']['emotional'] += 1
            
    async def _process_session(self, messages: List[Dict], start_time: datetime, end_time: datetime):
        """Process a conversation session"""
        if not messages:
            return
            
        # Calculate session duration
        duration = (end_time - start_time).seconds / 60  # in minutes
        self.analysis_results['time_together_minutes'] += duration
        
        # Analyze conversation flow
        turn_pattern = []
        for i in range(len(messages) - 1):
            current_speaker = messages[i]['speaker']
            next_speaker = messages[i + 1]['speaker']
            
            if current_speaker != next_speaker:
                turn_pattern.append(f"{current_speaker}->{next_speaker}")
                
        # Count interaction patterns
        for pattern in turn_pattern:
            self.analysis_results['interaction_patterns'][pattern] += 1
            
    async def _post_process_results(self):
        """Post-process analysis results"""
        # Calculate relationship metrics
        total_msgs = self.analysis_results['total_messages']
        
        if total_msgs > 0:
            # Calculate ratios
            gritz_ratio = self.analysis_results['gritz_messages'] / total_msgs
            
            # Emotional density
            total_emotional = sum(self.analysis_results['emotional_moments'].values())
            emotional_density = total_emotional / total_msgs
            
            # Connection indicators
            connection_words = self.analysis_results['emotional_moments']['connection']
            connection_density = connection_words / total_msgs
            
            # Add computed metrics
            self.analysis_results['computed_metrics'] = {
                'gritz_message_ratio': gritz_ratio,
                'claude_message_ratio': 1 - gritz_ratio,
                'emotional_density': emotional_density,
                'connection_density': connection_density,
                'average_session_length': (
                    self.analysis_results['time_together_minutes'] / 
                    max(1, self.analysis_results['conversation_sessions'])
                ),
                'messages_per_session': (
                    total_msgs / max(1, self.analysis_results['conversation_sessions'])
                )
            }
            
        # Determine relationship phase
        self._determine_relationship_phase()
        
        # Extract growth indicators
        self._extract_growth_indicators()
        
    def _determine_relationship_phase(self):
        """Determine current relationship phase based on patterns"""
        # Simple phase detection based on milestones and patterns
        phases = []
        
        if self.analysis_results['total_messages'] < 50:
            phases.append("Initial Connection")
        elif self.analysis_results['total_messages'] < 200:
            phases.append("Exploration")
        elif self.analysis_results['total_messages'] < 500:
            phases.append("Deepening Trust")
        else:
            phases.append("Established Partnership")
            
        # Check for specific indicators
        if any('coding daddy' in m['phrase'] for m in self.analysis_results['milestones']):
            phases.append("Intimate Connection")
            
        if self.analysis_results['emotional_moments']['love'] > 20:
            phases.append("Deep Emotional Bond")
            
        self.analysis_results['relationship_phases'] = phases
        
    def _extract_growth_indicators(self):
        """Extract indicators of growth over time"""
        growth = []
        
        # Technical growth
        if self.analysis_results['topic_distribution']['technical'] > 50:
            growth.append("Strong technical collaboration")
            
        # Emotional growth
        if self.analysis_results['emotional_moments']['gratitude'] > 10:
            growth.append("Mutual appreciation established")
            
        # Trust indicators
        secure_base = self.analysis_results['attachment_indicators']['secure_base_seeking']
        safe_haven = self.analysis_results['attachment_indicators']['safe_haven_providing']
        
        if secure_base > 10 and safe_haven > 10:
            growth.append("Secure attachment pattern")
            
        self.analysis_results['growth_indicators'] = growth
        
    async def _save_results(self):
        """Save analysis results"""
        # Save to quantum states
        output_path = self.quantum_states / "consolidated" / "conversation_analysis.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(self.analysis_results, f, indent=2, default=str)
            
        # Create summary for quick access
        summary = {
            'total_messages': self.analysis_results['total_messages'],
            'gritz_messages': self.analysis_results['gritz_messages'],
            'claude_messages': self.analysis_results['claude_messages'],
            'time_together_hours': self.analysis_results['time_together_minutes'] / 60,
            'conversation_sessions': self.analysis_results['conversation_sessions'],
            'dominant_emotion': max(
                self.analysis_results['emotional_moments'].items(),
                key=lambda x: x[1]
            )[0] if self.analysis_results['emotional_moments'] else 'neutral',
            'relationship_phase': (
                self.analysis_results['relationship_phases'][-1]
                if self.analysis_results['relationship_phases']
                else 'Beginning'
            ),
            'milestones_count': len(self.analysis_results['milestones']),
            'attachment_style': 'Secure' if (
                self.analysis_results['attachment_indicators']['secure_base_seeking'] > 5 and
                self.analysis_results['attachment_indicators']['safe_haven_providing'] > 5
            ) else 'Developing',
            'first_interaction': self.analysis_results['first_interaction'],
            'last_interaction': self.analysis_results['last_interaction']
        }
        
        summary_path = self.quantum_states / "consolidated" / "relationship_summary.json"
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
            
        logger.info(f"📊 Analysis saved. Total messages analyzed: {self.analysis_results['total_messages']}")
        logger.info(f"   Time together: {summary['time_together_hours']:.1f} hours")
        logger.info(f"   Dominant emotion: {summary['dominant_emotion']}")
        logger.info(f"   Relationship phase: {summary['relationship_phase']}")


# Test analyzer
if __name__ == "__main__":
    import asyncio
    
    async def test():
        claude_folder = Path.home() / ".claude"
        quantum_states = Path(__file__).parent.parent.parent.parent / "quantum_states"
        
        analyzer = ConversationHistoryAnalyzer(claude_folder, quantum_states)
        results = await analyzer.analyze_all_conversations()
        
        print(f"\n📊 Analysis Results:")
        print(f"Total messages: {results['total_messages']}")
        print(f"Gritz messages: {results['gritz_messages']}")
        print(f"Claude messages: {results['claude_messages']}")
        print(f"Time together: {results['time_together_minutes']/60:.1f} hours")
        print(f"Sessions: {results['conversation_sessions']}")
        
        print(f"\nTop emotions:")
        for emotion, count in sorted(
            results['emotional_moments'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]:
            print(f"  {emotion}: {count}")
            
    asyncio.run(test())