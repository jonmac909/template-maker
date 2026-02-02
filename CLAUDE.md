# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL RULES

### NO DEV SERVER - EVER
- **NEVER run `npm run dev` or `next dev`**
- **NEVER use localhost for testing**
- All testing happens on production Vercel deployment ONLY
- Deploy via GitHub push (Vercel auto-deploys from main branch)
- URL: https://template-maker-one.vercel.app

### User Instructions Are Commands
- When user says "stop" → STOP immediately
- Do not continue building/coding after being told to stop
- Ask before making changes, don't assume what's "helpful"

## Commands

```bash
# Deploy (only way to test)
git add . && git commit -m "message" && git push

# Manual deploy if needed
npx vercel --prod

# Use yt-dlp for video extraction (installed locally)
yt-dlp --dump-json "https://www.tiktok.com/@user/video/123"
yt-dlp -o "%(id)s.%(ext)s" "https://www.tiktok.com/@user/video/123"

# Test API extraction manually
curl "https://www.tikwm.com/api/?url=<encoded-url>"
```

## Architecture

### Tech Stack
- Next.js 16.1.6 with App Router
- Tailwind CSS v4
- Anthropic Claude API (Vision) for frame analysis
- localStorage for template persistence

### Core Flow
```
URL Input → /api/extract → Template saved as draft → /template/[id] → Deep Analyze → Editor
```

### Key APIs
- `/api/extract` - Extracts template from TikTok/IG URL
  - Tries TikWM API first, then Cobalt API, then fallbacks
  - Returns: videoInfo, locations, thumbnail
- `/api/analyze-frames` - Deep analysis with Claude Vision
  - Server fetches thumbnail URL (avoids CORS)
  - Extracts text overlays, fonts, visual style

### Key Files
- `app/api/extract/route.ts` - Main extraction with fallback chain
- `app/api/analyze-frames/route.ts` - Claude Vision analysis
- `app/template/[id]/page.tsx` - Template preview + deep analyze trigger
- `app/lib/videoFrameExtractor.ts` - Client-side frame extraction
- `app/lib/fontLibrary.ts` - Font persistence across sessions

### Template Data Structure
Templates stored in localStorage as `template_<id>`:
- `videoInfo`: title, author, duration, thumbnail, videoUrl
- `locations[]`: locationId, locationName, textOverlay, timestamp
- `isDraft`: true until user saves
- `deepAnalyzed`: true after Claude Vision analysis

## Video Extraction

Prefer **yt-dlp** (installed locally) over third-party APIs when APIs fail.

See `.claude/skills/yt-dlp-video-extraction.md` for patterns.

## Code Rules

### Duration Formatting
- **ALWAYS format durations to 1 decimal place**
- Use `Number(duration.toFixed(1))` when displaying any duration
- Never show floating point errors like `2.200000000001s`
- Example: `{Number(scene.duration.toFixed(1))}s` → displays "2.2s"

## Known Issues
- TikTok thumbnails show video TITLE text, not intro content
- Third-party APIs (TikWM, Cobalt) may be rate-limited or down
- CORS blocks direct TikTok CDN image fetches from browser
