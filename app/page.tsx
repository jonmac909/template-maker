'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, House, Plus, FileText, Play, Sparkles, Edit3, X, Trash2, Upload, Link } from 'lucide-react';

// Version for debugging deployment - if you see this, the new code is deployed
const APP_VERSION = 'v2.2.0-real-streaming';

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
  const [inputMode, setInputMode] = useState<'url' | 'upload'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

          // Skip and delete corrupted templates:
          // - 0 locations AND 0 scenes
          // - Missing videoInfo
          // - "Untitled Template" title (indicates corrupted/incomplete extraction)
          const isCorrupted = (locationsCount === 0 && scenesCount === 0) ||
                             !data.videoInfo ||
                             !data.videoInfo.title ||
                             data.videoInfo.title === 'Untitled Template';

          if (isCorrupted) {
            console.log('[v2.0.2] Auto-deleting corrupted template:', templateId, {
              locationsCount,
              scenesCount,
              hasVideoInfo: !!data.videoInfo,
              title: data.videoInfo?.title,
            });
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
    setProgress(5);
    setStatus('Connecting...');

    try {
      const platform = inputUrl.includes('tiktok') ? 'tiktok' : 'instagram';
      console.log('Platform detected:', platform);

      // Use fetch with streaming response for real-time progress
      const response = await fetch('/api/extract-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, platform }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let templateData: any = null;
      let buffer = '';

      // Read the SSE stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('SSE event:', data);
              
              // Update progress based on stage
              if (data.stage) {
                switch (data.stage) {
                  case 'downloading':
                    setProgress(data.progress || 15);
                    setStatus('Downloading video...');
                    break;
                  case 'extracting':
                    setProgress(data.progress || 35);
                    setStatus('Extracting frames...');
                    break;
                  case 'analyzing':
                    setProgress(data.progress || 55);
                    setStatus('Analyzing with AI...');
                    break;
                  case 'detecting':
                    setProgress(data.progress || 70);
                    setStatus('Detecting scenes...');
                    break;
                  case 'building':
                    setProgress(data.progress || 85);
                    setStatus('Building template...');
                    break;
                  case 'complete':
                    setProgress(95);
                    setStatus('Processing results...');
                    templateData = data;
                    break;
                  case 'error':
                    throw new Error(data.error || 'Extraction failed');
                }
              }
              
              // Also handle direct progress updates
              if (data.progress && !data.stage) {
                setProgress(data.progress);
              }
              if (data.status) {
                setStatus(data.status);
              }
            } catch (parseErr) {
              // Ignore parse errors for incomplete JSON
              console.log('Parse error (may be incomplete):', parseErr);
            }
          }
        }
      }

      // If we didn't get template data from stream, fall back to regular endpoint
      if (!templateData || !templateData.templateId) {
        console.log('No template from stream, falling back to regular endpoint');
        setProgress(50);
        setStatus('Processing (fallback)...');
        
        const fallbackResponse = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputUrl, platform }),
        });
        
        templateData = await fallbackResponse.json();
      }

      setProgress(95);
      setStatus('Processing results...');

      if (!templateData.templateId || !templateData.template) {
        throw new Error('Failed to build template');
      }

      setStatus('Saving template...');
      setProgress(98);

      // Validate template has required fields
      if (!templateData.template.locations || templateData.template.locations.length === 0) {
        throw new Error('Extraction failed - no locations found');
      }

      // Store template in localStorage as DRAFT
      const templateWithDraft = {
        ...templateData.template,
        isDraft: true,
        isEdit: false,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(`template_${templateData.templateId}`, JSON.stringify(templateWithDraft));

      // Reload saved data
      loadSavedData();
      setActiveTab('drafts');

      setStatus('Redirecting to preview...');
      setProgress(100);
      // Go to template preview page first (then to editor)
      const previewUrl = `/template/${templateData.templateId}`;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type - accept any video
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        setError('Video file must be less than 100MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  // Extract frames from video using canvas (client-side)
  const extractFramesFromVideo = async (file: File): Promise<{ frames: string[]; duration: number }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.onloadedmetadata = async () => {
        const duration = video.duration;
        console.log('[Client] Video duration:', duration);

        // Set canvas size (720p max for efficiency)
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        // Extract 1 frame per second - an 18 second video gets 18 frames
        // This ensures we catch every location (they appear ~1 second each)
        const numFrames = Math.min(30, Math.max(10, Math.ceil(duration)));
        const timestamps: number[] = [];

        // One frame per second
        for (let i = 0; i < numFrames; i++) {
          // Start at 0.5s, then 1.5s, 2.5s, etc. to catch mid-second content
          const t = Math.min(i + 0.5, duration - 0.1);
          timestamps.push(t);
        }

        console.log('[Client] Extracting frames at:', timestamps);
        const frames: string[] = [];

        // Extract each frame
        for (let i = 0; i < timestamps.length; i++) {
          setStatus(`Extracting frame ${i + 1}/${timestamps.length}...`);

          try {
            const frame = await extractFrameAtTime(video, canvas, ctx, timestamps[i]);
            if (frame) {
              frames.push(frame);
            }
          } catch (e) {
            console.log(`[Client] Failed to extract frame at ${timestamps[i]}s`);
          }
        }

        URL.revokeObjectURL(objectUrl);
        resolve({ frames, duration });
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load video'));
      };
    });
  };

  // Extract a single frame at a specific timestamp
  const extractFrameAtTime = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    time: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Frame extraction timeout')), 5000);

      video.currentTime = time;

      video.onseeked = () => {
        clearTimeout(timeout);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Get base64 without the data:image/jpeg;base64, prefix
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };

      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Video seek error'));
      };
    });
  };

  const handleUploadExtract = async () => {
    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }

    console.log('[Client] Starting frame extraction for:', selectedFile.name);
    setLoading(true);
    setError(null);
    setStatus('Loading video...');

    try {
      // Extract frames client-side (no file size limit!)
      const { frames, duration } = await extractFramesFromVideo(selectedFile);

      if (frames.length === 0) {
        throw new Error('Could not extract any frames from video');
      }

      console.log('[Client] Extracted', frames.length, 'frames, sending to API...');
      setStatus('Analyzing frames...');

      // Send just the frames (not the whole video) - much smaller!
      const response = await fetch('/api/analyze-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames,
          title: selectedFile.name.replace(/\.[^/.]+$/, ''),
          duration: Math.round(duration),
        }),
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

      console.log(`[${APP_VERSION}] Template ID:`, data.templateId);
      setStatus('Saving template...');

      // Validate template has required fields
      if (!data.template.locations || data.template.locations.length === 0) {
        console.error(`[${APP_VERSION}] Invalid template - no locations!`);
        throw new Error('Extraction failed - no locations found');
      }

      // Store template in localStorage as DRAFT
      const templateWithDraft = {
        ...data.template,
        isDraft: true,
        isEdit: false,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(`template_${data.templateId}`, JSON.stringify(templateWithDraft));
      console.log(`[${APP_VERSION}] Saved to localStorage`);

      // Reload saved data
      loadSavedData();

      // Switch to Drafts tab
      setActiveTab('drafts');

      // Reset file selection
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setStatus('Redirecting to preview...');
      router.push(`/template/${data.templateId}`);
    } catch (err) {
      console.error('Upload extract error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process video. Please try again.';
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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            TemplateMaker
          </h1>
          <span className="text-[9px] text-[var(--text-tertiary)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded">{APP_VERSION}</span>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-[20px] bg-[var(--bg-card)]">
          <Settings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-6 px-6 pt-4 pb-3 overflow-y-auto">
        {/* Import Card - Mobile Optimized */}
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="rounded-[16px] sm:rounded-[20px] bg-[var(--accent-purple)] p-3 sm:p-5 flex flex-col gap-2.5 sm:gap-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex bg-white/20 rounded-full p-0.5">
                <button
                  onClick={() => { setInputMode('url'); setError(null); }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                    inputMode === 'url' ? 'bg-white text-[#8B5CF6]' : 'text-white/80'
                  }`}
                >
                  <Link className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  URL
                </button>
                <button
                  onClick={() => { setInputMode('upload'); setError(null); }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all ${
                    inputMode === 'upload' ? 'bg-white text-[#8B5CF6]' : 'text-white/80'
                  }`}
                >
                  <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Upload
                </button>
              </div>
            </div>

            {/* URL Input */}
            {inputMode === 'url' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder="Paste TikTok or Reel URL..."
                  className="flex-1 bg-white rounded-[14px] sm:rounded-[18px] px-3 sm:px-4 py-2.5 sm:py-3 text-[13px] sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  onClick={handleExtract}
                  disabled={loading}
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-[14px] sm:rounded-[18px] bg-white transition-all ${
                    url.trim() ? 'hover:scale-105 active:scale-95' : 'opacity-50'
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-[#8B5CF6] text-lg sm:text-xl font-bold">→</span>
                  )}
                </button>
              </div>
            )}

            {/* Upload Input - Compact on Mobile */}
            {inputMode === 'upload' && (
              <div className="flex flex-col gap-2 sm:gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 bg-white/20 border-2 border-dashed border-white/40 rounded-[14px] sm:rounded-[18px] px-3 sm:px-4 py-2.5 sm:py-4 cursor-pointer hover:bg-white/30 transition-all ${
                    selectedFile ? 'border-white' : ''
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-white">
                      <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="text-[12px] sm:text-sm font-medium truncate max-w-[160px] sm:max-w-[200px]">{selectedFile.name}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="ml-0.5 sm:ml-1 p-0.5 sm:p-1 hover:bg-white/20 rounded-full flex-shrink-0"
                      >
                        <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-white/70 flex-shrink-0" />
                      <span className="text-white/70 text-[11px] sm:text-sm">Select video (.mp4, .mov)</span>
                    </>
                  )}
                </label>
                <button
                  onClick={handleUploadExtract}
                  disabled={loading || !selectedFile}
                  className={`w-full h-9 sm:h-12 flex items-center justify-center gap-1.5 sm:gap-2 rounded-[14px] sm:rounded-[18px] bg-white transition-all ${
                    selectedFile && !loading ? 'hover:scale-[1.02] active:scale-[0.98]' : 'opacity-50'
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8B5CF6]" />
                      <span className="text-[#8B5CF6] text-[13px] sm:text-base font-semibold">Extract Template</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {loading && (
              <div className="space-y-2 w-full">
                {/* Progress bar */}
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#8B5CF6] h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {/* Status text with percentage */}
                <div className="flex justify-between items-center">
                  <p className="text-white/70 text-xs">{status}</p>
                  <p className="text-white/50 text-xs font-mono">{progress}%</p>
                </div>
              </div>
            )}
            {error && (
              <p className="text-red-200 text-xs">{error}</p>
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
