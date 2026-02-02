import { NextRequest, NextResponse } from 'next/server';

// Use OpenAI API
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
  textShadow?: string;
  hasEmoji: boolean;
  emoji?: string;
  emojiPosition?: 'before' | 'after' | 'both';
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
}

interface SceneInfo {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  textOverlay: string | null;
  textStyle?: TextStyle;
  description: string;
}

interface LocationGroup {
  locationId: number;
  locationName: string;
  scenes: SceneInfo[];
  totalDuration: number;
}

interface DetectedFont {
  name: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  weights: string[];
  suggestedFor: string; // e.g., "titles", "captions", "locations"
  source: string; // video URL or "manual"
}

interface VideoAnalysis {
  type: 'reel';
  totalDuration: number;
  locations: LocationGroup[];
  detectedFonts: DetectedFont[];
  music?: {
    name: string;
    hasMusic: boolean;
  };
}

// Font detection based on video style/content
function detectFontsForVideo(videoInfo: { title: string; author: string }, originalUrl: string): DetectedFont[] {
  const title = videoInfo.title.toLowerCase();
  const fonts: DetectedFont[] = [];

  // Analyze video style from title keywords
  const isTravel = /travel|trip|visit|explore|tour|city|country|places/i.test(title);
  const isFood = /food|cafe|coffee|restaurant|eat|drink|bar|brunch/i.test(title);
  const isLifestyle = /lifestyle|aesthetic|vlog|day in|routine/i.test(title);
  const isList = /top \d+|\d+ best|\d+ must|things to/i.test(title);
  const isMinimal = /minimal|clean|simple|modern/i.test(title);
  const isBold = /bold|epic|crazy|insane|best|ultimate/i.test(title);

  // Always include base fonts used in this template
  fonts.push({
    name: 'Poppins',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700'],
    suggestedFor: 'locations, captions',
    source: originalUrl,
  });

  fonts.push({
    name: 'Montserrat',
    category: 'sans-serif',
    weights: ['600', '700', '800', '900'],
    suggestedFor: 'titles, hooks',
    source: originalUrl,
  });

  fonts.push({
    name: 'Inter',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700'],
    suggestedFor: 'numbered lists, clean text',
    source: originalUrl,
  });

  // Add style-specific fonts
  if (isTravel) {
    fonts.push({
      name: 'Playfair Display',
      category: 'serif',
      weights: ['400', '500', '600', '700'],
      suggestedFor: 'elegant travel titles',
      source: originalUrl,
    });
  }

  if (isFood) {
    fonts.push({
      name: 'Outfit',
      category: 'sans-serif',
      weights: ['400', '500', '600', '700'],
      suggestedFor: 'food content, modern',
      source: originalUrl,
    });
    fonts.push({
      name: 'DM Sans',
      category: 'sans-serif',
      weights: ['400', '500', '600', '700'],
      suggestedFor: 'cafe aesthetic',
      source: originalUrl,
    });
  }

  if (isLifestyle || isMinimal) {
    fonts.push({
      name: 'Manrope',
      category: 'sans-serif',
      weights: ['400', '500', '600', '700', '800'],
      suggestedFor: 'minimal aesthetic',
      source: originalUrl,
    });
    fonts.push({
      name: 'Space Grotesk',
      category: 'sans-serif',
      weights: ['400', '500', '600', '700'],
      suggestedFor: 'modern minimal',
      source: originalUrl,
    });
  }

  if (isBold || isList) {
    fonts.push({
      name: 'Bebas Neue',
      category: 'display',
      weights: ['400'],
      suggestedFor: 'bold titles, impact',
      source: originalUrl,
    });
    fonts.push({
      name: 'Oswald',
      category: 'sans-serif',
      weights: ['400', '500', '600', '700'],
      suggestedFor: 'attention-grabbing',
      source: originalUrl,
    });
  }

  // Handwriting/script for personal feel
  if (isLifestyle || isTravel) {
    fonts.push({
      name: 'Caveat',
      category: 'handwriting',
      weights: ['400', '500', '600', '700'],
      suggestedFor: 'personal touch, annotations',
      source: originalUrl,
    });
  }

  return fonts;
}

// Common TikTok text styles
const TEXT_STYLES = {
  title: {
    fontFamily: 'Montserrat',
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
    hasEmoji: false,
    position: 'center' as const,
    alignment: 'center' as const,
  },
  locationLabel: {
    fontFamily: 'Poppins',
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.6)',
    hasEmoji: true,
    emoji: '📍',
    emojiPosition: 'before' as const,
    position: 'bottom' as const,
    alignment: 'left' as const,
  },
  numbered: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadow: '1px 1px 3px rgba(0,0,0,0.9)',
    hasEmoji: false,
    position: 'top' as const,
    alignment: 'left' as const,
  },
  cta: {
    fontFamily: 'Poppins',
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    hasEmoji: true,
    emoji: '👆',
    emojiPosition: 'after' as const,
    position: 'center' as const,
    alignment: 'center' as const,
  },
  hook: {
    fontFamily: 'Montserrat',
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadow: '2px 2px 6px rgba(0,0,0,0.9)',
    hasEmoji: true,
    emoji: '✨',
    emojiPosition: 'both' as const,
    position: 'center' as const,
    alignment: 'center' as const,
  },
};

// Map font style descriptions to actual Google Fonts
interface ExtractedFontStyle {
  style: string;
  weight: string;
  description: string;
}

interface MappedFonts {
  titleFont: string;
  bodyFont: string;
  accentFont: string;
  titleWeight: string;
  bodyWeight: string;
}

function mapExtractedFonts(
  extractedFonts: { titleFont?: ExtractedFontStyle; bodyFont?: ExtractedFontStyle; accentFont?: ExtractedFontStyle },
  visualStyle: string
): MappedFonts {
  // Font mapping based on style descriptions
  const scriptFonts = ['Pacifico', 'Dancing Script', 'Great Vibes', 'Satisfy', 'Sacramento', 'Tangerine', 'Alex Brush'];
  const serifFonts = ['Playfair Display', 'Lora', 'Merriweather', 'Cormorant Garamond', 'Libre Baskerville', 'Crimson Text'];
  const displayFonts = ['Bebas Neue', 'Oswald', 'Anton', 'Abril Fatface', 'Righteous', 'Russo One'];
  const sansFonts = ['Poppins', 'Montserrat', 'Inter', 'DM Sans', 'Space Grotesk', 'Outfit', 'Manrope'];
  const handwritingFonts = ['Caveat', 'Kalam', 'Shadows Into Light', 'Patrick Hand', 'Indie Flower'];

  // Helper to pick font based on style
  const pickFont = (style?: ExtractedFontStyle, category?: string): string => {
    if (!style) return 'Poppins';

    const styleDesc = (style.style + ' ' + (style.description || '')).toLowerCase();

    // Script/cursive fonts
    if (styleDesc.includes('script') || styleDesc.includes('cursive') || styleDesc.includes('elegant') || styleDesc.includes('handwritten')) {
      if (styleDesc.includes('elegant') || styleDesc.includes('formal')) {
        return scriptFonts[Math.floor(Math.random() * 3)]; // First 3 are more elegant
      }
      return scriptFonts[Math.floor(Math.random() * scriptFonts.length)];
    }

    // Serif fonts
    if (styleDesc.includes('serif') && !styleDesc.includes('sans')) {
      return serifFonts[Math.floor(Math.random() * serifFonts.length)];
    }

    // Display/decorative fonts
    if (styleDesc.includes('display') || styleDesc.includes('bold') || styleDesc.includes('impact')) {
      return displayFonts[Math.floor(Math.random() * displayFonts.length)];
    }

    // Handwriting
    if (styleDesc.includes('handwriting') || styleDesc.includes('casual')) {
      return handwritingFonts[Math.floor(Math.random() * handwritingFonts.length)];
    }

    // Default to sans-serif
    return sansFonts[Math.floor(Math.random() * sansFonts.length)];
  };

  // Map based on visual style if no fonts extracted
  let defaultTitleFont = 'Montserrat';
  let defaultBodyFont = 'Poppins';

  switch (visualStyle.toLowerCase()) {
    case 'elegant':
      defaultTitleFont = 'Playfair Display';
      defaultBodyFont = 'Lora';
      break;
    case 'bold':
      defaultTitleFont = 'Bebas Neue';
      defaultBodyFont = 'Oswald';
      break;
    case 'minimal':
      defaultTitleFont = 'Space Grotesk';
      defaultBodyFont = 'Inter';
      break;
    case 'playful':
      defaultTitleFont = 'Pacifico';
      defaultBodyFont = 'Caveat';
      break;
    case 'cinematic':
      defaultTitleFont = 'Cormorant Garamond';
      defaultBodyFont = 'Libre Baskerville';
      break;
    case 'vintage':
      defaultTitleFont = 'Abril Fatface';
      defaultBodyFont = 'Merriweather';
      break;
  }

  return {
    titleFont: extractedFonts.titleFont ? pickFont(extractedFonts.titleFont) : defaultTitleFont,
    bodyFont: extractedFonts.bodyFont ? pickFont(extractedFonts.bodyFont) : defaultBodyFont,
    accentFont: extractedFonts.accentFont ? pickFont(extractedFonts.accentFont) : defaultTitleFont,
    titleWeight: extractedFonts.titleFont?.weight === 'bold' ? '700' : '600',
    bodyWeight: extractedFonts.bodyFont?.weight === 'bold' ? '600' : '400',
  };
}

function getTextStyleForSceneWithFonts(
  locationId: number,
  sceneIndex: number,
  textOverlay: string | null,
  fonts: MappedFonts
): TextStyle {
  if (!textOverlay) {
    return {
      ...TEXT_STYLES.locationLabel,
      fontFamily: fonts.bodyFont,
    };
  }

  // Intro/hook text - use title font
  if (locationId === 0) {
    return {
      ...TEXT_STYLES.hook,
      fontFamily: fonts.titleFont,
      fontWeight: fonts.titleWeight,
    };
  }

  // Outro/CTA
  if (textOverlay.toLowerCase().includes('follow') || textOverlay.toLowerCase().includes('more')) {
    return {
      ...TEXT_STYLES.cta,
      fontFamily: fonts.bodyFont,
    };
  }

  // Numbered items (e.g., "1. Cafe Name") - use accent font
  if (/^\d+\./.test(textOverlay)) {
    return {
      ...TEXT_STYLES.numbered,
      fontFamily: fonts.accentFont,
      fontWeight: fonts.bodyWeight,
      hasEmoji: true,
      emoji: '📍',
      emojiPosition: 'before' as const,
    };
  }

  // Default location label
  return {
    ...TEXT_STYLES.locationLabel,
    fontFamily: fonts.bodyFont,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { url, platform } = await request.json();

    if (!url || !platform) {
      return NextResponse.json(
        { error: 'URL and platform are required' },
        { status: 400 }
      );
    }

    const videoInfo = await getTikTokVideoInfo(url);

    console.log('=== EXTRACTION START ===');
    console.log('Video info retrieved:', {
      title: videoInfo.title,
      author: videoInfo.author,
      duration: videoInfo.duration,
      hasThumbnail: !!videoInfo.thumbnail,
      thumbnailUrl: videoInfo.thumbnail?.substring(0, 80),
      hasVideoUrl: !!videoInfo.videoUrl,
    });

    const analysis = await analyzeVideoWithClaude(videoInfo, url);
    const detectedFonts = detectFontsForVideo(videoInfo, url);

    // Try to fetch and store thumbnail as base64 for later use
    let thumbnailBase64 = '';
    if (videoInfo.thumbnail) {
      console.log('Fetching thumbnail to store as base64...');
      try {
        // Try same fetch methods as analyzeVideoWithClaude
        const fetchMethods = [
          async () => fetch(videoInfo.thumbnail, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Referer': 'https://www.tiktok.com/',
            },
          }),
          async () => fetch(`https://wsrv.nl/?url=${encodeURIComponent(videoInfo.thumbnail)}&w=720&output=jpg`),
          async () => fetch(`https://images.weserv.nl/?url=${encodeURIComponent(videoInfo.thumbnail)}&w=720&output=jpg`),
        ];

        for (const fetchMethod of fetchMethods) {
          try {
            const response = await fetchMethod();
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              if (buffer.byteLength > 1000) {
                thumbnailBase64 = Buffer.from(buffer).toString('base64');
                console.log('Thumbnail stored as base64, size:', thumbnailBase64.length);
                break;
              }
            }
          } catch (e) {
            // Try next method
          }
        }
      } catch (e) {
        console.log('Failed to store thumbnail as base64:', e);
      }
    }

    const templateId = generateTemplateId();
    const template = {
      id: templateId,
      platform,
      originalUrl: url,
      videoInfo: {
        title: videoInfo.title,
        author: videoInfo.author,
        duration: videoInfo.duration,
        thumbnail: videoInfo.thumbnail,
        thumbnailBase64: thumbnailBase64 || undefined, // Store base64 for later use
        videoUrl: videoInfo.videoUrl,
      },
      ...analysis,
      detectedFonts,
      createdAt: new Date().toISOString(),
      needsSceneDetection: true,
    };

    global.templates = global.templates || {};
    global.templates[templateId] = template;

    return NextResponse.json({
      templateId,
      template,
    });
  } catch (error) {
    console.error('Extract error:', error);
    return NextResponse.json(
      { error: `Failed to extract template: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

async function getTikTokVideoInfo(url: string): Promise<{
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  videoUrl: string;
  allCovers?: string[];
}> {
  // Extract video ID and username from URL
  const videoIdMatch = url.match(/video\/(\d+)/);
  const videoId = videoIdMatch ? videoIdMatch[1] : '';
  const usernameMatch = url.match(/@([^/]+)/);
  const username = usernameMatch ? usernameMatch[1] : 'creator';

  console.log(`Extracting video: ID=${videoId}, user=@${username}`);

  // Method 1: Try TikWM API first
  try {
    console.log('Method 1: Trying TikWM API...');
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('TikWM response code:', data.code, 'msg:', data.msg);

      if (data.code === 0 && data.data) {
        const videoData = data.data;
        console.log('TikWM API success!');
        console.log('Available images:', {
          cover: !!videoData.cover,
          origin_cover: !!videoData.origin_cover,
          dynamic_cover: !!videoData.dynamic_cover,
          ai_dynamic_cover: !!videoData.ai_dynamic_cover,
        });

        const allCovers: string[] = [];
        if (videoData.origin_cover) allCovers.push(videoData.origin_cover);
        if (videoData.cover) allCovers.push(videoData.cover);
        if (videoData.dynamic_cover) allCovers.push(videoData.dynamic_cover);
        if (videoData.ai_dynamic_cover) allCovers.push(videoData.ai_dynamic_cover);

        return {
          title: videoData.title || 'TikTok Video',
          author: videoData.author?.nickname || videoData.author?.unique_id || username,
          duration: videoData.duration || 30,
          thumbnail: videoData.origin_cover || videoData.cover || '',
          videoUrl: videoData.play || videoData.hdplay || '',
          allCovers,
        };
      } else {
        console.log('TikWM returned error code:', data.code, data.msg);
      }
    }
  } catch (error) {
    console.log('TikWM API failed:', error instanceof Error ? error.message : error);
  }

  // Method 1b: Try TikWM with POST method (sometimes works better)
  try {
    console.log('Method 1b: Trying TikWM POST...');
    const response = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: `url=${encodeURIComponent(url)}&hd=1`,
    });

    if (response.ok) {
      const data = await response.json();
      console.log('TikWM POST response code:', data.code);

      if (data.code === 0 && data.data) {
        const videoData = data.data;
        console.log('TikWM POST success!');

        return {
          title: videoData.title || 'TikTok Video',
          author: videoData.author?.nickname || videoData.author?.unique_id || username,
          duration: videoData.duration || 30,
          thumbnail: videoData.origin_cover || videoData.cover || '',
          videoUrl: videoData.play || videoData.hdplay || '',
          allCovers: [videoData.origin_cover, videoData.cover].filter(Boolean),
        };
      }
    }
  } catch (error) {
    console.log('TikWM POST failed:', error instanceof Error ? error.message : error);
  }

  // Method 2: Try cobalt.tools API (yt-dlp wrapper)
  try {
    console.log('Method 2: Trying cobalt.tools API (yt-dlp based)...');
    const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        vQuality: '720',
        filenamePattern: 'basic',
        isNoTTWatermark: true,
      }),
    });

    if (cobaltResponse.ok) {
      const cobaltData = await cobaltResponse.json();
      console.log('Cobalt response:', JSON.stringify(cobaltData).substring(0, 200));

      if (cobaltData.status === 'stream' || cobaltData.status === 'redirect') {
        // Cobalt gives us a direct video URL, but we need metadata
        // We can try to get the thumbnail from the video URL
        const videoUrl = cobaltData.url || '';

        // Extract video ID from URL for potential thumbnail
        const videoId = videoIdMatch ? videoIdMatch[1] : '';

        // Use username from URL - reuse already declared variables
        const usernameFromUrl = usernameMatch ? usernameMatch[1] : 'Creator';

        console.log('Cobalt API success! Video URL obtained.');
        return {
          title: `Video by @${usernameFromUrl}`,
          author: usernameFromUrl,
          duration: 30,
          thumbnail: '', // Cobalt doesn't provide thumbnail directly
          videoUrl: videoUrl,
        };
      }
    }
  } catch (error) {
    console.log('Cobalt API failed:', error instanceof Error ? error.message : error);
  }

  // Method 3: Try SSSTik API
  try {
    console.log('Method 3: Trying SSSTik API...');
    const ssstikResponse = await fetch(`https://ssstik.io/abc?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (ssstikResponse.ok) {
      const html = await ssstikResponse.text();
      // Try to extract video info from response
      const titleMatch = html.match(/<p class="maintext">([^<]+)<\/p>/);
      const authorMatch = html.match(/@(\w+)/);

      if (titleMatch) {
        console.log('SSSTik API success!');
        return {
          title: titleMatch[1] || 'TikTok Video',
          author: authorMatch ? authorMatch[1] : 'Creator',
          duration: 30,
          thumbnail: '',
          videoUrl: '',
        };
      }
    }
  } catch (error) {
    console.log('SSSTik API failed:', error instanceof Error ? error.message : error);
  }

  // Fallback: Create a basic template from URL parsing
  console.log('All APIs failed, using URL-based fallback for:', url);

  // Create a generic template (reuse already extracted username)
  return {
    title: 'TikTok Video Template',
    author: username,
    duration: 30, // Default duration
    thumbnail: '',
    videoUrl: '',
  };
}

// Extract frames from video at specific timestamps
async function extractVideoFrames(videoUrl: string, duration: number, numFrames: number = 6): Promise<string[]> {
  const frames: string[] = [];

  if (!videoUrl) {
    console.log('No video URL provided for frame extraction');
    return frames;
  }

  console.log('Attempting to extract frames from video:', videoUrl.substring(0, 60));

  // Use a screenshot service to capture frames at different timestamps
  // We'll use urlbox.io's free tier or similar
  const timestamps = [];
  const interval = Math.max(1, Math.floor(duration / numFrames));

  for (let i = 1; i < numFrames; i++) {
    timestamps.push(i * interval);
  }

  console.log('Target timestamps:', timestamps);

  // Try using wsrv.nl to get frames from video (it supports video thumbnails)
  for (const timestamp of timestamps) {
    try {
      // wsrv.nl can extract frames from videos using the 'page' parameter
      const frameUrl = `https://wsrv.nl/?url=${encodeURIComponent(videoUrl)}&output=jpg&w=720&page=${timestamp}`;

      const response = await fetch(frameUrl, { method: 'HEAD' });
      if (response.ok) {
        // Fetch the actual image
        const imgResponse = await fetch(frameUrl);
        if (imgResponse.ok) {
          const buffer = await imgResponse.arrayBuffer();
          if (buffer.byteLength > 5000) { // Valid image
            const base64 = Buffer.from(buffer).toString('base64');
            frames.push(base64);
            console.log(`Frame at ${timestamp}s extracted, size: ${buffer.byteLength}`);
          }
        }
      }
    } catch (e) {
      console.log(`Failed to extract frame at ${timestamp}s:`, e);
    }

    // Limit to avoid rate limiting
    if (frames.length >= 4) break;
  }

  console.log(`Extracted ${frames.length} frames from video`);
  return frames;
}

async function analyzeVideoWithClaude(
  videoInfo: { title: string; author: string; duration: number; thumbnail: string; videoUrl: string; allCovers?: string[] },
  originalUrl: string
): Promise<VideoAnalysis> {
  try {
    // Extract destination from title for context
    const destinationMatch = videoInfo.title.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s*[-–—]|\s*[!?.]|\s*#|\s*$)/i);
    const destination = destinationMatch ? destinationMatch[1].trim() : '';

    // Count expected locations from title
    const countMatch = videoInfo.title.match(/(\d+)\s*(must|best|top|places|things|spots|cafe|restaurant|unique)/i);
    const expectedCount = countMatch ? parseInt(countMatch[1]) : 5;

    const prompt = `You are analyzing a TikTok video. I'm showing you the thumbnail AND frames from throughout the video.

YOUR TASK: Read ALL TEXT OVERLAYS visible in EACH image. The location names appear as text overlays throughout the video frames.

Duration: ${videoInfo.duration} seconds
Expected locations: ${expectedCount}

FOR EACH IMAGE, READ:
1. Any intro/hook text (like "3 Day Trips To Do From Da Nang")
2. Location names that appear as text overlays (like "Hoi An", "Ba Na Hills", "Marble Mountains")
3. Numbered items (1., 2., 3., etc.)
4. Any captions or labels

IMPORTANT: The ACTUAL location names are shown as TEXT OVERLAYS in the video frames. Read them EXACTLY as written. Do NOT guess or use generic tourist spots.

Return ONLY this JSON (fill in what you ACTUALLY READ from the images):

{
  "type": "reel",
  "totalDuration": ${videoInfo.duration},
  "extractedText": {
    "hookText": "COPY THE EXACT BIG TEXT YOU SEE IN THE IMAGE",
    "visibleLocations": ["location names you can read"]
  },
  "extractedFonts": {
    "titleFont": { "style": "script|sans-serif|display", "weight": "bold", "description": "what the title font looks like" }
  },
  "visualStyle": "elegant|bold|minimal|playful",
  "locations": [
    {
      "locationId": 0,
      "locationName": "Intro",
      "scenes": [{ "id": 1, "startTime": 0, "endTime": 2, "duration": 2, "textOverlay": "THE BIG TEXT FROM THE IMAGE", "description": "Hook" }],
      "totalDuration": 2
    },
    {
      "locationId": 1,
      "locationName": "First location name",
      "scenes": [{ "id": 11, "startTime": 2, "endTime": 5, "duration": 3, "textOverlay": "1. Name", "description": "Shot" }],
      "totalDuration": 3
    }
  ],
  "music": { "name": "Sound", "hasMusic": true }
}

Create ${expectedCount} locations plus Intro and Outro.`;

    let analysisResult: VideoAnalysis;

    console.log('Calling Claude Vision API to analyze video thumbnail for:', destination || 'unknown destination');

    // Build message content with thumbnail for vision analysis
    type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    type ImageContent = { type: 'image'; source: { type: 'base64'; media_type: AllowedMediaType; data: string } };
    type TextContent = { type: 'text'; text: string };
    const messageContent: Array<TextContent | ImageContent> = [];

    // Try to fetch and convert thumbnail to base64 for Claude vision
    let hasImage = false;

    // Build list of image URLs to try (all covers + thumbnail)
    const imageUrls: string[] = [];

    // Add all available covers from TikTok (origin_cover, cover, dynamic_cover, etc.)
    if (videoInfo.allCovers && videoInfo.allCovers.length > 0) {
      for (const coverUrl of videoInfo.allCovers) {
        if (coverUrl && coverUrl.startsWith('http') && !imageUrls.includes(coverUrl)) {
          imageUrls.push(coverUrl);
        }
      }
      console.log(`Found ${imageUrls.length} cover images to analyze`);
    }

    // Fallback to thumbnail if no covers
    if (imageUrls.length === 0 && videoInfo.thumbnail && videoInfo.thumbnail.startsWith('http')) {
      imageUrls.push(videoInfo.thumbnail);
    }

    // Try fetching images from multiple sources
    for (const imageUrl of imageUrls) {
      if (hasImage) break;

      // Try multiple methods to fetch the thumbnail
      const fetchMethods = [
        // Method 1: Direct fetch with browser-like headers
        async () => {
          console.log('Fetch Method 1: Direct fetch with browser headers');
          return fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.tiktok.com/',
              'Sec-Fetch-Dest': 'image',
              'Sec-Fetch-Mode': 'no-cors',
              'Sec-Fetch-Site': 'cross-site',
            },
          });
        },
        // Method 2: Use a CORS proxy (allorigins)
        async () => {
          console.log('Fetch Method 2: Using allorigins proxy');
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`;
          return fetch(proxyUrl);
        },
        // Method 3: Use corsproxy.io
        async () => {
          console.log('Fetch Method 3: Using corsproxy.io');
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
          return fetch(proxyUrl);
        },
        // Method 4: Use images.weserv.nl (image proxy that handles many sources)
        async () => {
          console.log('Fetch Method 4: Using weserv.nl image proxy');
          const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&w=720&output=jpg`;
          return fetch(proxyUrl);
        },
        // Method 5: Use wsrv.nl (alternative weserv)
        async () => {
          console.log('Fetch Method 5: Using wsrv.nl image proxy');
          const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=720&output=jpg`;
          return fetch(proxyUrl);
        },
      ];

      for (const fetchMethod of fetchMethods) {
        try {
          console.log('Trying to fetch thumbnail...');
          const imageResponse = await fetchMethod();

          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();

            // Skip if response is too small (likely an error page)
            if (imageBuffer.byteLength < 1000) {
              console.log('Response too small, likely not an image:', imageBuffer.byteLength);
              continue;
            }

            const base64Image = Buffer.from(imageBuffer).toString('base64');
            const rawContentType = imageResponse.headers.get('content-type') || 'image/jpeg';

            // Map to allowed media types
            let mediaType: AllowedMediaType = 'image/jpeg';
            if (rawContentType.includes('png')) mediaType = 'image/png';
            else if (rawContentType.includes('gif')) mediaType = 'image/gif';
            else if (rawContentType.includes('webp')) mediaType = 'image/webp';

            console.log('Thumbnail fetched successfully! Size:', imageBuffer.byteLength, 'Type:', mediaType);

            messageContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            });
            hasImage = true;
            break; // Success, exit the loop
          } else {
            console.log('Fetch failed:', imageResponse.status, imageResponse.statusText);
          }
        } catch (imgError) {
          console.log('Fetch method failed:', imgError instanceof Error ? imgError.message : imgError);
        }
      }
    } // End of imageUrls loop

    if (!hasImage) {
      console.log('All thumbnail fetch methods failed for all URLs');
    }

    // Try to extract additional frames from the video itself
    // This helps capture text overlays that appear throughout the video
    if (videoInfo.videoUrl) {
      console.log('Attempting to extract frames from video for better text detection...');
      const videoFrames = await extractVideoFrames(videoInfo.videoUrl, videoInfo.duration || 30);

      for (let i = 0; i < videoFrames.length; i++) {
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: videoFrames[i],
          },
        });
        messageContent.push({
          type: 'text',
          text: `[Frame ${i + 1} from video - READ ALL TEXT OVERLAYS visible here]`,
        });
        hasImage = true;
      }

      if (videoFrames.length > 0) {
        console.log(`Added ${videoFrames.length} video frames to analysis`);
      }
    }

    if (!hasImage) {
      console.log('No image available, using text-only prompt');
      messageContent.push({
        type: 'text',
        text: prompt,
      });
    } else {
      // Add OCR instruction
      messageContent.push({
        type: 'text',
        text: prompt,
      });
    }

    console.log('Sending request to OpenAI API...');
    console.log('API Key present:', !!OPENAI_API_KEY);

    // Convert message content to OpenAI format
    const openAIContent = messageContent.map(item => {
      if (item.type === 'text') {
        return { type: 'text', text: item.text };
      } else if (item.type === 'image') {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${item.source.media_type};base64,${item.source.data}`
          }
        };
      }
      return item;
    });

    const openAIResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: openAIContent
        }]
      })
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json().catch(() => ({}));
      console.error('OpenAI API error:', openAIResponse.status, JSON.stringify(errorData));
      throw new Error(`OpenAI API error: ${openAIResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const openAIData = await openAIResponse.json();
    console.log('GPT-4o response received');
    const responseText = openAIData.choices?.[0]?.message?.content || '';
    console.log('Claude response text (first 1000 chars):', responseText.substring(0, 1000));

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('JSON match found, parsing...');
      analysisResult = JSON.parse(jsonMatch[0]);

      // Log extracted info for debugging
      console.log('=== CLAUDE VISION SUCCESS ===');
      console.log('Extracted TEXT from thumbnail:', (analysisResult as any).extractedText);
      console.log('Extracted locations from Claude:', analysisResult.locations?.map((l: LocationGroup) => l.locationName));
      console.log('Intro text overlay:', analysisResult.locations?.[0]?.scenes?.[0]?.textOverlay);
      console.log('Extracted fonts from Claude:', (analysisResult as any).extractedFonts);
      console.log('Visual style:', (analysisResult as any).visualStyle);

      // Map extracted font styles to actual Google Fonts
      const extractedFontStyles = (analysisResult as any).extractedFonts || {};
      const visualStyle = (analysisResult as any).visualStyle || 'modern';

      const mappedFonts = mapExtractedFonts(extractedFontStyles, visualStyle);
      console.log('Mapped fonts:', mappedFonts);

      // Add text styles and calculate location durations
      // Keep whatever Claude extracted from the images
      analysisResult.locations = analysisResult.locations.map((loc, locIdx) => ({
        ...loc,
        totalDuration: loc.scenes.reduce((sum, scene) => sum + scene.duration, 0),
        scenes: loc.scenes.map((scene, sceneIdx) => ({
          ...scene,
          textStyle: getTextStyleForSceneWithFonts(loc.locationId, sceneIdx, scene.textOverlay, mappedFonts)
        }))
      }));

      // Add detected fonts for use in template
      analysisResult.detectedFonts = [];
      (analysisResult as any).extractedFontStyles = extractedFontStyles;
      (analysisResult as any).mappedFonts = mappedFonts;

      console.log('Claude analysis successful:', analysisResult.locations.length, 'locations');
      // Mark that we used actual thumbnail extraction
      (analysisResult as any).extractionMethod = 'claude-vision';
      return analysisResult;
    }

    console.log('No JSON match found in response, full response:', responseText);
    throw new Error('Could not parse Claude response');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Claude analysis FAILED:', errorMessage);
    console.error('Full error:', error);

    // Check if it's an API key issue
    if (errorMessage.includes('api_key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
      console.error('ANTHROPIC_API_KEY may not be set correctly on Vercel!');
    }

    console.log('=== FALLING BACK TO DATABASE (Claude failed) ===');
    console.log('Reason: Claude Vision could not analyze the thumbnail');
    console.log('Using title-based extraction instead of actual thumbnail text');
    return createFallbackAnalysis(videoInfo);
  }
}

function getTextStyleForScene(locationId: number, sceneIndex: number, textOverlay: string | null): TextStyle {
  if (!textOverlay) {
    return TEXT_STYLES.locationLabel;
  }

  // Intro/hook text
  if (locationId === 0) {
    return TEXT_STYLES.hook;
  }

  // Outro/CTA
  if (textOverlay.toLowerCase().includes('follow') || textOverlay.toLowerCase().includes('more')) {
    return TEXT_STYLES.cta;
  }

  // Numbered items (e.g., "1. Cafe Name")
  if (/^\d+\./.test(textOverlay)) {
    return {
      ...TEXT_STYLES.numbered,
      hasEmoji: true,
      emoji: '📍',
      emojiPosition: 'before' as const,
    };
  }

  // Default location label
  return TEXT_STYLES.locationLabel;
}

function createFallbackAnalysis(videoInfo: { title: string; duration: number }): VideoAnalysis {
  const title = videoInfo.title;
  const titleLower = title.toLowerCase();
  const duration = videoInfo.duration || 30;

  // Detect visual style from title keywords for font selection
  let visualStyle = 'modern';
  if (/dream|dreamy|magical|fairy|fantasy/i.test(title)) visualStyle = 'elegant';
  else if (/bold|epic|crazy|insane|best|ultimate|top/i.test(title)) visualStyle = 'bold';
  else if (/minimal|clean|simple|aesthetic/i.test(title)) visualStyle = 'minimal';
  else if (/fun|cute|yummy|adorable/i.test(title)) visualStyle = 'playful';
  else if (/cinematic|film|movie/i.test(title)) visualStyle = 'cinematic';
  else if (/vintage|retro|classic/i.test(title)) visualStyle = 'vintage';
  else if (/travel|explore|wanderlust/i.test(title)) visualStyle = 'elegant';

  // Get mapped fonts based on detected style
  const mappedFonts = mapExtractedFonts({}, visualStyle);
  console.log('Fallback visual style:', visualStyle, 'Mapped fonts:', mappedFonts);

  // Extract destination from title
  const destinationMatch = title.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s*[-–—]|\s*[!?.]|\s*#|\s*$)/i);
  const destination = destinationMatch ? destinationMatch[1].trim() : '';

  // Don't use hardcoded places - they're misleading
  // Instead, create placeholder locations that user must fill in
  console.log('Using placeholder locations - video text extraction failed');
  const placesForDest: string[] = [];

  // Extract numbered items from title (e.g., "1. Cafe Name 2. Another Place")
  const numberedItems: string[] = [];
  const numberedPattern = /(\d+)\.\s*([^0-9]+?)(?=\d+\.|#|$)/g;
  let match;
  while ((match = numberedPattern.exec(title)) !== null) {
    const itemName = match[2].trim().replace(/\s+/g, ' ');
    if (itemName.length > 2 && itemName.length < 100) {
      numberedItems.push(itemName);
    }
  }

  // Detect emojis in title
  const emojiMatch = title.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu);
  const detectedEmoji = emojiMatch?.[0] || '📍';

  // Parse number from title like "8 must-visit places" or "Top 10 cafes"
  const numberMatch = titleLower.match(/(\d+)\s*(must|best|top|places|things|spots|cafe|restaurant|food|unique)/i);
  const itemCount = numberedItems.length > 0 ? numberedItems.length : (numberMatch ? parseInt(numberMatch[1]) : 5);

  // Calculate time distribution - ALWAYS fit all locations
  const introTime = Math.min(2, duration * 0.1); // 10% or 2s max for intro
  const outroTime = Math.min(2, duration * 0.1); // 10% or 2s max for outro
  const contentTime = Math.max(duration - introTime - outroTime, duration * 0.8); // At least 80% for content

  // Calculate time per item - must fit ALL items
  const timePerItem = Math.max(1, contentTime / itemCount); // At least 1s per item

  const locations: LocationGroup[] = [];
  let currentTime = 0;

  // Intro with hook style - user will fill in their own intro text
  const actualIntroTime = Math.max(1, Math.round(introTime));
  locations.push({
    locationId: 0,
    locationName: 'Intro',
    scenes: [{
      id: 1,
      startTime: 0,
      endTime: actualIntroTime,
      duration: actualIntroTime,
      textOverlay: null, // User will add their own intro text
      textStyle: {
        ...TEXT_STYLES.hook,
        fontFamily: mappedFonts.titleFont,
        fontWeight: mappedFonts.titleWeight,
        emoji: detectedEmoji,
      },
      description: 'Hook shot - add your intro text'
    }],
    totalDuration: actualIntroTime
  });
  currentTime = actualIntroTime;

  // Content items - ALWAYS create all items
  for (let i = 1; i <= itemCount; i++) {
    const sceneStart = currentTime;
    // Round to 1 decimal for cleaner display
    const sceneDuration = Math.max(1, Math.round(timePerItem * 10) / 10);

    // Priority: numbered items from title > destination places > generic
    const itemName = numberedItems[i - 1] || placesForDest[i - 1] || `Location ${i}`;
    const displayName = itemName.length > 40 ? itemName.slice(0, 40) + '...' : itemName;

    // For very short videos, just one scene per location
    if (sceneDuration < 2) {
      locations.push({
        locationId: i,
        locationName: displayName,
        scenes: [
          {
            id: i * 10 + 1,
            startTime: sceneStart,
            endTime: sceneStart + sceneDuration,
            duration: sceneDuration,
            textOverlay: `${i}. ${displayName}`,
            textStyle: {
              ...TEXT_STYLES.numbered,
              fontFamily: mappedFonts.accentFont,
              fontWeight: mappedFonts.bodyWeight,
              hasEmoji: true,
              emoji: detectedEmoji,
              emojiPosition: 'before' as const,
            },
            description: `Shot of ${displayName}`
          }
        ],
        totalDuration: sceneDuration
      });
    } else {
      // For longer scenes, split into multiple shots
      const shot1Duration = Math.max(1, Math.round(sceneDuration * 0.5));
      const shot2Duration = Math.max(1, sceneDuration - shot1Duration);

      locations.push({
        locationId: i,
        locationName: displayName,
        scenes: [
          {
            id: i * 10 + 1,
            startTime: sceneStart,
            endTime: sceneStart + shot1Duration,
            duration: shot1Duration,
            textOverlay: `${i}. ${displayName}`,
            textStyle: {
              ...TEXT_STYLES.numbered,
              fontFamily: mappedFonts.accentFont,
              fontWeight: mappedFonts.bodyWeight,
              hasEmoji: true,
              emoji: detectedEmoji,
              emojiPosition: 'before' as const,
            },
            description: `Establishing shot of ${displayName}`
          },
          {
            id: i * 10 + 2,
            startTime: sceneStart + shot1Duration,
            endTime: sceneStart + sceneDuration,
            duration: shot2Duration,
            textOverlay: null,
            textStyle: {
              ...TEXT_STYLES.locationLabel,
              fontFamily: mappedFonts.bodyFont,
            },
            description: 'Detail or reaction shot'
          }
        ],
        totalDuration: sceneDuration
      });
    }
    currentTime += sceneDuration;
  }

  // Outro with CTA style - use remaining time
  const actualLocationCount = locations.length; // includes intro
  const remainingTime = Math.max(1, duration - currentTime);

  locations.push({
    locationId: actualLocationCount, // Sequential ID after all locations
    locationName: 'Outro',
    scenes: [{
      id: 999,
      startTime: currentTime,
      endTime: currentTime + remainingTime,
      duration: remainingTime,
      textOverlay: 'Follow for more! 👆',
      textStyle: {
        ...TEXT_STYLES.cta,
        fontFamily: mappedFonts.bodyFont,
      },
      description: 'Call to action - wave, point at follow button'
    }],
    totalDuration: remainingTime
  });

  return {
    type: 'reel',
    totalDuration: duration,
    locations,
    detectedFonts: [], // Will be added by caller
    visualStyle,
    mappedFonts,
    extractionMethod: 'fallback-database', // Claude Vision failed, using title-based extraction
    music: {
      name: 'Trending Sound',
      hasMusic: true
    },
  } as VideoAnalysis;
}

function generateTemplateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

declare global {
  var templates: Record<string, any> | undefined;
}
