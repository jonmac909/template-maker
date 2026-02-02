import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

const TIKTOK_URL = 'https://www.tiktok.com/@lostcreektravel/video/7407085039734584618';

async function scrapeTikTokFrame() {
  console.log('=== Starting TikTok scraper ===');

  // Use non-headless with a real browser profile
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('1. Going to TikTok video...');
    await page.goto(TIKTOK_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for page to load
    console.log('2. Waiting for page...');
    await page.waitForTimeout(3000);

    // Try to click "Not now" on the app popup if it appears
    try {
      const notNowBtn = page.locator('text=Not now');
      if (await notNowBtn.isVisible({ timeout: 3000 })) {
        await notNowBtn.click();
        console.log('   Dismissed app popup');
      }
    } catch (e) {
      console.log('   No app popup found');
    }

    // Wait for video container
    console.log('3. Looking for video...');
    await page.waitForTimeout(3000);

    // Try to pause video by clicking it
    try {
      const videoEl = page.locator('video').first();
      if (await videoEl.isVisible({ timeout: 5000 })) {
        await videoEl.click();
        console.log('   Clicked video');
      }
    } catch (e) {
      console.log('   Video not found');
    }

    await page.waitForTimeout(2000);

    // Take screenshot
    console.log('3. Taking screenshot...');
    const screenshot = await page.screenshot({
      path: 'tiktok-frame.png',
      type: 'png'
    });
    console.log('   Screenshot saved to tiktok-frame.png');

    // Convert to base64
    const base64 = screenshot.toString('base64');
    console.log(`   Base64 size: ${base64.length} characters`);

    // Now send to Claude for OCR
    console.log('\n4. Sending to Claude Vision for OCR...');

    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `This is a screenshot of a TikTok video's title card/intro frame.

READ THE TEXT ON THIS IMAGE CHARACTER BY CHARACTER.

I need you to extract:
1. The HOOK TEXT - the main title/headline visible (like "10 Dreamiest Places in Northern Thailand")
2. The font style description

Return ONLY this JSON:
{
  "hookText": "THE EXACT TEXT YOU SEE - read every word",
  "fontStyle": {
    "family": "script|serif|sans-serif|display",
    "weight": "normal|bold|extra-bold",
    "color": "#hex color",
    "effect": "shadow|outline|glow|none",
    "description": "brief description of the font appearance"
  }
}

IMPORTANT: Copy the EXACT text. Don't paraphrase.`
          }
        ]
      }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('\nClaude response:', responseText);

    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log('\n=== EXTRACTED DATA ===');
      console.log('Hook text:', result.hookText);
      console.log('Font style:', JSON.stringify(result.fontStyle, null, 2));

      // Save result
      fs.writeFileSync('extracted-text.json', JSON.stringify(result, null, 2));
      console.log('\nSaved to extracted-text.json');
    }

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'tiktok-error.png' });
  } finally {
    await browser.close();
  }
}

scrapeTikTokFrame().catch(console.error);
