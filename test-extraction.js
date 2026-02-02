const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Go to the deployed app (change URL if different)
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  console.log('Testing app at:', appUrl);

  await page.goto(appUrl);
  await page.waitForLoadState('networkidle');

  // Find and fill the URL input
  const input = page.locator('input[placeholder*="TikTok"]');
  await input.fill('https://www.tiktok.com/@twotravelingsmiles/video/7581810768757165320');

  console.log('Entered TikTok URL');

  // Click the extract button (the arrow button)
  const extractBtn = page.locator('button:has(span:text("→"))');
  await extractBtn.click();

  console.log('Clicked extract, waiting for response...');

  // Wait for navigation to template page
  await page.waitForURL(/\/template\//, { timeout: 60000 });

  console.log('Navigated to template page');

  // Wait for content to load
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/extraction-result.png', fullPage: true });
  console.log('Screenshot saved to /tmp/extraction-result.png');

  // Check intro text
  const introText = await page.locator('text=Intro').first().textContent();
  console.log('Intro section found:', introText);

  // Get all visible text on page
  const pageText = await page.textContent('body');
  console.log('Page contains "Dreamiest":', pageText.includes('Dreamiest'));
  console.log('Page contains "Magical":', pageText.includes('Magical'));

  // Keep browser open for inspection
  console.log('Browser open for inspection. Press Ctrl+C to close.');
  await page.waitForTimeout(300000); // 5 minutes

  await browser.close();
})();
