import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Bypass cache
await page.goto('https://reel-template-extractor.vercel.app/?nocache=' + Date.now(), { 
  waitUntil: 'networkidle' 
});

// Check for version in HTML
const html = await page.content();
const hasVersion = html.includes('v2.0.2');
console.log('Has version v2.0.2 in HTML:', hasVersion);

// Check page text
const bodyText = await page.locator('body').textContent();
const versionMatch = bodyText.match(/v\d+\.\d+\.\d+/);
console.log('Version found in text:', versionMatch ? versionMatch[0] : 'NONE');

await browser.close();
