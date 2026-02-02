/**
 * Client-side video frame extraction utility
 * Extracts frames from TikTok/Instagram videos for analysis
 */

export interface ExtractedFrame {
  timestamp: number;
  dataUrl: string;
  base64: string;
}

/**
 * Extract frames from a video URL at specified timestamps
 * Must be called from client-side (browser)
 */
export async function extractVideoFrames(
  videoUrl: string,
  timestamps: number[],
  options: {
    maxWidth?: number;
    quality?: number;
    timeout?: number;
  } = {}
): Promise<ExtractedFrame[]> {
  const { maxWidth = 720, quality = 0.8, timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const frames: ExtractedFrame[] = [];
    let currentIndex = 0;

    // Timeout handler
    const timeoutId = setTimeout(() => {
      video.src = '';
      reject(new Error('Video loading timeout'));
    }, timeout);

    video.onloadedmetadata = () => {
      // Set canvas size maintaining aspect ratio
      const aspectRatio = video.videoHeight / video.videoWidth;
      canvas.width = Math.min(video.videoWidth, maxWidth);
      canvas.height = canvas.width * aspectRatio;

      // Start seeking to first timestamp
      if (timestamps.length > 0) {
        video.currentTime = timestamps[0];
      } else {
        clearTimeout(timeoutId);
        resolve(frames);
      }
    };

    video.onseeked = () => {
      // Draw current frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

      frames.push({
        timestamp: timestamps[currentIndex],
        dataUrl,
        base64,
      });

      currentIndex++;

      if (currentIndex < timestamps.length) {
        // Seek to next timestamp
        video.currentTime = timestamps[currentIndex];
      } else {
        // All frames extracted
        clearTimeout(timeoutId);
        video.src = '';
        resolve(frames);
      }
    };

    video.onerror = (e) => {
      clearTimeout(timeoutId);
      reject(new Error(`Video load error: ${e}`));
    };

    // Try to load the video
    video.src = videoUrl;
    video.load();
  });
}

/**
 * Generate timestamps for frame extraction based on video duration
 */
export function generateFrameTimestamps(
  duration: number,
  options: {
    introFrameAt?: number; // Timestamp for intro frame (default: 0.5s)
    numLocationFrames?: number; // Number of frames for locations (default: 5)
    outroFrameAt?: number; // Timestamp offset from end for outro (default: 1s)
  } = {}
): number[] {
  const {
    introFrameAt = 0.5,
    numLocationFrames = 5,
    outroFrameAt = 1,
  } = options;

  const timestamps: number[] = [];

  // CRITICAL: Extract at 0.0s AND slightly later to catch title cards
  // Title overlays often appear right at the start or fade in within first 0.5s
  timestamps.push(0.1); // Very first frame - often has title text (0.1s to avoid potential blank)
  timestamps.push(Math.min(introFrameAt, duration * 0.1)); // Slightly later to catch animated text

  // Content frames - evenly distributed through the middle
  const contentStart = duration * 0.15;
  const contentEnd = duration * 0.85;
  const contentDuration = contentEnd - contentStart;

  for (let i = 0; i < numLocationFrames; i++) {
    const t = contentStart + (contentDuration * i) / (numLocationFrames - 1 || 1);
    timestamps.push(Math.round(t * 10) / 10); // Round to 1 decimal
  }

  // Outro frame - near the end
  timestamps.push(Math.max(duration - outroFrameAt, duration * 0.9));

  return timestamps;
}

/**
 * Proxy video URL through CORS-friendly services
 */
export function getProxiedVideoUrl(originalUrl: string): string[] {
  const urls: string[] = [];

  // Direct URL first
  urls.push(originalUrl);

  // Proxy options for CORS issues
  if (originalUrl.includes('tiktokcdn.com') || originalUrl.includes('tiktok.com')) {
    // Some CDN URLs work directly, try them first
    urls.push(originalUrl.replace('http://', 'https://'));
  }

  return urls;
}

/**
 * Extract a single frame at a specific timestamp
 */
export async function extractSingleFrame(
  videoUrl: string,
  timestamp: number
): Promise<ExtractedFrame | null> {
  try {
    const frames = await extractVideoFrames(videoUrl, [timestamp], { timeout: 15000 });
    return frames[0] || null;
  } catch (error) {
    console.error('Failed to extract frame:', error);
    return null;
  }
}

/**
 * Check if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Convert image URL to base64 (client-side)
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string | null> {
  if (!isBrowser()) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      resolve(base64);
    };

    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
