# Project: Reel Template Extractor

## Deployment
- **NEVER use dev server for testing**
- Deploy via **GitHub push** (Vercel auto-deploys from main branch)
- To test changes: commit, push to GitHub, wait for Vercel deployment

## Tech Stack
- Next.js 16.1.6 with App Router
- Tailwind CSS v4
- Anthropic Claude API for video analysis
- localStorage for template persistence

## Key APIs
- `/api/extract` - Extract template from TikTok/IG URL (uses TikWM + Claude Vision)
- `/api/analyze-frames` - Deep analyze video frames with Claude Vision

## Important Notes
- TikTok thumbnails show video TITLE, not actual intro text
- Intro textOverlay is forced to null - users fill in manually or use Deep Analyze
- Templates saved as drafts until user clicks "Save Template"
