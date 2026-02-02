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
    const prompt = `You are analyzing ${frames.length} frames extracted from a TikTok video.

VIDEO INFO:
- Author: @${videoInfo.author}
- Duration: ${videoInfo.duration} seconds
- Expected locations: approximately ${expectedLocations}

ANALYZE EACH FRAME AND EXTRACT:

1. INTRO FRAME (usually first frame):
   - Read the EXACT hook/title text (e.g., "10 Dreamiest Places in Northern Thailand")
   - Identify the font style (script/cursive, serif, sans-serif, display)
   - Note colors and positioning

2. LOCATION FRAMES:
   - Read EXACT location names (e.g., "📍 The Blue Temple", "1. Cafe Name")
   - Note if names are numbered (1., 2., 3.)
   - Identify font styles for location text

3. FONTS & STYLING:
   - Title/Hook font: Is it elegant script? Bold display? Clean sans-serif?
   - Location text font: Same or different from title?
   - Describe what you see: "flowing cursive script", "bold condensed uppercase", etc.

4. OUTRO FRAME (usually last frame):
   - Any call-to-action text ("Follow for more!")
   - Social media handles

Respond with ONLY valid JSON:

{
  "extractedText": {
    "hookText": "EXACT intro text from first frame or null if not visible",
    "locationNames": ["EXACT location names in order they appear"],
    "outroText": "CTA text if visible or null"
  },
  "extractedFonts": {
    "titleFont": {
      "style": "script|serif|sans-serif|display",
      "weight": "normal|bold",
      "description": "DESCRIBE what you see - e.g., 'elegant flowing script with decorative flourishes'"
    },
    "locationFont": {
      "style": "script|serif|sans-serif|display",
      "weight": "normal|bold",
      "description": "e.g., 'clean rounded sans-serif with emoji prefix'"
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
      "textOverlay": "EXACT hook text or null",
      "timestamp": 0
    },
    {
      "locationId": 1,
      "locationName": "EXACT name from frame",
      "textOverlay": "1. EXACT name or null",
      "timestamp": 2
    }
  ]
}

Create entries for each distinct location you can identify. If you can't read text clearly, set to null.`;

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
