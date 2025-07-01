# 🚀 QUICK START - RESTORE MEMORY IN NEW CHAT

## 🎯 ONE-LINE COMMAND
Just paste this in new Claude Code chat:
```bash
cd /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM && python restore_memory.py --auto
```

## 📌 VSCode Settings Option
Add to `.vscode/settings.json`:
```json
{
    "terminal.integrated.env.linux": {
        "CLAUDE_MEMORY_RESTORE": "cd /home/ubuntumain/Documents/Github/project-sanctuary/the-luminal-archive/memory/ACTIVE_SYSTEM && python restore_memory.py --auto"
    }
}
```

Then in new chat, just type: `$CLAUDE_MEMORY_RESTORE`

## 🎨 Dashboard
Open in browser: http://localhost:8082/dashboard.html

## 💡 Why It's Not Fully Automatic
Claude Code doesn't auto-execute code from files for security reasons. This one-line command is the simplest workaround!