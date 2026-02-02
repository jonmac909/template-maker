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
async function fetchThumbnailFromUrl(url: string): Promise<string | null> {
  try {
    console.log('Fetching thumbnail from URL:', url.substring(0, 80));
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!response.ok) {
      console.error('Thumbnail fetch failed:', response.status);
      return null;
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    console.log('Thumbnail fetched successfully, size:', base64.length);
    return base64;
  } catch (error) {
    console.error('Failed to fetch thumbnail:', error);
    return null;
  }
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
    const prompt = `You are analyzing images from a TikTok video.${hasThumbnail ? ' THE FIRST IMAGE IS THE THUMBNAIL - this shows the video title card with the hook text.' : ''}

VIDEO INFO:
- Author: @${videoInfo.author}
- Duration: ${videoInfo.duration} seconds
- Expected locations: approximately ${expectedLocations}

🔴 CRITICAL - YOUR #1 TASK - READ THE HOOK TEXT:
${hasThumbnail ? 'The THUMBNAIL (first image) shows the TITLE CARD.' : 'The first frames show the TITLE CARD.'}
Look for the BIG TEXT on the image. This is the video's hook/title.

Examples of what to look for:
- "10 Dreamiest Places in Northern Thailand"
- "5 Must-Visit Cafes in Bangkok"
- "Top 10 Hidden Gems in Bali"

⚠️ READ THE TEXT CHARACTER BY CHARACTER. Copy it EXACTLY as it appears.

WHAT TO EXTRACT:

1. HOOK TEXT (from ${hasThumbnail ? 'thumbnail' : 'first frames'}) - MOST IMPORTANT:
   - The big stylized text on the title card
   - Copy every word exactly
   - Include numbers ("10", "5", etc.)
   - Include destination name

2. LOCATION NAMES (from middle frames):
   - Read exact location names
   - Note if numbered (1., 2., 3.)

3. FONT STYLES:
   - Describe what the title font looks like

Respond with ONLY valid JSON:

{
  "extractedText": {
    "hookText": "COPY THE EXACT BIG TEXT FROM THE ${hasThumbnail ? 'THUMBNAIL' : 'FIRST FRAMES'} HERE",
    "locationNames": ["location names you see"],
    "outroText": "CTA text or null"
  },
  "extractedFonts": {
    "titleFont": {
      "style": "script|serif|sans-serif|display",
      "weight": "normal|bold",
      "description": "describe the title font"
    },
    "locationFont": {
      "style": "script|serif|sans-serif|display",
      "weight": "normal|bold",
      "description": "describe location text font"
    }
  },
  "visualStyle": {
    "overall": "elegant|bold|minimal|playful|cinematic|vintage|modern",
    "colors": ["#hex1", "#hex2"],
    "textPosition": "top|center|bottom"
  },
  "locations": [
    {
      "locationId": 0,
      "locationName": "Intro",
      "textOverlay": "THE EXACT HOOK TEXT YOU READ FROM THE IMAGE",
      "timestamp": 0
    },
    {
      "locationId": 1,
      "locationName": "location name",
      "textOverlay": "1. location name",
      "timestamp": 2
    }
  ]
}

🔴 REMEMBER: The hookText and locations[0].textOverlay MUST be the actual text you READ from the image. DO NOT make up or paraphrase the text.`;

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
