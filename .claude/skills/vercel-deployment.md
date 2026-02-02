# Vercel Deployment Skill

## Overview
This skill ensures reliable Vercel deployments for the reel-template-extractor project.

## CRITICAL: GitHub Auto-Deploy May Not Work
The GitHub integration for this project sometimes doesn't trigger automatic deployments. **Always manually deploy after pushing code changes.**

## Deployment Workflow

### 1. After Making Code Changes
```bash
# Commit changes
git add .
git commit -m "your message"
git push origin main
```

### 2. ALWAYS Deploy Manually
```bash
# Deploy to production (from the project root)
cd /Users/jacquelineyeung/Template-maker/template-maker
npx vercel --prod
```

### 3. Verify Deployment
```bash
# Check deployment status
npx vercel ls

# Test the live site
curl -s "https://reel-template-extractor.vercel.app/" | grep -o 'v[0-9]\.[0-9]\.[0-9][a-z-]*' | head -1
```

## Version Tracking
Always include a version constant in `app/page.tsx`:
```typescript
const APP_VERSION = 'v2.0.X-description';
```

Display it in the UI to verify deployment:
```tsx
<span className="text-[9px] text-[var(--text-tertiary)]">{APP_VERSION}</span>
```

## Troubleshooting

### Deployment Not Showing Changes
1. **Manual deploy**: `npx vercel --prod`
2. **Check build logs**: `npx vercel logs <deployment-url>`
3. **Inspect deployment**: `npx vercel inspect <deployment-url>`

### Cache Issues
- Vercel caches aggressively
- Add cache-busting query params for testing: `?_=timestamp`
- Hard refresh browser: `Cmd+Shift+R`

### Git Submodule Issues
This repo has a broken submodule setup where `reel-template-extractor` is a gitlink. The actual app files are in the ROOT `app/` folder, NOT in `reel-template-extractor/app/`.

**Do NOT try to fix the submodule** - just deploy from the root.

## Project Configuration

### Vercel Project Details
- **Project Name**: reel-template-extractor
- **Production URL**: https://reel-template-extractor.vercel.app
- **Deploy From**: Root directory (/)
- **Framework**: Next.js 16.x

### Environment Variables (Vercel Dashboard)
- `ANTHROPIC_API_KEY` - Required for Claude Vision API

## Playwright Testing

### Quick Deployment Test
```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://reel-template-extractor.vercel.app/');
const hasVersion = await page.content().then(h => h.includes('v2.0'));
console.log('Deployed:', hasVersion);
await browser.close();
```

## When to Use This Skill
- After ANY code changes that need to be deployed
- When the live site doesn't reflect recent changes
- When debugging deployment issues
- Before telling the user "changes are deployed"
