# Instructions for Claude Code: Video Frame Analysis with LLaVA + RunPod

## Context

This template-maker app extracts "templates" from TikTok/Instagram reels (text overlays, timing, positions) so users can apply the same style to their own videos.

Currently using Claude Vision API to analyze video frames. We want to switch to **Jon's existing LLaVA setup on RunPod** which is 98% cheaper.

## Jon's Existing Code (COPY FROM HERE)

The working implementation lives in Jon's history-gen-ai project. You should **copy and adapt** these files:

### 1. RunPod Vision Client
**Source:** `/Users/jonmac/hermione/history-gen-ai/render-api/src/lib/opensource-vision-client.ts`

This is a complete client that:
- Submits batches of frames to a RunPod endpoint running LLaVA-NeXT-Video
- Polls for job completion
- Returns text descriptions for each frame
- Supports base64 encoding (faster) or URL mode

Key function:
```typescript
generateDescriptions(frameUrls: string[], options?)
// Returns: { descriptions: string[], failedIndices: number[], count: number }
```

### 2. Required Environment Variables
```
RUNPOD_API_KEY=<ask Jon>
RUNPOD_VISION_ENDPOINT_ID=<ask Jon>
```

### 3. How Jon's Template Extractor Works
**Source:** `/Users/jonmac/hermione/history-gen-ai/render-api/src/lib/template-extractor.ts`

Flow:
1. Download video → extract frames with ffmpeg
2. Send frames to LLaVA (via RunPod) → get text descriptions
3. Parse descriptions to find: text overlays, positions, timing, fonts, colors
4. Calculate pacing from scene detection
5. Return structured template data

## What to Change in Template-Maker

### Current (Claude Vision)
`/Users/jonmac/hermione/template-maker/app/api/extract-template/route.ts`

### New Approach
1. Copy `opensource-vision-client.ts` to `lib/opensource-vision-client.ts`
2. In extract-template route, replace Claude Vision calls with:
   ```typescript
   import { generateDescriptions } from '@/lib/opensource-vision-client';
   
   const { descriptions } = await generateDescriptions(frameUrls, {
     batchSize: 10,
     onProgress: (percent) => console.log(`Vision: ${percent}%`)
   });
   ```
3. Parse the LLaVA descriptions to extract template structure

## LLaVA vs Claude Vision Output

LLaVA returns natural language descriptions. You'll need to prompt it correctly and parse the response. Jon's worker expects frames and returns descriptions like:

> "The frame shows white bold text saying 'BREAKING NEWS' centered at the top of the screen. The background is dark blue. Text appears to have a slight drop shadow."

Your job is to:
1. Send frames to LLaVA
2. Parse these descriptions to extract: text content, position, color, font style, timing
3. Build the template structure the app expects

## Don't Break the Existing Flow

The app flow is:
1. Home page → paste URL or upload video
2. `/template/[id]` → shows template breakdown
3. `/editor/reel/[id]` → user uploads their videos
4. `/preview/reel/[id]` → final preview

**DO NOT** create new pages. Work within the existing structure.

## Questions to Ask Jon

1. What are the RunPod API credentials?
2. Is the LLaVA endpoint still active/deployed?
3. Any specific prompt format that works best for extracting text overlay info?

---

Written by Hermione. I'm not allowed to code this myself because I keep breaking things. 😅
