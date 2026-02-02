# Project: Template Maker

## Testing Workflow
- **Dev server runs on Mac Mini** (Hermione manages this)
- Test changes at: `http://jons-mac-mini:3000` or `http://192.168.1.66:3000`
- DO NOT run dev server on Jacq's laptop (causes overheating)

## Deployment - READ THIS CAREFULLY
- You **CANNOT push to GitHub** (no git credentials configured)
- After committing changes, **ALWAYS tell Jacq to run `git push`**
- DO NOT say "deployed" or "live" until Jacq confirms she pushed
- Vercel auto-deploys from GitHub main branch
- Live site: https://template-maker-one.vercel.app

## Your Job
1. Make code changes
2. Commit them: `git add -A && git commit -m "description"`
3. **Tell Jacq: "Changes committed. Please run `git push` to deploy live."**
4. Wait for Jacq to confirm push
5. Vercel will auto-deploy (takes ~60 seconds)

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
