/**
 * WebSocketHandler - Centralized WebSocket event handling
 *
 * Phase 5C: Backend Monolith Split
 * Extracted from index.js to centralize WebSocket connection, message, and close handling
 * Manages all client interactions including bot commands, trading operations, and chart subscriptions
 */

export class WebSocketHandler {
  constructor(wss, dependencies) {
    this.wss = wss;
    // Bot Manager now runs on separate hermes-bots service (port 4829)
    this.getBotsWebSocket = dependencies.botsWebSocket; // Function to get botsWebSocket
    this.coinbaseWebSocket = dependencies.coinbaseWebSocket;
    this.subscriptionManager = dependencies.subscriptionManager;
    this.getGranularitySeconds = dependencies.getGranularitySeconds;

    // Get references to subscription tracking from SubscriptionManager
    this.chartSubscriptions = dependencies.chartSubscriptions;
    this.activeSubscriptions = dependencies.activeSubscriptions;
    this.granularityMappings = dependencies.granularityMappings;
    this.granularityMappingTimes = dependencies.granularityMappingTimes;
    this.lastEmissionTimes = dependencies.lastEmissionTimes;

    // Cache for level2 snapshots
    this.cachedLevel2Snapshot = dependencies.cachedLevel2Snapshot;
  }

  /**
   * Initialize WebSocket connection and message handlers
   */
  initialize() {
    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws) {
    // Generate unique client ID for tracking subscriptions
    ws._clientId = Math.random().toString(36).substring(7);
    this.chartSubscriptions.set(ws._clientId, new Set());

    // Bot management now handled by separate hermes-bots service

    // Send cached level2 snapshot to new client immediately
    if (this.cachedLevel2Snapshot) {
      ws.send(JSON.stringify({
        type: 'level2',
        data: this.cachedLevel2Snapshot
      }));
    }

    // Set up event handlers for this connection
    ws.on('message', (message) => this.handleMessage(ws, message));
    ws.on('close', () => this.handleClose(ws));
    ws.on('error', (error) => this.handleError(ws, error));

    // Send welcome message with current state
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to trading backend (bot manager on separate service: port 4829)'
    }));
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(ws, message) {
    try {
      const data = JSON.parse(message.toString());

      // 🔇 REDUCED LOGGING: Commented out for cleaner console
      // Only uncomment for debugging specific issues
      // if (data.type !== 'getStatus' && data.type !== 'getManagerState' && data.type !== 'realtimePrice') {
      //   if (data.type === 'createBot' || data.type === 'deleteBot' || data.type === 'startBot' || data.type === 'stopBot') {
      //     console.log('📥 [Backend]', data.type, '- botId:', data.botId);
      //   }
      // }


      switch (data.type) {
        // Bot-related commands - forward to hermes-bots service (port 4829)
        case 'createBot':
        case 'selectBot':
        case 'deleteBot':
        case 'getManagerState':
        case 'start':
        case 'stop':
        case 'pause':
        case 'resume':
        case 'getStatus':
        case 'updateStrategy':
        case 'updateSelectedStrategy':
        case 'realtimePrice':
        case 'reset':
          // Forward command to bots service
          const botsWs = this.getBotsWebSocket();
          if (botsWs && botsWs.readyState === 1) { // WebSocket.OPEN
            botsWs.send(message.toString());
            console.log(`🤖 Forwarded ${data.type} command to bots service`);
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Bots service is not connected'
            }));
            console.error('❌ Cannot forward command - bots service not connected');
          }
          break;
        case 'forceSell':
          await this.handleForceSell(ws, data);
          break;
        case 'subscribe':
          this.handleSubscribe(ws, data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(ws, data);
          break;
        case 'requestLevel2Snapshot':
          this.handleRequestLevel2Snapshot(ws, data);
          break;
        default:
          // Reduced logging - uncomment for debugging
          // console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }

  /**
   * Handle bot creation command
   */
  handleCreateBot(ws, data) {
    const botId = this.botManager.createBot(data.strategyType, data.botName, data.config);
    ws.send(JSON.stringify({
      type: 'botCreated',
      data: { botId }
    }));
  }

  /**
   * Handle start trading command
   */
  handleStartTrading(ws, data) {
    // Reduced logging - commented out for cleaner output
    // console.log('Start trading request received:', {
    //   config: data.config,
    //   activeBotId: this.botManager.activeBotId,
    //   hasActiveBot: !!this.botManager.getActiveBot()
    // });
    this.botManager.startTrading(data.config);
  }

  /**
   * Handle stop trading command
   */
  handleStopTrading(ws, data) {
    // If botId provided, select that bot first
    if (data.botId) {
      try {
        this.botManager.selectBot(data.botId);
      } catch (error) {
        // Silently ignore if bot doesn't exist
      }
    }
    this.botManager.stopTrading();
    // Send updated status
    ws.send(JSON.stringify({
      type: 'tradingStopped',
      status: this.botManager.getStatus()
    }));
  }

  /**
   * Handle pause trading command
   */
  handlePauseTrading(ws, data) {
    // If botId provided, select that bot first
    if (data.botId) {
      try {
        this.botManager.selectBot(data.botId);
      } catch (error) {
        // Silently ignore if bot doesn't exist
      }
    }
    this.botManager.pauseTrading();
  }

  /**
   * Handle resume trading command
   */
  handleResumeTrading(ws, data) {
    // If botId provided, select that bot first
    if (data.botId) {
      try {
        this.botManager.selectBot(data.botId);
      } catch (error) {
        // Silently ignore if bot doesn't exist
      }
    }
    this.botManager.resumeTrading();
  }

  /**
   * Handle update selected strategy command
   */
  async handleUpdateSelectedStrategy(ws, data) {
    // Update just the dropdown selection for persistence
    const bot = data.botId ? this.botManager.getBot(data.botId) : this.botManager.getActiveBot();
    if (bot) {
      await bot.updateSelectedStrategy(data.strategyType);
      ws.send(JSON.stringify({
        type: 'selectedStrategyUpdated',
        botId: data.botId || this.botManager.activeBotId,
        strategyType: data.strategyType
      }));
    }
  }

  /**
   * Handle reset command
   */
  async handleReset(ws, data) {
    console.log('Reset request received for bot:', data.botId);
    const botToReset = data.botId ? this.botManager.getBot(data.botId) : this.botManager.getActiveBot();
    if (botToReset) {
      botToReset.resetState();
      // Save the cleared state to file
      botToReset.saveState().catch(error => {
        console.error('Failed to save reset state:', error);
      });
      ws.send(JSON.stringify({
        type: 'resetComplete',
        botId: data.botId || this.botManager.activeBotId,
        status: botToReset.getStatus()
      }));
      // Broadcast updated manager state
      this.botManager.broadcast({
        type: 'managerState',
        data: this.botManager.getManagerState()
      });
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No bot found to reset'
      }));
    }
  }

  /**
   * Handle force sell command (for testing vault allocation)
   */
  async handleForceSell(ws, data) {
    console.log('🧪 FORCE SELL request received for testing vault allocation');
    const botToSell = this.botManager.getActiveBot();
    if (botToSell) {
      // Force trigger a sell signal to test vault allocation
      const currentPrice = botToSell.currentPrice || 112000; // Use current price or fallback
      console.log(`🧪 Forcing sell at price: $${currentPrice}`);

      // Call the orchestrator's executeSellSignal directly for testing
      if (botToSell.orchestrator) {
        // Check current BTC balance before forcing sell
        const currentBtc = botToSell.orchestrator.positionManager.getTotalBtc();
        console.log(`🧪 Current BTC balance: ${currentBtc} BTC`);

        if (currentBtc === 0) {
          // No BTC to sell - simulate a profitable trade for testing
          console.log('🧪 No BTC to sell, simulating a profitable trade for testing...');
          const simulatedBtc = 0.1; // Simulate 0.1 BTC
          const simulatedCostBasis = currentPrice * 0.95 * simulatedBtc; // 5% profit

          // Temporarily add position for testing
          botToSell.orchestrator.balance.btc = simulatedBtc;
          botToSell.orchestrator.positionManager.addPosition({
            size: simulatedBtc,
            entryPrice: currentPrice * 0.95,
            timestamp: Date.now()
          });

          console.log(`🧪 Simulated position: ${simulatedBtc} BTC at cost basis $${simulatedCostBasis.toFixed(2)}`);
        }

        const mockSignal = { reason: data.reason || 'Force sell for vault allocation test' };
        try {
          await botToSell.orchestrator.executeSellSignal(mockSignal, currentPrice);
          console.log('🧪 Force sell completed, vault allocation should be applied');
          ws.send(JSON.stringify({
            type: 'forceSellComplete',
            status: botToSell.getStatus()
          }));
        } catch (error) {
          console.error('🧪 Force sell failed:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Force sell failed: ' + error.message
          }));
        }
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Bot orchestrator not available'
        }));
      }
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No active bot found for force sell'
      }));
    }
  }

  /**
   * Handle chart subscription command
   */
  handleSubscribe(ws, data) {
    // Chart subscription - subscribe to Coinbase real-time data
    console.log('📊 Chart subscription received:', data.pair, data.granularity);

    const subscriptionKey = `${data.pair}:${data.granularity}`;
    const clientSubs = this.chartSubscriptions.get(ws._clientId);

    if (clientSubs && !clientSubs.has(subscriptionKey)) {
      clientSubs.add(subscriptionKey);

      // Track active granularities for this pair
      if (!this.activeSubscriptions.has(data.pair)) {
        this.activeSubscriptions.set(data.pair, new Set());
      }
      this.activeSubscriptions.get(data.pair).add(data.granularity);

      // Convert granularity string to seconds for Coinbase
      const granularitySeconds = this.getGranularitySeconds(data.granularity);

      // Track the mapping between seconds and string for this pair
      const mappingKey = `${data.pair}:${granularitySeconds}`;
      this.granularityMappings.set(mappingKey, data.granularity);
      // 🔥 MEMORY LEAK FIX: Track creation time for TTL cleanup
      this.granularityMappingTimes.set(mappingKey, Date.now());

      // Subscribe to Coinbase WebSocket for this pair
      this.coinbaseWebSocket.subscribeMatches(data.pair, granularitySeconds);
    }

    ws.send(JSON.stringify({
      type: 'subscribed',
      pair: data.pair,
      granularity: data.granularity
    }));
  }

  /**
   * Handle chart unsubscription command
   */
  handleUnsubscribe(ws, data) {
    // Chart unsubscription
    console.log('Chart unsubscription received:', data.pair, data.granularity);

    const unsubKey = `${data.pair}:${data.granularity}`;
    const clientSubsUnsub = this.chartSubscriptions.get(ws._clientId);

    if (clientSubsUnsub && clientSubsUnsub.has(unsubKey)) {
      clientSubsUnsub.delete(unsubKey);

      // Check if any other clients are still subscribed to this pair
      let stillSubscribed = false;
      this.chartSubscriptions.forEach((subs) => {
        if (subs.has(unsubKey)) {
          stillSubscribed = true;
        }
      });

      // If no clients are subscribed, unsubscribe from Coinbase
      if (!stillSubscribed) {
        this.coinbaseWebSocket.unsubscribe(data.pair, 'matches');
        console.log(`📡 Unsubscribed from Coinbase for ${unsubKey} - no more clients`);

        // 🔥 MEMORY LEAK FIX: Clean up granularity mappings and timestamps
        const granularitySeconds = this.getGranularitySeconds(data.granularity);
        const mappingKey = `${data.pair}:${granularitySeconds}`;
        this.granularityMappings.delete(mappingKey);
        this.granularityMappingTimes.delete(mappingKey);
        console.log(`🧹 Cleaned up granularity mapping: ${mappingKey}`);
      }

      console.log(`📡 Unsubscribed client ${ws._clientId} from ${unsubKey}`);
    }

    ws.send(JSON.stringify({
      type: 'unsubscribed',
      pair: data.pair,
      granularity: data.granularity
    }));
  }

  /**
   * Handle level2 snapshot request
   */
  handleRequestLevel2Snapshot(ws, data) {
    // Force refresh of level2 orderbook snapshot by re-subscribing
    console.log('📸 [Backend] Level2 snapshot requested by client', ws._clientId);

    // 🔧 FIX: Send cached snapshot only if it has data, otherwise wait for real data
    if (this.cachedLevel2Snapshot && this.cachedLevel2Snapshot.bids && this.cachedLevel2Snapshot.bids.length > 0) {
      console.log(`✅ [Backend] Sending cached level2 snapshot to client (${this.cachedLevel2Snapshot.bids.length} bids, ${this.cachedLevel2Snapshot.asks.length} asks)`);
      try {
        ws.send(JSON.stringify({
          type: 'level2',
          data: this.cachedLevel2Snapshot
        }));
      } catch (error) {
        console.error('❌ [Backend] Failed to send cached snapshot:', error);
      }
    } else {
      console.warn('⚠️ [Backend] No valid cached level2 snapshot yet (waiting for Coinbase data...)');
    }

    // Also unsubscribe and re-subscribe to get fresh data for future updates
    this.coinbaseWebSocket.unsubscribe('BTC-USD', 'level2');

    // Wait a moment before re-subscribing
    setTimeout(() => {
      this.coinbaseWebSocket.subscribeLevel2('BTC-USD');
      console.log('📡 [Backend] Re-subscribed to level2 to get fresh updates');
    }, 500);
  }

  /**
   * Handle WebSocket connection close
   */
  handleClose(ws) {
    // Clean up chart subscriptions for this client
    const clientSubs = this.chartSubscriptions.get(ws._clientId);
    if (clientSubs) {
      clientSubs.forEach(subscriptionKey => {
        // Check if any other clients are still subscribed to this data
        let stillSubscribed = false;
        this.chartSubscriptions.forEach((subs, clientId) => {
          if (clientId !== ws._clientId && subs.has(subscriptionKey)) {
            stillSubscribed = true;
          }
        });

        // If no other clients are subscribed, unsubscribe from Coinbase
        if (!stillSubscribed) {
          const [pair, granularityStr] = subscriptionKey.split(':');
          this.coinbaseWebSocket.unsubscribe(pair, 'matches');
          console.log(`📡 Unsubscribed from Coinbase for ${subscriptionKey} - client disconnected`);

          // 🔥 MEMORY LEAK FIX: Clean up granularity mappings and timestamps
          const granularitySeconds = this.getGranularitySeconds(granularityStr);
          const mappingKey = `${pair}:${granularitySeconds}`;
          this.granularityMappings.delete(mappingKey);
          this.granularityMappingTimes.delete(mappingKey);
          console.log(`🧹 Cleaned up granularity mapping: ${mappingKey}`);
        }
      });

      this.chartSubscriptions.delete(ws._clientId);
    }

    // Bot client management now handled by hermes-bots service (port 4829)

    // 🔥 RACE CONDITION FIX: Clean up emission throttle tracking
    const keysToDelete = [];
    for (const key of this.lastEmissionTimes.keys()) {
      if (key.startsWith(`${ws._clientId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.lastEmissionTimes.delete(key));

    console.log(`🧹 WebSocket client ${ws._clientId} disconnected and cleaned up (${keysToDelete.length} throttle entries removed)`);
  }

  /**
   * Handle WebSocket connection error
   */
  handleError(ws, error) {
    console.error(`WebSocket error for client ${ws._clientId}:`, error);
    // Trigger cleanup on error
    ws.close();
  }

  /**
   * Set cached level2 snapshot (called from external handler)
   */
  setCachedLevel2Snapshot(snapshot) {
    this.cachedLevel2Snapshot = snapshot;

    // Broadcast to all connected clients
    this.wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'level2',
          data: snapshot
        }));
      }
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    const clientCount = Array.from(this.wss.clients).filter(c => c.readyState === c.OPEN).length;
    if (message.type === 'candle') {
      // 🔧 FIX: Reduced logging - only log summary, not per-client details
      // Access granularity from flat structure (message.granularity)
      console.log(`📡 [Broadcast] Broadcasting candle (${message.granularity}) to ${clientCount} clients`);
    }

    this.wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          const clientInfo = client._socket ? `${client._socket.remoteAddress}:${client._socket.remotePort}` : 'unknown';
          console.error(`❌ [Broadcast] Failed to send to ${clientInfo}: ${error.message}`);
        }
      }
    });
  }
}
