/**
 * Template Storage Service
 * Handles template persistence with localStorage (immediate) + Supabase sync (cloud backup)
 */

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

interface TrimData {
  inTime: number;
  outTime: number;
  cropX: number;
  cropY: number;
  cropScale: number;
}

interface SceneInfo {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  textOverlay: string | null;
  textStyle?: TextStyle;
  description: string;
  thumbnail?: string;
  userVideoId?: string;
  userThumbnail?: string;
  filled: boolean;
  trimData?: TrimData;
}

interface LocationGroup {
  locationId: number;
  locationName: string;
  scenes: SceneInfo[];
  totalDuration: number;
  expanded?: boolean;
}

export interface Template {
  id: string;
  type: 'reel' | 'carousel';
  totalDuration: number;
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
    videoUrl: string;
  };
  locations: LocationGroup[];
  isDraft: boolean;
  deepAnalyzed?: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'local' | 'syncing' | 'synced';
}

const TEMPLATE_PREFIX = 'template_';
const TEMPLATES_INDEX_KEY = 'templates_index';

/**
 * Get all template IDs stored locally
 */
export function getTemplateIds(): string[] {
  if (typeof window === 'undefined') return [];

  const index = localStorage.getItem(TEMPLATES_INDEX_KEY);
  if (index) {
    try {
      return JSON.parse(index);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Save template to localStorage immediately
 */
export function saveTemplate(template: Template): void {
  if (typeof window === 'undefined') return;

  const now = new Date().toISOString();
  const templateToSave: Template = {
    ...template,
    updatedAt: now,
    createdAt: template.createdAt || now,
    syncStatus: 'local',
  };

  localStorage.setItem(`${TEMPLATE_PREFIX}${template.id}`, JSON.stringify(templateToSave));

  // Update index
  const ids = getTemplateIds();
  if (!ids.includes(template.id)) {
    ids.push(template.id);
    localStorage.setItem(TEMPLATES_INDEX_KEY, JSON.stringify(ids));
  }
}

/**
 * Get template from localStorage
 */
export function getTemplate(id: string): Template | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(`${TEMPLATE_PREFIX}${id}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Get all templates from localStorage
 */
export function getAllTemplates(): Template[] {
  const ids = getTemplateIds();
  const templates: Template[] = [];

  for (const id of ids) {
    const template = getTemplate(id);
    if (template) {
      templates.push(template);
    }
  }

  return templates.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Delete template from localStorage
 */
export function deleteTemplate(id: string): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(`${TEMPLATE_PREFIX}${id}`);

  const ids = getTemplateIds().filter(i => i !== id);
  localStorage.setItem(TEMPLATES_INDEX_KEY, JSON.stringify(ids));
}

/**
 * Update template sync status
 */
export function updateSyncStatus(id: string, status: 'local' | 'syncing' | 'synced'): void {
  const template = getTemplate(id);
  if (template) {
    template.syncStatus = status;
    localStorage.setItem(`${TEMPLATE_PREFIX}${id}`, JSON.stringify(template));
  }
}

/**
 * Check if user is signed in (placeholder - integrate with Supabase auth)
 */
export function isUserSignedIn(): boolean {
  // TODO: Integrate with Supabase auth
  return false;
}

/**
 * Sync template to Supabase (placeholder)
 */
export async function syncTemplateToCloud(template: Template): Promise<void> {
  if (!isUserSignedIn()) return;

  updateSyncStatus(template.id, 'syncing');

  try {
    // TODO: Implement Supabase sync
    // const { error } = await supabase
    //   .from('templates')
    //   .upsert({
    //     id: template.id,
    //     user_id: supabase.auth.user()?.id,
    //     data: template,
    //     updated_at: new Date().toISOString(),
    //   });

    updateSyncStatus(template.id, 'synced');
  } catch (error) {
    console.error('Failed to sync template:', error);
    updateSyncStatus(template.id, 'local');
  }
}

/**
 * Fetch templates from Supabase (placeholder)
 */
export async function fetchTemplatesFromCloud(): Promise<Template[]> {
  if (!isUserSignedIn()) return [];

  try {
    // TODO: Implement Supabase fetch
    // const { data, error } = await supabase
    //   .from('templates')
    //   .select('*')
    //   .eq('user_id', supabase.auth.user()?.id);
    return [];
  } catch (error) {
    console.error('Failed to fetch templates from cloud:', error);
    return [];
  }
}

/**
 * Merge local and cloud templates (cloud wins on conflict)
 */
export async function mergeTemplates(): Promise<Template[]> {
  const localTemplates = getAllTemplates();

  if (!isUserSignedIn()) {
    return localTemplates;
  }

  const cloudTemplates = await fetchTemplatesFromCloud();

  const merged = new Map<string, Template>();

  // Add all local templates
  for (const t of localTemplates) {
    merged.set(t.id, t);
  }

  // Cloud wins on conflict
  for (const t of cloudTemplates) {
    const local = merged.get(t.id);
    if (!local || new Date(t.updatedAt) > new Date(local.updatedAt)) {
      merged.set(t.id, { ...t, syncStatus: 'synced' });
      saveTemplate({ ...t, syncStatus: 'synced' });
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Sync all local templates to cloud
 */
export async function syncAllToCloud(): Promise<void> {
  if (!isUserSignedIn()) return;

  const templates = getAllTemplates().filter(t => t.syncStatus !== 'synced');

  for (const template of templates) {
    await syncTemplateToCloud(template);
  }
}
