import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const appUrl = 'http://localhost:3000';
console.log('Testing app at:', appUrl);

await page.goto(appUrl);
await page.waitForLoadState('networkidle');

// Find and fill the URL input
const input = page.locator('input[placeholder*="TikTok"]');
await input.fill('https://www.tiktok.com/@twotravelingsmiles/video/7581810768757165320');
console.log('Entered TikTok URL');

// Click extract button
await page.click('button:has-text("→")');
console.log('Clicked extract...');

// Wait for navigation
try {
  await page.waitForURL(/\/template\//, { timeout: 60000 });
  console.log('On template page');

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/result.png', fullPage: true });
  console.log('Screenshot: /tmp/result.png');

  const text = await page.textContent('body');
  console.log('Has "Dreamiest":', text.includes('Dreamiest'));
  console.log('Has "Magical":', text.includes('Magical'));
} catch (e) {
  console.log('Error:', e.message);
  await page.screenshot({ path: '/tmp/error.png' });
}

console.log('Done. Closing in 30s...');
await page.waitForTimeout(30000);
await browser.close();
