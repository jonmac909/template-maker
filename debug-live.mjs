import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

console.log('Opening live site...');
await page.goto('https://reel-template-extractor.vercel.app/');
await page.waitForLoadState('networkidle');

// Check for version number
const headerText = await page.locator('h1').first().textContent();
console.log('Header text:', headerText);

// Look for version badge
const versionBadge = await page.locator('text=v2.0').count();
console.log('Version badge found:', versionBadge > 0);

// Check localStorage
const templates = await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('template_'));
  return keys.map(k => {
    const data = JSON.parse(localStorage.getItem(k));
    return {
      key: k,
      title: data.videoInfo?.title || 'NO TITLE',
      isDraft: data.isDraft,
      isEdit: data.isEdit,
      locationsCount: data.locations?.length || 0,
    };
  });
});

console.log('\n=== LOCALSTORAGE TEMPLATES ===');
templates.forEach(t => {
  console.log(`- ${t.key}: "${t.title}" | isDraft=${t.isDraft} | locations=${t.locationsCount}`);
});

// Take screenshot
await page.screenshot({ path: '/tmp/debug-live.png', fullPage: true });
console.log('\nScreenshot saved to /tmp/debug-live.png');

// Check which tab is active
const activeTab = await page.locator('button.bg-white').textContent();
console.log('Active tab:', activeTab);

console.log('\nKeeping browser open for 60s...');
await page.waitForTimeout(60000);
await browser.close();
