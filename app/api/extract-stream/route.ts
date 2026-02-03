import { NextRequest } from 'next/server';

const RAILWAY_API = process.env.RAILWAY_API_URL || 'https://template-api-production-c2cc.up.railway.app';

// Helper to send SSE event
function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { url, platform } = await request.json();

  if (!url || !platform) {
    return new Response(JSON.stringify({ error: 'URL and platform are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        // Stage 1: Starting
        send({ stage: 'downloading', progress: 10, status: 'Connecting to video source...' });
        
        // Small delay for UI feedback
        await new Promise(r => setTimeout(r, 500));
        send({ stage: 'downloading', progress: 15, status: 'Downloading video...' });

        // Stage 2: Call Railway API
        send({ stage: 'downloading', progress: 20, status: 'Fetching video data...' });
        
        const railwayResponse = await fetch(`${RAILWAY_API}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        send({ stage: 'extracting', progress: 35, status: 'Extracting frames...' });

        if (!railwayResponse.ok) {
          const errorData = await railwayResponse.json().catch(() => ({}));
          send({ stage: 'error', error: errorData.error || `Railway API error: ${railwayResponse.status}` });
          controller.close();
          return;
        }

        send({ stage: 'extracting', progress: 45, status: 'Processing video...' });
        
        const railwayData = await railwayResponse.json();
        
        send({ stage: 'analyzing', progress: 55, status: 'Analyzing with AI...' });

        if (!railwayData.success || !railwayData.analysis?.locations?.length) {
          send({ stage: 'error', error: 'Could not extract locations from video' });
          controller.close();
          return;
        }

        send({ stage: 'detecting', progress: 70, status: 'Detecting scenes...' });
        
        // Build template from Railway response (simplified version)
        const { videoInfo, analysis } = railwayData;
        
        send({ stage: 'building', progress: 85, status: 'Building template...' });

        // Generate template ID
        const templateId = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Convert Railway response to template format
        const locations = analysis.locations.map((loc: any, locIndex: number) => ({
          locationId: locIndex + 1,
          locationName: loc.name || `Location ${locIndex + 1}`,
          totalDuration: loc.scenes?.reduce((sum: number, s: any) => sum + (s.duration || 2), 0) || 5,
          scenes: (loc.scenes || [{ text: loc.text || '', duration: 3 }]).map((scene: any, sceneIndex: number) => ({
            id: sceneIndex + 1,
            startTime: scene.startTime || sceneIndex * 2,
            endTime: scene.endTime || (sceneIndex + 1) * 2,
            duration: scene.duration || 2,
            textOverlay: scene.text || null,
            description: scene.description || `Scene ${sceneIndex + 1}`,
          })),
        }));

        const template = {
          type: 'reel',
          totalDuration: videoInfo?.duration || locations.reduce((sum: number, loc: any) => sum + loc.totalDuration, 0),
          locations,
          hookText: analysis.hookText || '',
          outroText: analysis.outroText || '',
          videoInfo: {
            title: videoInfo?.title || 'Untitled Template',
            author: videoInfo?.author || 'Unknown',
            duration: videoInfo?.duration || 30,
            thumbnail: videoInfo?.thumbnail || '',
            originalUrl: url,
          },
        };

        send({ stage: 'building', progress: 95, status: 'Finalizing...' });

        // Send complete event with template data
        send({ 
          stage: 'complete', 
          progress: 100,
          templateId,
          template,
        });

        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        controller.enqueue(encoder.encode(sseEvent({ 
          stage: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
