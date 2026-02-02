/**
 * Video Storage Service
 * Handles video persistence with IndexedDB (fast, local) + Supabase Storage (cloud backup)
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'template-maker-videos';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';
const THUMBNAIL_STORE = 'thumbnails';

interface VideoRecord {
  id: string;
  templateId: string;
  sceneId: number;
  locationId: number;
  blob: Blob;
  mimeType: string;
  size: number;
  duration?: number;
  createdAt: string;
  syncStatus: 'local' | 'syncing' | 'synced';
  cloudUrl?: string;
}

interface ThumbnailRecord {
  id: string;
  videoId: string;
  dataUrl: string;
  createdAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Initialize IndexedDB
 */
async function getDB(): Promise<IDBPDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        const videoStore = db.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
        videoStore.createIndex('templateId', 'templateId');
        videoStore.createIndex('syncStatus', 'syncStatus');
      }

      if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
        const thumbStore = db.createObjectStore(THUMBNAIL_STORE, { keyPath: 'id' });
        thumbStore.createIndex('videoId', 'videoId');
      }
    },
  });

  return dbPromise;
}

/**
 * Generate unique ID for video
 */
export function generateVideoId(templateId: string, locationId: number, sceneId: number): string {
  return `${templateId}-${locationId}-${sceneId}`;
}

/**
 * Save video to IndexedDB
 */
export async function saveVideo(
  templateId: string,
  locationId: number,
  sceneId: number,
  file: File
): Promise<string> {
  const db = await getDB();
  const id = generateVideoId(templateId, locationId, sceneId);

  const record: VideoRecord = {
    id,
    templateId,
    sceneId,
    locationId,
    blob: file,
    mimeType: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
    syncStatus: 'local',
  };

  await db.put(VIDEO_STORE, record);

  return id;
}

/**
 * Get video from IndexedDB
 */
export async function getVideo(id: string): Promise<VideoRecord | null> {
  const db = await getDB();
  const record = await db.get(VIDEO_STORE, id);
  return record || null;
}

/**
 * Get video blob from IndexedDB
 */
export async function getVideoBlob(id: string): Promise<Blob | null> {
  const record = await getVideo(id);
  return record?.blob || null;
}

/**
 * Get video URL (creates object URL from blob)
 */
export async function getVideoUrl(id: string): Promise<string | null> {
  const blob = await getVideoBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/**
 * Get all videos for a template
 */
export async function getVideosForTemplate(templateId: string): Promise<VideoRecord[]> {
  const db = await getDB();
  const index = db.transaction(VIDEO_STORE).store.index('templateId');
  return index.getAll(templateId);
}

/**
 * Delete video from IndexedDB
 */
export async function deleteVideo(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(VIDEO_STORE, id);
  // Also delete thumbnail
  const thumbId = `thumb-${id}`;
  await db.delete(THUMBNAIL_STORE, thumbId);
}

/**
 * Delete all videos for a template
 */
export async function deleteVideosForTemplate(templateId: string): Promise<void> {
  const videos = await getVideosForTemplate(templateId);
  for (const video of videos) {
    await deleteVideo(video.id);
  }
}

/**
 * Save thumbnail to IndexedDB
 */
export async function saveThumbnail(videoId: string, dataUrl: string): Promise<void> {
  const db = await getDB();
  const record: ThumbnailRecord = {
    id: `thumb-${videoId}`,
    videoId,
    dataUrl,
    createdAt: new Date().toISOString(),
  };
  await db.put(THUMBNAIL_STORE, record);
}

/**
 * Get thumbnail from IndexedDB
 */
export async function getThumbnail(videoId: string): Promise<string | null> {
  const db = await getDB();
  const record = await db.get(THUMBNAIL_STORE, `thumb-${videoId}`);
  return record?.dataUrl || null;
}

/**
 * Generate thumbnail from video file
 */
export async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadeddata = () => {
      canvas.width = 120;
      canvas.height = 160;
      video.currentTime = 0.5;
    };

    video.onseeked = () => {
      if (ctx) {
        ctx.drawImage(video, 0, 0, 120, 160);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Get video duration
 */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Update video sync status
 */
export async function updateVideoSyncStatus(
  id: string,
  status: 'local' | 'syncing' | 'synced',
  cloudUrl?: string
): Promise<void> {
  const db = await getDB();
  const record = await db.get(VIDEO_STORE, id);
  if (record) {
    record.syncStatus = status;
    if (cloudUrl) {
      record.cloudUrl = cloudUrl;
    }
    await db.put(VIDEO_STORE, record);
  }
}

/**
 * Check if user is signed in (placeholder - integrate with Supabase auth)
 */
function isUserSignedIn(): boolean {
  // TODO: Integrate with Supabase auth
  return false;
}

/**
 * Upload video to Supabase Storage (placeholder)
 */
export async function uploadVideoToCloud(id: string): Promise<string | null> {
  if (!isUserSignedIn()) return null;

  const record = await getVideo(id);
  if (!record) return null;

  await updateVideoSyncStatus(id, 'syncing');

  try {
    // TODO: Implement Supabase Storage upload
    // const { data, error } = await supabase.storage
    //   .from('user-videos')
    //   .upload(`${userId}/${id}`, record.blob, {
    //     contentType: record.mimeType,
    //   });
    //
    // if (error) throw error;
    // const { data: urlData } = supabase.storage
    //   .from('user-videos')
    //   .getPublicUrl(`${userId}/${id}`);

    const cloudUrl = ''; // urlData.publicUrl
    await updateVideoSyncStatus(id, 'synced', cloudUrl);
    return cloudUrl;
  } catch (error) {
    console.error('Failed to upload video:', error);
    await updateVideoSyncStatus(id, 'local');
    return null;
  }
}

/**
 * Download video from Supabase Storage (placeholder)
 */
export async function downloadVideoFromCloud(id: string, cloudUrl: string): Promise<void> {
  try {
    const response = await fetch(cloudUrl);
    if (!response.ok) throw new Error('Failed to download');

    const blob = await response.blob();
    const db = await getDB();

    const record: VideoRecord = {
      id,
      templateId: id.split('-')[0],
      sceneId: parseInt(id.split('-')[2], 10),
      locationId: parseInt(id.split('-')[1], 10),
      blob,
      mimeType: blob.type,
      size: blob.size,
      createdAt: new Date().toISOString(),
      syncStatus: 'synced',
      cloudUrl,
    };

    await db.put(VIDEO_STORE, record);
  } catch (error) {
    console.error('Failed to download video:', error);
  }
}

/**
 * Sync all local videos to cloud
 */
export async function syncAllVideosToCloud(): Promise<void> {
  if (!isUserSignedIn()) return;

  const db = await getDB();
  const index = db.transaction(VIDEO_STORE).store.index('syncStatus');
  const localVideos = await index.getAll('local');

  for (const video of localVideos) {
    await uploadVideoToCloud(video.id);
  }
}

/**
 * Get storage usage
 */
export async function getStorageUsage(): Promise<{ count: number; totalSize: number }> {
  const db = await getDB();
  const allVideos = await db.getAll(VIDEO_STORE);

  return {
    count: allVideos.length,
    totalSize: allVideos.reduce((sum, v) => sum + v.size, 0),
  };
}

/**
 * Clear all videos (use with caution)
 */
export async function clearAllVideos(): Promise<void> {
  const db = await getDB();
  await db.clear(VIDEO_STORE);
  await db.clear(THUMBNAIL_STORE);
}
