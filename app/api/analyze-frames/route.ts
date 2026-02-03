import { NextRequest, NextResponse } from 'next/server';
import { generateDescriptions, checkVisionAvailability } from '../../lib/opensource-vision-client';

// Claude Vision API (primary)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

// OpenAI as fallback
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Check if LLaVA is configured
const USE_LLAVA = process.env.RUNPOD_VISION_ENDPOINT_ID && process.env.RUNPOD_API_KEY;

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

    // Send ALL frames - 1 per second means we need them all to catch every location
    const framesToAnalyze = frames; // Use ALL frames
    const frameCount = framesToAnalyze.length;

    const prompt = `I'm showing you ${frameCount} frames from a TikTok video (1 frame per second).

Each frame shows a NUMBERED LOCATION like "1) Circus Lane" or "2) Dean Village".

YOUR TASK: List EVERY numbered location you see across ALL ${frameCount} frames.

Look for text overlays that show:
- Numbers followed by location names: "1)" "2)" "3)" etc.
- The location name after each number

INSTRUCTIONS:
1. Check EVERY frame for a numbered location
2. Write down the number and EXACT name you see
3. Continue until you've found the HIGHEST number (could be 5, 10, 15, 17, or more)

Return JSON:
{
  "hookText": "intro text if you see it",
  "items": [
    { "number": 1, "text": "1) First Location Name" },
    { "number": 2, "text": "2) Second Location Name" },
    { "number": 3, "text": "3) Third Location Name" }
  ],
  "outroText": "ending text if you see it"
}

CRITICAL: Return ALL numbered locations from 1 to the highest number you find. Do NOT stop early.`;

    let responseText = '';

    // Try Claude first (best vision), fall back to OpenAI
    if (ANTHROPIC_API_KEY) {
      try {
        console.log('[analyze-frames] Using Claude Vision API...');
        responseText = await callClaude(framesToAnalyze, prompt, frameCount);
      } catch (claudeError) {
        console.log('[analyze-frames] Claude failed, falling back to OpenAI:', claudeError);
        responseText = await callOpenAI(framesToAnalyze, prompt, frameCount);
      }
    } else if (OPENAI_API_KEY) {
      console.log('[analyze-frames] Claude not configured, using OpenAI...');
      responseText = await callOpenAI(framesToAnalyze, prompt, frameCount);
    } else {
      throw new Error('No vision API configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[analyze-frames] Could not find JSON in response:', responseText.substring(0, 500));
      throw new Error('Could not parse vision API response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Log what the vision API returned
    const items = parsed.items || [];
    console.log('[analyze-frames] Vision API found', items.length, 'items:', items.map((i: any) => i.text).join(', '));

    if (items.length === 0) {
      throw new Error('Vision API could not find any numbered locations in the frames');
    }

    // Use ONLY the actual items found - no defaults!
    const template = buildTemplateFromAnalysis(parsed, title, duration, items.length, frames[0]);

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

// Claude Vision API helper
async function callClaude(frames: string[], prompt: string, frameCount: number): Promise<string> {
  // Build content array with images and frame labels
  const content: any[] = [];

  for (let i = 0; i < frames.length; i++) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: frames[i],
      },
    });
    content.push({
      type: 'text',
      text: `[Frame ${i + 1}/${frameCount}]`,
    });
  }

  // Add the prompt at the end
  content.push({
    type: 'text',
    text: prompt,
  });

  console.log('[analyze-frames] Calling Claude Vision API with', frames.length, 'frames...');

  const claudeResponse = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: content,
      }],
    }),
  });

  if (!claudeResponse.ok) {
    const errorData = await claudeResponse.json().catch(() => ({}));
    console.error('[analyze-frames] Claude error:', claudeResponse.status, errorData);
    throw new Error(`Claude Vision API failed: ${claudeResponse.status}`);
  }

  const claudeData = await claudeResponse.json();
  const responseText = claudeData.content?.[0]?.text || '';
  console.log('[analyze-frames] Claude response:', responseText.substring(0, 300));
  return responseText;
}

// OpenAI Vision API helper
async function callOpenAI(frames: string[], prompt: string, frameCount: number): Promise<string> {
  const imageContent = frames.map((base64, i) => ([
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${base64}` }
    },
    {
      type: 'text',
      text: `[Frame ${i + 1}/${frameCount}]`
    }
  ])).flat();

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
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: imageContent
      }]
    })
  });

  if (!openAIResponse.ok) {
    const errorData = await openAIResponse.json().catch(() => ({}));
    console.error('[analyze-frames] OpenAI error:', openAIResponse.status, errorData);
    throw new Error(`OpenAI Vision API failed: ${openAIResponse.status}`);
  }

  const openAIData = await openAIResponse.json();
  const responseText = openAIData.choices?.[0]?.message?.content || '';
  console.log('[analyze-frames] GPT-4o response:', responseText.substring(0, 300));
  return responseText;
}

function buildTemplateFromAnalysis(
  analysis: {
    hookText: string | null;
    items: Array<{ number: number; text: string }>;
    visualStyle: string;
    outroText: string | null;
    totalItemsDetected?: number;
    highestNumberSeen?: number;
  },
  title: string,
  duration: number,
  fallbackCount: number,
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
  const actualItems = analysis.items || [];

  // Use ONLY the actual items GPT found - they have real names
  const itemCount = actualItems.length;
  console.log('[buildTemplate] Building template with', itemCount, 'locations');

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

    const item = actualItems[i];
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
