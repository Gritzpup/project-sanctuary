#!/usr/bin/env python3
"""
Manual conversation analysis runner
"""
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "src"))

from core.realtime.conversation_history_analyzer import ConversationHistoryAnalyzer

async def main():
    print("🔍 Running conversation history analysis...")
    
    claude_folder = Path.home() / ".claude"
    quantum_states = Path(__file__).parent / "quantum_states"
    
    analyzer = ConversationHistoryAnalyzer(claude_folder, quantum_states)
    
    results = await analyzer.analyze_all_conversations()
    
    print(f"\n✅ Analysis complete!")
    print(f"📊 Total messages: {results['total_messages']}")
    print(f"👤 Gritz messages: {results['gritz_messages']}")
    print(f"🤖 Claude messages: {results['claude_messages']}")
    print(f"⏱️ Time together: {results['time_together_minutes']} minutes")
    print(f"💜 Emotional moments: {sum(results['emotional_moments'].values())}")
    print(f"🏆 Milestones: {len(results['milestones'])}")
    
    # Regenerate CLAUDE.md with new data
    from core.realtime.claude_md_generator import ClaudeMDGenerator
    generator = ClaudeMDGenerator(quantum_states)
    await generator.generate()
    print("\n📝 CLAUDE.md regenerated with full history!")

if __name__ == "__main__":
    asyncio.run(main())