import { chromium } from 'playwright';

async function checkTemplate() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://template-maker-one.vercel.app');
  await page.waitForTimeout(2000);

  // Get all templates from localStorage
  const templates = await page.evaluate(() => {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('template_')) {
        const data = JSON.parse(localStorage.getItem(key));
        results.push({
          id: data.id,
          title: data.videoInfo?.title,
          thumbnail: data.videoInfo?.thumbnail?.substring(0, 80) || '(empty)',
          videoUrl: data.videoInfo?.videoUrl?.substring(0, 80) || '(empty)',
          deepAnalyzed: data.deepAnalyzed,
        });
      }
    }
    return results;
  });

  console.log('Templates in localStorage:');
  templates.forEach(t => {
    console.log(`\n${t.id}:`);
    console.log(`  Title: ${t.title}`);
    console.log(`  Thumbnail: ${t.thumbnail}`);
    console.log(`  VideoUrl: ${t.videoUrl}`);
    console.log(`  DeepAnalyzed: ${t.deepAnalyzed}`);
  });

  await browser.close();
}

checkTemplate().catch(console.error);
