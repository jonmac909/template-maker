import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

// Use OpenAI for vision analysis
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

export async function POST(request: NextRequest) {
  const tmpDir = '/tmp/video-extract';
  let videoPath = '';
  const framePaths: string[] = [];

  try {
    // Ensure tmp directory exists
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string || 'Uploaded Video';

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    console.log('[upload] Received video:', videoFile.name, 'Size:', videoFile.size);

    // Save video to /tmp
    const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ext = videoFile.name.split('.').pop() || 'mp4';
    videoPath = join(tmpDir, `${videoId}.${ext}`);

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await writeFile(videoPath, videoBuffer);
    console.log('[upload] Saved video to:', videoPath);

    // Get video duration using ffprobe
    let duration = 30;
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
      );
      duration = Math.round(parseFloat(stdout.trim()));
      console.log('[upload] Video duration:', duration, 'seconds');
    } catch (e) {
      console.log('[upload] Could not get duration, using default:', duration);
    }

    // Extract frames at key timestamps
    const numFrames = Math.min(8, Math.max(4, Math.floor(duration / 5)));
    const timestamps: number[] = [];

    // Intro frame
    timestamps.push(0.5);

    // Content frames evenly distributed
    for (let i = 1; i < numFrames - 1; i++) {
      timestamps.push((i / numFrames) * duration);
    }

    // Outro frame
    timestamps.push(duration - 0.5);

    console.log('[upload] Extracting frames at timestamps:', timestamps);

    // Extract frames using ffmpeg
    const frameBase64s: string[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const framePath = join(tmpDir, `${videoId}_frame_${i}.jpg`);
      framePaths.push(framePath);

      try {
        await execAsync(
          `ffmpeg -ss ${timestamps[i]} -i "${videoPath}" -vframes 1 -q:v 2 -y "${framePath}"`,
          { timeout: 10000 }
        );

        // Read frame and convert to base64
        const frameBuffer = await readFile(framePath);
        frameBase64s.push(frameBuffer.toString('base64'));
        console.log(`[upload] Extracted frame ${i + 1}/${timestamps.length}`);
      } catch (e) {
        console.log(`[upload] Failed to extract frame at ${timestamps[i]}s:`, e);
      }
    }

    if (frameBase64s.length === 0) {
      throw new Error('Failed to extract any frames from video');
    }

    console.log('[upload] Extracted', frameBase64s.length, 'frames, sending to vision API...');

    // Analyze frames with GPT-4o
    const analysis = await analyzeFramesWithGPT4o(frameBase64s, title, duration);

    // Generate template ID and build template
    const templateId = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use first frame as thumbnail (base64)
    const thumbnailBase64 = frameBase64s[0] ? `data:image/jpeg;base64,${frameBase64s[0]}` : '';

    const template = {
      id: templateId,
      platform: 'upload',
      originalUrl: '',
      videoInfo: {
        title,
        author: 'You',
        duration,
        thumbnail: thumbnailBase64,
        videoUrl: '',
      },
      ...analysis,
      createdAt: new Date().toISOString(),
      needsSceneDetection: false,
      extractionMethod: 'video-upload',
    };

    // Store in global templates (for API access)
    global.templates = global.templates || {};
    global.templates[templateId] = template;

    console.log('[upload] Template created:', templateId, 'with', analysis.locations?.length, 'locations');

    return NextResponse.json({
      templateId,
      template,
    });
  } catch (error) {
    console.error('[upload] Error:', error);
    return NextResponse.json(
      { error: `Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    try {
      if (videoPath && existsSync(videoPath)) {
        await unlink(videoPath);
      }
      for (const framePath of framePaths) {
        if (existsSync(framePath)) {
          await unlink(framePath);
        }
      }
    } catch (e) {
      console.log('[upload] Cleanup error:', e);
    }
  }
}

async function analyzeFramesWithGPT4o(
  frameBase64s: string[],
  title: string,
  duration: number
): Promise<{
  type: 'reel';
  totalDuration: number;
  locations: LocationGroup[];
  detectedFonts: any[];
}> {
  // Build prompt for GPT-4o
  const prompt = `You are analyzing frames from a TikTok-style video. I'm showing you ${frameBase64s.length} frames from throughout the video.

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

  try {
    // Build content with images
    const content: any[] = frameBase64s.map((base64, i) => ({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${base64}`,
      },
    }));
    content.push({ type: 'text', text: prompt });

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[upload] GPT-4o error:', response.status, errorData);
      throw new Error(`Vision API failed: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';
    console.log('[upload] GPT-4o response:', responseText.substring(0, 500));

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse GPT-4o response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return buildTemplateFromAnalysis(parsed, duration);
  } catch (error) {
    console.error('[upload] Vision analysis failed:', error);
    // Return fallback template
    return buildFallbackTemplate(title, duration);
  }
}

function buildTemplateFromAnalysis(
  analysis: {
    hookText: string | null;
    items: Array<{ number: number; text: string }>;
    visualStyle: string;
    outroText: string | null;
  },
  duration: number
): {
  type: 'reel';
  totalDuration: number;
  locations: LocationGroup[];
  detectedFonts: any[];
} {
  const locations: LocationGroup[] = [];
  const itemCount = Math.max(analysis.items?.length || 0, 3);

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
      textOverlay: analysis.hookText,
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
  };
}

function buildFallbackTemplate(
  title: string,
  duration: number
): {
  type: 'reel';
  totalDuration: number;
  locations: LocationGroup[];
  detectedFonts: any[];
} {
  // Parse number from title if possible
  const countMatch = title.match(/(\d+)/);
  const itemCount = countMatch ? Math.min(parseInt(countMatch[1]), 10) : 5;

  return buildTemplateFromAnalysis(
    {
      hookText: title || null,
      items: Array.from({ length: itemCount }, (_, i) => ({
        number: i + 1,
        text: `Location ${i + 1}`,
      })),
      visualStyle: 'modern',
      outroText: null,
    },
    duration
  );
}

declare global {
  var templates: Record<string, any> | undefined;
}
