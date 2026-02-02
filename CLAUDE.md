# Project: Reel Template Extractor

## ⚠️ CRITICAL: NO DEV SERVER - EVER
- **NEVER run `npm run dev` or `next dev`**
- **NEVER use localhost for testing**
- **DO NOT start any local development servers**
- All testing happens on production Vercel deployment ONLY

## Deployment
- Deploy via **GitHub push** (Vercel auto-deploys from main branch)
- Vercel project: `template-maker` → https://template-maker-one.vercel.app
- To test changes: commit → push to GitHub → wait for Vercel deployment
- Use `npx vercel --prod` for manual deploys if needed

## Tech Stack
- Next.js 16.1.6 with App Router
- Tailwind CSS v4
- Anthropic Claude API for video analysis
- localStorage for template persistence

## Key APIs
- `/api/extract` - Extract template from TikTok/IG URL (uses TikWM + Claude Vision)
- `/api/analyze-frames` - Deep analyze video frames with Claude Vision

## Important Notes
- Deep analysis runs automatically when template loads (no manual button)
- Templates auto-save after deep analysis completes
- Frame extraction captures at 0.1s and 0.5s to catch intro/title text
