#!/usr/bin/env node

import axios from 'axios';

const API_URL = 'http://localhost:4827/api/trading';

async function testBotManager() {
  try {
    console.log('🧪 Testing Bot Manager API...\n');

    // 1. Get initial state
    console.log('1. Getting initial bot manager state...');
    const initialState = await axios.get(`${API_URL}/bots`);
    console.log(`✅ Found ${Object.keys(initialState.data.bots).length} bots`);
    console.log(`   Active bot: ${initialState.data.activeBotId || 'none'}\n`);

    // 2. Get status
    console.log('2. Getting trading status...');
    const status = await axios.get(`${API_URL}/status`);
    console.log(`✅ Status: ${status.data.isRunning ? 'Running' : 'Stopped'}`);
    console.log(`   Bot: ${status.data.botName || 'none'}\n`);

    // 3. List bots by strategy
    console.log('3. Bots by strategy:');
    for (const [strategy, botIds] of Object.entries(initialState.data.strategyBots)) {
      console.log(`   ${strategy}: ${botIds.length} bots`);
    }
    console.log('');

    // 4. Select a different bot
    const reverseBots = initialState.data.strategyBots['reverse-ratio'];
    if (reverseBots && reverseBots.length > 1) {
      const secondBotId = reverseBots[1];
      console.log(`4. Selecting bot: ${secondBotId}...`);
      await axios.put(`${API_URL}/bots/${secondBotId}/select`);
      console.log('✅ Bot selected\n');
    }

    // 5. Test creating a new bot (if room)
    const strategies = ['reverse-ratio', 'micro-scalping', 'grid-trading'];
    let createdBot = false;
    
    for (const strategy of strategies) {
      const existing = initialState.data.strategyBots[strategy]?.length || 0;
      if (existing < 6) {
        console.log(`5. Creating new bot for ${strategy}...`);
        const response = await axios.post(`${API_URL}/bots`, {
          strategyType: strategy,
          botName: `Test Bot ${existing + 1}`
        });
        console.log(`✅ Created bot: ${response.data.botId}\n`);
        createdBot = true;
        break;
      }
    }

    if (!createdBot) {
      console.log('5. All strategies have max bots (6 each)\n');
    }

    // 6. Final state
    console.log('6. Getting final bot manager state...');
    const finalState = await axios.get(`${API_URL}/bots`);
    console.log(`✅ Total bots: ${Object.keys(finalState.data.bots).length}`);
    console.log(`   Active bot: ${finalState.data.activeBotId}`);

    console.log('\n✅ Bot Manager test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
testBotManager();