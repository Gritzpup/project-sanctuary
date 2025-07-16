import puppeteer from 'puppeteer';

async function debugVisibleRange() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('visible range') || text.includes('Setting') || text.includes('Chart visible')) {
      console.log('Console:', text);
    }
  });
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get debug info from the page
    const debugInfo = await page.evaluate(() => {
      // Try to get chart instance
      const chartContainer = document.querySelector('.tv-lightweight-charts');
      if (!chartContainer) return { error: 'No chart found' };
      
      // Get visible range info from any displayed text
      const texts = Array.from(document.querySelectorAll('*')).map(el => el.textContent).filter(t => t && t.includes('candle'));
      
      return {
        candleText: texts[0] || 'Not found',
        containerWidth: chartContainer.offsetWidth,
        containerHeight: chartContainer.offsetHeight
      };
    });
    
    console.log('\nDebug Info:', debugInfo);
    
    // Wait to see console logs
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  console.log('\nKeeping browser open for inspection...');
  // Keep browser open
}

debugVisibleRange();