'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Scissors, Type, Music, Trash2, GripHorizontal, Volume2, VolumeX } from 'lucide-react';

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

interface TextOverlay {
  id: string;
  text: string;
  style: TextStyle;
  startTime: number;
  endTime: number;
  trackIndex: number;
}

interface TimelineClip {
  id: string;
  sceneId: number;
  locationId: number;
  locationName: string;
  color: string;
  startTime: number;
  duration: number;
  videoUrl?: string;
  thumbnail?: string;
  textOverlay?: string;
  textStyle?: TextStyle;
  muted: boolean;
}

interface ExtractedFonts {
  titleFont?: {
    style: 'script' | 'serif' | 'sans-serif' | 'display';
    weight: string;
    description: string;
  };
  locationFont?: {
    style: 'script' | 'serif' | 'sans-serif' | 'display';
    weight: string;
    description: string;
  };
}

interface Template {
  id: string;
  type: 'reel';
  totalDuration: number;
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
      userVideo?: File | null;
      userThumbnail?: string;
      filled: boolean;
    }>;
    totalDuration: number;
  }>;
  extractedFonts?: ExtractedFonts;
}

const LOCATION_COLORS = ['#8B5CF6', '#14B8A6', '#F472B6', '#FCD34D', '#E879F9', '#A78BFA', '#22D3EE'];

// Pixels per second for timeline (wider = more scrollable)
const PIXELS_PER_SECOND = 80;

type EditorTab = 'trim' | 'text' | 'audio';

export default function TimelineEditor() {
  const params = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTab, setActiveTab] = useState<EditorTab>('trim');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);

  // Selection state
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [selectedTextOverlay, setSelectedTextOverlay] = useState<string | null>(null);

  // Audio state
  const [globalMuted, setGlobalMuted] = useState(false);
  const [backgroundMusic, setBackgroundMusic] = useState<string | null>(null);

  // Text editing
  const [editingText, setEditingText] = useState<TextOverlay | null>(null);

  useEffect(() => {
    loadTemplate();
  }, [params.id]);

  const loadTemplate = async () => {
    try {
      const stored = localStorage.getItem(`template_${params.id}`);
      if (stored) {
        const data: Template = JSON.parse(stored);
        setTemplate(data);
        initializeTimeline(data);
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

    data.locations.forEach((location, locIdx) => {
      const color = LOCATION_COLORS[locIdx % LOCATION_COLORS.length];
      const isIntro = locIdx === 0 && location.locationName.toLowerCase().includes('intro');

      location.scenes.forEach((scene, sceneIdx) => {
        // Use the scene's text overlay and style (which should have extracted data)
        let displayTextOverlay: string | undefined;
        let displayTextStyle = scene.textStyle;

        if (isIntro) {
          // Intro scene - use extracted hook text if available
          displayTextOverlay = scene.textOverlay || undefined;
          // Use extracted title style or default
          displayTextStyle = scene.textStyle || {
            fontFamily: 'Poppins',
            fontSize: 24,
            fontWeight: '700',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.5)',
            hasEmoji: false,
            position: 'center',
            alignment: 'center',
          };
        } else {
          // Location scenes - show location name with extracted style
          displayTextOverlay = location.locationName;
          displayTextStyle = scene.textStyle || {
            fontFamily: 'Poppins',
            fontSize: 18,
            fontWeight: '600',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.5)',
            hasEmoji: true,
            emoji: '📍',
            emojiPosition: 'before',
            position: 'bottom',
            alignment: 'left',
          };
        }

        const clip: TimelineClip = {
          id: `clip-${location.locationId}-${scene.id}`,
          sceneId: scene.id,
          locationId: location.locationId,
          locationName: location.locationName,
          color,
          startTime: currentStartTime,
          duration: scene.duration,
          // Only show user-uploaded thumbnails, not original TikTok thumbnails
          thumbnail: scene.filled ? scene.userThumbnail : undefined,
          textOverlay: displayTextOverlay,
          textStyle: displayTextStyle,
          muted: false,
        };
        timelineClips.push(clip);

        if (displayTextOverlay) {
          overlays.push({
            id: `text-${location.locationId}-${scene.id}`,
            text: displayTextOverlay,
            style: displayTextStyle || {
              fontFamily: 'Poppins',
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF',
              hasEmoji: true,
              emoji: '📍',
              emojiPosition: 'before',
              position: 'bottom',
              alignment: 'left',
            },
            startTime: currentStartTime,
            endTime: currentStartTime + scene.duration,
            trackIndex: 0,
          });
        }

        currentStartTime += scene.duration;
      });
    });

    setClips(timelineClips);
    setTextOverlays(overlays);
    setTotalDuration(currentStartTime);
  };

  const togglePlayback = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

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

  useEffect(() => {
    const clipIndex = clips.findIndex(
      clip => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
    );
    if (clipIndex !== -1) {
      setCurrentClipIndex(clipIndex);
    }
  }, [currentTime, clips]);

  // Auto-scroll timeline to follow playhead
  useEffect(() => {
    if (timelineScrollRef.current && isPlaying) {
      const playheadX = currentTime * PIXELS_PER_SECOND;
      const scrollContainer = timelineScrollRef.current;
      const containerWidth = scrollContainer.clientWidth;
      const scrollLeft = scrollContainer.scrollLeft;

      if (playheadX > scrollLeft + containerWidth - 50 || playheadX < scrollLeft + 50) {
        scrollContainer.scrollTo({
          left: Math.max(0, playheadX - containerWidth / 2),
          behavior: 'smooth',
        });
      }
    }
  }, [currentTime, isPlaying]);

  const currentTextOverlay = textOverlays.find(
    overlay => currentTime >= overlay.startTime && currentTime < overlay.endTime
  );

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = timelineScrollRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const newTime = x / PIXELS_PER_SECOND;
    setCurrentTime(Math.max(0, Math.min(newTime, totalDuration)));
  };

  const deleteSelectedClip = () => {
    if (selectedClip) {
      setClips(clips.filter(c => c.id !== selectedClip));
      setSelectedClip(null);
    }
  };

  const deleteSelectedTextOverlay = () => {
    if (selectedTextOverlay) {
      setTextOverlays(textOverlays.filter(t => t.id !== selectedTextOverlay));
      setSelectedTextOverlay(null);
    }
  };

  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: `text-new-${Date.now()}`,
      text: 'New Text',
      style: {
        fontFamily: 'Poppins',
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        hasEmoji: false,
        position: 'center',
        alignment: 'center',
      },
      startTime: currentTime,
      endTime: Math.min(currentTime + 3, totalDuration),
      trackIndex: 0,
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setSelectedTextOverlay(newOverlay.id);
    setEditingText(newOverlay);
  };

  const toggleClipMute = (clipId: string) => {
    setClips(clips.map(c =>
      c.id === clipId ? { ...c, muted: !c.muted } : c
    ));
  };

  const handlePreview = () => {
    if (template) {
      const updatedTemplate = {
        ...template,
        timelineData: {
          clips,
          textOverlays,
          globalMuted,
          backgroundMusic,
        },
        isEdit: true, // Mark as completed edit
        isDraft: false, // Clear draft status
        editedAt: new Date().toISOString(),
      };
      localStorage.setItem(`template_${params.id}`, JSON.stringify(updatedTemplate));
    }
    router.push(`/preview/reel/${params.id}`);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate time markers
  const generateTimeMarkers = () => {
    const markers = [];
    const interval = 3; // Every 3 seconds
    for (let t = 0; t <= totalDuration; t += interval) {
      markers.push(t);
    }
    return markers;
  };

  if (loading || !template) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading editor...</p>
        </div>
      </div>
    );
  }

  const currentClip = clips[currentClipIndex];
  const timelineWidth = totalDuration * PIXELS_PER_SECOND;
  const playheadPosition = currentTime * PIXELS_PER_SECOND;

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-white font-semibold text-sm">Edit Video</h1>
        <div className="w-8" />
      </div>

      {/* LARGE Video Preview - Takes most of the screen */}
      <div className="flex-1 flex justify-center items-center px-4 py-2 min-h-0">
        <div className="relative h-full max-h-[65vh] aspect-[9/16] bg-[#1A1A2E] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          {/* Check if current clip has user video */}
          {currentClip?.thumbnail ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${currentClip.thumbnail})` }}
            />
          ) : (
            /* Empty placeholder state */
            <div className="absolute inset-0 bg-gradient-to-b from-[#2D2640] to-[#1A1A2E] flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <Play className="w-10 h-10 text-white/30" />
              </div>
              <p className="text-white/40 text-sm font-medium">Add your video</p>
              <p className="text-white/25 text-xs mt-2 px-6 text-center">
                {currentClip?.locationName || 'Select a clip below'}
              </p>
            </div>
          )}

          {/* Gradient overlay for readability - only when has video */}
          {currentClip?.thumbnail && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          )}

          {/* Text Overlay - Styled like TikTok */}
          {currentClip?.textOverlay && (
            <div
              className={`absolute left-0 right-0 px-4 flex ${
                currentClip.textStyle?.position === 'top' ? 'top-6' :
                currentClip.textStyle?.position === 'center' ? 'top-1/2 -translate-y-1/2' :
                'bottom-16'
              } ${
                currentClip.textStyle?.alignment === 'center' ? 'justify-center' :
                currentClip.textStyle?.alignment === 'right' ? 'justify-end' :
                'justify-start'
              }`}
            >
              <div
                className="px-3 py-2 rounded-lg max-w-[90%]"
                style={{
                  backgroundColor: currentClip.textStyle?.backgroundColor || 'rgba(0,0,0,0.6)',
                }}
              >
                <span
                  style={{
                    fontFamily: currentClip.textStyle?.fontFamily || 'Poppins',
                    fontSize: currentClip.textStyle?.fontSize || 20,
                    fontWeight: currentClip.textStyle?.fontWeight || '600',
                    color: currentClip.textStyle?.color || '#FFFFFF',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {currentClip.textStyle?.hasEmoji && currentClip.textStyle?.emoji &&
                    (currentClip.textStyle?.emojiPosition === 'before' || currentClip.textStyle?.emojiPosition === 'both') && (
                    <span className="mr-1.5">{currentClip.textStyle.emoji}</span>
                  )}
                  {currentClip.textOverlay}
                  {currentClip.textStyle?.hasEmoji && currentClip.textStyle?.emoji &&
                    (currentClip.textStyle?.emojiPosition === 'after' || currentClip.textStyle?.emojiPosition === 'both') && (
                    <span className="ml-1.5">{currentClip.textStyle.emoji}</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Play Button - Always visible for scrubbing */}
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-105">
              {isPlaying ? (
                <Pause className="w-7 h-7 text-white" />
              ) : (
                <Play className="w-7 h-7 text-white ml-1" />
              )}
            </div>
          </button>

          {/* Time Display */}
          <div className="absolute bottom-4 right-4 px-2.5 py-1 bg-black/80 rounded-lg text-xs text-white font-medium">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>

          {/* Current clip color indicator + name */}
          {currentClip && (
            <div
              className="absolute bottom-4 left-4 px-2.5 py-1 rounded-lg text-xs text-white font-medium flex items-center gap-2"
              style={{ backgroundColor: currentClip.color }}
            >
              <span>{currentClip.locationName.slice(0, 15)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Compact Bottom Section - Timeline + Preview */}
      <div className="flex-shrink-0 bg-[#1A1A2E] rounded-t-2xl">
        {/* Mini Timeline - Single scrollable row */}
        <div className="px-3 py-3">
          <div
            ref={timelineScrollRef}
            className="overflow-x-scroll pb-2 -mb-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
              {clips.map((clip, idx) => (
                <button
                  key={clip.id}
                  onClick={() => {
                    setSelectedClip(clip.id);
                    setCurrentClipIndex(idx);
                    setCurrentTime(clip.startTime);
                  }}
                  className={`relative flex-shrink-0 h-16 rounded-xl overflow-hidden transition-all ${
                    selectedClip === clip.id || currentClipIndex === idx
                      ? 'ring-2 ring-white scale-105'
                      : 'opacity-80'
                  }`}
                  style={{
                    width: Math.max(clip.duration * 25, 60),
                    backgroundColor: clip.color,
                  }}
                >
                  {clip.thumbnail && (
                    <div
                      className="absolute inset-0 opacity-50 bg-cover bg-center"
                      style={{ backgroundImage: `url(${clip.thumbnail})` }}
                    />
                  )}
                  <div className="relative h-full flex flex-col justify-end p-2">
                    <span className="text-[9px] text-white font-semibold drop-shadow-lg line-clamp-1">
                      {clip.locationName.slice(0, 12)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor Tabs - Inline */}
        <div className="flex items-center justify-center gap-6 px-3 py-1 border-t border-white/5">
          <button
            onClick={() => setActiveTab('trim')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${activeTab === 'trim' ? 'bg-white/10 text-white' : 'text-white/40'}`}
          >
            <Scissors className="w-4 h-4" />
            <span className="text-[10px]">Trim</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${activeTab === 'text' ? 'bg-white/10 text-white' : 'text-white/40'}`}
          >
            <Type className="w-4 h-4" />
            <span className="text-[10px]">Text</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${activeTab === 'audio' ? 'bg-white/10 text-white' : 'text-white/40'}`}
          >
            <Music className="w-4 h-4" />
            <span className="text-[10px]">Audio</span>
          </button>
        </div>

        {/* Preview Button - Fixed at bottom */}
        <div className="px-4 pb-6 pt-2">
          <button
            onClick={handlePreview}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-full bg-[#8B5CF6] text-white font-semibold"
          >
            <Play className="w-4 h-4" />
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
