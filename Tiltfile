# Tiltfile - Development Environment Manager
# Web UI: http://localhost:10350

# Allow Tilt to connect to the local Docker daemon (if you use Docker later)
# docker_prune_settings(disable=True)

# Update settings - more responsive UI
update_settings(max_parallel_updates=5)

# Log retention: Keep only last 3 hours of logs
local_resource(
    'log-cleanup',
    cmd='find ~/.tilt-dev/logs -type f -mtime +0.125 -delete 2>/dev/null || echo "No old logs to clean"',
    deps=[],
    labels=['utilities'],
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL
)

# Set up port forwards for the Tilt web UI
# config.define_bool("enable-web-ui")
# cfg = config.parse()

print("🚀 Starting Development Environment Dashboard")
print("📊 Access Tilt UI at: http://localhost:10350")
print("⌨️  Press Ctrl+C to stop all services")

# ============================================
# MESSAGING SERVICES
# ============================================

# RELAYER - Chat relay service with deletion detection
local_resource(
    'relayer',
    serve_cmd='cd relayer && node scripts/start-production.js',
    deps=['./relayer/src'],
    labels=['messaging'],
    resource_deps=[],
    readiness_probe=probe(
        period_secs=30,
        initial_delay_secs=90,  # Increased: All platforms need time to connect on startup (Discord, Telegram, Twitch, Kick, YouTube)
        exec=exec_action(['./relayer-health-check.sh'])
    ),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO  # Auto-start on Tilt startup
)

# NOTIFIER - Notification service with frontend
local_resource(
    'notifier',
    serve_cmd='./start-notifier.sh',
    deps=['./notifier/src', './notifier/backend/src'],
    labels=['messaging'],
    resource_deps=[],
    links=[
        link('http://localhost:6173', 'Notifier Frontend'),
        link('http://localhost:7392', 'Notifier Backend API')
    ],
    readiness_probe=probe(
        period_secs=15,
        initial_delay_secs=10,
        exec=exec_action(['sh', '-c', 'curl -s http://localhost:7392/health >/dev/null || (curl -s http://localhost:6173 >/dev/null && pgrep -f "node.*notifier" > /dev/null)'])
    ),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# ============================================
# GAMEBOT - Gaming bot service  
# ============================================
local_resource(
    'gamebot',
    serve_cmd='cd gamebot && npm run dev',
    deps=['./gamebot/src'],
    labels=['bots'],
    resource_deps=[],
    readiness_probe=probe(
        period_secs=10,
        initial_delay_secs=5,
        exec=exec_action(['sh', '-c', 'pgrep -f "gamebot.*index.ts" > /dev/null'])
    ),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# ============================================
# NSFW-BOT - Content moderation bot with duplicate prevention
# ============================================
local_resource(
    'nsfw-bot',
    serve_cmd='cd nsfw-bot && ./start_redis_bot.sh',
    deps=['./nsfw-bot/nsfw_bot_redis.py', './nsfw-bot/requirements.txt'],
    labels=['bots'],
    resource_deps=[],
    readiness_probe=probe(
        period_secs=15,
        initial_delay_secs=8,
        exec=exec_action(['sh', '-c', 'pgrep -f "nsfw_bot_redis.py" > /dev/null && redis-cli -p 16379 ping > /dev/null'])
    ),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# ============================================
# SFW-BOT - Safe cute adorable furry content bot
# ============================================
local_resource(
    'sfw-bot',
    serve_cmd='cd sfw-bot && ./start_redis_bot.sh',
    deps=['./sfw-bot/sfw_bot_redis.py', './sfw-bot/requirements.txt'],
    labels=['bots'],
    resource_deps=[],
    readiness_probe=probe(
        period_secs=15,
        initial_delay_secs=8,
        exec=exec_action(['sh', '-c', 'pgrep -f "sfw_bot_redis.py" > /dev/null && redis-cli -p 16380 ping > /dev/null'])
    ),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# ============================================
# FURRY-GOTCHI - Virtual Pet Game (Godot 4)
# ============================================
local_resource(
    'furry-gotchi',
    serve_cmd='./start-furry-gotchi.sh',
    deps=['./furry-gotchi'],
    labels=['bots'],
    resource_deps=[],
    links=[
        link('http://localhost:8085', 'Furry-Gotchi Game')
    ],
    readiness_probe=probe(
        period_secs=15,
        initial_delay_secs=10,
        http_get=http_get_action(port=8085, path='/')
    ),
    auto_init=False,  # Manual start
    trigger_mode=TRIGGER_MODE_MANUAL
)

# ============================================
# HERMES REDIS SERVER - Monitor existing Redis for Hermes Trading Post
# ============================================
local_resource(
    'hermes-redis-server',
    cmd='redis-cli -p 6379 ping > /dev/null && echo "Hermes Redis healthy" || echo "Hermes Redis down"',
    deps=[],  # No file watching needed for Redis monitoring
    labels=['sanctuary'],
    resource_deps=[],
    links=[
        link('redis://localhost:6379', 'Hermes Redis Database')
    ],
    readiness_probe=probe(
        period_secs=10,
        initial_delay_secs=5,  # Give Redis more time to start after boot
        exec=exec_action(['redis-cli', '-p', '6379', 'ping'])
    ),
    auto_init=True,  # Auto-check before other Hermes services
    trigger_mode=TRIGGER_MODE_AUTO  # Auto-start on boot so dependent services can start
)

# ============================================
# HERMES TRADING POST - Trading platform
# ============================================
local_resource(
    'hermes-trading-post',
    serve_cmd='./start-hermes-trading.sh',
    deps=['./project-sanctuary/hermes-trading-post/src'],  # Only watch frontend files
    labels=['sanctuary'],
    resource_deps=['hermes-redis-server'],  # Depend on Hermes Redis server
    links=[
        link('http://localhost:5173', 'Hermes Frontend')
    ],
    readiness_probe=probe(
        period_secs=10,
        initial_delay_secs=15,  # Increased: Vite needs time to compile and start
        http_get=http_get_action(port=5173, path='/')  # Check frontend on correct port
    ),
    auto_init=True,  # Auto-start after Redis
    trigger_mode=TRIGGER_MODE_AUTO
)

# ============================================
# BROWSER MONITOR - Console & Error Logger with proper cleanup
# ============================================
local_resource(
    'browser-monitor',
    serve_cmd='./start-browser-monitor.sh',
    deps=['~/browser-monitor/monitor.js'],
    labels=['monitoring'],
    resource_deps=['hermes-trading-post'],  # Wait for frontend to be ready
    links=[
        link('http://localhost:5173', 'Hermes Frontend (Monitored)'),
        link('http://localhost:10350', 'Tilt Dashboard')
    ],
    readiness_probe=probe(
        period_secs=10,
        initial_delay_secs=8,
        exec=exec_action(['sh', '-c', 'pgrep -f "monitor.js" > /dev/null'])
    ),
    auto_init=True,  # Auto-start after frontend is ready
    trigger_mode=TRIGGER_MODE_AUTO
)

# ============================================
# TERMINAL MONITOR - Backend & System Logger
# ============================================
local_resource(
    'terminal-monitor',
    serve_cmd='~/terminal-monitor/monitor.sh',
    deps=['~/terminal-monitor/monitor.sh'],
    labels=['monitoring'],
    resource_deps=[],
    readiness_probe=probe(
        period_secs=10,
        initial_delay_secs=2,
        exec=exec_action(['sh', '-c', 'test -d ~/.terminal-logs && test -f ~/.terminal-logs/all.log'])
    ),
    auto_init=False,  # Manual start only
    trigger_mode=TRIGGER_MODE_MANUAL
)

# ============================================
# HEALTH MONITOR - Comprehensive Service Monitor
# ============================================
local_resource(
    'health-monitor',
    serve_cmd='./start-health-monitor.sh',
    deps=['./health-monitor/src'],
    labels=['monitoring'],
    resource_deps=[],
    links=[
        link('http://localhost:9999', 'Health Monitor Dashboard'),
        link('http://localhost:9999/status', 'Status API'),
    ],
    readiness_probe=probe(
        period_secs=15,
        initial_delay_secs=10,
        http_get=http_get_action(port=9999, path='/health')
    ),
    auto_init=False,  # Manual start only
    trigger_mode=TRIGGER_MODE_MANUAL
)

# ============================================
# HERMES BACKEND - Trading backend API server
# ============================================
local_resource(
    'hermes-backend',
    serve_cmd='./start-hermes-backend.sh',
    deps=['./project-sanctuary/hermes-trading-post/backend/src'],
    labels=['sanctuary'],
    resource_deps=['hermes-redis-server'],  # Removed hermes-bots dependency - not critical
    links=[
        link('http://localhost:4828', 'Hermes Trading Backend API'),
        link('http://localhost:4828/health', 'Hermes Backend Health Check')
    ],
    readiness_probe=probe(
        period_secs=15,  # Check every 15 seconds instead of 10
        initial_delay_secs=45,  # Increased: backend needs time to load historical data from Redis + connect to Coinbase + startup delays
        http_get=http_get_action(port=4828, path='/health')
    ),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# ============================================
# HERMES BOTS - Trading bots backend service
# ============================================
local_resource(
    'hermes-bots',
    serve_cmd='cd ./project-sanctuary/hermes-trading-post/backend/bots && npm install && node src/index.js',
    deps=['./project-sanctuary/hermes-trading-post/backend/bots/src'],
    labels=['sanctuary'],
    resource_deps=['hermes-redis-server'],
    links=[
        link('http://localhost:4829', 'Hermes Bots Service'),
        link('http://localhost:4829/health', 'Hermes Bots Health Check'),
        link('http://localhost:4829/api/bots', 'Hermes Bots API')
    ],
    readiness_probe=probe(
        period_secs=10,
        initial_delay_secs=30,  # Increased: npm install + node startup takes time on first boot
        http_get=http_get_action(port=4829, path='/health')
    ),
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)


# ============================================
# Helper Commands - Available in Tilt UI
# ============================================

# Database check command
local_resource(
    'check-db-locks',
    cmd='lsof ~/Documents/Github/relayer/relay_messages.db 2>/dev/null || echo "No database locks"',
    deps=[],
    labels=['utilities'],
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# Kill all Node processes (emergency)
local_resource(
    'kill-all-node',
    cmd='pkill -f "node|tsx" || echo "No node processes to kill"',
    deps=[],
    labels=['utilities'],
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# Check port usage
local_resource(
    'check-ports',
    cmd='lsof -i :3000-3010 -i :5173-5180 || echo "No ports in use"',
    deps=[],
    labels=['utilities'],
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)

# System resource monitor
local_resource(
    'system-monitor',
    cmd='echo "=== CPU & Memory ===" && top -bn1 | head -10 && echo -e "\n=== Disk Usage ===" && df -h /',
    deps=[],
    labels=['utilities'],
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO
)



print("✅ Tiltfile loaded successfully!")
print("💡 Tips:")
print("   - Services are set to manual trigger to avoid conflicts")
print("   - Click on a service in the UI to start/stop/restart it")
print("   - Use the 'utilities' resources to check system status")
print("   - Logs are available in real-time for each service")

# ============================================
# VERUS MINING - DISABLED
# ============================================
# local_resource(
#     'verus',
#     serve_cmd='/home/ubuntubox/Documents/Mining/CPU/ccminer-linux/ccminer.sh',
#     deps=['/home/ubuntubox/Documents/Mining/CPU/ccminer-linux/ccminer.sh'],
#     labels=['mining'],
#     resource_deps=[],
#     readiness_probe=probe(
#         period_secs=15,
#         initial_delay_secs=5,
#         exec=exec_action(['sh', '-c', 'pgrep -f "ccminer" > /dev/null'])
#     ),
#     auto_init=True,
#     trigger_mode=TRIGGER_MODE_AUTO
# )


# MONERO HASHVAULT MINING - DISABLED
# ============================================
# local_resource(
#     'monero-hashvault',
#     serve_cmd='/home/ubuntubox/Documents/Mining/CPU/xmrig-linux/start-hashvault-monero.sh',
#     deps=['/home/ubuntubox/Documents/Mining/CPU/xmrig-linux/start-hashvault-monero.sh'],
#     labels=['mining'],
#     resource_deps=[],
#     readiness_probe=probe(
#         period_secs=15,
#         initial_delay_secs=5,
#         exec=exec_action(['sh', '-c', 'pgrep -f "xmrig.*hashvault" > /dev/null'])
#     ),
#     auto_init=True,
#     trigger_mode=TRIGGER_MODE_AUTO
# )

# ============================================
# QUANTUM RESISTANT LEDGER MINING - MANUAL START ONLY
# ============================================
local_resource(
    'qrl-mining',
    serve_cmd='cd "/home/ubuntubox/Documents/Mining/CPU/XMRig - Linux" && bash "Quantum Resistant Ledger.sh"',
    deps=['/home/ubuntubox/Documents/Mining/CPU/XMRig - Linux/Quantum Resistant Ledger.sh'],
    labels=['mining'],
    resource_deps=[],
    readiness_probe=probe(
        period_secs=15,
        initial_delay_secs=5,
        exec=exec_action(['sh', '-c', 'pgrep -f "xmrig.*herominers" > /dev/null'])
    ),
    auto_init=False,  # Manual start only
    trigger_mode=TRIGGER_MODE_MANUAL
)

# ============================================
# CCMINER - DISABLED
# ============================================
# local_resource(
#     'ccminer',
#     serve_cmd='cd "/home/ubuntubox/Documents/Mining/CPU/ccminer-linux" && ./ccminer.sh',
#     deps=['/home/ubuntubox/Documents/Mining/CPU/ccminer-linux/ccminer.sh'],
#     labels=['mining'],
#     resource_deps=[],
#     readiness_probe=probe(
#         period_secs=15,
#         initial_delay_secs=5,
#         exec=exec_action(['sh', '-c', 'pgrep -f "ccminer" > /dev/null'])
#     ),
#     auto_init=True,
#     trigger_mode=TRIGGER_MODE_AUTO
# )

# ============================================
# MONERO MINING - DISABLED
# ============================================
# local_resource(
#     'monero-mining',
#     serve_cmd='cd "/home/ubuntubox/Documents/Mining/CPU/XMRig - Linux" && ./Monero.sh',
#     deps=['/home/ubuntubox/Documents/Mining/CPU/XMRig - Linux/Monero.sh'],
#     labels=['mining'],
#     resource_deps=[],
#     readiness_probe=probe(
#         period_secs=15,
#         initial_delay_secs=5,
#         exec=exec_action(['sh', '-c', 'pgrep -f "xmrig.*hashvault" > /dev/null'])
#     ),
#     auto_init=True,
#     trigger_mode=TRIGGER_MODE_AUTO
# )

# ============================================
# DISABLED RESOURCES
# ============================================