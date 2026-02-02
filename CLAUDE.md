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
- Anthropic Claude API (Vision) for frame analysis
- Supabase (Auth + Storage + Database)
- FFmpeg.wasm for browser video processing
- IndexedDB for local video storage

### Storage Strategy (like CapCut)
**Templates:**
- Save to localStorage immediately
- If signed in → sync to Supabase `templates` table
- Templates persist forever with account

**Videos:**
- Save to IndexedDB immediately (fast, no upload wait)
- If signed in → background upload to Supabase Storage
- No account = local only (still works, just one device)

### Core Flow
```
URL Input → /api/extract → Template saved as draft → /template/[id] → Deep Analyze → Editor → Timeline → Preview → Export
```

### Video Editor Flow
```
Editor (upload clips) → Timeline (trim/crop) → Preview → Render with FFmpeg → Download MP4
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
- `app/editor/reel/[id]/page.tsx` - Main editor for filling template
- `app/timeline/reel/[id]/page.tsx` - Timeline editor with trim/text/audio tabs
- `app/preview/reel/[id]/page.tsx` - Final preview with export options
- `app/lib/videoFrameExtractor.ts` - Client-side frame extraction
- `app/lib/fontLibrary.ts` - Font persistence across sessions
- `app/lib/templateStorage.ts` - Template sync (localStorage + Supabase)
- `app/lib/videoStorage.ts` - Video storage (IndexedDB + Supabase Storage)
- `app/lib/ffmpegService.ts` - FFmpeg wrapper for trim, crop, text, concat
- `app/components/VideoTrimmer.tsx` - Trim UI with in/out handles
- `app/components/VideoCropper.tsx` - Crop/zoom UI

### Template Data Structure
Templates stored in localStorage as `template_<id>`:
- `videoInfo`: title, author, duration, thumbnail, videoUrl
- `locations[]`: locationId, locationName, textOverlay, timestamp
- `isDraft`: true until user saves
- `isEdit`: true when saved to My Edits
- `deepAnalyzed`: true after Claude Vision analysis

### Tab Logic
- **Templates**: `isDraft: false, isEdit: false` - freshly imported
- **Drafts**: `isDraft: true` - started editing
- **My Edits**: `isEdit: true` - saved from preview page

## Video Extraction

Prefer **yt-dlp** (installed locally) over third-party APIs when APIs fail.

See `.claude/skills/yt-dlp-video-extraction.md` for patterns.

## Code Rules

### Duration Formatting
- **ALWAYS format durations to 1 decimal place**
- Use `Number(duration.toFixed(1))` when displaying any duration
- Never show floating point errors like `2.200000000001s`
- Example: `{Number(scene.duration.toFixed(1))}s` → displays "2.2s"

## Export Formats

### Professional Editor Export
- **Final Cut Pro**: FCPXML v1.10 with gaps as placeholders
- **DaVinci Resolve**: FCPXML v1.9 (compatible format)
- **CapCut**: NOT SUPPORTED - closed ecosystem, no import API

### Rendered Video Export
- MP4 via FFmpeg.wasm (no audio - add music in TikTok later)

## Known Issues
- TikTok thumbnails show video TITLE text, not intro content
- Third-party APIs (TikWM, Cobalt) may be rate-limited or down
- CORS blocks direct TikTok CDN image fetches from browser
- CapCut has no import functionality - use Final Cut or DaVinci instead
