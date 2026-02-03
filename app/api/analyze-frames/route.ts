import { NextRequest, NextResponse } from 'next/server';
import { generateDescriptions, checkVisionAvailability } from '../../lib/opensource-vision-client';

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

    // Use up to 30 frames for thorough analysis (1 per second)
    const framesToAnalyze = frames.slice(0, 30);
    const frameCount = framesToAnalyze.length;

    const prompt = `You are analyzing ${frameCount} frames from a TikTok-style travel/guide video.

Title: "${title}"
Duration: ${duration} seconds

YOUR TASK: Look at EVERY frame and extract ALL text overlays you see.

CRITICAL STEP 1: Find the HIGHEST numbered item visible in ANY frame (like "17)" or "17." or "#17"). This tells you how many total items exist.

CRITICAL STEP 2: Extract ALL items from 1 to that highest number. Videos often have 10-20+ locations!

Look for:
1. Hook/intro text (big text at start, e.g., "17 must visit spots in Edinburgh")
2. EVERY numbered item from 1 to the highest number (1., 2., 3., ... 15., 16., 17.)
3. Location names shown on screen
4. Outro/CTA text

IMPORTANT:
- Read text EXACTLY as written
- Find the HIGHEST number first, then list ALL items up to that number
- Do NOT stop at 5 - keep going to 10, 15, 20 if that's what you see
- Each frame shows 1 second of video - check ALL ${frameCount} frames

Return ONLY this JSON:

{
  "hookText": "exact intro/hook text or null",
  "highestNumberSeen": <the highest location number you found in any frame>,
  "items": [
    { "number": 1, "text": "exact text for item 1" },
    { "number": 2, "text": "exact text for item 2" }
  ],
  "totalItemsDetected": <should match highestNumberSeen>,
  "visualStyle": "elegant|bold|minimal|playful|modern",
  "outroText": "CTA text or null"
}

Include ALL items from 1 to highestNumberSeen!`;

    let responseText = '';

    // Try LLaVA first (cheaper), fall back to OpenAI
    if (USE_LLAVA) {
      try {
        console.log('[analyze-frames] Trying LLaVA on RunPod...');
        const llavaResult = await generateDescriptions(framesToAnalyze, prompt, { maxWaitMs: 120000 });

        if (llavaResult.descriptions && llavaResult.descriptions.length > 0) {
          // Combine all descriptions into one response
          responseText = llavaResult.descriptions.join('\n');
          console.log('[analyze-frames] LLaVA response:', responseText.substring(0, 300));
        } else {
          throw new Error('LLaVA returned no descriptions');
        }
      } catch (llavaError) {
        console.log('[analyze-frames] LLaVA failed, falling back to OpenAI:', llavaError);
        responseText = await callOpenAI(framesToAnalyze, prompt, frameCount);
      }
    } else {
      console.log('[analyze-frames] LLaVA not configured, using OpenAI...');
      responseText = await callOpenAI(framesToAnalyze, prompt, frameCount);
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse vision API response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build template from analysis - use actual items found, not expected count
    const itemCount = parsed.items?.length || parsed.totalItemsDetected || 5;
    const template = buildTemplateFromAnalysis(parsed, title, duration, itemCount, frames[0]);

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
  // Use actual items found - don't override with arbitrary count
  const actualItems = analysis.items || [];
  const itemCount = actualItems.length > 0 ? actualItems.length : fallbackCount;

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
