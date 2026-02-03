'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Play, Pause, Music, Type, Grid3X3, Trash2, Copy, Clock, Pencil, Check, X, Upload } from 'lucide-react';
import { getVideoUrl } from '../../../lib/videoStorage';

// Google Fonts to support
const GOOGLE_FONTS = [
  'Poppins', 'Montserrat', 'Bebas+Neue', 'Oswald', 'Playfair+Display', 
  'Dancing+Script', 'Pacifico', 'Lato', 'Roboto', 'Open+Sans', 
  'Raleway', 'Anton', 'Inter', 'Space+Grotesk', 'DM+Sans'
];

// Load a Google Font dynamically
function loadGoogleFont(fontFamily: string) {
  if (typeof window === 'undefined') return;
  
  const fontName = fontFamily.replace(/ /g, '+');
  const linkId = `google-font-${fontName}`;
  
  if (document.getElementById(linkId)) return; // Already loaded
  
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  backgroundColor?: string;
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

interface TextOverlay {
  id: string;
  text: string;
  style: TextStyle;
  startTime: number;
  endTime: number;
}

interface TimelineClip {
  id: string;
  sceneIndex: number;
  sceneId: number;
  locationId: number;
  locationName: string;
  startTime: number;
  duration: number;
  videoId?: string;
  thumbnail?: string;
  trimData?: TrimData;
  userVideoDuration?: number;
}

interface TemplateFontStyle {
  fontFamily: string;
  category: string;
  weight: string;
  color: string;
  detected?: string | null;
  suggested?: string;
}

interface Template {
  id: string;
  type: 'reel';
  totalDuration: number;
  fontStyle?: TemplateFontStyle;
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
    videoUrl: string;
  };
  locations: Array<{
    locationId: number;
    locationName: string;
    scenes: Array<{
      id: number;
      startTime: number;
      endTime: number;
      duration: number;
      textOverlay: string | null;
      textStyle?: TextStyle;
      thumbnail?: string;
      userVideoId?: string;
      userVideo?: File | null;
      userThumbnail?: string;
      userVideoDuration?: number;
      filled: boolean;
      trimData?: TrimData;
    }>;
    totalDuration: number;
  }>;
}

type BottomTab = 'media' | 'audio' | 'text';

export default function CapCutEditor() {
  const params = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTab, setActiveTab] = useState<BottomTab>('media');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(10);

  // Video state
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);

  // Text editing state
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  // Load template
  useEffect(() => {
    loadTemplate();
  }, [params.id]);

  // Load detected font when template is loaded
  useEffect(() => {
    if (template?.fontStyle?.fontFamily) {
      loadGoogleFont(template.fontStyle.fontFamily);
      console.log('[Font] Loading detected font:', template.fontStyle.fontFamily);
    }
  }, [template?.fontStyle?.fontFamily]);

  const loadTemplate = async () => {
    try {
      const stored = localStorage.getItem(`template_${params.id}`);
      if (stored) {
        const data: Template = JSON.parse(stored);
        setTemplate(data);
        initializeTimeline(data);
        
        // Use original TikTok video for preview (high quality!)
        if (data.videoInfo?.videoUrl) {
          setOriginalVideoUrl(data.videoInfo.videoUrl);
          console.log('[Video] Using original video:', data.videoInfo.videoUrl.substring(0, 50) + '...');
        }
      }
    } catch (error) {
      console.error('Failed to load template:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeTimeline = (data: Template) => {
    const timelineClips: TimelineClip[] = [];
    const overlays: TextOverlay[] = [];
    let currentStartTime = 0;
    let sceneIndex = 0;

    data.locations.forEach((location) => {
      const locationStartTime = currentStartTime;

      location.scenes.forEach((scene) => {
        const sceneDuration = scene.trimData
          ? (scene.trimData.outTime - scene.trimData.inTime)
          : (scene.duration || 1);
        
        const clip: TimelineClip = {
          id: `clip-${location.locationId}-${scene.id}`,
          sceneIndex: sceneIndex++,
          sceneId: scene.id,
          locationId: location.locationId,
          locationName: location.locationName,
          startTime: currentStartTime,
          duration: Math.max(0.5, sceneDuration),
          videoId: scene.userVideoId,
          thumbnail: scene.filled ? scene.userThumbnail : scene.thumbnail,
          trimData: scene.trimData,
          userVideoDuration: scene.userVideoDuration,
        };
        timelineClips.push(clip);
        currentStartTime += clip.duration;
      });

      // One text overlay per location - using detected font
      if (location.locationName) {
        const detectedFont = data.fontStyle?.fontFamily || 'Poppins';
        const fontWeight = data.fontStyle?.weight || '500';
        const fontColor = data.fontStyle?.color || '#FFFFFF';
        
        overlays.push({
          id: `text-${location.locationId}`,
          text: `📍 ${location.locationName}`,
          style: {
            fontFamily: detectedFont,
            fontSize: 16,
            fontWeight: fontWeight === 'bold' ? '700' : fontWeight === 'semibold' ? '600' : '500',
            color: fontColor,
            hasEmoji: true,
            emoji: '📍',
            emojiPosition: 'before',
            position: 'center',
            alignment: 'center',
          },
          startTime: locationStartTime,
          endTime: currentStartTime,
        });
      }
    });

    setClips(timelineClips);
    setTextOverlays(overlays);
    setTotalDuration(currentStartTime || 10);

    // Load first clip's video
    if (timelineClips.length > 0 && timelineClips[0].videoId) {
      loadVideoForClip(timelineClips[0]);
    }
  };

  const loadVideoForClip = async (clip: TimelineClip) => {
    if (clip.videoId) {
      const url = await getVideoUrl(clip.videoId);
      if (url) {
        setCurrentVideoUrl(url);
      }
    }
  };

  // Get current clip based on playback time
  const getCurrentClip = useCallback(() => {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        return { clip, index: i };
      }
    }
    return clips.length > 0 ? { clip: clips[0], index: 0 } : null;
  }, [clips, currentTime]);

  // Get current text overlay
  const getCurrentTextOverlay = useCallback(() => {
    return textOverlays.find(
      t => currentTime >= t.startTime && currentTime < t.endTime
    );
  }, [textOverlays, currentTime]);

  // Update video when clip changes
  useEffect(() => {
    const current = getCurrentClip();
    if (current && current.index !== currentClipIndex) {
      setCurrentClipIndex(current.index);
      loadVideoForClip(current.clip);
    }
  }, [getCurrentClip, currentClipIndex]);

  // Playback timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.1;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // Sync video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && currentVideoUrl) {
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [isPlaying, currentVideoUrl]);

  const togglePlayback = () => {
    setIsPlaying(prev => !prev);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectClip = async (index: number) => {
    const clip = clips[index];
    if (clip) {
      setCurrentClipIndex(index);
      setCurrentTime(clip.startTime);
      setSelectedTextId(null);
      
      // ALWAYS try to load user's uploaded video first
      if (clip.videoId) {
        const url = await getVideoUrl(clip.videoId);
        if (url) {
          setCurrentVideoUrl(url);
          return; // User video found, don't use original
        }
      }
      
      // No user video - clear it and fall back to original TikTok
      setCurrentVideoUrl(null);
      if (videoRef.current && originalVideoUrl) {
        videoRef.current.currentTime = clip.startTime;
      }
    }
  };

  // Text editing functions
  const startEditingText = (textId: string) => {
    const overlay = textOverlays.find(t => t.id === textId);
    if (overlay) {
      setEditingTextId(textId);
      setEditingTextValue(overlay.text);
    }
  };

  const saveTextEdit = () => {
    if (editingTextId) {
      setTextOverlays(overlays =>
        overlays.map(t =>
          t.id === editingTextId ? { ...t, text: editingTextValue } : t
        )
      );
      setEditingTextId(null);
      setEditingTextValue('');
    }
  };

  const cancelTextEdit = () => {
    setEditingTextId(null);
    setEditingTextValue('');
  };

  const duplicateText = (textId: string) => {
    const overlay = textOverlays.find(t => t.id === textId);
    if (overlay) {
      const newOverlay = {
        ...overlay,
        id: `text-${Date.now()}`,
        text: `${overlay.text} (copy)`,
      };
      setTextOverlays([...textOverlays, newOverlay]);
    }
  };

  const deleteText = (textId: string) => {
    setTextOverlays(overlays => overlays.filter(t => t.id !== textId));
    setSelectedTextId(null);
  };

  const handleExport = () => {
    // Save template state
    if (template) {
      const updatedTemplate = {
        ...template,
        timelineData: {
          clips,
          textOverlays,
        },
        isDraft: true,
        editedAt: new Date().toISOString(),
      };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    router.push(`/preview/reel/${params.id}`);
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00D4AA] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const currentTextOverlay = getCurrentTextOverlay();
  const selectedText = selectedTextId ? textOverlays.find(t => t.id === selectedTextId) : null;

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Header - CapCut style */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        {/* Audio selector */}
        <button className="flex items-center gap-2 px-4 py-2 bg-[#2A2A2A] rounded-full">
          <Music className="w-4 h-4 text-white" />
          <span className="text-white text-sm">Original</span>
        </button>

        {/* Export button - teal like CapCut */}
        <button
          onClick={handleExport}
          className="px-5 py-2 bg-[#00D4AA] rounded-full"
        >
          <span className="text-black font-semibold text-sm">Export</span>
        </button>
      </div>

      {/* Video Preview - Large like CapCut */}
      <div className="flex-1 flex justify-center items-center px-4 min-h-0">
        <div className="relative w-full max-w-[320px] aspect-[9/16] bg-[#1A1A1A] rounded-lg overflow-hidden">
          {/* Video - PREFER USER'S UPLOADED VIDEO, fall back to original TikTok */}
          {currentVideoUrl ? (
            // User's uploaded video for this clip
            <video
              ref={videoRef}
              src={currentVideoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              loop
              preload="auto"
            />
          ) : originalVideoUrl ? (
            // Fall back to original TikTok video (with time seeking)
            <video
              ref={videoRef}
              src={originalVideoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              loop
              preload="auto"
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                const clip = clips[currentClipIndex];
                if (clip && video.duration) {
                  video.currentTime = Math.min(clip.startTime, video.duration - 0.1);
                }
              }}
            />
          ) : clips[currentClipIndex]?.thumbnail ? (
            <img
              src={clips[currentClipIndex].thumbnail}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/30 text-sm">No video</span>
            </div>
          )}

          {/* CapCut watermark position */}
          <div className="absolute top-3 right-3 opacity-50">
            <span className="text-white text-xs">✂️ TemplateMaker</span>
          </div>

          {/* Text Overlay - Tap to select */}
          {currentTextOverlay && (
            <button
              onClick={() => {
                setSelectedTextId(currentTextOverlay.id);
                setActiveTab('text');
              }}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 transition-all ${
                selectedTextId === currentTextOverlay.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent'
                  : ''
              }`}
            >
              {selectedTextId === currentTextOverlay.id && (
                <>
                  {/* Selection handles like CapCut */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-black" onClick={(e) => { e.stopPropagation(); deleteText(currentTextOverlay.id); }} />
                  </div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <span className="text-black text-xs">↻</span>
                  </div>
                </>
              )}
              <span 
                className="text-lg drop-shadow-lg"
                style={{ 
                  fontFamily: currentTextOverlay.style.fontFamily || template?.fontStyle?.fontFamily || 'Poppins',
                  fontWeight: currentTextOverlay.style.fontWeight || '500',
                  color: currentTextOverlay.style.color || '#FFFFFF',
                }}
              >
                {currentTextOverlay.text}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Timecode + Play button */}
      <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
        <span className="text-white text-sm font-medium">
          {formatTime(currentTime)}
        </span>
        <button
          onClick={togglePlayback}
          className="w-10 h-10 flex items-center justify-center"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white" fill="white" />
          ) : (
            <Play className="w-6 h-6 text-white" fill="white" />
          )}
        </button>
        <span className="text-white/50 text-sm">
          {formatTime(totalDuration)}
        </span>
      </div>

      {/* Text Editing Panel - Shows when editing */}
      {editingTextId && (
        <div className="px-4 py-3 bg-[#1A1A1A] flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              className="flex-1 bg-[#2A2A2A] text-white px-4 py-3 rounded-lg text-sm outline-none"
              autoFocus
              placeholder="Enter text..."
            />
            <button
              onClick={cancelTextEdit}
              className="w-10 h-10 flex items-center justify-center text-white/50"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={saveTextEdit}
              className="w-10 h-10 flex items-center justify-center text-[#00D4AA]"
            >
              <Check className="w-5 h-5" />
            </button>
          </div>
          
          {/* Text options bar */}
          <div className="flex items-center gap-4 mt-3 text-white/70 text-sm">
            <button className="px-3 py-1 bg-[#2A2A2A] rounded">Text presets</button>
            <button className="px-3 py-1">Color</button>
            <button className="px-3 py-1">Font</button>
            <button className="px-3 py-1">Align</button>
          </div>
        </div>
      )}

      {/* Selected Text Actions - CapCut style bottom bar */}
      {selectedTextId && !editingTextId && (
        <div className="flex items-center justify-around py-3 bg-[#1A1A1A] border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => startEditingText(selectedTextId)}
            className="flex flex-col items-center gap-1"
          >
            <Pencil className="w-5 h-5 text-white" />
            <span className="text-white text-xs">Edit</span>
          </button>
          <button
            onClick={() => duplicateText(selectedTextId)}
            className="flex flex-col items-center gap-1"
          >
            <Copy className="w-5 h-5 text-white" />
            <span className="text-white text-xs">Duplicate</span>
          </button>
          <button className="flex flex-col items-center gap-1">
            <Clock className="w-5 h-5 text-white" />
            <span className="text-white text-xs">Set duration</span>
          </button>
          <button
            onClick={() => deleteText(selectedTextId)}
            className="flex flex-col items-center gap-1"
          >
            <Trash2 className="w-5 h-5 text-white" />
            <span className="text-white text-xs">Delete</span>
          </button>
        </div>
      )}

      {/* Timeline - Horizontal clips with thumbnails like CapCut */}
      {!editingTextId && (
        <div 
          ref={timelineRef}
          className="overflow-x-auto px-4 py-3 flex-shrink-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-2">
            {clips.map((clip, index) => {
              // PRIORITY: User's thumbnail > Scene thumbnail > Original video thumbnail
              const thumbnailUrl = clip.thumbnail || template?.videoInfo?.thumbnail;
              const hasUserContent = !!clip.videoId;
              
              return (
                <button
                  key={clip.id}
                  onClick={() => selectClip(index)}
                  className={`relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden transition-all ${
                    currentClipIndex === index ? 'ring-2 ring-white' : ''
                  }`}
                >
                  {/* Thumbnail - use img for better quality */}
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`Clip ${index + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#2A2A2A] flex items-center justify-center">
                      <span className="text-white/30 text-[8px]">{index + 1}</span>
                    </div>
                  )}
                  
                  {/* Show checkmark if user has uploaded content */}
                  {hasUserContent && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-[#00D4AA] rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  
                  {/* Clip number badge */}
                  <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                    {index + 1}
                  </div>
                  
                  {/* Duration badge */}
                  <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white">
                    {clip.duration.toFixed(1)}s
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Tabs - CapCut style */}
      <div className="flex items-center justify-around py-4 border-t border-white/10 flex-shrink-0 bg-black">
        <button
          onClick={() => { setActiveTab('media'); setSelectedTextId(null); }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'media' ? 'text-[#00D4AA]' : 'text-white/50'}`}
        >
          <Grid3X3 className="w-6 h-6" />
          <span className="text-xs">Media</span>
          {activeTab === 'media' && <div className="w-1 h-1 bg-[#00D4AA] rounded-full mt-0.5" />}
        </button>
        <button
          onClick={() => { setActiveTab('audio'); setSelectedTextId(null); }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'audio' ? 'text-[#00D4AA]' : 'text-white/50'}`}
        >
          <Music className="w-6 h-6" />
          <span className="text-xs">Audio</span>
          {activeTab === 'audio' && <div className="w-1 h-1 bg-[#00D4AA] rounded-full mt-0.5" />}
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'text' ? 'text-[#00D4AA]' : 'text-white/50'}`}
        >
          <Type className="w-6 h-6" />
          <span className="text-xs">Text</span>
          {activeTab === 'text' && <div className="w-1 h-1 bg-[#00D4AA] rounded-full mt-0.5" />}
        </button>
      </div>
    </div>
  );
}
