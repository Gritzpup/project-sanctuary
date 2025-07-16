import puppeteer from 'puppeteer';

async function verify1HFix() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check visible candles
    const candleInfo = await page.evaluate(() => {
      const elements = document.querySelectorAll('.candle-count');
      return elements.length > 0 ? elements[0].textContent : 'Not found';
    });
    
    console.log('1H View:', candleInfo);
    
    // Extract numbers
    const match = candleInfo.match(/(\d+) \/ (\d+)/);
    if (match) {
      const visible = parseInt(match[1]);
      const total = parseInt(match[2]);
      
      if (visible >= 60 && visible <= 62) {
        console.log('✅ SUCCESS: 1H view showing', visible, 'candles (expected ~60)');
      } else {
        console.log('❌ FAIL: 1H view showing', visible, 'candles (expected ~60)');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

verify1HFix();