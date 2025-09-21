# Claude Code Working Practices

## 🔍 Browser Monitoring + Screenshots (MANDATORY)
**IMMEDIATELY** check browser logs AND take screenshots after ANY frontend change:
- **MANDATORY**: Check `~/.browser-logs/errors.log` after every change
- **MANDATORY**: Check `~/.browser-logs/console.log` for issues  
- **MANDATORY**: Use `tail -f ~/.browser-logs/all.log` to monitor live
- **MANDATORY**: Take screenshot after UI changes to verify visually
- **NEVER** assume changes work without checking logs AND screenshots
- **PROACTIVELY** fix ALL errors found before moving on

### Frontend Quick Commands:
```bash
# View latest console logs
tail -n 20 ~/.browser-logs/console.log

# Check for errors
grep -i error ~/.browser-logs/all.log

# Monitor live logs
tail -f ~/.browser-logs/console.log
```

## 🖥️ Terminal/Backend Monitoring
**ALWAYS** check terminal logs for backend services:
- Backend server logs: `~/.terminal-logs/backend.log`
- System logs: `~/.terminal-logs/system.log`
- Error logs: `~/.terminal-logs/errors.log`
- Combined logs: `~/.terminal-logs/all.log`

### Backend Quick Commands:
```bash
# View latest backend logs
tail -n 20 ~/.terminal-logs/backend.log

# Check for backend errors
grep -i error ~/.terminal-logs/errors.log

# Monitor live backend activity
tail -f ~/.terminal-logs/backend.log

# Check all logs for issues
tail -f ~/.terminal-logs/all.log
```

## ✅ Verification Process
**ALWAYS** verify changes after making them:
1. Check browser-monitor logs for frontend changes
2. Check terminal-monitor logs for backend changes
3. Verify no new errors in either error log
4. Confirm expected behavior in both frontend and backend logs
5. Test functionality through logs before considering complete

## 🚫 Git Commit Rules
**NEVER** commit to GitHub without explicit permission:
- Do NOT run `git commit` unless explicitly asked
- Do NOT run `git push` unless explicitly asked
- Always wait for user approval before committing
- Ask "Should I commit these changes?" when work is complete

## 📊 Tilt Integration
- Browser-monitor runs silently (no console spam to Tilt)
- Access Tilt UI at http://localhost:10350 for service status
- Paper trading backend is in the "sanctuary" section
- Use browser-monitor logs instead of Tilt logs for frontend debugging

## 🎯 Important Reminders
1. Browser logs are the primary source for frontend debugging
2. Always verify changes through logs
3. Never auto-commit - always ask first
4. Check logs after EVERY change to frontend code
