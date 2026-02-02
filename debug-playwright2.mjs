import { chromium } from 'playwright';

const TIKTOK_URL = 'https://www.tiktok.com/@lostcreektravel/video/7407085039734584618';
const APP_URL = 'https://template-maker-one.vercel.app';

async function debugExtraction() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable ALL console logging
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
  });

  // Intercept ALL API responses
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      console.log(`\n[API RESPONSE] ${response.status()} ${response.url()}`);
      try {
        const json = await response.json();
        console.log('  Response:', JSON.stringify(json, null, 2).substring(0, 2000));
      } catch (e) {
        // Not JSON
      }
    }
  });

  try {
    console.log('\n=== STEP 1: Go to app ===');
    await page.goto(APP_URL);
    await page.waitForTimeout(2000);

    console.log('\n=== STEP 2: Enter TikTok URL ===');
    await page.fill('input[type="text"]', TIKTOK_URL);

    console.log('\n=== STEP 3: Click Extract ===');
    await page.click('button:has-text("→")');

    console.log('\n=== STEP 4: Wait for navigation to template page ===');
    await page.waitForURL(/\/template\//, { timeout: 60000 });
    console.log('Navigated to:', page.url());

    console.log('\n=== STEP 5: Check template data immediately ===');
    let templateData = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('template_'));
      if (keys.length > 0) {
        const data = JSON.parse(localStorage.getItem(keys[keys.length - 1]));
        return {
          id: data.id,
          videoUrl: data.videoInfo?.videoUrl,
          thumbnail: data.videoInfo?.thumbnail,
          deepAnalyzed: data.deepAnalyzed,
          title: data.videoInfo?.title,
        };
      }
      return null;
    });
    console.log('Initial template data:', JSON.stringify(templateData, null, 2));

    console.log('\n=== STEP 6: Wait 45 seconds for deep analysis ===');
    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(1000);
      // Check for analyze-frames request
      const currentStatus = await page.evaluate(() => {
        const statusEl = document.querySelector('[class*="text-sm"][class*="text-"]');
        return statusEl?.textContent || null;
      });
      if (currentStatus) {
        console.log(`  Status at ${i}s: ${currentStatus}`);
      }
    }

    console.log('\n=== STEP 7: Check final template data ===');
    templateData = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('template_'));
      if (keys.length > 0) {
        const data = JSON.parse(localStorage.getItem(keys[keys.length - 1]));
        return {
          id: data.id,
          videoUrl: data.videoInfo?.videoUrl?.substring(0, 80),
          thumbnail: data.videoInfo?.thumbnail?.substring(0, 80),
          deepAnalyzed: data.deepAnalyzed,
          title: data.videoInfo?.title,
          introTextOverlay: data.locations?.[0]?.scenes?.[0]?.textOverlay,
        };
      }
      return null;
    });
    console.log('Final template data:', JSON.stringify(templateData, null, 2));

    await page.screenshot({ path: 'debug-screenshot2.png' });
    console.log('\nScreenshot saved to debug-screenshot2.png');

    console.log('\n=== Keeping browser open 30s ===');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'debug-error2.png' });
  } finally {
    await browser.close();
  }
}

debugExtraction().catch(console.error);
