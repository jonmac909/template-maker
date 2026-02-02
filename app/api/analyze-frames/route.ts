import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface FrameData {
  timestamp: number;
  base64: string;
}

interface AnalysisRequest {
  thumbnailBase64?: string; // Thumbnail as base64 (if client could fetch it)
  thumbnailUrl?: string; // Thumbnail URL - server will fetch it (avoids CORS)
  frames: FrameData[];
  videoInfo: {
    title: string;
    author: string;
    duration: number;
  };
  expectedLocations?: number;
}

// Helper to fetch thumbnail from URL (server-side, no CORS issues)
// Uses image proxy services as fallback since TikTok URLs expire
async function fetchThumbnailFromUrl(url: string): Promise<string | null> {
  const methods = [
    // Method 1: Direct fetch
    async () => {
      console.log('Method 1: Direct fetch from:', url.substring(0, 60));
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
      return response;
    },
    // Method 2: weserv.nl proxy
    async () => {
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg`;
      console.log('Method 2: wsrv.nl proxy');
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`wsrv.nl failed: ${response.status}`);
      return response;
    },
    // Method 3: images.weserv.nl proxy
    async () => {
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg`;
      console.log('Method 3: images.weserv.nl proxy');
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`images.weserv.nl failed: ${response.status}`);
      return response;
    },
  ];

  for (const method of methods) {
    try {
      const response = await method();
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      console.log('Thumbnail fetched successfully, size:', base64.length);
      return base64;
    } catch (error) {
      console.log('Fetch method failed:', error instanceof Error ? error.message : error);
    }
  }

  console.error('All thumbnail fetch methods failed');
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { thumbnailBase64: providedBase64, thumbnailUrl, frames, videoInfo, expectedLocations = 5 } = body;

    // Try to get thumbnail: prefer base64 if provided, otherwise fetch from URL
    let thumbnailBase64 = providedBase64;
    if (!thumbnailBase64 && thumbnailUrl) {
      thumbnailBase64 = await fetchThumbnailFromUrl(thumbnailUrl) || undefined;
    }

    // We need either thumbnail or frames
    if ((!frames || frames.length === 0) && !thumbnailBase64) {
      return NextResponse.json({ error: 'No frames or thumbnail provided' }, { status: 400 });
    }

    const hasThumbnail = !!thumbnailBase64;
    const totalImages = (hasThumbnail ? 1 : 0) + (frames?.length || 0);
    console.log(`Analyzing ${totalImages} images for video by @${videoInfo.author} (thumbnail: ${hasThumbnail})`);

    // Build message content with thumbnail FIRST (most important!)
    type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    type ImageContent = { type: 'image'; source: { type: 'base64'; media_type: AllowedMediaType; data: string } };
    type TextContent = { type: 'text'; text: string };
    const messageContent: Array<TextContent | ImageContent> = [];

    // ⭐ ADD THUMBNAIL FIRST - This is the key fix!
    // The thumbnail usually shows the title card with the hook text
    if (thumbnailBase64) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: thumbnailBase64,
        },
      });
      messageContent.push({
        type: 'text',
        text: `[THUMBNAIL - THIS IS THE MOST IMPORTANT IMAGE! Read ALL text visible here, especially the big title/hook text]`,
      });
    }

    // Add each frame as an image
    if (frames && frames.length > 0) {
      for (const frame of frames) {
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: frame.base64,
          },
        });
        messageContent.push({
          type: 'text',
          text: `[Frame at ${frame.timestamp}s]`,
        });
      }
    }

    // Add analysis prompt - emphasize thumbnail OCR
    const prompt = `YOU ARE AN OCR SYSTEM. Your task is to READ TEXT from the image(s) provided.

🔴 CRITICAL: DO NOT use any external knowledge. DO NOT guess. ONLY report what you can LITERALLY SEE written in the image.

THE IMAGE SHOWS: A TikTok video thumbnail with TEXT OVERLAID on it.

YOUR TASK:
1. Look at the image carefully
2. Find ALL text visible in the image
3. Read each word EXACTLY as written
4. Note the FONT STYLE of each text element

WHAT TEXT TO LOOK FOR:
- Large title/hook text (usually in the center or top)
- Numbers like "10", "5", "Top 10"
- Location names like "Northern Thailand", "Bali", "Bangkok"
- The text may be in MULTIPLE FONTS (e.g., script + serif)

FONT IDENTIFICATION:
- script = curly/handwriting style (like "Dreamiest")
- serif = traditional with decorative strokes (like "NORTHERN THAILAND" in caps)
- sans-serif = clean modern letters
- display = bold decorative

Respond with ONLY this JSON:

{
  "extractedText": {
    "hookText": "THE EXACT TEXT YOU READ FROM THE IMAGE - WORD FOR WORD",
    "locationNames": [],
    "outroText": null
  },
  "extractedFonts": {
    "titleFont": {
      "style": "script|serif|sans-serif|display",
      "weight": "normal|bold",
      "description": "what the main title font looks like"
    },
    "locationFont": {
      "style": "script|serif|sans-serif|display",
      "weight": "normal|bold",
      "description": "what the location/subtitle font looks like"
    }
  },
  "visualStyle": {
    "overall": "elegant|bold|minimal|playful|cinematic|vintage|modern",
    "colors": ["primary color hex", "secondary color hex"],
    "textPosition": "top|center|bottom"
  },
  "locations": [
    {
      "locationId": 0,
      "locationName": "Intro",
      "textOverlay": "COPY EXACT TEXT FROM IMAGE HERE",
      "timestamp": 0
    }
  ]
}

🔴 IMPORTANT:
- hookText MUST be the ACTUAL words visible in the image
- If the image shows "10 Dreamiest Places NORTHERN THAILAND", write EXACTLY that
- Do NOT paraphrase or change the wording
- Include line breaks if the text is on multiple lines`;

    messageContent.push({ type: 'text', text: prompt });

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: messageContent }],
    });

    // Extract JSON from response
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    console.log('Claude response:', responseText.substring(0, 500));

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      analysis,
      framesAnalyzed: totalImages,
      hadThumbnail: hasThumbnail,
    });
  } catch (error) {
    console.error('Frame analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
