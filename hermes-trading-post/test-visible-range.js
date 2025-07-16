import puppeteer from 'puppeteer';

async function testVisibleRange() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('visible range') || text.includes('Loaded') || text.includes('candles') || text.includes('Setting')) {
      console.log('Console:', text);
    }
  });
  
  try {
    console.log('Loading dashboard...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n=== Testing 1H with 1m granularity ===');
    
    // Make sure we're on 1H timeframe (should be default)
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await button.evaluate(el => el.textContent);
      if (text && text.trim() === '1H') {
        await button.click();
        console.log('✓ Clicked 1H button');
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get chart info
    const chartInfo = await page.evaluate(() => {
      const chart = window.chart; // If exposed
      const timeScale = chart?.timeScale();
      const visibleRange = timeScale?.getVisibleRange();
      
      // Get candle info from DOM
      const infoElements = document.querySelectorAll('.text-xs.text-gray-600');
      let candleInfo = 'Not found';
      for (const el of infoElements) {
        if (el.textContent && el.textContent.includes('Visible:')) {
          candleInfo = el.textContent;
          break;
        }
      }
      
      return {
        visibleRange: visibleRange ? {
          from: new Date(visibleRange.from * 1000).toISOString(),
          to: new Date(visibleRange.to * 1000).toISOString(),
          rangeSeconds: visibleRange.to - visibleRange.from,
          rangeMinutes: (visibleRange.to - visibleRange.from) / 60
        } : null,
        candleInfo,
        chartExists: !!chart
      };
    }).catch(err => ({error: err.message}));
    
    console.log('\nChart info:', JSON.stringify(chartInfo, null, 2));
    
    // Try to get more info using dev tools
    const metrics = await page.metrics();
    console.log('\nPage metrics:', metrics);
    
    // Check for any errors
    const errors = await page.evaluate(() => {
      const errorEl = document.querySelector('.text-red-500');
      return errorEl ? errorEl.textContent : null;
    });
    
    if (errors) {
      console.log('\nErrors found:', errors);
    }
    
    console.log('\nKeeping browser open for inspection...');
    console.log('Press Ctrl+C to exit');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testVisibleRange();