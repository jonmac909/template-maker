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
}

const LOCATION_COLORS = ['#8B5CF6', '#14B8A6', '#F472B6', '#FCD34D', '#E879F9', '#A78BFA', '#22D3EE'];

type EditorTab = 'trim' | 'text' | 'audio';

export default function TimelineEditor() {
  const params = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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

      location.scenes.forEach((scene) => {
        const clip: TimelineClip = {
          id: `clip-${location.locationId}-${scene.id}`,
          sceneId: scene.id,
          locationId: location.locationId,
          locationName: location.locationName,
          color,
          startTime: currentStartTime,
          duration: scene.duration,
          videoUrl: scene.userThumbnail ? undefined : undefined, // Will use blob URLs
          thumbnail: scene.userThumbnail || scene.thumbnail,
          textOverlay: scene.textOverlay || undefined,
          textStyle: scene.textStyle,
          muted: false,
        };
        timelineClips.push(clip);

        // Create text overlay if exists
        if (scene.textOverlay) {
          overlays.push({
            id: `text-${location.locationId}-${scene.id}`,
            text: scene.textOverlay,
            style: scene.textStyle || {
              fontFamily: 'Poppins',
              fontSize: 22,
              fontWeight: '700',
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

  // Playback controls
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

  // Find current clip based on playhead position
  useEffect(() => {
    const clipIndex = clips.findIndex(
      clip => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
    );
    if (clipIndex !== -1) {
      setCurrentClipIndex(clipIndex);
    }
  }, [currentTime, clips]);

  // Get current text overlay
  const currentTextOverlay = textOverlays.find(
    overlay => currentTime >= overlay.startTime && currentTime < overlay.endTime
  );

  // Timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * totalDuration;
    setCurrentTime(Math.max(0, Math.min(newTime, totalDuration)));
  };

  // Delete selected clip
  const deleteSelectedClip = () => {
    if (selectedClip) {
      setClips(clips.filter(c => c.id !== selectedClip));
      setSelectedClip(null);
    }
  };

  // Delete selected text overlay
  const deleteSelectedTextOverlay = () => {
    if (selectedTextOverlay) {
      setTextOverlays(textOverlays.filter(t => t.id !== selectedTextOverlay));
      setSelectedTextOverlay(null);
    }
  };

  // Add new text overlay
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

  // Toggle clip mute
  const toggleClipMute = (clipId: string) => {
    setClips(clips.map(c =>
      c.id === clipId ? { ...c, muted: !c.muted } : c
    ));
  };

  // Save and go to preview
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
  const playheadPosition = (currentTime / totalDuration) * 100;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-semibold">Edit Video</h1>
        <div className="w-9" />
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[240px] aspect-[9/16] bg-[#1A1A2E] rounded-2xl overflow-hidden">
          {/* Video/Thumbnail Display */}
          {currentClip?.thumbnail ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${currentClip.thumbnail})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#2D2640] to-[#1A1A2E]" />
          )}

          {/* Text Overlay Display */}
          {currentTextOverlay && (
            <div
              className="absolute left-0 right-0 px-4 text-center"
              style={{
                top: currentTextOverlay.style.position === 'top' ? '10%' :
                     currentTextOverlay.style.position === 'center' ? '50%' : 'auto',
                bottom: currentTextOverlay.style.position === 'bottom' ? '15%' : 'auto',
                transform: currentTextOverlay.style.position === 'center' ? 'translateY(-50%)' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: currentTextOverlay.style.fontFamily,
                  fontSize: currentTextOverlay.style.fontSize * 0.7,
                  fontWeight: currentTextOverlay.style.fontWeight,
                  color: currentTextOverlay.style.color,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                }}
              >
                {currentTextOverlay.style.hasEmoji && currentTextOverlay.style.emoji &&
                 (currentTextOverlay.style.emojiPosition === 'before' || currentTextOverlay.style.emojiPosition === 'both') && (
                  <span className="mr-1">{currentTextOverlay.style.emoji}</span>
                )}
                {currentTextOverlay.text}
                {currentTextOverlay.style.hasEmoji && currentTextOverlay.style.emoji &&
                 (currentTextOverlay.style.emojiPosition === 'after' || currentTextOverlay.style.emojiPosition === 'both') && (
                  <span className="ml-1">{currentTextOverlay.style.emoji}</span>
                )}
              </span>
            </div>
          )}

          {/* Play Button Overlay */}
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center bg-black/20"
          >
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-1" />
              )}
            </div>
          </button>

          {/* Time Display */}
          <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded text-xs text-white">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>

      {/* Editor Tabs */}
      <div className="flex justify-center gap-8 py-3 border-t border-white/10">
        <button
          onClick={() => setActiveTab('trim')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'trim' ? 'text-white' : 'text-white/40'}`}
        >
          <Scissors className="w-5 h-5" />
          <span className="text-xs">Trim</span>
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'text' ? 'text-white' : 'text-white/40'}`}
        >
          <Type className="w-5 h-5" />
          <span className="text-xs">Text</span>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'audio' ? 'text-white' : 'text-white/40'}`}
        >
          <Music className="w-5 h-5" />
          <span className="text-xs">Audio</span>
        </button>
      </div>

      {/* Timeline Section */}
      <div className="bg-[#1A1A2E] rounded-t-3xl px-4 pt-4 pb-6">
        {/* Timeline Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/50">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
          <div className="flex gap-2">
            {selectedClip && (
              <button
                onClick={deleteSelectedClip}
                className="p-2 rounded-lg bg-red-500/20 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {selectedTextOverlay && (
              <button
                onClick={deleteSelectedTextOverlay}
                className="p-2 rounded-lg bg-red-500/20 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {activeTab === 'text' && (
              <button
                onClick={addTextOverlay}
                className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-xs"
              >
                + Add Text
              </button>
            )}
          </div>
        </div>

        {/* Video Track Timeline */}
        <div
          ref={timelineRef}
          className="relative h-12 bg-[#2D2640] rounded-lg mb-2 overflow-hidden cursor-pointer"
          onClick={handleTimelineClick}
        >
          {/* Clips */}
          <div className="absolute inset-0 flex">
            {clips.map((clip) => {
              const width = (clip.duration / totalDuration) * 100;
              const left = (clip.startTime / totalDuration) * 100;
              return (
                <div
                  key={clip.id}
                  className={`absolute h-full rounded transition-all ${
                    selectedClip === clip.id ? 'ring-2 ring-white' : ''
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: clip.color,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClip(clip.id);
                    setSelectedTextOverlay(null);
                  }}
                >
                  {/* Clip thumbnail preview */}
                  {clip.thumbnail && (
                    <div
                      className="absolute inset-0 opacity-60 bg-cover bg-center"
                      style={{ backgroundImage: `url(${clip.thumbnail})` }}
                    />
                  )}
                  {/* Mute indicator */}
                  {clip.muted && (
                    <div className="absolute top-1 right-1">
                      <VolumeX className="w-3 h-3 text-white/80" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
            style={{ left: `${playheadPosition}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full" />
          </div>
        </div>

        {/* Text Track */}
        <div className="relative h-8 bg-[#2D2640]/50 rounded-lg mb-4 overflow-hidden">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 px-2">
            <Type className="w-3 h-3 text-white/30" />
          </div>

          {/* Text Overlays on Timeline */}
          {textOverlays.map((overlay) => {
            const width = ((overlay.endTime - overlay.startTime) / totalDuration) * 100;
            const left = (overlay.startTime / totalDuration) * 100;
            return (
              <div
                key={overlay.id}
                className={`absolute h-6 top-1 rounded cursor-pointer flex items-center px-2 ${
                  selectedTextOverlay === overlay.id
                    ? 'bg-[#8B5CF6] ring-2 ring-white'
                    : 'bg-[#8B5CF6]/60'
                }`}
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 5)}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTextOverlay(overlay.id);
                  setSelectedClip(null);
                  if (activeTab === 'text') {
                    setEditingText(overlay);
                  }
                }}
              >
                <span className="text-[10px] text-white truncate">{overlay.text}</span>
                <GripHorizontal className="w-3 h-3 text-white/50 ml-auto flex-shrink-0" />
              </div>
            );
          })}

          {/* Playhead for text track */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10"
            style={{ left: `${playheadPosition}%` }}
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'trim' && selectedClip && (
          <div className="bg-[#2D2640] rounded-xl p-3 mb-4">
            <p className="text-xs text-white/50 mb-2">Selected: {clips.find(c => c.id === selectedClip)?.locationName}</p>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-lg bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs">
                Split at Playhead
              </button>
              <button
                onClick={() => toggleClipMute(selectedClip)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs flex items-center gap-1"
              >
                {clips.find(c => c.id === selectedClip)?.muted ? (
                  <>
                    <VolumeX className="w-3 h-3" /> Unmute
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" /> Mute
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'text' && editingText && (
          <div className="bg-[#2D2640] rounded-xl p-3 mb-4">
            <input
              type="text"
              value={editingText.text}
              onChange={(e) => {
                const updated = { ...editingText, text: e.target.value };
                setEditingText(updated);
                setTextOverlays(textOverlays.map(t => t.id === editingText.id ? updated : t));
              }}
              className="w-full bg-[#1A1A2E] rounded-lg px-3 py-2 text-sm text-white mb-2 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
            <div className="flex gap-2">
              {['top', 'center', 'bottom'].map(pos => (
                <button
                  key={pos}
                  onClick={() => {
                    const updated = {
                      ...editingText,
                      style: { ...editingText.style, position: pos as 'top' | 'center' | 'bottom' }
                    };
                    setEditingText(updated);
                    setTextOverlays(textOverlays.map(t => t.id === editingText.id ? updated : t));
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs capitalize ${
                    editingText.style.position === pos
                      ? 'bg-[#8B5CF6] text-white'
                      : 'bg-[#1A1A2E] text-white/60'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="bg-[#2D2640] rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/70">Original Audio</span>
              <button
                onClick={() => setGlobalMuted(!globalMuted)}
                className={`px-3 py-1.5 rounded-lg text-xs ${
                  globalMuted ? 'bg-red-500/20 text-red-400' : 'bg-[#8B5CF6]/20 text-[#8B5CF6]'
                }`}
              >
                {globalMuted ? 'Muted' : 'On'}
              </button>
            </div>
            <div className="border-t border-white/10 pt-3">
              <span className="text-xs text-white/50">Background Music</span>
              <p className="text-xs text-white/30 mt-1">Coming soon - Add music from library</p>
            </div>
          </div>
        )}

        {/* Preview Button */}
        <button
          onClick={handlePreview}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] text-white font-semibold"
        >
          <Play className="w-4 h-4" />
          Preview
        </button>
      </div>
    </div>
  );
}
