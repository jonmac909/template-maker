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

// Text styles for different scene types
const TEXT_STYLES = {
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
};

// New format: frames directly from client-side extraction
interface ClientFrameRequest {
  frames: string[];  // Array of base64 strings
  title: string;
  duration: number;
}

// Legacy format support
interface LegacyFrameData {
  timestamp: number;
  base64: string;
}

interface LegacyAnalysisRequest {
  thumbnailBase64?: string;
  thumbnailUrl?: string;
  frames: LegacyFrameData[];
  videoInfo: {
    title: string;
    author: string;
    duration: number;
  };
  expectedLocations?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Detect request format
    const isClientFormat = Array.isArray(body.frames) && typeof body.frames[0] === 'string';

    let frames: string[] = [];
    let title = '';
    let duration = 30;

    if (isClientFormat) {
      // New client-side extraction format
      const clientBody = body as ClientFrameRequest;
      frames = clientBody.frames;
      title = clientBody.title || 'Uploaded Video';
      duration = clientBody.duration || 30;
      console.log('[analyze-frames] Client format - frames:', frames.length, 'duration:', duration);
    } else {
      // Legacy format
      const legacyBody = body as LegacyAnalysisRequest;
      if (legacyBody.thumbnailBase64) {
        frames.push(legacyBody.thumbnailBase64);
      }
      if (legacyBody.frames) {
        frames.push(...legacyBody.frames.map(f => f.base64));
      }
      title = legacyBody.videoInfo?.title || 'Video';
      duration = legacyBody.videoInfo?.duration || 30;
      console.log('[analyze-frames] Legacy format - frames:', frames.length);
    }

    if (frames.length === 0) {
      return NextResponse.json({ error: 'No frames provided' }, { status: 400 });
    }

    console.log(`[analyze-frames] Analyzing ${frames.length} frames for: "${title}"`);

    // Extract expected count from title
    const countMatch = title.match(/(\d+)\s*(must|best|top|places|things|spots|cafe|restaurant|unique)/i);
    const expectedCount = countMatch ? Math.min(parseInt(countMatch[1]), 10) : 5;

    // Build OpenAI Vision API request
    const imageContent = frames.slice(0, 8).map((base64, i) => ([
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64}` }
      },
      {
        type: 'text',
        text: `[Frame ${i + 1}/${Math.min(frames.length, 8)}]`
      }
    ])).flat();

    const prompt = `You are analyzing frames from a TikTok-style video. I'm showing you ${Math.min(frames.length, 8)} frames.

Title hint: "${title}"
Duration: ${duration} seconds

YOUR TASK: Read ALL TEXT OVERLAYS visible in EACH frame. Look for:
1. Any intro/hook text (big text at the start)
2. Numbered items (1., 2., 3., etc.)
3. Location names or captions
4. Any call-to-action text

IMPORTANT: Read text EXACTLY as written. Do NOT guess or make up content.

Return ONLY this JSON structure:

{
  "hookText": "THE EXACT BIG TEXT from the intro frame (or null)",
  "items": [
    { "number": 1, "text": "exact text for item 1" },
    { "number": 2, "text": "exact text for item 2" }
  ],
  "visualStyle": "elegant|bold|minimal|playful|modern",
  "outroText": "any call-to-action text (or null)"
}

If you can't read any text clearly, return:
{ "hookText": null, "items": [], "visualStyle": "modern", "outroText": null }`;

    imageContent.push({ type: 'text', text: prompt });

    console.log('[analyze-frames] Calling OpenAI GPT-4o...');

    const openAIResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: imageContent
        }]
      })
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json().catch(() => ({}));
      console.error('[analyze-frames] OpenAI error:', openAIResponse.status, errorData);
      throw new Error(`Vision API failed: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const responseText = openAIData.choices?.[0]?.message?.content || '';
    console.log('[analyze-frames] GPT-4o response:', responseText.substring(0, 300));

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse GPT-4o response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build template from analysis
    const template = buildTemplateFromAnalysis(parsed, title, duration, expectedCount, frames[0]);

    // Generate template ID
    const templateId = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('[analyze-frames] Template created:', templateId, 'with', template.locations.length, 'locations');

    return NextResponse.json({
      templateId,
      template: {
        id: templateId,
        ...template,
        createdAt: new Date().toISOString(),
        extractionMethod: 'client-frames',
      },
    });
  } catch (error) {
    console.error('[analyze-frames] Error:', error);
    return NextResponse.json(
      { error: `Failed to analyze frames: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

function buildTemplateFromAnalysis(
  analysis: {
    hookText: string | null;
    items: Array<{ number: number; text: string }>;
    visualStyle: string;
    outroText: string | null;
  },
  title: string,
  duration: number,
  expectedCount: number,
  thumbnailBase64?: string
): {
  type: 'reel';
  totalDuration: number;
  locations: LocationGroup[];
  detectedFonts: any[];
  videoInfo: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
  };
} {
  const locations: LocationGroup[] = [];
  const itemCount = Math.max(analysis.items?.length || 0, expectedCount);

  // Calculate timing
  const introTime = Math.min(2, duration * 0.1);
  const outroTime = Math.min(2, duration * 0.1);
  const contentTime = duration - introTime - outroTime;
  const timePerItem = contentTime / itemCount;

  let currentTime = 0;

  // Intro
  const actualIntroTime = Math.max(1, Math.round(introTime));
  locations.push({
    locationId: 0,
    locationName: 'Intro',
    scenes: [{
      id: 1,
      startTime: 0,
      endTime: actualIntroTime,
      duration: actualIntroTime,
      textOverlay: analysis.hookText || title,
      textStyle: TEXT_STYLES.hook,
      description: 'Hook shot',
    }],
    totalDuration: actualIntroTime,
  });
  currentTime = actualIntroTime;

  // Content items
  for (let i = 0; i < itemCount; i++) {
    const sceneStart = currentTime;
    const sceneDuration = Math.max(1, Math.round(timePerItem * 10) / 10);

    const item = analysis.items?.[i];
    const itemText = item?.text || `Location ${i + 1}`;
    const displayName = itemText.replace(/^\d+[\.\)]\s*/, '').trim();

    locations.push({
      locationId: i + 1,
      locationName: displayName || `Location ${i + 1}`,
      scenes: [{
        id: (i + 1) * 10 + 1,
        startTime: sceneStart,
        endTime: sceneStart + sceneDuration,
        duration: sceneDuration,
        textOverlay: `${i + 1}. ${displayName}`,
        textStyle: {
          ...TEXT_STYLES.numbered,
          hasEmoji: true,
          emoji: '📍',
          emojiPosition: 'before' as const,
        },
        description: `Shot of ${displayName}`,
      }],
      totalDuration: sceneDuration,
    });
    currentTime += sceneDuration;
  }

  // Outro
  const remainingTime = Math.max(1, duration - currentTime);
  locations.push({
    locationId: itemCount + 1,
    locationName: 'Outro',
    scenes: [{
      id: 999,
      startTime: currentTime,
      endTime: currentTime + remainingTime,
      duration: remainingTime,
      textOverlay: analysis.outroText || 'Follow for more! 👆',
      textStyle: TEXT_STYLES.cta,
      description: 'Call to action',
    }],
    totalDuration: remainingTime,
  });

  return {
    type: 'reel',
    totalDuration: duration,
    locations,
    detectedFonts: [],
    videoInfo: {
      title,
      author: 'You',
      duration,
      thumbnail: thumbnailBase64 ? `data:image/jpeg;base64,${thumbnailBase64}` : '',
    },
  };
}
