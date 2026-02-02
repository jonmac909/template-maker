import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface FrameData {
  timestamp: number;
  base64: string;
}

interface AnalysisRequest {
  frames: FrameData[];
  videoInfo: {
    title: string;
    author: string;
    duration: number;
  };
  expectedLocations?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { frames, videoInfo, expectedLocations = 5 } = body;

    if (!frames || frames.length === 0) {
      return NextResponse.json({ error: 'No frames provided' }, { status: 400 });
    }

    console.log(`Analyzing ${frames.length} frames for video by @${videoInfo.author}`);

    // Build message content with all frames
    type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    type ImageContent = { type: 'image'; source: { type: 'base64'; media_type: AllowedMediaType; data: string } };
    type TextContent = { type: 'text'; text: string };
    const messageContent: Array<TextContent | ImageContent> = [];

    // Add each frame as an image
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

    // Add analysis prompt
    const prompt = `You are analyzing ${frames.length} frames extracted from a TikTok video. The FIRST TWO FRAMES are from the intro/title card.

VIDEO INFO:
- Author: @${videoInfo.author}
- Duration: ${videoInfo.duration} seconds
- Expected locations: approximately ${expectedLocations}

CRITICAL - EXTRACTING THE INTRO/HOOK TEXT:
The FIRST TWO FRAMES (at 0.1s and 0.5s) show the INTRO/TITLE CARD.
Look for the BIG TEXT - this is usually something like:
- "10 Dreamiest Places in Northern Thailand"
- "5 Must-Visit Cafes in Bangkok"
- "Top 10 Hidden Gems"

This text is the HOOK - the main title of the video. READ IT EXACTLY as it appears.

ANALYZE EACH FRAME AND EXTRACT:

1. INTRO/TITLE CARD (FIRST TWO FRAMES - THIS IS THE MOST IMPORTANT):
   - Read the EXACT BIG TEXT overlaid on the video
   - This is usually in large, stylized font
   - Examples: "10 Dreamiest Places in Northern Thailand", "Best Cafes in Tokyo"
   - Copy it EXACTLY including emojis if any

2. LOCATION FRAMES (middle frames):
   - Read EXACT location names (e.g., "📍 The Blue Temple", "1. Cafe Name")
   - Note if names are numbered (1., 2., 3.)

3. FONTS & STYLING:
   - Describe the title font style

4. OUTRO FRAME (last frame):
   - Any call-to-action text

Respond with ONLY valid JSON:

{
  "extractedText": {
    "hookText": "THE EXACT BIG TEXT FROM THE FIRST FRAMES - this is critical!",
    "locationNames": ["location names in order"],
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
      "textOverlay": "THE EXACT HOOK TEXT FROM FRAME 1 or 2",
      "timestamp": 0
    },
    {
      "locationId": 1,
      "locationName": "location name",
      "textOverlay": "1. location name or null",
      "timestamp": 2
    }
  ]
}

IMPORTANT: The hookText and locations[0].textOverlay MUST be the actual text you see in the first frames. Do not make it up.`;

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
      framesAnalyzed: frames.length,
    });
  } catch (error) {
    console.error('Frame analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
