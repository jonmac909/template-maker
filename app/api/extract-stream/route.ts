import { NextRequest } from 'next/server';

const RAILWAY_API = process.env.RAILWAY_API_URL || 'https://template-api-production-c2cc.up.railway.app';

export async function POST(request: NextRequest) {
  const { url, platform } = await request.json();

  if (!url || !platform) {
    return new Response(JSON.stringify({ error: 'URL and platform are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create a streaming response
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Call Railway API with streaming enabled
        const railwayResponse = await fetch(`${RAILWAY_API}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, stream: true }),
        });

        if (!railwayResponse.ok) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'error', error: 'Railway API error' })}\n\n`));
          controller.close();
          return;
        }

        const reader = railwayResponse.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'error', error: 'No response body' })}\n\n`));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Forward the SSE data to the client
          const chunk = decoder.decode(value, { stream: true });
          controller.enqueue(encoder.encode(chunk));
        }
        
        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'error', error: String(error) })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
