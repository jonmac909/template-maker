'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, House, Plus, FileText, Play, Sparkles, Edit3, X, Trash2 } from 'lucide-react';

interface SavedTemplate {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  locationsCount: number;
  scenesCount: number;
  createdAt: string;
  isDraft?: boolean;
  isEdit?: boolean;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [edits, setEdits] = useState<SavedTemplate[]>([]);
  const [drafts, setDrafts] = useState<SavedTemplate[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<SavedTemplate | null>(null);
  const router = useRouter();

  // Load saved data from localStorage on mount
  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = () => {
    const savedTemplates: SavedTemplate[] = [];
    const savedEdits: SavedTemplate[] = [];
    const savedDrafts: SavedTemplate[] = [];

    // Scan localStorage for templates
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('template_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          const templateId = key.replace('template_', '');

          const locationsCount = data.locations?.length || 0;
          const scenesCount = data.locations?.reduce((sum: number, loc: any) => sum + (loc.scenes?.length || 0), 0) || 0;

          // Skip corrupted/empty templates (0 locations AND 0 scenes)
          if (locationsCount === 0 && scenesCount === 0) {
            console.log('Skipping corrupted template:', templateId);
            // Auto-delete corrupted templates
            localStorage.removeItem(key);
            continue;
          }

          const item: SavedTemplate = {
            id: templateId,
            title: data.videoInfo?.title || 'Untitled Template',
            author: data.videoInfo?.author || 'Unknown',
            duration: data.totalDuration || data.videoInfo?.duration || 30,
            thumbnail: data.videoInfo?.thumbnail || '',
            locationsCount,
            scenesCount,
            createdAt: data.createdAt || new Date().toISOString(),
            isDraft: data.isDraft === true,
            isEdit: data.isEdit === true,
          };

          // Categorize based on flags
          if (item.isDraft) {
            savedDrafts.push(item);
          } else if (item.isEdit) {
            savedEdits.push(item);
          } else {
            savedTemplates.push(item);
          }
        } catch (e) {
          console.error('Failed to parse template:', key);
          // Remove corrupted JSON
          localStorage.removeItem(key!);
        }
      }
    }

    // Sort by creation date (newest first)
    const sortByDate = (a: SavedTemplate, b: SavedTemplate) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    setTemplates(savedTemplates.sort(sortByDate));
    setEdits(savedEdits.sort(sortByDate));
    setDrafts(savedDrafts.sort(sortByDate));
  };

  const handleDeleteClick = (template: SavedTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      localStorage.removeItem(`template_${templateToDelete.id}`);
      loadSavedData();
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setTemplateToDelete(null);
  };

  const handleExtract = async () => {
    const inputUrl = url.trim();
    if (!inputUrl) {
      setError('Please paste a TikTok URL');
      return;
    }

    console.log('Starting extraction for:', inputUrl);
    setLoading(true);
    setError(null);
    setStatus('Connecting...');

    try {
      const platform = inputUrl.includes('tiktok') ? 'tiktok' : 'instagram';
      console.log('Platform detected:', platform);
      setStatus('Extracting video info...');

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, platform }),
      });

      console.log('Response status:', response.status);
      setStatus('Processing response...');

      const text = await response.text();
      console.log('Response text length:', text.length);

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        throw new Error('Server returned invalid response');
      }

      if (!response.ok) {
        console.error('Response not ok:', data);
        throw new Error(data.error || 'Failed to extract template');
      }

      if (!data.templateId || !data.template) {
        console.error('Missing data:', { hasTemplateId: !!data.templateId, hasTemplate: !!data.template });
        throw new Error('Invalid response from server');
      }

      console.log('Template ID:', data.templateId);
      setStatus('Saving template...');

      // Store template in localStorage as DRAFT (until user saves it)
      const templateWithDraft = {
        ...data.template,
        isDraft: true,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(`template_${data.templateId}`, JSON.stringify(templateWithDraft));
      console.log('Saved to localStorage');

      // Reload saved data to show new template
      loadSavedData();

      // Switch to Drafts tab since new imports go to drafts
      setActiveTab('drafts');

      setStatus('Redirecting to preview...');
      // Go to template preview page first (then to editor)
      const previewUrl = `/template/${data.templateId}`;
      console.log('Navigating to:', previewUrl);
      router.push(previewUrl);
    } catch (err) {
      console.error('Extract error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract. Please try again.';
      setError(errorMessage);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTemplateClick = (templateId: string) => {
    router.push(`/template/${templateId}`);
  };

  const getAccentColor = (index: number) => {
    const colors = ['#8B5CF6', '#14B8A6', '#F472B6', '#FCD34D', '#E879F9', '#A78BFA', '#22D3EE'];
    return colors[index % colors.length];
  };

  // Render empty state for tabs
  const renderEmptyState = (type: 'edits' | 'drafts') => {
    const config = {
      edits: {
        icon: <Edit3 className="w-10 h-10 text-white/20" />,
        title: 'No edits yet',
        description: 'Your completed edits will appear here',
      },
      drafts: {
        icon: <FileText className="w-10 h-10 text-white/20" />,
        title: 'No drafts yet',
        description: 'Drafts you save will appear here',
      },
    };

    const { icon, title, description } = config[type];

    return (
      <div className="flex flex-col items-center justify-center py-16 px-8">
        <div className="w-20 h-20 rounded-full bg-[var(--bg-card)] flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-[var(--text-primary)] font-semibold text-base mb-1">{title}</h3>
        <p className="text-[var(--text-secondary)] text-sm text-center">{description}</p>
      </div>
    );
  };

  // Render template grid
  const renderTemplateGrid = (items: SavedTemplate[], emptyType?: 'edits' | 'drafts') => {
    if (items.length === 0 && emptyType) {
      return renderEmptyState(emptyType);
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-8">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-card)] flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-[var(--text-primary)] font-semibold text-base mb-1">No templates yet</h3>
          <p className="text-[var(--text-secondary)] text-sm text-center">Paste a TikTok URL above to extract your first template</p>
        </div>
      );
    }

    // Create rows of 2 items each
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }

    return (
      <div className="flex flex-col gap-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-3">
            {row.map((template, idx) => (
              <div
                key={template.id}
                className="flex-1 flex flex-col gap-2 text-left"
              >
                {/* Portrait Thumbnail - 9:16 aspect ratio */}
                <div
                  className="relative rounded-2xl overflow-hidden cursor-pointer"
                  style={{
                    aspectRatio: '9/16',
                    backgroundColor: template.thumbnail ? '#1A1A2E' : getAccentColor(rowIndex * 2 + idx),
                  }}
                  onClick={() => handleTemplateClick(template.id)}
                >
                  {template.thumbnail && (
                    <img
                      src={template.thumbnail}
                      alt={template.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        // Hide broken image, show color fallback
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  {/* Gradient overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteClick(template, e)}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-red-500/80 transition-colors z-10"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  {/* Play Button */}
                  <div className="absolute left-2 bottom-12 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                  {/* Duration */}
                  <div className="absolute right-2 bottom-3 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm">
                    <span className="text-white text-[10px] font-semibold">
                      {formatDuration(template.duration)}
                    </span>
                  </div>
                  {/* Draft/Edit badge */}
                  {(template.isDraft || template.isEdit) && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#8B5CF6]">
                      <span className="text-white text-[9px] font-semibold uppercase">
                        {template.isDraft ? 'Draft' : 'Edit'}
                      </span>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex flex-col gap-0.5 px-0.5">
                  <h3 className="text-[12px] font-semibold text-[var(--text-primary)] line-clamp-1">
                    {template.title}
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {template.locationsCount} locations • {template.scenesCount} scenes
                  </p>
                </div>
              </div>
            ))}
            {/* Add empty placeholder if odd number of items in last row */}
            {row.length === 1 && <div className="flex-1" />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[var(--bg-page)]">
      {/* Nav Bar */}
      <div className="flex items-center justify-between h-14 px-6 pt-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          TemplateMaker
        </h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-[20px] bg-[var(--bg-card)]">
          <Settings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-6 px-6 pt-4 pb-3 overflow-y-auto">
        {/* Import from URL Card */}
        <div className="flex flex-col gap-3">
          <div className="rounded-[20px] bg-[var(--accent-purple)] p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-semibold">📎 Import from URL</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                placeholder="Paste TikTok or Reel URL..."
                className="flex-1 bg-white rounded-[18px] px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button
                onClick={handleExtract}
                disabled={loading}
                className={`w-12 h-12 flex items-center justify-center rounded-[18px] bg-white transition-all ${
                  url.trim() ? 'hover:scale-105 active:scale-95' : 'opacity-50'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-[#8B5CF6] text-xl font-bold">→</span>
                )}
              </button>
            </div>
            {loading && status && (
              <p className="text-white/70 text-xs mt-2">{status}</p>
            )}
            {error && (
              <p className="text-red-200 text-xs mt-1">{error}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[var(--bg-card)] rounded-[22px] p-1 flex h-11">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 rounded-[18px] flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-white text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('edits')}
            className={`flex-1 rounded-[18px] flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'edits'
                ? 'bg-white text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            My Edits
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className={`flex-1 rounded-[18px] flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === 'drafts'
                ? 'bg-white text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Drafts
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'templates' && renderTemplateGrid(templates)}
        {activeTab === 'edits' && renderTemplateGrid(edits, 'edits')}
        {activeTab === 'drafts' && renderTemplateGrid(drafts, 'drafts')}
      </div>

      {/* Bottom Nav */}
      <div className="h-18 flex items-center justify-around px-8 pb-6 pt-3 bg-[#FAFAFA] border-t border-[#E4E4E7]">
        <button className="w-9 h-9 flex items-center justify-center">
          <House className="w-7 h-7" style={{ color: 'var(--accent-purple)' }} />
        </button>
        <button className="w-14 h-14 flex items-center justify-center rounded-[28px] bg-[var(--accent-purple)]">
          <Plus className="w-7 h-7 text-white" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center">
          <FileText className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && templateToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
              Delete Template?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Are you sure you want to delete "{templateToDelete.title.slice(0, 30)}{templateToDelete.title.length > 30 ? '...' : ''}"? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
