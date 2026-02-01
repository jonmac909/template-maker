import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { url, platform } = await request.json();

    if (!url || !platform) {
      return NextResponse.json(
        { error: 'URL and platform are required' },
        { status: 400 }
      );
    }

    // Step 1: Download/scrape the video
    // For now, we'll simulate this. In production, you'd use a service like:
    // - TikTok Scraper API
    // - Instagram Scraper API
    // - Or a video downloader service

    const mockVideoPath = simulateVideoDownload(url, platform);

    // Step 2: Use Claude Vision API to analyze the video
    const analysis = await analyzeVideo(mockVideoPath, platform);

    // Step 3: Create template from analysis
    const template = createTemplate(analysis, platform);

    // Step 4: Store template (in production, save to database)
    const templateId = generateTemplateId();

    // For now, we'll store in memory
    // In production, save to a database
    global.templates = global.templates || {};
    global.templates[templateId] = template;

    return NextResponse.json({
      templateId,
      template,
    });
  } catch (error) {
    console.error('Extract error:', error);
    return NextResponse.json(
      { error: 'Failed to extract template' },
      { status: 500 }
    );
  }
}

function simulateVideoDownload(url: string, platform: string): string {
  // In production, this would actually download the video
  // using a TikTok/Instagram scraper
  console.log(`Simulating download from ${platform}: ${url}`);
  return '/mock/video.mp4';
}

async function analyzeVideo(videoPath: string, platform: string) {
  // For the demo, we'll use Claude to analyze a description
  // In production, you'd:
  // 1. Extract frames from video at regular intervals
  // 2. Send frames to Claude Vision API
  // 3. Ask Claude to identify scenes, text overlays, transitions, etc.

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Analyze this ${platform} video and extract the template structure.

For a REEL (vertical video):
- Identify distinct scenes/clips
- Note the timing of each clip (estimate)
- Identify any text overlays and their timing
- Note transitions between clips
- Identify background music if present

For a CAROUSEL (image slideshow):
- Identify each slide/image
- Extract text overlays on each slide (position, style, content)
- Note the order of slides

Return a JSON structure with this information.

For this demo, create a sample template for a "${platform}" post about "Top 10 Cafes" with 5 clips/slides.`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e);
  }

  // Fallback to mock data
  return getMockAnalysis(platform);
}

function getMockAnalysis(platform: string) {
  if (platform === 'tiktok') {
    return {
      type: 'reel',
      duration: 45,
      clips: [
        { id: 1, name: 'Intro', startTime: 0, endTime: 5, textOverlay: 'Top 10 Cafes in Tokyo' },
        { id: 2, name: 'Cafe #10', startTime: 5, endTime: 10, textOverlay: '#10' },
        { id: 3, name: 'Cafe #9', startTime: 10, endTime: 15, textOverlay: '#9' },
        { id: 4, name: 'Cafe #8', startTime: 15, endTime: 20, textOverlay: '#8' },
        { id: 5, name: 'Cafe #7', startTime: 20, endTime: 25, textOverlay: '#7' },
      ],
      music: {
        name: 'Lo-fi Beat',
        duration: 45,
      },
    };
  } else {
    return {
      type: 'carousel',
      slides: [
        { id: 1, textOverlay: 'Top 5 Must-See Spots', position: 'center', style: 'bold' },
        { id: 2, textOverlay: 'Wet Pine Singh 🏔', position: 'bottom', style: 'bold' },
        { id: 3, textOverlay: 'Doi Suthep Temple 🛕', position: 'bottom', style: 'bold' },
        { id: 4, textOverlay: 'Sunday Night Market 🛍️', position: 'bottom', style: 'bold' },
        { id: 5, textOverlay: 'Old City Walls 🏛️', position: 'bottom', style: 'bold' },
      ],
    };
  }
}

function createTemplate(analysis: any, platform: string) {
  const templateId = generateTemplateId();

  return {
    id: templateId,
    platform,
    type: analysis.type,
    createdAt: new Date().toISOString(),
    ...analysis,
  };
}

function generateTemplateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Add type for global templates storage
declare global {
  var templates: Record<string, any> | undefined;
}
