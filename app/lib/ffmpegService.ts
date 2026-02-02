/**
 * FFmpeg Service
 * Browser-based video processing with FFmpeg.wasm
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  hasEmoji: boolean;
  emoji?: string;
  emojiPosition?: 'before' | 'after' | 'both';
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
}

interface TrimData {
  inTime: number;
  outTime: number;
  cropX: number;
  cropY: number;
  cropScale: number;
}

interface ClipData {
  videoBlob: Blob;
  trimData?: TrimData;
  textOverlay?: string;
  textStyle?: TextStyle;
  duration: number;
}

export interface RenderProgress {
  stage: 'loading' | 'processing' | 'concatenating' | 'complete';
  currentClip?: number;
  totalClips?: number;
  percent: number;
  message: string;
}

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Convert FFmpeg readFile output to Blob
 */
function dataToBlob(data: Uint8Array | string, mimeType: string = 'video/mp4'): Blob {
  if (typeof data === 'string') {
    // If string, encode it (shouldn't happen for video files)
    return new Blob([new TextEncoder().encode(data)], { type: mimeType });
  }
  // Create ArrayBuffer copy to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(data.length);
  const view = new Uint8Array(buffer);
  view.set(data);
  return new Blob([buffer], { type: mimeType });
}

/**
 * Initialize FFmpeg
 */
export async function loadFFmpeg(
  onProgress?: (progress: RenderProgress) => void
): Promise<void> {
  if (isLoaded && ffmpeg) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    onProgress?.({
      stage: 'loading',
      percent: 0,
      message: 'Loading FFmpeg...',
    });

    ffmpeg = new FFmpeg();

    ffmpeg.on('progress', ({ progress }) => {
      onProgress?.({
        stage: 'processing',
        percent: Math.round(progress * 100),
        message: `Processing: ${Math.round(progress * 100)}%`,
      });
    });

    // Load FFmpeg with CORS-enabled CDN URLs
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    isLoaded = true;
    onProgress?.({
      stage: 'loading',
      percent: 100,
      message: 'FFmpeg loaded',
    });
  })();

  return loadPromise;
}

/**
 * Check if FFmpeg is loaded
 */
export function isFFmpegLoaded(): boolean {
  return isLoaded && ffmpeg !== null;
}

/**
 * Trim video to specified in/out points
 */
export async function trimVideo(
  inputBlob: Blob,
  inTime: number,
  outTime: number
): Promise<Blob> {
  if (!ffmpeg || !isLoaded) {
    await loadFFmpeg();
  }

  const inputFile = 'input.mp4';
  const outputFile = 'trimmed.mp4';

  await ffmpeg!.writeFile(inputFile, await fetchFile(inputBlob));

  const duration = outTime - inTime;

  await ffmpeg!.exec([
    '-i', inputFile,
    '-ss', String(inTime),
    '-t', String(duration),
    '-c', 'copy',
    '-y',
    outputFile,
  ]);

  const data = await ffmpeg!.readFile(outputFile);
  const blob = dataToBlob(data, 'video/mp4');

  // Cleanup
  await ffmpeg!.deleteFile(inputFile);
  await ffmpeg!.deleteFile(outputFile);

  return blob;
}

/**
 * Crop/scale video
 */
export async function cropVideo(
  inputBlob: Blob,
  cropX: number,
  cropY: number,
  cropScale: number,
  outputWidth: number = 1080,
  outputHeight: number = 1920
): Promise<Blob> {
  if (!ffmpeg || !isLoaded) {
    await loadFFmpeg();
  }

  const inputFile = 'input.mp4';
  const outputFile = 'cropped.mp4';

  await ffmpeg!.writeFile(inputFile, await fetchFile(inputBlob));

  // Calculate crop parameters
  // cropX and cropY are 0-1 normalized positions
  // cropScale is zoom level (1 = fit, >1 = zoomed in)
  const cropW = Math.round(outputWidth / cropScale);
  const cropH = Math.round(outputHeight / cropScale);
  const x = Math.round(cropX * (outputWidth - cropW));
  const y = Math.round(cropY * (outputHeight - cropH));

  const filterStr = cropScale > 1
    ? `crop=${cropW}:${cropH}:${x}:${y},scale=${outputWidth}:${outputHeight}`
    : `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2`;

  await ffmpeg!.exec([
    '-i', inputFile,
    '-vf', filterStr,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    '-y',
    outputFile,
  ]);

  const data = await ffmpeg!.readFile(outputFile);
  const blob = dataToBlob(data, 'video/mp4');

  await ffmpeg!.deleteFile(inputFile);
  await ffmpeg!.deleteFile(outputFile);

  return blob;
}

/**
 * Convert hex color to FFmpeg format
 */
function hexToFFmpegColor(hex: string): string {
  // Remove # and convert to FFmpeg format (white becomes ffffff)
  return hex.replace('#', '').toLowerCase();
}

/**
 * Calculate text position for FFmpeg drawtext
 */
function getTextPosition(position: 'top' | 'center' | 'bottom', alignment: 'left' | 'center' | 'right'): { x: string; y: string } {
  let x: string;
  let y: string;

  switch (alignment) {
    case 'left':
      x = '50';
      break;
    case 'right':
      x = 'w-tw-50';
      break;
    case 'center':
    default:
      x = '(w-tw)/2';
      break;
  }

  switch (position) {
    case 'top':
      y = '100';
      break;
    case 'bottom':
      y = 'h-th-150';
      break;
    case 'center':
    default:
      y = '(h-th)/2';
      break;
  }

  return { x, y };
}

/**
 * Add text overlay to video
 */
export async function addTextOverlay(
  inputBlob: Blob,
  text: string,
  style: TextStyle
): Promise<Blob> {
  if (!ffmpeg || !isLoaded) {
    await loadFFmpeg();
  }

  const inputFile = 'input.mp4';
  const outputFile = 'with_text.mp4';

  await ffmpeg!.writeFile(inputFile, await fetchFile(inputBlob));

  // Build full text with emoji
  let fullText = text;
  if (style.hasEmoji && style.emoji) {
    if (style.emojiPosition === 'before' || style.emojiPosition === 'both') {
      fullText = `${style.emoji} ${fullText}`;
    }
    if (style.emojiPosition === 'after' || style.emojiPosition === 'both') {
      fullText = `${fullText} ${style.emoji}`;
    }
  }

  // Escape special characters for FFmpeg
  const escapedText = fullText
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:');

  const { x, y } = getTextPosition(style.position, style.alignment);
  const color = hexToFFmpegColor(style.color);

  // Note: Custom fonts require the font file. Using default sans-serif.
  const drawTextFilter = `drawtext=text='${escapedText}':fontsize=${style.fontSize * 2}:fontcolor=${color}:x=${x}:y=${y}:shadowcolor=black@0.7:shadowx=2:shadowy=2`;

  await ffmpeg!.exec([
    '-i', inputFile,
    '-vf', drawTextFilter,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    '-y',
    outputFile,
  ]);

  const data = await ffmpeg!.readFile(outputFile);
  const blob = dataToBlob(data, 'video/mp4');

  await ffmpeg!.deleteFile(inputFile);
  await ffmpeg!.deleteFile(outputFile);

  return blob;
}

/**
 * Concatenate multiple video clips
 */
export async function concatenateVideos(
  blobs: Blob[],
  onProgress?: (progress: RenderProgress) => void
): Promise<Blob> {
  if (!ffmpeg || !isLoaded) {
    await loadFFmpeg(onProgress);
  }

  if (blobs.length === 0) {
    throw new Error('No videos to concatenate');
  }

  if (blobs.length === 1) {
    return blobs[0];
  }

  onProgress?.({
    stage: 'concatenating',
    percent: 0,
    message: 'Preparing files...',
  });

  // Write all input files
  const inputFiles: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const filename = `input${i}.mp4`;
    await ffmpeg!.writeFile(filename, await fetchFile(blobs[i]));
    inputFiles.push(filename);

    onProgress?.({
      stage: 'concatenating',
      currentClip: i + 1,
      totalClips: blobs.length,
      percent: Math.round(((i + 1) / blobs.length) * 30),
      message: `Preparing clip ${i + 1}/${blobs.length}...`,
    });
  }

  // Create concat file list
  const concatContent = inputFiles.map(f => `file '${f}'`).join('\n');
  await ffmpeg!.writeFile('concat.txt', concatContent);

  onProgress?.({
    stage: 'concatenating',
    percent: 40,
    message: 'Merging clips...',
  });

  // Concatenate using concat demuxer
  await ffmpeg!.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-y',
    'output.mp4',
  ]);

  onProgress?.({
    stage: 'concatenating',
    percent: 90,
    message: 'Finalizing...',
  });

  const data = await ffmpeg!.readFile('output.mp4');
  const blob = dataToBlob(data, 'video/mp4');

  // Cleanup
  for (const file of inputFiles) {
    await ffmpeg!.deleteFile(file);
  }
  await ffmpeg!.deleteFile('concat.txt');
  await ffmpeg!.deleteFile('output.mp4');

  onProgress?.({
    stage: 'complete',
    percent: 100,
    message: 'Complete!',
  });

  return blob;
}

/**
 * Process a single clip with trim, crop, and text
 */
export async function processClip(
  clip: ClipData,
  onProgress?: (progress: RenderProgress) => void
): Promise<Blob> {
  if (!ffmpeg || !isLoaded) {
    await loadFFmpeg(onProgress);
  }

  let processedBlob = clip.videoBlob;

  // Apply trim if needed
  if (clip.trimData && (clip.trimData.inTime > 0 || clip.trimData.outTime < clip.duration)) {
    onProgress?.({
      stage: 'processing',
      percent: 20,
      message: 'Trimming...',
    });
    processedBlob = await trimVideo(
      processedBlob,
      clip.trimData.inTime,
      clip.trimData.outTime
    );
  }

  // Apply crop if needed
  if (clip.trimData && clip.trimData.cropScale > 1) {
    onProgress?.({
      stage: 'processing',
      percent: 50,
      message: 'Cropping...',
    });
    processedBlob = await cropVideo(
      processedBlob,
      clip.trimData.cropX,
      clip.trimData.cropY,
      clip.trimData.cropScale
    );
  }

  // Add text overlay if needed
  if (clip.textOverlay && clip.textStyle) {
    onProgress?.({
      stage: 'processing',
      percent: 80,
      message: 'Adding text...',
    });
    processedBlob = await addTextOverlay(
      processedBlob,
      clip.textOverlay,
      clip.textStyle
    );
  }

  return processedBlob;
}

/**
 * Render full video from clips
 */
export async function renderFullVideo(
  clips: ClipData[],
  onProgress?: (progress: RenderProgress) => void
): Promise<Blob> {
  if (!ffmpeg || !isLoaded) {
    await loadFFmpeg(onProgress);
  }

  onProgress?.({
    stage: 'processing',
    currentClip: 0,
    totalClips: clips.length,
    percent: 0,
    message: 'Starting render...',
  });

  const processedClips: Blob[] = [];

  for (let i = 0; i < clips.length; i++) {
    onProgress?.({
      stage: 'processing',
      currentClip: i + 1,
      totalClips: clips.length,
      percent: Math.round((i / clips.length) * 70),
      message: `Processing clip ${i + 1}/${clips.length}...`,
    });

    const processed = await processClip(clips[i]);
    processedClips.push(processed);
  }

  onProgress?.({
    stage: 'concatenating',
    percent: 75,
    message: 'Merging clips...',
  });

  const finalVideo = await concatenateVideos(processedClips, onProgress);

  onProgress?.({
    stage: 'complete',
    percent: 100,
    message: 'Render complete!',
  });

  return finalVideo;
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get video metadata from blob
 */
export async function getVideoMetadata(blob: Blob): Promise<{
  duration: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = URL.createObjectURL(blob);
  });
}
