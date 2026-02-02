import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    if (!videoInfo) {
      return NextResponse.json(
        { error: 'Could not fetch video. Please check the URL.' },
        { status: 400 }
      );
    }

    const analysis = await analyzeVideoWithClaude(videoInfo, url);
    const detectedFonts = detectFontsForVideo(videoInfo, url);

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
} | null> {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error('TikWM API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.code !== 0 || !data.data) {
      console.error('TikWM API returned error:', data);
      return null;
    }

    const videoData = data.data;

    return {
      title: videoData.title || 'Untitled',
      author: videoData.author?.nickname || videoData.author?.unique_id || 'Unknown',
      duration: videoData.duration || 0,
      thumbnail: videoData.cover || videoData.origin_cover || '',
      videoUrl: videoData.play || videoData.hdplay || '',
    };
  } catch (error) {
    console.error('Error fetching TikTok info:', error);
    return null;
  }
}

async function analyzeVideoWithClaude(
  videoInfo: { title: string; author: string; duration: number; thumbnail: string; videoUrl: string },
  originalUrl: string
): Promise<VideoAnalysis> {
  try {
    const prompt = `You are a video template analyzer. Analyze this TikTok video and extract its structure for someone who wants to recreate a similar video with their own content.

VIDEO INFO:
- Title: "${videoInfo.title}"
- Author: @${videoInfo.author}
- Duration: ${videoInfo.duration} seconds
- URL: ${originalUrl}

Based on the title and typical TikTok travel/lifestyle video structures, create a detailed scene-by-scene breakdown.

IMPORTANT: Your response must be ONLY valid JSON, no other text. Use this exact structure:

{
  "type": "reel",
  "totalDuration": ${videoInfo.duration},
  "locations": [
    {
      "locationId": 1,
      "locationName": "Location Name Here",
      "scenes": [
        {
          "id": 1,
          "startTime": 0,
          "endTime": 3,
          "duration": 3,
          "textOverlay": "Text that appears on screen or null",
          "description": "What to film: brief description of the shot"
        }
      ],
      "totalDuration": 0
    }
  ],
  "music": {
    "name": "Trending TikTok Sound",
    "hasMusic": true
  }
}

Requirements:
1. Break down the ${videoInfo.duration} second video into logical scenes
2. Group scenes by location (if it's a "Top 10" or list video, each item is a location)
3. Each scene should be 2-5 seconds
4. Include text overlays where they would typically appear (titles, location names, numbers)
5. Make descriptions actionable ("Film wide shot of entrance", "Close-up of food", etc.)
6. Calculate totalDuration for each location as sum of scene durations

Respond with ONLY the JSON, no explanation:`;

    let analysisResult: VideoAnalysis;

    console.log('Calling Claude API with prompt length:', prompt.length);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('Claude response received, content type:', message.content[0]?.type);
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    console.log('Claude response text (first 500 chars):', responseText.substring(0, 500));

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('JSON match found, parsing...');
      analysisResult = JSON.parse(jsonMatch[0]);

      // Add text styles and calculate location durations
      analysisResult.locations = analysisResult.locations.map((loc, locIdx) => ({
        ...loc,
        totalDuration: loc.scenes.reduce((sum, scene) => sum + scene.duration, 0),
        scenes: loc.scenes.map((scene, sceneIdx) => ({
          ...scene,
          textStyle: getTextStyleForScene(loc.locationId, sceneIdx, scene.textOverlay)
        }))
      }));

      // Add empty detectedFonts (will be populated by caller)
      analysisResult.detectedFonts = [];

      console.log('Claude analysis successful:', analysisResult.locations.length, 'locations');
      return analysisResult;
    }

    console.log('No JSON match found in response');
    throw new Error('Could not parse Claude response');
  } catch (error) {
    console.error('Claude analysis error:', error instanceof Error ? error.message : error);
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

  // Extract numbered items from title
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

  const numberMatch = titleLower.match(/(\d+)\s*(must|best|top|places|things|spots|cafe|restaurant|food|unique)/i);
  const itemCount = numberedItems.length > 0 ? numberedItems.length : (numberMatch ? parseInt(numberMatch[1]) : 5);

  const introTime = 3;
  const outroTime = 2;
  const contentTime = duration - introTime - outroTime;
  const timePerItem = Math.max(3, Math.floor(contentTime / itemCount));

  const locations: LocationGroup[] = [];
  let currentTime = 0;

  const hookText = title.split(/\d+\./)[0].trim().slice(0, 100) || title.slice(0, 50);

  // Intro with hook style
  locations.push({
    locationId: 0,
    locationName: 'Intro',
    scenes: [{
      id: 1,
      startTime: 0,
      endTime: introTime,
      duration: introTime,
      textOverlay: hookText,
      textStyle: {
        ...TEXT_STYLES.hook,
        emoji: detectedEmoji,
      },
      description: 'Hook shot - eye-catching establishing shot'
    }],
    totalDuration: introTime
  });
  currentTime += introTime;

  // Content items with location styles
  for (let i = 1; i <= itemCount; i++) {
    const sceneStart = currentTime;
    const sceneDuration = Math.min(timePerItem, duration - currentTime - outroTime);

    if (sceneDuration <= 0) break;

    const itemName = numberedItems[i - 1] || `Location ${i}`;
    const displayName = itemName.length > 40 ? itemName.slice(0, 40) + '...' : itemName;

    locations.push({
      locationId: i,
      locationName: displayName,
      scenes: [
        {
          id: i * 10 + 1,
          startTime: sceneStart,
          endTime: sceneStart + Math.floor(sceneDuration * 0.4),
          duration: Math.floor(sceneDuration * 0.4),
          textOverlay: `${i}. ${displayName}`,
          textStyle: {
            ...TEXT_STYLES.numbered,
            hasEmoji: true,
            emoji: detectedEmoji,
            emojiPosition: 'before' as const,
          },
          description: `Wide establishing shot of ${displayName}`
        },
        {
          id: i * 10 + 2,
          startTime: sceneStart + Math.floor(sceneDuration * 0.4),
          endTime: sceneStart + Math.floor(sceneDuration * 0.7),
          duration: Math.floor(sceneDuration * 0.3),
          textOverlay: null,
          textStyle: TEXT_STYLES.locationLabel,
          description: 'Detail shot - food, interior, or highlight'
        },
        {
          id: i * 10 + 3,
          startTime: sceneStart + Math.floor(sceneDuration * 0.7),
          endTime: sceneStart + sceneDuration,
          duration: Math.ceil(sceneDuration * 0.3),
          textOverlay: null,
          textStyle: TEXT_STYLES.locationLabel,
          description: 'Reaction or experience shot'
        }
      ],
      totalDuration: sceneDuration
    });
    currentTime += sceneDuration;
  }

  // Outro with CTA style
  if (currentTime < duration) {
    locations.push({
      locationId: itemCount + 1,
      locationName: 'Outro',
      scenes: [{
        id: 999,
        startTime: currentTime,
        endTime: duration,
        duration: duration - currentTime,
        textOverlay: 'Follow for more! 👆',
        textStyle: TEXT_STYLES.cta,
        description: 'Call to action - wave, point at follow button'
      }],
      totalDuration: duration - currentTime
    });
  }

  return {
    type: 'reel',
    totalDuration: duration,
    locations,
    detectedFonts: [], // Will be added by caller
    music: {
      name: 'Trending Sound',
      hasMusic: true
    },
  };
}

function generateTemplateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

declare global {
  var templates: Record<string, any> | undefined;
}
