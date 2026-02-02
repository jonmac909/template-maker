import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    // Method 1: Direct fetch with TikTok-like headers
    async () => {
      console.log('Method 1: Direct fetch from:', url.substring(0, 60));
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });
      if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
      return response;
    },
    // Method 2: weserv.nl proxy
    async () => {
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg&w=720`;
      console.log('Method 2: wsrv.nl proxy');
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`wsrv.nl failed: ${response.status}`);
      return response;
    },
    // Method 3: images.weserv.nl proxy
    async () => {
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&w=720`;
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
      // Skip too-small responses (error pages)
      if (buffer.byteLength < 1000) {
        console.log('Response too small, likely not an image:', buffer.byteLength);
        continue;
      }
      const base64 = Buffer.from(buffer).toString('base64');
      console.log('Thumbnail fetched successfully, size:', base64.length);
      return base64;
    } catch (error) {
      console.log('Fetch method failed:', error instanceof Error ? error.message : error);
    }
  }

  console.error('All thumbnail fetch methods failed for URL:', url.substring(0, 60));
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { thumbnailBase64: providedBase64, thumbnailUrl, frames, videoInfo, expectedLocations = 5 } = body;

    console.log('=== ANALYZE-FRAMES REQUEST ===');
    console.log('Has providedBase64:', !!providedBase64, providedBase64 ? `(${providedBase64.length} chars)` : '');
    console.log('Has thumbnailUrl:', !!thumbnailUrl, thumbnailUrl ? thumbnailUrl.substring(0, 60) : '');
    console.log('Frames count:', frames?.length || 0);

    // Try to get thumbnail: prefer base64 if provided, otherwise fetch from URL
    let thumbnailBase64 = providedBase64;
    if (!thumbnailBase64 && thumbnailUrl) {
      console.log('No base64 provided, attempting to fetch from URL...');
      thumbnailBase64 = await fetchThumbnailFromUrl(thumbnailUrl) || undefined;
      if (thumbnailBase64) {
        console.log('Successfully fetched thumbnail from URL');
      } else {
        console.log('Failed to fetch thumbnail from URL');
      }
    }

    // We need either thumbnail or frames
    if ((!frames || frames.length === 0) && !thumbnailBase64) {
      console.log('ERROR: No thumbnail or frames available');
      return NextResponse.json({
        error: 'Could not load thumbnail. Try re-extracting the template to get a fresh copy.'
      }, { status: 400 });
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
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

    // Provide more specific error messages
    let userMessage = errorMessage;
    if (errorMessage.includes('api_key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
      userMessage = 'API key error - please check server configuration';
    } else if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      userMessage = 'Too many requests - please wait a moment and try again';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      userMessage = 'Request timed out - please try again';
    }

    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
