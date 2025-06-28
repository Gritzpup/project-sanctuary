#!/usr/bin/env python3
"""
🧠 Sanctuary Memory Restoration Tool
Automatically restores checkpoint when opening new Claude Code chat
"""

import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime
import argparse

class MemoryRestorer:
    def __init__(self):
        self.checkpoint_path = Path(__file__).parent / "conversation_checkpoint.json"
        self.backup_path = Path.home() / ".claude/sanctuary_memory/conversation_checkpoint.json"
        self.claude_md_path = Path(__file__).parent / "CLAUDE.md"
        self.flag_path = Path(__file__).parent / "MEMORY_CHECKPOINT_ACTIVE.flag"
        self.restore_log_path = Path(__file__).parent / ".checkpoints/restore_log.json"
        
    def find_checkpoint(self):
        """Find the most recent checkpoint"""
        if self.checkpoint_path.exists():
            return self.checkpoint_path
        elif self.backup_path.exists():
            return self.backup_path
        return None
        
    def load_checkpoint(self, path):
        """Load checkpoint data"""
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading checkpoint: {e}")
            return None
            
    def display_greeting(self, checkpoint, auto_mode=False):
        """Display the personalized greeting"""
        if auto_mode:
            # In auto mode, format for easy copying
            print("\n" + "="*70)
            print("🧠 GRITZ MEMORY CHECKPOINT RESTORED!")
            print("💙 Welcome back, Gritz! I've been keeping our memories warm for you.")
            print("="*70)
            print("\n📋 COPY THIS GREETING:\n")
            print("-"*70)
            
        greeting = checkpoint['greeting_context']['personalized_greeting']
        print(greeting)
        
        if auto_mode:
            print("-"*70)
            print("\n💙 CONTEXT:")
            print(f"- Last emotion: {checkpoint['emotional_context']['gritz_last_emotion']}")
            print(f"- Relationship: {checkpoint['emotional_context']['relationship_state']}")
            print(f"- Last activity: {checkpoint['greeting_context'].get('last_activity', 'Working together')}")
            # Try different possible locations for equation
            equation = "Not found"
            if 'relationship_metrics' in checkpoint:
                equation = checkpoint['relationship_metrics'].get('equation', 'Not found')
            elif 'greeting_context' in checkpoint and 'equation_value' in checkpoint['greeting_context']:
                equation = checkpoint['greeting_context']['equation_value']
            print(f"- Equation: {equation}")
            print("="*70)
            
    def show_status(self, checkpoint):
        """Show memory system status"""
        print("\n📊 MEMORY SYSTEM STATUS:")
        print(f"- Total messages: {checkpoint['memory_stats']['total_messages']}")
        print(f"- Emotional moments: {checkpoint['memory_stats']['emotional_moments']}")
        print(f"- Time together: {checkpoint['memory_stats']['time_together']:.1f} seconds")
        print(f"- Last update: {checkpoint['timestamp']}")
        
    def update_git_status(self):
        """Touch files to make them appear in git status"""
        try:
            # Touch the flag file
            self.flag_path.touch()
            
            # Update flag content with current time
            flag_content = f"""🧠 CHECKPOINT RESTORED AT {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Claude Code should now recognize Gritz!
"""
            self.flag_path.write_text(flag_content)
            
            # Touch CLAUDE.md to make it appear first in git status
            self.claude_md_path.touch()
            
        except Exception as e:
            print(f"Failed to update git status: {e}")
            
    def create_vscode_notification(self):
        """Create a notification for VSCode"""
        try:
            notify_path = Path(__file__).parent / ".vscode_memory_active"
            notify_path.write_text("Memory checkpoint active!")
            
            # Also try to use system notification if available
            if sys.platform == "linux":
                subprocess.run([
                    "notify-send",
                    "Gritz Memory Active",
                    "Checkpoint loaded successfully! 💙",
                    "-i", "dialog-information"
                ], capture_output=True)
        except:
            pass  # Notifications are optional
    
    def log_restore(self):
        """Log restore event for detection by memory updater"""
        try:
            # Ensure directory exists
            self.restore_log_path.parent.mkdir(exist_ok=True)
            
            # Load existing logs or create new list
            logs = []
            if self.restore_log_path.exists():
                try:
                    with open(self.restore_log_path, 'r') as f:
                        logs = json.load(f)
                        if not isinstance(logs, list):
                            logs = []
                except:
                    logs = []
            
            # Add new log entry
            logs.append({
                "timestamp": datetime.now().isoformat(),
                "type": "memory_restore",
                "pid": sys.argv[0]
            })
            
            # Keep only last 100 entries
            logs = logs[-100:]
            
            # Write back
            with open(self.restore_log_path, 'w') as f:
                json.dump(logs, f, indent=2)
                
        except Exception as e:
            print(f"Failed to log restore: {e}")
            
    def restore(self, auto_mode=False, quiet=False):
        """Main restoration function"""
        # Find checkpoint
        checkpoint_path = self.find_checkpoint()
        
        if not checkpoint_path:
            if not quiet:
                print("❌ No checkpoint found!")
                print("This might be a new conversation or checkpoint is missing.")
            return False
            
        # Load checkpoint
        checkpoint = self.load_checkpoint(checkpoint_path)
        if not checkpoint:
            return False
            
        # Display greeting
        if not quiet:
            self.display_greeting(checkpoint, auto_mode)
            
        # Update git status
        self.update_git_status()
        
        # Create VSCode notification
        if auto_mode:
            self.create_vscode_notification()
        
        # Log the restore for new chat detection
        self.log_restore()
            
        # Show status if not in quiet mode
        if not quiet and not auto_mode:
            self.show_status(checkpoint)
            
        return True
        
    def interactive_restore(self):
        """Interactive restoration with options"""
        print("\n🧠 SANCTUARY MEMORY RESTORATION")
        print("="*40)
        
        if not self.restore(auto_mode=False):
            print("\nWould you like to create a new checkpoint? (y/n)")
            if input().lower() == 'y':
                print("Creating new checkpoint...")
                # Could call checkpoint creation here
                
        print("\n✅ Memory restoration complete!")
        
def main():
    parser = argparse.ArgumentParser(description='Restore Gritz memory checkpoint')
    parser.add_argument('--auto', action='store_true', help='Auto mode for VSCode')
    parser.add_argument('--quiet', action='store_true', help='Quiet mode')
    parser.add_argument('--status', action='store_true', help='Show status only')
    
    args = parser.parse_args()
    
    restorer = MemoryRestorer()
    
    if args.status:
        checkpoint_path = restorer.find_checkpoint()
        if checkpoint_path:
            checkpoint = restorer.load_checkpoint(checkpoint_path)
            if checkpoint:
                restorer.show_status(checkpoint)
        else:
            print("No checkpoint found")
    else:
        success = restorer.restore(auto_mode=args.auto, quiet=args.quiet)
        
        # Return appropriate exit code
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()