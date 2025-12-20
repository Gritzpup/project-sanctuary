#!/usr/bin/env node

import axios from 'axios';

const API_URL = 'http://localhost:4828/api/trading';

async function testBotManager() {
  try {

    // 1. Get initial state
    const initialState = await axios.get(`${API_URL}/bots`);

    // 2. Get status
    const status = await axios.get(`${API_URL}/status`);

    // 3. List bots by strategy
    for (const [strategy, botIds] of Object.entries(initialState.data.strategyBots)) {
    }

    // 4. Select a different bot
    const reverseBots = initialState.data.strategyBots['reverse-descending-grid'];
    if (reverseBots && reverseBots.length > 1) {
      const secondBotId = reverseBots[1];
      await axios.put(`${API_URL}/bots/${secondBotId}/select`);
    }

    // 5. Test creating a new bot (if room)
    const strategies = ['reverse-descending-grid', 'micro-scalping', 'grid-trading'];
    let createdBot = false;
    
    for (const strategy of strategies) {
      const existing = initialState.data.strategyBots[strategy]?.length || 0;
      if (existing < 6) {
        const response = await axios.post(`${API_URL}/bots`, {
          strategyType: strategy,
          botName: `Test Bot ${existing + 1}`
        });
        createdBot = true;
        break;
      }
    }

    if (!createdBot) {
    }

    // 6. Final state
    const finalState = await axios.get(`${API_URL}/bots`);


  } catch (error) {
    process.exit(1);
  }
}

// Run the test
testBotManager();