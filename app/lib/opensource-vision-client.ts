/**
 * Open-Source Vision RunPod Client
 *
 * Calls the LLaVA-NeXT-Video RunPod worker to generate visual descriptions from frames.
 * Provides drop-in replacement for Claude/OpenAI Vision API with 98% cost savings.
 */

// RunPod endpoint for LLaVA-NeXT-Video worker
const VISION_ENDPOINT_ID = process.env.RUNPOD_VISION_ENDPOINT_ID || '';
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';

const RUNPOD_BASE_URL = 'https://api.runpod.ai/v2';

export interface VisionDescriptionRequest {
  frameUrls?: string[];
  frameData?: string[];  // base64 encoded frames
}

export interface VisionDescriptionResponse {
  descriptions: string[];      // Array of description strings
  failedIndices: number[];     // Indices that failed to process
  count: number;               // Number of descriptions
}

// RunPod API response types
interface RunPodJobStatus {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: {
    descriptions?: string[];
    failed_indices?: number[];
    error?: string;
  };
  error?: string;
}

interface RunPodJobSubmission {
  id?: string;
  status?: string;
}

/**
 * Poll for RunPod job completion
 */
async function pollRunPodJob(jobId: string, maxWaitMs: number = 120000): Promise<RunPodJobStatus['output']> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const statusUrl = `${RUNPOD_BASE_URL}/${VISION_ENDPOINT_ID}/status/${jobId}`;

    const response = await fetch(statusUrl, {
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`RunPod status check failed: ${response.status}`);
    }

    const data = await response.json() as RunPodJobStatus;

    if (data.status === 'COMPLETED') {
      return data.output;
    }

    if (data.status === 'FAILED') {
      throw new Error(`RunPod job failed: ${data.error || 'Unknown error'}`);
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`RunPod job timed out after ${maxWaitMs}ms`);
}

/**
 * Generate visual descriptions for frames using LLaVA
 *
 * @param frames - Array of base64 encoded frame images
 * @param prompt - Custom prompt for the vision model
 * @param options - Configuration options
 * @returns Array of visual descriptions
 */
export async function generateDescriptions(
  frames: string[],
  prompt?: string,
  options: {
    maxWaitMs?: number;
  } = {}
): Promise<VisionDescriptionResponse> {
  const {
    maxWaitMs = 120000,  // 2 minute timeout
  } = options;

  if (!VISION_ENDPOINT_ID) {
    throw new Error('RUNPOD_VISION_ENDPOINT_ID not configured');
  }

  if (!RUNPOD_API_KEY) {
    throw new Error('RUNPOD_API_KEY not configured');
  }

  console.log(`[llava-client] Generating descriptions for ${frames.length} frames`);

  // Prepare payload with base64 frames
  const payload: any = {
    frame_data: frames,
    format: 'base64',
  };

  // Add custom prompt if provided
  if (prompt) {
    payload.prompt = prompt;
  }

  // Submit job to RunPod
  const runUrl = `${RUNPOD_BASE_URL}/${VISION_ENDPOINT_ID}/run`;

  const response = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod submission failed: ${response.status} - ${errorText}`);
  }

  const jobData = await response.json() as RunPodJobSubmission;

  if (!jobData.id) {
    throw new Error('RunPod did not return a job ID');
  }

  console.log(`[llava-client] Job submitted: ${jobData.id}`);

  // Poll for completion
  const result = await pollRunPodJob(jobData.id, maxWaitMs);

  if (result?.error) {
    throw new Error(`Vision worker error: ${result.error}`);
  }

  const descriptions = result?.descriptions || [];
  const failedIndices = result?.failed_indices || [];

  console.log(`[llava-client] Generated ${descriptions.length} descriptions`);

  return {
    descriptions,
    failedIndices,
    count: descriptions.length,
  };
}

/**
 * Analyze a single frame with LLaVA and a custom prompt
 */
export async function analyzeFrame(
  frameBase64: string,
  prompt: string,
  options: { maxWaitMs?: number } = {}
): Promise<string> {
  const result = await generateDescriptions([frameBase64], prompt, options);
  return result.descriptions[0] || '';
}

/**
 * Check if open-source vision endpoint is configured and available
 */
export async function checkVisionAvailability(): Promise<{
  available: boolean;
  endpointId?: string;
  error?: string;
}> {
  if (!VISION_ENDPOINT_ID) {
    return {
      available: false,
      error: 'RUNPOD_VISION_ENDPOINT_ID not configured',
    };
  }

  if (!RUNPOD_API_KEY) {
    return {
      available: false,
      error: 'RUNPOD_API_KEY not configured',
    };
  }

  try {
    // Check endpoint health
    const healthUrl = `${RUNPOD_BASE_URL}/${VISION_ENDPOINT_ID}/health`;

    const response = await fetch(healthUrl, {
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });

    if (response.ok) {
      return {
        available: true,
        endpointId: VISION_ENDPOINT_ID,
      };
    }

    return {
      available: false,
      endpointId: VISION_ENDPOINT_ID,
      error: `Endpoint returned ${response.status}`,
    };
  } catch (err: any) {
    return {
      available: false,
      endpointId: VISION_ENDPOINT_ID,
      error: err.message,
    };
  }
}
