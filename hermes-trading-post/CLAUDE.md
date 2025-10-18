# Claude Code Working Practices

## 📊 Tilt Integration (CRITICAL - PRIMARY LOGGING METHOD)
**ALWAYS** use Tilt for ALL server monitoring and logging:
- **MANDATORY**: Use `tilt logs [resource-name]` to check frontend, backend, database, and browser console logs
- **MANDATORY**: Access Tilt UI at http://localhost:10350 for service status
- **NEVER** use ~/.browser-logs or ~/.terminal-logs directories
- **ALWAYS** use Tilt for starting/stopping services
- **NEVER** run manual bash commands for backend servers
- Use `tilt trigger [resource-name]` to restart services

### Tilt Logging Commands:
```bash
# Check browser console logs (console.log, errors, network, WebSocket)
tilt logs browser-monitor

# Check frontend server logs (Vite dev server)
tilt logs hermes-trading-post

# Check backend logs (Paper trading API)
tilt logs paper-trading-backend

# Check database status
tilt logs hermes-redis-server

# Follow logs in real-time
tilt logs browser-monitor --follow

# Check all resources
tilt get uiresources
```

## 🌐 Browser Console Monitoring (CRITICAL)
**Browser-monitor captures ALL browser console activity via Chrome DevTools Protocol:**
- **Console output**: console.log, console.warn, console.error, console.debug
- **JavaScript exceptions**: All uncaught errors with stack traces
- **Network errors**: Failed requests, HTTP 4xx/5xx responses
- **WebSocket errors**: Connection failures and frame errors
- **Security warnings**: Certificate and security policy issues

**ALWAYS check browser-monitor logs after frontend changes:**
```bash
# See recent console activity
tilt logs browser-monitor | tail -n 50

# Filter for errors only
tilt logs browser-monitor | grep -E "EXCEPTION|ERROR|console.error"

# Watch console in real-time
tilt logs browser-monitor --follow
```

## 🚫 Git Commit Rules
**NEVER** commit to GitHub without explicit permission:
- Do NOT run `git commit` unless explicitly asked
- Do NOT run `git push` unless explicitly asked
- Always wait for user approval before committing
- Ask "Should I commit these changes?" when work is complete

## ✅ Verification Process
**ALWAYS** verify changes after making them:
1. **WAIT 5 SECONDS** after making code changes before checking logs (machine needs time to rebuild)
2. Use `tilt logs browser-monitor` to check browser console for errors after frontend changes
3. Use `tilt logs hermes-trading-post` to check Vite dev server logs
4. Use `tilt logs paper-trading-backend` to check backend API logs
5. Verify no new errors in any Tilt logs
6. Confirm expected behavior through Tilt logs before considering complete
7. Check Tilt UI at http://localhost:10350 for service health

## 🎯 Quick Debug Commands
**When debugging the valley indicator - ALWAYS USE VITE TRIGGER FIRST:**
```bash
# CRITICAL: Refresh Vite build FIRST, then check logs
tilt trigger hermes-trading-post && sleep 6

# Then check indicator positioning in browser logs
tilt logs browser-monitor 2>&1 | grep "🎯 INDICATOR" | tail -5

# Check raw depth data (bid/ask prices)
tilt logs browser-monitor 2>&1 | grep -E "bids\[0\]=|asks\[0\]=" | tail -5

# Full debug flow (data + calculation)
tilt logs browser-monitor 2>&1 | grep -E "📊 depthData|bids\[0\]=|🎯 INDICATOR" | tail -15
```

## 🎯 Important Reminders
1. **WAIT 5 SECONDS** after making changes before checking any logs - machine needs time to rebuild
2. Tilt logs are the PRIMARY source for all debugging (frontend, backend, database, browser console)
3. Browser-monitor captures ALL console activity - check it after every frontend change
4. Always verify changes through Tilt logs
5. Never auto-commit - always ask first
6. Check Tilt logs after EVERY change to any code (but wait 5 seconds first!)
7. All logging goes through Tilt - no local log files
8. **USE VITE REFRESH**: `tilt trigger hermes-trading-post` forces Vite rebuild - gives fresh logs immediately
