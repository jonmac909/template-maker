// Client-side scene detection using canvas frame comparison

export interface DetectedScene {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  thumbnail: string; // base64 data URL
  description: string;
}

export interface SceneDetectionResult {
  scenes: DetectedScene[];
  totalDuration: number;
  frameRate: number;
}

/**
 * Detect scene changes in a video by comparing frame differences
 */
export async function detectScenes(
  videoUrl: string,
  options: {
    sampleInterval?: number; // seconds between samples
    threshold?: number; // 0-1, higher = more sensitive to changes
    minSceneDuration?: number; // minimum scene length in seconds
    onProgress?: (progress: number) => void;
  } = {}
): Promise<SceneDetectionResult> {
  const {
    sampleInterval = 0.5,
    threshold = 0.3,
    minSceneDuration = 1,
    onProgress
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const width = Math.min(video.videoWidth, 320); // Downscale for performance
      const height = Math.min(video.videoHeight, 180);

      canvas.width = width;
      canvas.height = height;

      const scenes: DetectedScene[] = [];
      let previousFrame: ImageData | null = null;
      let sceneStart = 0;
      let sceneId = 1;
      let lastThumbnail = '';

      const captureFrame = (time: number): Promise<{ imageData: ImageData; thumbnail: string }> => {
        return new Promise((res) => {
          video.currentTime = time;
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            res({ imageData, thumbnail });
          };
        });
      };

      const compareFrames = (frame1: ImageData, frame2: ImageData): number => {
        const data1 = frame1.data;
        const data2 = frame2.data;
        let diff = 0;
        const pixelCount = data1.length / 4;

        for (let i = 0; i < data1.length; i += 4) {
          // Compare RGB values (skip alpha)
          const rDiff = Math.abs(data1[i] - data2[i]);
          const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
          const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
          diff += (rDiff + gDiff + bDiff) / (255 * 3);
        }

        return diff / pixelCount;
      };

      // Sample frames throughout the video
      const sampleTimes: number[] = [];
      for (let t = 0; t < duration; t += sampleInterval) {
        sampleTimes.push(t);
      }

      for (let i = 0; i < sampleTimes.length; i++) {
        const time = sampleTimes[i];
        const { imageData, thumbnail } = await captureFrame(time);

        if (onProgress) {
          onProgress((i + 1) / sampleTimes.length);
        }

        if (previousFrame) {
          const difference = compareFrames(previousFrame, imageData);

          // Scene change detected
          if (difference > threshold) {
            const sceneDuration = time - sceneStart;

            // Only add if scene is long enough
            if (sceneDuration >= minSceneDuration) {
              scenes.push({
                id: sceneId++,
                startTime: Math.round(sceneStart * 10) / 10,
                endTime: Math.round(time * 10) / 10,
                duration: Math.round(sceneDuration * 10) / 10,
                thumbnail: lastThumbnail,
                description: `Scene ${sceneId - 1}`
              });
            }

            sceneStart = time;
          }
        }

        previousFrame = imageData;
        lastThumbnail = thumbnail;
      }

      // Add final scene
      if (duration - sceneStart >= minSceneDuration) {
        scenes.push({
          id: sceneId,
          startTime: Math.round(sceneStart * 10) / 10,
          endTime: Math.round(duration * 10) / 10,
          duration: Math.round((duration - sceneStart) * 10) / 10,
          thumbnail: lastThumbnail,
          description: `Scene ${sceneId}`
        });
      }

      resolve({
        scenes,
        totalDuration: Math.round(duration * 10) / 10,
        frameRate: 1 / sampleInterval
      });
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = videoUrl;
    video.load();
  });
}

/**
 * Get video metadata without full scene detection
 */
export async function getVideoMetadata(videoUrl: string): Promise<{
  duration: number;
  width: number;
  height: number;
  thumbnail: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = () => {
      canvas.width = 320;
      canvas.height = 180;

      video.currentTime = 1; // Get frame at 1 second
      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, 320, 180);
        }
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          thumbnail: canvas.toDataURL('image/jpeg', 0.8)
        });
      };
    };

    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = videoUrl;
    video.load();
  });
}
