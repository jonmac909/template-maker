# yt-dlp Video Extraction Skill

## Overview
This skill provides patterns for extracting video information, frames, and metadata from TikTok/Instagram using yt-dlp and related services.

## Architecture Options

### Option 1: Cobalt API (yt-dlp wrapper) - RECOMMENDED for Vercel
Cobalt.tools is a hosted yt-dlp service that works from serverless environments.

```typescript
// Get video URL via Cobalt API
const response = await fetch('https://api.cobalt.tools/api/json', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: tiktokUrl,
    vQuality: '720',
    filenamePattern: 'basic',
    isNoTTWatermark: true,
  }),
});

const data = await response.json();
// data.url = direct video URL
// data.status = 'stream' | 'redirect' | 'error'
```

### Option 2: TikWM API - Best for Metadata
TikWM provides rich metadata including multiple cover images.

```typescript
const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
const data = await response.json();

// Available fields:
// data.data.title - Video title
// data.data.author.nickname - Creator name
// data.data.duration - Duration in seconds
// data.data.cover - Static thumbnail
// data.data.origin_cover - Original cover (often higher quality)
// data.data.dynamic_cover - Animated cover (GIF-like)
// data.data.ai_dynamic_cover - AI-generated dynamic cover
// data.data.play - Video URL without watermark
// data.data.hdplay - HD video URL
// data.data.music - Background music info
```

### Option 3: Local yt-dlp (for backend servers)
If running on a server with shell access:

```bash
# Install yt-dlp
pip install yt-dlp

# Get video info as JSON
yt-dlp --dump-json "https://www.tiktok.com/@user/video/123"

# Download video
yt-dlp -o "%(id)s.%(ext)s" "https://www.tiktok.com/@user/video/123"

# Extract frames at specific timestamps
ffmpeg -i video.mp4 -vf "select='eq(n,0)+eq(n,30)+eq(n,60)'" -vsync vfr frame_%d.jpg
```

## Frame Extraction Strategies

### Strategy 1: Use All TikTok Covers
TikTok provides multiple cover images that often show different frames:

```typescript
const allCovers: string[] = [];
if (videoData.origin_cover) allCovers.push(videoData.origin_cover);
if (videoData.cover) allCovers.push(videoData.cover);
if (videoData.dynamic_cover) allCovers.push(videoData.dynamic_cover);
if (videoData.ai_dynamic_cover) allCovers.push(videoData.ai_dynamic_cover);
```

### Strategy 2: Client-Side Frame Extraction
Extract frames from video in the browser:

```typescript
async function extractFramesFromVideo(videoUrl: string, timestamps: number[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const frames: string[] = [];
    let currentIndex = 0;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = timestamps[0];
    };

    video.onseeked = () => {
      ctx.drawImage(video, 0, 0);
      frames.push(canvas.toDataURL('image/jpeg', 0.8));
      currentIndex++;

      if (currentIndex < timestamps.length) {
        video.currentTime = timestamps[currentIndex];
      } else {
        resolve(frames);
      }
    };

    video.onerror = reject;
  });
}

// Usage: Extract frames at 0s, 2s, 4s, etc.
const frames = await extractFramesFromVideo(videoUrl, [0, 2, 4, 6, 8]);
```

### Strategy 3: Video Frame API Services
Use external services that can extract frames:

```typescript
// Example: Using a hypothetical frame extraction API
const frames = await fetch('https://api.frameextractor.com/extract', {
  method: 'POST',
  body: JSON.stringify({
    videoUrl: 'https://...',
    timestamps: [0, 2, 4, 6, 8],
    format: 'base64'
  })
});
```

## Image Proxy Services
TikTok CDN often blocks direct requests. Use these proxies:

```typescript
const proxyMethods = [
  // weserv.nl - Image proxy with caching
  (url) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=720&output=jpg`,

  // wsrv.nl - Alternative weserv
  (url) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=720&output=jpg`,

  // allorigins - CORS proxy
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,

  // corsproxy.io
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];
```

## Claude Vision Analysis Pattern
Send extracted frames/covers to Claude for analysis:

```typescript
const messageContent = [];

// Add multiple images for better analysis
for (const frame of frames) {
  messageContent.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: frame.replace(/^data:image\/\w+;base64,/, '')
    }
  });
}

messageContent.push({
  type: 'text',
  text: `Analyze these video frames. Extract:
1. EXACT text overlays visible on each frame
2. Font styles (script, serif, sans-serif, display)
3. Location names
4. Visual style (colors, aesthetic)`
});

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  messages: [{ role: 'user', content: messageContent }]
});
```

## Fallback Chain Pattern
Always implement fallbacks:

```typescript
async function getVideoInfo(url: string) {
  // Try TikWM first (best metadata)
  try {
    const tikwm = await fetchTikWM(url);
    if (tikwm) return tikwm;
  } catch (e) { console.log('TikWM failed'); }

  // Try Cobalt (yt-dlp based)
  try {
    const cobalt = await fetchCobalt(url);
    if (cobalt) return cobalt;
  } catch (e) { console.log('Cobalt failed'); }

  // Try SSSTik
  try {
    const ssstik = await fetchSSSTik(url);
    if (ssstik) return ssstik;
  } catch (e) { console.log('SSSTik failed'); }

  // Fallback to URL parsing
  return parseUrlFallback(url);
}
```

## Key Files in This Project
- `/app/api/extract/route.ts` - Main extraction API
- `/app/lib/fontLibrary.ts` - Font detection and mapping

## Common Issues & Solutions

### CORS Blocking
TikTok CDN blocks cross-origin requests. Use image proxies (weserv.nl, wsrv.nl).

### Rate Limiting
APIs may rate limit. Implement exponential backoff and caching.

### Dynamic Covers
TikTok's `dynamic_cover` is often a GIF/WebP animation. May need to extract first frame.

### Video URL Expiration
Video URLs from TikTok expire. Don't cache them long-term.

## Testing Commands

```bash
# Test TikWM API
curl "https://www.tikwm.com/api/?url=https://www.tiktok.com/@user/video/123"

# Test Cobalt API
curl -X POST https://api.cobalt.tools/api/json \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.tiktok.com/@user/video/123"}'
```
