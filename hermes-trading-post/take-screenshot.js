import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Log console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  // Navigate to the backtesting page
  console.log('Navigating to http://localhost:5173/backtesting');
  await page.goto('http://localhost:5173/backtesting', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  // Wait a bit for the page to render
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Take screenshot
  await page.screenshot({ 
    path: '/tmp/backtesting-screenshot.png',
    fullPage: false
  });
  
  console.log('Screenshot saved to /tmp/backtesting-screenshot.png');
  
  await browser.close();
})();