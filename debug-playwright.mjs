import { chromium } from 'playwright';

const TIKTOK_URL = 'https://www.tiktok.com/@lostcreektravel/video/7407085039734584618';
const APP_URL = 'https://template-maker-one.vercel.app';

async function debugExtraction() {
  const browser = await chromium.launch({ headless: false }); // Show browser
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    }
  });

  // Intercept network requests to see API calls
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`\n[API REQUEST] ${request.method()} ${request.url()}`);
      if (request.postData()) {
        const data = JSON.parse(request.postData());
        console.log('  - Has thumbnailBase64:', !!data.thumbnailBase64);
        console.log('  - Frames count:', data.frames?.length || 0);
        console.log('  - Video title:', data.videoInfo?.title);
      }
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/analyze-frames')) {
      console.log(`\n[API RESPONSE] ${response.status()} ${response.url()}`);
      try {
        const json = await response.json();
        console.log('  - Success:', json.success);
        console.log('  - Had thumbnail:', json.hadThumbnail);
        console.log('  - Frames analyzed:', json.framesAnalyzed);
        if (json.analysis) {
          console.log('  - Hook text:', json.analysis.extractedText?.hookText);
          console.log('  - Locations[0] textOverlay:', json.analysis.locations?.[0]?.textOverlay);
          console.log('  - Location names:', json.analysis.locations?.map(l => l.locationName));
        }
        if (json.error) {
          console.log('  - ERROR:', json.error);
        }
      } catch (e) {
        console.log('  - Could not parse response');
      }
    }
  });

  try {
    console.log('\n=== STEP 1: Go to app ===');
    await page.goto(APP_URL);
    await page.waitForTimeout(2000);

    console.log('\n=== STEP 2: Enter TikTok URL ===');
    await page.fill('input[type="text"]', TIKTOK_URL);

    console.log('\n=== STEP 3: Click Extract (arrow button) ===');
    // The button has an arrow → character
    await page.click('button:has-text("→")');

    console.log('\n=== STEP 4: Wait for extraction (30s max) ===');
    await page.waitForURL(/\/template\//, { timeout: 60000 });
    console.log('Navigated to template page:', page.url());

    console.log('\n=== STEP 5: Wait for deep analysis ===');
    // Wait for analysis to complete (status message should disappear or show complete)
    await page.waitForTimeout(30000); // Give it 30 seconds for analysis

    console.log('\n=== STEP 6: Check localStorage for template data ===');
    const templateData = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('template_'));
      if (keys.length > 0) {
        return JSON.parse(localStorage.getItem(keys[0]));
      }
      return null;
    });

    if (templateData) {
      console.log('\nTemplate data from localStorage:');
      console.log('  - ID:', templateData.id);
      console.log('  - Deep analyzed:', templateData.deepAnalyzed);
      console.log('  - Intro location:', templateData.locations?.[0]?.locationName);
      console.log('  - Intro textOverlay:', templateData.locations?.[0]?.scenes?.[0]?.textOverlay);
      console.log('  - All locations:', templateData.locations?.map(l => ({
        name: l.locationName,
        textOverlay: l.scenes?.[0]?.textOverlay
      })));
    } else {
      console.log('No template data found in localStorage');
    }

    // Take screenshot
    await page.screenshot({ path: 'debug-screenshot.png' });
    console.log('\nScreenshot saved to debug-screenshot.png');

    // Keep browser open for inspection
    console.log('\n=== Browser staying open for 60 seconds for inspection ===');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'debug-error.png' });
  } finally {
    await browser.close();
  }
}

debugExtraction().catch(console.error);
